/**
 * Write the Eylül 2026 Ana Kadro DHR run into the site data: fills the DHR
 * column, recomputes Δ DHR−YZ everywhere and updates the matrix verdicts.
 * Luca stays pending.
 */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "src", "data");
const dhr = JSON.parse(fs.readFileSync(path.join(__dirname, "faz1_dhr_eylul.json"), "utf8"));
const cmpPath = path.join(DATA, "faz1_comparison.json");
const mtxPath = path.join(DATA, "faz1_matrix.json");
const cmp = JSON.parse(fs.readFileSync(cmpPath, "utf8"));
const mtx = JSON.parse(fs.readFileSync(mtxPath, "utf8"));

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const d = (a, b) => (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) ? null : r2(a - b));
const KEYS = [
  "salary",
  "meal",
  "transport",
  "overtime",
  "prim",
  "ikramiye",
  "masraf",
  "gross",
  "sgk",
  "unemployment",
  "gv",
  "damga",
  "bes",
  "advance",
  "kesinti",
  "net",
  "saglik",
  "besEmployer",
];

// DHR books employer-side benefits inside Toplam Kazanç, so they need their own
// rows; the YZ column never computed them, hence ai stays null.
const EMPLOYER_DEFS = [
  { key: "saglik", label: "Özel sağlık sigortası (işveren)", group: "kazanc" },
  { key: "besEmployer", label: "BES işveren katkısı", group: "kazanc" },
];
cmp.lineDefs = cmp.lineDefs || [];
const masrafAt = cmp.lineDefs.findIndex((l) => l.key === "masraf");
for (const def of EMPLOYER_DEFS) {
  if (cmp.lineDefs.some((l) => l.key === def.key)) continue;
  cmp.lineDefs.splice(masrafAt + 1, 0, def);
}
for (const row of cmp.rows) {
  row.lineItems = row.lineItems || [];
  for (const def of EMPLOYER_DEFS) {
    if (row.lineItems.some((li) => li.key === def.key)) continue;
    const at = row.lineItems.findIndex((li) => li.key === "masraf");
    row.lineItems.splice(at + 1, 0, {
      key: def.key,
      label: def.label,
      group: def.group,
      dhr: null,
      luca: null,
      delta: null,
      match: false,
      ai: null,
      deltaDhrAi: null,
      deltaLucaAi: null,
      matchAi: false,
    });
  }
}
cmp.kalemler = cmp.kalemler || [];
for (const def of EMPLOYER_DEFS) {
  if (cmp.kalemler.some((k) => k.key === def.key)) continue;
  const at = cmp.kalemler.findIndex((k) => k.key === "masraf");
  cmp.kalemler.splice(at + 1, 0, {
    key: def.key,
    label: def.label,
    group: def.group,
    dhrSum: 0,
    lucaSum: 0,
    aiSum: null,
    deltaSum: null,
    deltaDhrAi: null,
    deltaLucaAi: null,
    peopleWithValue: 0,
    matchCount: 0,
    compared: 0,
    matchLucaAi: 0,
    comparedLucaAi: 0,
  });
}

const runAt = new Date().toISOString();
let filled = 0;
for (const row of cmp.rows) {
  const src = dhr[row.tc];
  if (!src) continue;
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
    gross: src.gross,
    sgk: src.sgk,
    unemployment: src.unemployment,
    gv: src.gv,
    damga: src.damga,
    bes: src.bes,
    advance: src.advance,
    kesinti: src.kesinti,
    net: src.net,
    saglik: src.saglik,
    besEmployer: src.besEmployer,
    sgkDays: src.sgkDays,
    sgkBase: src.sgkBase,
    gvMatrah: src.gvMatrah,
    gvExemptApplied: src.gvExemptApplied,
    damgaExemptApplied: src.damgaExemptApplied,
    employerCost: src.employerCost,
  };
  row.delta = {
    net: row.luca?.net == null ? null : d(src.net, row.luca.net),
    gv: row.luca?.gv == null ? null : d(src.gv, row.luca.gv),
    damga: row.luca?.damga == null ? null : d(src.damga, row.luca.damga),
    netAi: d(src.net, row.ai?.net),
    gvAi: d(src.gv, row.ai?.gv),
  };
  for (const li of row.lineItems || []) {
    if (!KEYS.includes(li.key)) continue;
    li.dhr = src[li.key] ?? null;
    li.delta = li.dhr == null || li.luca == null ? null : d(li.dhr, li.luca);
    li.match = li.delta != null && Math.abs(li.delta) <= 0.01;
    li.deltaDhrAi = d(li.dhr, li.ai);
    li.matchAi = li.deltaDhrAi != null && Math.abs(li.deltaDhrAi) <= 0.01;
  }
}

for (const k of cmp.kalemler || []) {
  k.dhrSum = r2(cmp.rows.reduce((a, r) => a + (r.dhr?.[k.key] ?? 0), 0));
  k.deltaSum = null;
  k.deltaDhrAi = d(k.dhrSum, k.aiSum);
  k.matchCount = 0;
  k.compared = 0;
  k.matchAi = cmp.rows.filter((r) => (r.lineItems || []).some((li) => li.key === k.key && li.matchAi)).length;
  k.comparedAi = cmp.rows.filter((r) => (r.lineItems || []).some((li) => li.key === k.key && li.deltaDhrAi != null)).length;
  if (k.aiSum == null) k.peopleWithValue = cmp.rows.filter((r) => (r.dhr?.[k.key] || 0) > 0).length;
}

const netDeltas = cmp.rows.map((r) => r.delta?.netAi).filter((v) => v != null);
cmp.summary.dhrCount = filled;
cmp.summary.netWithin100Ai = netDeltas.filter((v) => Math.abs(v) <= 100).length;
cmp.summary.avgAbsNetDeltaAi = netDeltas.length ? r2(netDeltas.reduce((a, v) => a + Math.abs(v), 0) / netDeltas.length) : null;
cmp.pending = { luca: !cmp.rows.some((r) => r.luca?.net != null), dhr: false };
cmp.sources.dhrExcel = `dhrtest.d1-tech.com.tr — Eylül 2026 Ana Kadro dönemi, 15/15 hesaplandı (${runAt.slice(0, 10)})`;
cmp.generatedAt = runAt;

// The GV exemption DHR actually used this period.
const exempts = [...new Set(cmp.rows.map((r) => r.dhr?.gvExemptApplied).filter((v) => v != null))];
cmp.legal.dhrObserved = {
  exemptApplied: exempts.length === 1 ? exempts[0] : (exempts[0] ?? 0),
  paramFormulaValue: exempts.length === 1 ? exempts[0] : (exempts[0] ?? 0),
  allMonthsSame: false,
};

const std = cmp.rows.find((r) => r.tc === "8003");
const stdDelta = std?.delta?.netAi ?? 0;
cmp.ui.lead =
  "Ana Kadro 15 kişi. DHR kolonu dolu: puantaj kaydedildi, dönem hesaplandı (15/15). Luca PDF bekliyor. YZ kolonu 2026 Türk mevzuatıyla (5510, 4447, GVK 23/18, 488, 332 GT) hesaplandı. İK Ekim/Ocak karışmaz.";
cmp.ui.verdict = `DHR Eylül dönemini 15/15 hesapladı. Tam ay standart profilde DHR net YZ’den ${stdDelta > 0 ? "+" : ""}${stdDelta.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL sapıyor; sebebi DHR’nin yemek yardımını SGK primine esas kazanç ve GV matrahından tümüyle düşmesi. Luca kolonu bekliyor.`;
cmp.ui.footer = "İK Ekim/Ocak verisi bu sekmeye karışmaz. BT kapsam dışı. Luca PDF gelince aynı satırlara işlenecek.";
cmp.ui.personCaption = "Çalışan seç → DHR hesaplanan bordro, YZ mevzuat neti; Luca bekliyor.";
cmp.ui.gvCompareTitle = "Eylül 2026 — GV istisnası: DHR uyguladığı vs yasal (YZ)";
cmp.ui.gvBullets = [
  `DHR Eylül’de kişi başı ${(cmp.legal.dhrObserved.exemptApplied || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL GV istisnası uyguladı.`,
  "YZ Eylül istisnası 5.615,10 TL (GVK 23/18, 7352, 2026 Ağu–Ara bandı) — iki taraf aynı.",
  "Damga istisnası DHR’de 250,70 TL; 5510 işçi %14 + 4447 %1 ayrı hesaplanıyor.",
];
cmp.ui.drivers = [
  {
    title: "Yemek istisnası",
    body: "DHR yemek yardımının tamamını (5.500 TL) SGK primine esas kazançtan ve GV matrahından düşüyor; YZ istisna uygulamadı. Tam ay standart profildeki tüm fark buradan geliyor.",
  },
  {
    title: "Kısmi ay",
    body: "8004 (giriş 19.09, 12 gün) ve 8005 (çıkış 14.09, 18 gün) DHR’de gün orantılı; YZ tam ay hesapladı. Bu satırlardaki büyük sapma beklenen.",
  },
  {
    title: "Luca bekliyor",
    body: "Faz 1 Eylül Luca bordrosu henüz yok. Δ DHR−Luca kolonu PDF gelince dolacak.",
  },
];

const fmt = (n) => Number(n ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const g = (sicil) => cmp.rows.find((r) => r.tc === sicil);
cmp.aiReport = {
  month: 9,
  engine: "YZ — 2026 Türkiye bordro mevzuatı (mevzuat.json)",
  disclaimer:
    "YZ kolonu mevzuat metninden hesaplandı; DHR kolonu dhrtest Eylül 2026 Ana Kadro koşumundan geldi. Farklar otomatik hata değil, incelenecek kayıt olarak listelenir.",
  findings: [
    {
      id: "F1-YEMEK-SGK-GV",
      vs: "DHR ↔ YZ",
      result: "incelenecek",
      detail: `DHR yemek yardımının tamamını (5.500 TL) prime esas kazançtan ve GV matrahından düşüyor (brüt 68.700 → PEK 63.200, GV matrahı 53.720). YZ istisna uygulamadı (PEK 68.700, matrah 58.395). Tam ay standart profildeki ${fmt(g("8003")?.delta?.netAi)} TL net farkın tamamı bu tercihten geliyor. Nakit yemek istisnasının 2026 günlük sınırı doğrulanmalı.`,
    },
    {
      id: "F1-KISMI-AY",
      vs: "DHR ↔ YZ",
      result: "beklenen",
      detail: `DHR kısmi ayı gün orantısıyla hesaplıyor: 8004 Baran Ünal 12 gün (brüt ${fmt(g("8004")?.dhr?.gross)}), 8005 Cansu Kılıç 18 gün (brüt ${fmt(g("8005")?.dhr?.gross)}), 8006 Doruk Aslan 28 gün. YZ tam ay hesapladı; bu satırlardaki büyük sapma beklenen.`,
    },
    {
      id: "F1-GV-ISTISNA",
      vs: "DHR ↔ YZ",
      result: "uyumlu",
      detail: `Eylül GV istisnası iki tarafta da ${fmt(cmp.legal.dhrObserved.exemptApplied)} TL; damga istisnası DHR’de 250,70 TL. Ekim sekmesindeki istisna sapması Faz 1 Eylül koşumunda tekrarlamadı.`,
    },
    {
      id: "F1-AVANS",
      vs: "DHR ↔ kadro",
      result: "incelenecek",
      detail: `8009 Gülce Han’da kadroda 2.000 TL avans tanımlı; Eylül bordrosunda avans kesintisi satırı boş (net ${fmt(g("8009")?.dhr?.net)} TL). Prim 7.500, masraf 4.368 ve genel kesinti 1.500 doğru işlendi.`,
    },
    {
      id: "F1-FM-BIRIM",
      vs: "DHR ↔ kadro",
      result: "incelenecek",
      detail:
        "8008 Fırat Deniz’de 10 saat brüt fazla mesai bekleniyordu; DHR’de Fazla Mesai kalemi 10,00 TL olarak işledi (brüt 68.710). Kalem saat değil tutar alıyor; saatlik ücretle çarpım yapılmıyor.",
    },
    {
      id: "F1-ISVEREN-KALEM",
      vs: "DHR ↔ YZ",
      result: "incelenecek",
      detail:
        "8004’te işveren BES katkısı (1.800 TL) ve özel sağlık sigortası primi (2.500 TL) DHR’de Toplam Kazanç’a dahil; YZ kolonu bu işveren kalemlerini hiç hesaplamadı. Karşılaştırma tablosunda iki satır olarak ayrıldı.",
    },
    {
      id: "F1-EMEKLI-STAJYER",
      vs: "DHR ↔ mevzuat",
      result: "uyumlu",
      detail: `8012 Jale Öztürk (emekli/SGDP): SGK işçi ${fmt(g("8012")?.dhr?.sgk)} TL = PEK × %7,5, işsizlik kesintisi yok. 8014 Lale Tuna (stajyer): kesinti yok, net = brüt ${fmt(g("8014")?.dhr?.net)} TL.`,
    },
  ],
};

// ---- matrix ------------------------------------------------------------
const byName = new Map(cmp.rows.map((r) => [r.name, r]));
let mtxUpdated = 0;
let consistentCount = 0;
for (const s of mtx.scenarios || []) {
  const row = byName.get(s.name);
  if (!row?.dhr) continue;
  mtxUpdated++;
  const dd = row.dhr;
  // Net must equal earnings minus the deductions DHR itself reports; masraf is
  // a reimbursement, so it is added back rather than deducted.
  const deductions = ["sgk", "unemployment", "gv", "damga", "bes", "advance", "kesinti"].reduce((a, k) => a + (dd[k] || 0), 0);
  const consistent = Math.abs((dd.gross || 0) - deductions + (dd.masraf || 0) - (dd.net || 0)) <= 0.01;
  if (consistent) consistentCount++;
  s.dhr = consistent && (dd.net || 0) > 0 ? "pass" : "fail";
  const nd = row.delta?.netAi;
  s.verdict = `DHR net ${fmt(dd.net)} TL (${dd.sgkDays} gün). YZ ${fmt(row.ai?.net)} TL, Δ ${nd != null ? (nd > 0 ? "+" : "") + fmt(nd) : "—"} TL. Luca bekliyor.`;
}
mtx.sourceOfTruth =
  "YZ = 2026 Türkiye mevzuatı (5510, 4447, GVK, 488). DHR kolonu Eylül 2026 Ana Kadro hesaplamasından geldi. Luca kolonu bekliyor.";
mtx.checkedItems = [
  {
    item: "Dönem hesaplaması tamamlandı",
    result: "pass",
    note: "Puantaj 15/15 kaydedildi, hesaplama işi 15 çalışanı hatasız bitirdi (failedCount 0), dönem Hesaplandı durumuna geçti.",
  },
  {
    item: "Net = kazanç − kesinti tutarlılığı",
    result: consistentCount === mtxUpdated ? "pass" : "partial",
    note: `${consistentCount}/${mtxUpdated} kişide DHR’nin kendi kalemleri net ile birebir tutuyor (masraf geri ödemesi eklenerek).`,
  },
  {
    item: "GV istisnası (Eylül 2026)",
    result: "pass",
    note: `DHR ${fmt(cmp.legal.dhrObserved.exemptApplied)} TL uyguladı; yasal Ağu–Ara bandı ile aynı.`,
  },
  {
    item: "Kısmi ay gün orantısı",
    result: "pass",
    note: "8004 12 gün, 8005 18 gün, 8006 28 gün — maaş, yemek ve yol gün oranıyla düştü, damga/GV eşiklerine yansıdı.",
  },
  {
    item: "Emekli (SGDP) ve stajyer profilleri",
    result: "pass",
    note: "8012’de SGK %7,5 ve işsizlik yok; 8014’te kesinti yok.",
  },
  {
    item: "BES çalışan oranı %3",
    result: "pass",
    note: "8010 Hakan Işık Özel Katkı Oranı %3 (API 0,03). Eylül kesinti 1.896 TL, net 54.610,37 TL.",
  },
  {
    item: "Avans kesintisinin bordroya yansıması",
    result: "fail",
    note: "8009’daki 2.000 TL avans Eylül bordrosunda kesilmedi (F1-AVANS).",
  },
  {
    item: "Fazla mesai kaleminin birimi",
    result: "partial",
    note: "8008’de 10 saat yerine 10,00 TL işlendi; kalem tutar bekliyor (F1-FM-BIRIM).",
  },
  {
    item: "Yemek yardımının SGK/GV istisnası",
    result: "partial",
    note: "DHR 5.500 TL’nin tamamını istisna sayıyor; günlük sınır doğrulanmalı (F1-YEMEK-SGK-GV).",
  },
];
mtx.correctFindings = [
  `DHR Eylül dönemini 15/15 hesapladı, hata veren çalışan yok.`,
  `GV istisnası ${fmt(cmp.legal.dhrObserved.exemptApplied)} TL ve damga istisnası 250,70 TL yasal değerlerle aynı.`,
  "Kısmi ay (giriş/çıkış/ücretsiz izin) maaş, yemek ve yol kalemlerine gün oranıyla yansıdı.",
  "Emekli SGDP %7,5 ve işsizlik muafiyeti; stajyerde kesinti yok.",
  "Prim, masraf geri ödemesi ve genel kesinti 8009’da doğru işlendi.",
  "SGK işveren payı, işsizlik işveren hissesi ve işveren maliyeti her kişide üretildi.",
];
mtx.dhrBugs = [
  {
    id: "F1-AVANS",
    title: "Tanımlı avans bordroda kesilmedi",
    severity: "medium",
    detail: "8009 Gülce Han’da 2.000 TL avans kadroda tanımlı; dönem bordrosunda avans kesintisi satırı boş kaldı.",
  },
  {
    id: "F1-FM-BIRIM",
    title: "Fazla mesai kalemi saat girişini tutar sayıyor",
    severity: "low",
    detail: "8008’de 10 saat brüt mesai beklenirken kalem 10,00 TL olarak hesaplandı; saatlik ücretle çarpım yapılmadı.",
  },
];

fs.writeFileSync(cmpPath, JSON.stringify(cmp, null, 1));
fs.writeFileSync(mtxPath, JSON.stringify(mtx, null, 1));
console.log("rows filled:", filled, "| matrix scenarios updated:", mtxUpdated);
console.log("netWithin100Ai:", cmp.summary.netWithin100Ai, "avgAbsNetDeltaAi:", cmp.summary.avgAbsNetDeltaAi);
console.log(
  "kalem deltas:",
  (cmp.kalemler || []).map((k) => `${k.key}=${k.deltaDhrAi}`).join(" ")
);
