/**
 * After izole-dhr-seed.cjs dumps %TEMP%/izole_ocak_period.json, fill DHR
 * columns, recompute Δ DHR−YZ (±0,01 pass) and matrix whichCorrect fields.
 */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "src", "data");
const DUMP = path.join(process.env.TEMP, "izole_ocak_period.json");
const roster = JSON.parse(fs.readFileSync(path.join(DATA, "izole_roster.json"), "utf8"));
const cmp = JSON.parse(fs.readFileSync(path.join(DATA, "izole_comparison.json"), "utf8"));
const mtx = JSON.parse(fs.readFileSync(path.join(DATA, "izole_matrix.json"), "utf8"));

const PAY = {
  salary: ["Temel Maaş"],
  meal: ["Yemek Yardımı"],
  transport: ["Yol Yardımı"],
  overtime: ["Fazla Mesai", "Net Fazla Mesai"],
  prim: ["Prim"],
  ikramiye: ["İkramiye"],
  masraf: ["Masraf"],
  kesinti: ["Genel Kesinti", "İcra"],
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

const ADA_NET = 48052.89;
const MEAL_PACK =
  "DHR net Serra/Ada ile aynı zeminde (48.052,89). YZ aylık izole 46.784,70. Fark yemek GV/damga paketlemesi; Luca bu birimde yok.";

function hakem(p, dhr, ai) {
  if (!dhr || dhr.net == null) {
    return { dhr: "pending", whichCorrect: "", legalBasis: "", verdict: `Tek değişken: ${p.scenario}. DHR henüz hesaplanmadı.` };
  }
  const netOk = pass(dhr.net, ai?.net);
  if (netOk) {
    return {
      dhr: "pass",
      whichCorrect: "YZ ve DHR aynı (±0,01)",
      legalBasis: "Ocak 2026 GVK 23/18 istisna 4.211,33; 5510 %14; 4447 %1; 488 ‰7,59.",
      verdict: `Tek değişken ${p.scenario}: DHR net ${dhr.net} = YZ ${ai.net} (±0,01).`,
    };
  }
  if (p.tax === "4691" && nz(dhr.gv) <= 0.01) {
    return {
      dhr: "pass",
      whichCorrect: "DHR",
      legalBasis: "4691 sayılı Teknoloji Geliştirme Bölgeleri Kanunu — GV/damga terkini.",
      verdict: `Tek değişken ${p.scenario}: 4691 terkin DHR’de işliyor (GV ${dhr.gv}, damga ${dhr.damga}, net ${dhr.net}). YZ terkin modellemez.`,
    };
  }
  if (p.seedFlags?.priorTaxFilled && nz(dhr.gv) > 4000) {
    return {
      dhr: "fail",
      whichCorrect: "DHR",
      legalBasis: "GVK md. 103 kümülatif tarife; karttaki 185.000 aynı yıl YTD’sidir. YZ aylık izole.",
      verdict: `Tek değişken kümülatif GV: DHR GV ${dhr.gv} / net ${dhr.net}. YZ 185k taşımıyor.`,
    };
  }
  const parts = [];
  if (p.overtimeGrossHours && nz(dhr.overtime) <= 0.01) {
    parts.push("FM talebi 08:00–11:00 çalışma saatine denk; puantaj totalHours=0");
  }
  if (p.seedFlags?.disabilityDegree && pass(dhr.net, ADA_NET)) {
    parts.push(`engellilik ${p.seedFlags.disabilityDegree}. derece kartta yazılmadı (Employee.disabilityDegree null)`);
  }
  if (Math.abs(nz(dhr.prim) - nz(p.prim)) > 0.01 && p.prim) parts.push("prim bordroya yazılmadı (DHR-PPV-DROP)");
  if (Math.abs(nz(dhr.ikramiye) - nz(p.ikramiye)) > 0.01 && p.ikramiye) parts.push("ikramiye bordroya yazılmadı (DHR-PPV-DROP)");
  if (Math.abs(nz(dhr.masraf) - nz(p.masraf)) > 0.01 && p.masraf) parts.push("masraf bordroya yazılmadı (DHR-PPV-DROP)");
  if (Math.abs(nz(dhr.kesinti) - nz(p.kesinti)) > 0.01 && p.kesinti) parts.push("kesinti bordroya yazılmadı (DHR-PPV-DROP)");
  if (Math.abs(nz(dhr.advance) - nz(p.avans)) > 0.01 && p.avans) parts.push("avans mahsubu yok (F1-AVANS)");
  if (p.law && String(p.law).startsWith("05510") && pass(dhr.net, ADA_NET)) {
    parts.push("05510 işçi netini değiştirmiyor (işveren SGK teşviki); kalan Δ yemek paket farkı");
  }
  if (p.law && String(p.law).startsWith("5746") && pass(dhr.net, ADA_NET)) {
    parts.push("5746 işçi neti baseline; damga/GV terkini DHR’de yok (DHR-5746-TERKIN)");
  }
  if (p.sicil === "6201" || (pass(dhr.net, ADA_NET) && !parts.length)) {
    parts.push(MEAL_PACK);
  }
  if (Math.abs(nz(dhr.gvExemptApplied) - 4211.33) > 0.05 && !p.seedFlags?.stajyer && nz(dhr.gv) > 0.01) {
    parts.push(`GV istisnası ${dhr.gvExemptApplied} (yasal Ocak 4.211,33)`);
  }
  const drop = parts.some((x) => /PPV-DROP|avans|F1-AVANS|totalHours/i.test(x));
  const meal = parts.some((x) => /yemek|488/i.test(x));
  return {
    dhr: "fail",
    whichCorrect: drop ? "YZ" : meal ? "Luca — nakit yemek damga matrahında değil (488). Luca PDF bu birimde yok; YZ hakem." : "karar bekliyor",
    legalBasis: drop
      ? "Tek seferlik kalem / avans / FM bordroya yansımalı."
      : meal
        ? "488 sayılı Damga Vergisi Kanunu; GVK md. 23 nakit yemek. Luca referans, doğru kabul edilmez."
        : "Sapma YZ (2026 GVK/5510/488) ile ±0,01 dışında. Luca bu birimde yok.",
    verdict: `Tek değişken ${p.scenario}: DHR net ${dhr.net} / YZ ${ai?.net} (Δ ${r2(nz(dhr.net) - nz(ai?.net))}). ${parts.join(" · ")}`,
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
cmp.sources.dhrExcel = `DHR bordro UI/API — Tek Değişken Ocak 2026 /api/PayrollPeriod dump · ${filled}/27 hesaplandı`;
cmp.ui.lead = `27 kişi, her satırda Serra zemininden yalnız bir sapma. DHR ${filled}/27 hesaplandı. Luca PDF bekliyor; hakem YZ. Geçme ±0,01 TL.`;
cmp.ui.verdict = `Tek Değişken Ocak 2026: DHR ${filled}/27. Ort. |ΔNet DHR−YZ| ${cmp.summary.avgAbsNetDeltaAi ?? "—"} TL. Luca yok.`;
cmp.ui.personCaption = "Çalışan seç → DHR hesaplanan bordro ve YZ mevzuat neti; Luca bekliyor.";

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
      result: filled === 27 ? "pass" : "fail",
      note: `${filled}/27 kişi hesaplandı. YZ net ±0,01: ${passN}/${filled}. Hakem pass (4691 terkin vb.): ${hakemPass}/27.`,
    };
  }
  if (c.item === "Luca PDF") {
    return { ...c, result: "pending", note: "Bu birim için Luca çıktısı yok." };
  }
  return c;
});
mtx.dhrBugs = [
  {
    id: "IZ-FM-SAAT",
    title: "FM 08:00–11:00 çalışma saatine yazılıyor, bordro saati 0",
    severity: "Orta",
    detail: "Tolga 6219: 4×3s onaylı talep var, puantaj totalHours=0 çünkü aralık mesai değil iş günü. Akşam 18–21 günlük tavanı 3s dolduruyor.",
  },
  {
    id: "IZ-ENGEL-PUT",
    title: "Engellilik derecesi Employee PUT ile yazılmıyor",
    severity: "Orta",
    detail: "Kaan/Leman/Mert disabilityDegree GET’te null kalıyor; İK Ersin’de 1. Kart alanı API DTO’da var ama PUT yok sayıyor. Net Ada baseline.",
  },
  {
    id: "IZ-AVANS",
    title: "Avans mahsubu bordroya yazılmıyor",
    severity: "Yüksek",
    detail: "Umay 6220 avans 7.200 kaydı var, net Ada ile aynı (F1-AVANS).",
  },
];
if (withDhr.some((r) => nz(r.dhr.prim) === 0 && bySicil[roster.people.find((p) => p.name === r.name)?.sicil || ""]?.prim)) {
  mtx.dhrBugs.unshift({
    id: "DHR-PPV-DROP",
    title: "Tam hesaplama tek seferlik kalemleri bordroya yazmıyor",
    severity: "Yüksek",
    detail: "Tek Değişken Ocak’ta prim/ikramiye/masraf/kesinti PaymentValue’da duruyor, hesap sonrası 0 olabiliyor.",
  });
}
mtx.correctFindings = [
  "Ada Korkmaz net 48.052,89 = İK Serra Ocak DHR (tam ay, yemek 5.500).",
  "Hakan/Isik 4691: GV 0, net 50.841,40 — teknopark ataması isciTuru=1/2 ile terkin işliyor.",
  "Seda asgari net 30.010,47 = İK Selin Ocak DHR.",
  "Defne net ücret, Jale SGDP, Nazli kısmi, Oya stajyer, Volkan prim, Yelda ikramiye, Zafer kesinti, Asya masraf, Bora BES, Cemil 185k — her biri Ada’dan ayrı net.",
];
mtx.warnings = [
  {
    id: "IZ-05510",
    title: "05510 işçi netini değiştirmiyor",
    detail: "Berk %2 / Canan %5 neti Ada ile aynı; teşvik işveren SGK tarafında.",
    severity: "info",
  },
];

const dashPath = path.join(DATA, "dashboard.json");
const dash = JSON.parse(fs.readFileSync(dashPath, "utf8"));
const izolePeriod = dash.periods.find((p) => p.id === "izole");
if (izolePeriod) {
  izolePeriod.state = `Hesaplandı · DHR ${filled}/27 · hakem pass ${hakemPass} · YZ net ±0,01 ${passN} · Luca PDF bekliyor`;
  izolePeriod.compare = "DHR × YZ";
}
dash.generatedAt = new Date().toISOString();
fs.writeFileSync(dashPath, JSON.stringify(dash, null, 2) + "\n");

mtx.sourceOfTruth = `YZ = 2026 TR mevzuatı hakem. Luca referans (PDF yok). DHR UI/API dump ${filled}/27. Geçme ±0,01 TL.`;

fs.writeFileSync(path.join(DATA, "izole_comparison.json"), JSON.stringify(cmp, null, 2) + "\n");
fs.writeFileSync(path.join(DATA, "izole_matrix.json"), JSON.stringify(mtx, null, 2) + "\n");
console.log("filled", filled, "pass±0.01", passN, "bugs", mtx.dhrBugs.length);
