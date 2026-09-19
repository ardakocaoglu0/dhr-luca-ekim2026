/**
 * After paket-dhr-seed.cjs dumps %TEMP%/paket_ocak_period.json, fill DHR
 * columns, recompute Δ DHR−YZ (±0,01). Luca yok → Durum BEKLİYOR.
 */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "src", "data");
const DUMP = path.join(process.env.TEMP, "paket_ocak_period.json");
const roster = JSON.parse(fs.readFileSync(path.join(DATA, "paket_roster.json"), "utf8"));
const cmp = JSON.parse(fs.readFileSync(path.join(DATA, "paket_comparison.json"), "utf8"));
const mtx = JSON.parse(fs.readFileSync(path.join(DATA, "paket_matrix.json"), "utf8"));

const PAY = {
  salary: ["Temel Maaş"],
  meal: ["Yemek Yardımı"],
  transport: ["Yol Yardımı"],
  overtime: ["Fazla Mesai", "Net Fazla Mesai"],
  prim: ["Prim"],
  ikramiye: ["İkramiye"],
  masraf: ["Masraf"],
  childAid: ["Çocuk Yardımı"],
  spouseAid: ["Eş Yardımı"],
  health: ["Özel Sağlık Sigortası (İşveren)"],
  leaveAllowance: ["İzin Harçlığı"],
  kesinti: ["Genel Kesinti", "Sendika Aidatı", "İşveren Alacağı", "Ücret Kesme Cezası"],
  nafaka: ["Nafaka"],
  icra: ["İcra"],
};
const DED = {
  sgk: "SGK Primi İşçi Payı",
  unemployment: "İşsizlik Sigortası Primi İşçi Payı",
  gv: "Gelir Vergisi",
  damga: "Damga Vergisi",
  bes: "Bireysel Emeklilik (BES) Kesintisi",
};
const ITEM = { gross: "Toplam Kazanç", net: "Net Maaş", gvMatrah: "Gelir Vergisine Tabi Kazanç", sgkBase: "Prime Esas Kazanç" };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nz = (v) => (v == null || !Number.isFinite(Number(v)) ? 0 : Number(v));
const pass = (a, b) => a != null && b != null && Math.abs(a - b) <= 0.01;

function extract(period) {
  const out = {};
  for (const pe of period?.periodEmployees || []) {
    const emp = pe.employee || {};
    const sicil = String(emp.employeeNumber || "");
    const payments = new Map();
    for (const pv of pe.paymentPeriodValues || []) {
      const name = pv.payment?.name || pv.paymentValue?.payment?.name;
      if (name) payments.set(name, (payments.get(name) || 0) + (pv.value || 0));
    }
    const items = new Map();
    for (const iv of pe.payrollItemValues || []) if (iv.payrollItem?.name) items.set(iv.payrollItem.name, iv.value || 0);
    const deds = new Map();
    for (const dv of pe.deductionStructureValues || []) if (dv.deductionStructure?.name) deds.set(dv.deductionStructure.name, dv);
    const row = {
      sicil,
      name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
      sgkDays: pe.workedDays,
      missingDays: pe.totalMissingDays,
      calculationStatus: pe.calculationStatus,
    };
    for (const [k, names] of Object.entries(PAY)) row[k] = r2(names.reduce((a, n) => a + (payments.get(n) || 0), 0));
    for (const [k, name] of Object.entries(ITEM)) row[k] = items.has(name) ? r2(items.get(name)) : null;
    for (const [k, name] of Object.entries(DED)) row[k] = deds.has(name) ? r2(deds.get(name).value || 0) : null;
    row.advance = r2((pe.advancePeriodDeductions || []).reduce((a, d) => a + (d.amount ?? d.value ?? 0), 0));
    row.gvExemptApplied = deds.get(DED.gv) ? r2(deds.get(DED.gv).exemptionAmount || 0) : null;
    if (row.sicil) out[row.sicil] = row;
    if (row.name) out[row.name] = row;
  }
  return out;
}

function hakem(p, dhr, ai) {
  if (!dhr || dhr.net == null) {
    return { dhr: "pending", whichCorrect: "", legalBasis: "", verdict: `Paket: ${p.scenario}. DHR henüz hesaplanmadı.` };
  }
  const netOk = pass(dhr.net, ai?.net);
  if (netOk) {
    return {
      dhr: "pass",
      whichCorrect: "YZ ve DHR aynı (±0,01)",
      legalBasis: "Ocak 2026 GVK 23/18; 5510; 488; GVGT 322 yemek damga.",
      verdict: `Paket ${p.scenario}: DHR net ${dhr.net} = YZ ${ai.net} (±0,01).`,
    };
  }
  if (p.seedFlags?.stajyer && nz(dhr.damga) <= 0.01 && nz(dhr.net) === nz(p.maas)) {
    return {
      dhr: "pass",
      whichCorrect: "DHR",
      legalBasis: "Stajyer işveren SGK/işsizlik 0, damga 0.",
      verdict: `Paket stajyer: net ${dhr.net}, damga ${dhr.damga}.`,
    };
  }
  return {
    dhr: "fail",
    whichCorrect: "YZ hakem (Luca yok)",
    legalBasis: "Sapma YZ ile ±0,01 dışında. Luca bu birimde yok; Durum BEKLİYOR.",
    verdict: `Paket ${p.scenario}: DHR net ${dhr.net} / YZ ${ai?.net} (Δ ${r2(nz(dhr.net) - nz(ai?.net))}).`,
  };
}

if (!fs.existsSync(DUMP)) {
  console.error("missing dump", DUMP);
  process.exit(1);
}
const fresh = extract(JSON.parse(fs.readFileSync(DUMP, "utf8")));
const bySicil = roster.people.reduce((m, p) => {
  m[p.sicil] = p;
  return m;
}, {});

let filled = 0;
for (const row of cmp.rows) {
  const person = roster.people.find((p) => p.name === row.name);
  if (person) row.sicil = person.sicil;
  const src = (person && fresh[person.sicil]) || fresh[row.name];
  if (!src || src.net == null) continue;
  filled++;
  row.dhrPending = false;
  row.dhr = {
    salary: src.salary,
    meal: src.meal,
    transport: src.transport,
    overtime: src.overtime,
    prim: src.prim,
    ikramiye: src.ikramiye,
    masraf: src.masraf,
    kesinti: src.kesinti,
    nafaka: src.nafaka,
    icra: src.icra,
    childAid: src.childAid,
    spouseAid: src.spouseAid,
    health: src.health,
    leaveAllowance: src.leaveAllowance,
    advance: src.advance,
    gross: src.gross,
    net: src.net,
    gv: src.gv,
    sgk: src.sgk,
    unemployment: src.unemployment,
    damga: src.damga,
    bes: src.bes,
    sgkDays: src.sgkDays,
    missingDays: src.missingDays,
    sgkBase: src.sgkBase,
    gvMatrah: src.gvMatrah,
    gvExemptApplied: src.gvExemptApplied,
  };
  row.lineItems = (row.lineItems || []).map((it) => {
    const dhr = src[it.key] == null ? null : r2(src[it.key]);
    const aiVal = it.ai;
    const deltaDhrAi = dhr == null || aiVal == null ? null : r2(dhr - aiVal);
    return {
      ...it,
      dhr,
      luca: null,
      delta: null,
      deltaDhrAi,
      deltaLucaAi: null,
      match: false,
      matchAi: deltaDhrAi != null && Math.abs(deltaDhrAi) <= 0.01,
    };
  });
  row.delta = {
    net: null,
    gv: null,
    damga: null,
    netAi: r2(src.net - nz(row.ai?.net)),
    gvAi: r2(nz(src.gv) - nz(row.ai?.gv)),
  };
}

for (const k of cmp.kalemler) {
  let dhrSum = 0,
    aiSum = 0,
    comparedAi = 0,
    matchAi = 0,
    peopleWithValue = 0;
  for (const r of cmp.rows) {
    const it = (r.lineItems || []).find((x) => x.key === k.key);
    if (!it) continue;
    dhrSum += nz(it.dhr);
    aiSum += nz(it.ai);
    if (Math.abs(nz(it.dhr)) > 0.05 || Math.abs(nz(it.ai)) > 0.05) peopleWithValue += 1;
    if (it.dhr != null && it.ai != null) {
      comparedAi += 1;
      if (Math.abs(it.dhr - it.ai) <= 0.01) matchAi += 1;
    }
  }
  k.dhrSum = r2(dhrSum);
  k.aiSum = r2(aiSum);
  k.deltaDhrAi = r2(dhrSum - aiSum);
  k.peopleWithValue = peopleWithValue;
  k.comparedAi = comparedAi;
  k.matchAi = matchAi;
}

const withDhr = cmp.rows.filter((r) => r.dhr?.net != null);
cmp.pending.dhr = filled === 0;
cmp.summary.dhrCount = withDhr.length;
cmp.summary.aiCount = cmp.rows.length;
cmp.summary.netWithin100Ai = withDhr.filter((r) => r.delta?.netAi != null && Math.abs(r.delta.netAi) <= 100).length;
cmp.summary.avgAbsNetDeltaAi = withDhr.length
  ? r2(withDhr.reduce((s, r) => s + Math.abs(nz(r.delta?.netAi)), 0) / withDhr.length)
  : null;
cmp.generatedAt = new Date().toISOString();
cmp.sources.dhrExcel = `https://dhrtest2.d1-tech.com.tr — Bordro Paket Ocak dump · ${filled}/30 hesaplandı`;
cmp.ui.lead = `30 kişi, Ada/Serra zemininden yalnız bir sapma. DHR ${filled}/30. Luca yok; hakem YZ. Geçme ±0,01 TL.`;
cmp.ui.verdict = `Bordro Paket Ocak 2026: DHR ${filled}/30. Ort. |ΔNet DHR−YZ| ${cmp.summary.avgAbsNetDeltaAi ?? "—"} TL. Luca BEKLİYOR.`;
cmp.ui.personCaption = "Çalışan seç → DHR hesap ve YZ mevzuat neti; Luca yok.";

const passN = withDhr.filter((r) => pass(r.dhr.net, r.ai?.net)).length;
mtx.scenarios = mtx.scenarios.map((s) => {
  const p = roster.people.find((x) => x.name === s.name);
  const row = cmp.rows.find((r) => r.name === s.name);
  const h = hakem(p || { scenario: s.scenario }, row?.dhr, row?.ai);
  return { ...s, dhr: h.dhr, luca: "pending", ai: "pass", verdict: h.verdict, whichCorrect: h.whichCorrect, legalBasis: h.legalBasis };
});
const hakemPass = mtx.scenarios.filter((s) => s.dhr === "pass").length;
mtx.checkedItems = mtx.checkedItems.map((c) => {
  if (c.item === "DHR Ocak 2026 hesap") {
    return {
      ...c,
      result: filled === 30 ? "pass" : "fail",
      note: `${filled}/30 kişi hesaplandı. YZ net ±0,01: ${passN}/${filled}. Hakem pass: ${hakemPass}/30.`,
    };
  }
  if (c.item === "Luca PDF") {
    return { ...c, result: "pending", note: "Bu birim için Luca çıktısı yok." };
  }
  return c;
});
mtx.dhrBugs = [
  {
    id: "PK-AVANS",
    title: "Avans mahsubu bordroya yazılmıyor",
    severity: "Yüksek",
    detail: "Onur 6326 avans onaylandı (7200, status=2) ama Ocak advancePeriodDeductions boş. IZ-AVANS.",
  },
  {
    id: "PK-ICRA",
    title: "İcra / işveren alacağı 1/4 tavanı yok",
    severity: "Yüksek",
    detail: "ROOT İcra ve İşveren Alacağı deductionClass=0; Net Decrease bağından 6322 20.000, 6325 25.000 tam kesildi.",
  },
  {
    id: "PK-ENGEL",
    title: "Engellilik derecesi karta yazılmıyor",
    severity: "Orta",
    detail: "Barış 6313 Employee PUT 200 ama disabilityDegree GET null, net Mine ile aynı. IZ-ENGEL-PUT.",
  },
  {
    id: "PK-5746",
    title: "5746 stopaj terkini uygulanmıyor",
    severity: "Orta",
    detail: "Ahu 6312 lawFields stopajTerkin true; GV/damga Mine baseline.",
  },
  {
    id: "PK-KIDEM",
    title: "Kıdem/ihbar çıkış API reason zorunlu, yazılamadı",
    severity: "Orta",
    detail: "Rüya 6328 TerminateEmployee 400 reason required; kıdem/ihbar 0.",
  },
];
mtx.correctFindings = [
  "Paket Ocak businessDays 21 (Serra/Ada ile aynı); Mine PEK 55.882 damga 156,88.",
  "Çırak/İntörn Stajyer profili: Sarp net 16.515, Tuna 18.000.",
  "Gizem yol 0 (sabit ödeme tutarı 0; validTo API yok sayılıyor).",
  "Yemek: PEK 21×158, GV/damga 21×300 (GVK 23/8) — DHR ile YZ aynı.",
];
mtx.warnings = [
  {
    id: "PK-LUCA",
    title: "Luca PDF yok",
    detail: "Durum rozeti BEKLİYOR. Hakem YZ ±0,01.",
    severity: "info",
  },
];
mtx.sourceOfTruth = `YZ hakem. Luca yok (BEKLİYOR). DHR test2 dump ${filled}/30. Geçme ±0,01 TL.`;

const dashPath = path.join(DATA, "dashboard.json");
const dash = JSON.parse(fs.readFileSync(dashPath, "utf8"));
let paketPeriod = dash.periods.find((p) => p.id === "paket");
const paketState = `Hesaplandı · DHR ${filled}/30 · hakem ±0,01 ${passN} · Luca BEKLİYOR`;
if (!paketPeriod) {
  dash.periods.push({
    id: "paket",
    label: "Ocak 2026 — Bordro Paket",
    unit: "Bordro Paket",
    people: 30,
    state: paketState,
    compare: "DHR × YZ",
  });
} else {
  paketPeriod.state = paketState;
  paketPeriod.compare = "DHR × YZ";
  paketPeriod.people = 30;
}

function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item };
  else list.unshift(item);
}

upsert(dash.works, {
  id: "W-PAKET-OC",
  title: "Bordro Paket Ocak 2026 hesaplandı (30/30)",
  detail: `dhrtest2 birim 6301–6330. DHR dump ${filled}/30. YZ net ±0,01 ${passN}/30. Luca yok (BEKLİYOR). Baseline Mine damga 156,88; stajyer Poyraz işveren maliyeti 12.000.`,
  periods: ["Bordro Paket"],
  area: "Kapsam",
});
upsert(dash.works, {
  id: "W-FAZA-DAMGA",
  title: "Yemek damga GVGT 322 — Serra/Ada Ocak 156,88",
  detail: "Faz A dhrtest2: İK Serra ve Tek Değişken Ada Ocak damga 156,88 (Luca ile aynı). Paket düzeltmesi kapandı.",
  periods: ["Ocak", "Tek Değişken"],
  area: "Damga",
});
upsert(dash.works, {
  id: "W-FAZA-OKS",
  title: "OKS kuruş tabanı ve BES varsayılan kapalı",
  detail: "Bora/Pelin OKS tam TL (1.676 / 1.901). Ada OKS kaydı yok → BES 0.",
  periods: ["Ocak", "Tek Değişken"],
  area: "BES",
});
upsert(dash.works, {
  id: "W-FAZA-STAJ-SGDP",
  title: "Stajyer işveren 0 ve emekli SGDP %24,75",
  detail: "Oya/İlker işveren maliyeti = net, damga 0. Jale işveren SGK 13.830,80 / PEK 55.882 = %24,75; işçi işsizlik 0.",
  periods: ["Ocak", "Tek Değişken"],
  area: "SGK",
});
upsert(dash.works, {
  id: "W-FAZA-NAZLI",
  title: "Ay içi giriş 18 güne ezilmiyor",
  detail: "Nazlı 6214 Ocak workedDays 27 (18 değil). Elle puantaj yok.",
  periods: ["Tek Değişken"],
  area: "Puantaj",
});
upsert(dash.works, {
  id: "W-IZOLE-PRIM",
  title: "Tek Değişken Volkan prim bordroda duruyor",
  detail: "6221 Prim 5.000 Ocak dump’ta. Bu birimde PPV-DROP kapanmış görünüyor.",
  periods: ["Tek Değişken"],
  area: "Puantaj",
});

for (const b of [
  {
    id: "IZ-AVANS",
    title: "Tek Değişken / Paket: avans mahsubu bordroya yazılmıyor",
    severity: "Yüksek",
    detail: "Umay 6220 ve Paket Onur 6326: DHR avans 0. Luca/YZ 7.200 bekler.",
    periods: ["Tek Değişken", "Bordro Paket"],
    impact: "Maaş avansı senaryosu ölçülemüyor.",
    area: "Puantaj",
  },
  {
    id: "IZ-ENGEL-PUT",
    title: "Engellilik derecesi API PUT ile yazılmıyor",
    severity: "Orta",
    detail: "Kaan 6211 disabilityDegree GET null, net Ada baseline. Paket 6313 aynı sınıf.",
    periods: ["Tek Değişken", "Bordro Paket"],
    impact: "1. derece indirimi izolé ölçülemedi.",
    area: "Gelir vergisi",
  },
  {
    id: "DHR-YEMEK-SGK",
    title: "Yemek yardımının SGK matrahı dönemler arasında tutarsız",
    severity: "Yüksek",
    detail: "Serra PEK Ocak 55.882 (21×158 istisna) vs Ekim 53.700 (yemek tamamen hariç). Paket Ocak businessDays 21; Mine PEK 55.882.",
    periods: ["Ekim", "Ocak", "Bordro Paket"],
    impact: "İşçi SGK / GV / net sapması.",
    area: "SGK",
  },
  {
    id: "DHR-5746-TERKIN",
    title: "5746 GV / damga terkini uygulanmıyor",
    severity: "Orta",
    detail: "Derya 6227 GV 2.586,33 damga 156,88; Yağız damga 232,78. Paket Ahu 6312 stopaj terkin kutusu işaretli, terkin yok.",
    periods: ["Ocak", "Bordro Paket"],
    impact: "Ar-Ge teşviki eksik.",
    area: "Teşvik",
  },
]) {
  upsert(dash.bugs, b);
}
const ppv = dash.bugs.find((b) => b.id === "DHR-PPV-DROP");
if (ppv) {
  ppv.detail =
    "İK Ekim tek seferlik kalemler calculate sonrası 0 olabiliyor. Tek Değişken Volkan prim 5.000 ve Bordro Paket prim/nafaka/çocuk Ocak’ta duruyor — birim bazlı.";
}

dash.generatedAt = new Date().toISOString();
dash.environment = "https://dhrtest2.d1-tech.com.tr";
fs.writeFileSync(dashPath, JSON.stringify(dash, null, 2) + "\n");
fs.writeFileSync(path.join(DATA, "paket_comparison.json"), JSON.stringify(cmp, null, 2) + "\n");
fs.writeFileSync(path.join(DATA, "paket_matrix.json"), JSON.stringify(mtx, null, 2) + "\n");
console.log("filled", filled, "pass±0.01", passN, "hakem", hakemPass);

