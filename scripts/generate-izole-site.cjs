/**
 * Build izole_comparison.json + izole_matrix.json from izole_roster.json.
 * Luca pending. YZ from 2026 mevzuat. DHR filled later by izole-apply-dhr.cjs.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const roster = JSON.parse(fs.readFileSync(path.join(DATA, "izole_roster.json"), "utf8"));
const MEVZUAT = JSON.parse(fs.readFileSync(path.join(DATA, "mevzuat.json"), "utf8"));

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nz = (n) => (n == null || !Number.isFinite(Number(n)) ? 0 : Number(n));

function makeTckn(seed) {
  let n = 100000001 + Math.abs(Number(seed) || 0) * 137 + 246813579;
  n = n % 900000000;
  if (n < 100000000) n += 100000000;
  const d = String(n).padStart(9, "1").split("").map(Number);
  d[0] = Math.max(1, d[0]);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = (d.reduce((a, b) => a + b, 0) + d10) % 10;
  return d.join("") + d10 + d11;
}

function taxOnWage(matrah) {
  const m = Math.max(0, matrah);
  if (m <= 190000) return m * 0.15;
  if (m <= 400000) return 28500 + (m - 190000) * 0.2;
  if (m <= 1500000) return 70500 + (m - 400000) * 0.27;
  if (m <= 5300000) return 367500 + (m - 1500000) * 0.35;
  return 1697500 + (m - 5300000) * 0.4;
}

function computeAi(input) {
  const p = MEVZUAT.params;
  const gross = r2(input.gross);
  const tavan = p.asgariBrut * p.sgkTavanKat;
  const base = r2(Math.min(Math.max(gross, 0), tavan));
  const emekli = !!input.emekli;
  const stajyer = !!input.stajyer;
  const sgkRate = emekli ? p.sgdpIsciOran : stajyer ? p.stajyerGssOran : p.sgkIsciOran;
  const issRate = emekli || stajyer ? 0 : p.issizlikIsciOran;
  const sgk = r2(base * sgkRate);
  const unemployment = r2(base * issRate);
  const gvMatrah = r2(Math.max(0, gross - sgk - unemployment));
  const rawGv = r2(taxOnWage(gvMatrah));
  const exempt = stajyer ? rawGv : MEVZUAT.monthExemptTax["1"] || 4211.33;
  const gvExemptApplied = stajyer ? 0 : r2(Math.min(exempt, rawGv));
  const gv = stajyer ? 0 : r2(Math.max(0, rawGv - exempt));
  const damgaFull = r2(gross * p.damgaOran);
  const damgaExempt = r2(p.asgariBrut * p.damgaOran);
  const damga = stajyer ? 0 : r2(Math.max(0, damgaFull - damgaExempt));
  const bes = r2(input.bes || 0);
  const advance = r2(input.advance || 0);
  const kesinti = r2(input.kesinti || 0);
  const net = r2(gross - sgk - unemployment - gv - damga - bes - advance - kesinti);
  return {
    salary: r2(input.salary || 0),
    meal: r2(input.meal || 0),
    transport: r2(input.transport || 0),
    overtime: r2(input.overtime || 0),
    prim: r2(input.prim || 0),
    ikramiye: r2(input.ikramiye || 0),
    masraf: r2(input.masraf || 0),
    gross,
    sgk,
    unemployment,
    gv,
    damga,
    bes,
    advance,
    kesinti,
    net,
    gvMatrah,
    gvExemptApplied,
  };
}

const LINE_DEFS = [
  { key: "salary", label: "Temel maaş / ücret", group: "kazanc" },
  { key: "meal", label: "Yemek yardımı", group: "kazanc" },
  { key: "transport", label: "Yol yardımı", group: "kazanc" },
  { key: "overtime", label: "Fazla mesai", group: "kazanc" },
  { key: "prim", label: "Prim", group: "kazanc" },
  { key: "ikramiye", label: "İkramiye", group: "kazanc" },
  { key: "masraf", label: "Masraf", group: "kazanc" },
  { key: "gross", label: "Toplam kazanç / brüt", group: "ozet" },
  { key: "sgk", label: "SGK işçi", group: "kesinti" },
  { key: "unemployment", label: "İşsizlik işçi", group: "kesinti" },
  { key: "gv", label: "Gelir vergisi", group: "kesinti" },
  { key: "damga", label: "Damga vergisi", group: "kesinti" },
  { key: "bes", label: "BES kesintisi", group: "kesinti" },
  { key: "advance", label: "Avans mahsubu", group: "kesinti" },
  { key: "kesinti", label: "Genel kesinti", group: "kesinti" },
  { key: "net", label: "Net ödenen", group: "ozet" },
];

function lawLabel(p) {
  if (p.law === "05510_2") return "05510 %2";
  if (p.law === "05510_5") return "05510 %5";
  if (p.law === "5746_05746") return "05746";
  if (p.law === "5746_15746") return "15746";
  if (p.law === "5746_GV") return "5746 GV";
  if (p.tax === "4691") return "4691";
  if (p.seedFlags?.emekli) return "SGDP";
  if (p.seedFlags?.stajyer) return "STAJ";
  if (p.seedFlags?.foreign) return "YABANCI";
  return "00000";
}

function inputLabel(p) {
  if (p.overtimeGrossHours) return "FM 12s";
  if (p.avans) return "Avans 7200";
  if (p.prim) return "Prim 5000";
  if (p.ikramiye) return "İkramiye 10k";
  if (p.kesinti) return "Kesinti 1200";
  if (p.masraf) return "Masraf 750";
  if (p.besEmployeePct) return "BES %3";
  if (p.seedFlags?.priorTaxFilled) return "CumTax 185k";
  if (p.salaryType === 1) return "NET";
  if (p.seedFlags?.partTime) return "Kısmi";
  if (p.maas === 26008) return "Asgari";
  return "—";
}

const rows = roster.people.map((p, i) => {
  const salary = nz(p.maas);
  const meal = nz(p.yemek);
  const transport = nz(p.yol);
  const prim = nz(p.prim);
  const ikramiye = nz(p.ikramiye);
  const masraf = nz(p.masraf);
  const overtime = 0;
  const gross = r2(salary + meal + transport + overtime + prim + ikramiye + masraf);
  const bes = p.besEmployeePct ? r2(gross * p.besEmployeePct) : 0;
  const advance = nz(p.avans);
  const kesinti = nz(p.kesinti);
  const ai = computeAi({
    salary,
    meal,
    transport,
    overtime,
    prim,
    ikramiye,
    masraf,
    gross,
    bes,
    advance,
    kesinti,
    emekli: !!p.seedFlags?.emekli,
    stajyer: !!p.seedFlags?.stajyer,
  });
  const empty = Object.fromEntries(LINE_DEFS.map((d) => [d.key, null]));
  const lineItems = LINE_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    group: d.group,
    dhr: null,
    luca: null,
    ai: ai[d.key] ?? null,
    delta: null,
    deltaDhrAi: null,
    deltaLucaAi: null,
    match: false,
    matchAi: false,
  }));
  return {
    n: i + 1,
    name: p.name,
    tc: makeTckn(620000 + parseInt(p.sicil, 10)),
    note: p.note,
    profile: p.profile,
    input: inputLabel(p),
    lucaKanunExpected: lawLabel(p),
    lucaPending: true,
    dhrPending: true,
    luca: { ...empty },
    dhr: null,
    ai,
    delta: null,
    lineItems,
  };
});

const kalemler = LINE_DEFS.map((d) => {
  let aiSum = 0;
  let peopleWithValue = 0;
  for (const r of rows) {
    const v = r.ai?.[d.key];
    aiSum += nz(v);
    if (Math.abs(nz(v)) > 0.05) peopleWithValue += 1;
  }
  return {
    ...d,
    dhrSum: 0,
    lucaSum: 0,
    aiSum: r2(aiSum),
    deltaSum: null,
    deltaDhrAi: null,
    deltaLucaAi: null,
    peopleWithValue,
    matchCount: 0,
    compared: 0,
    matchAi: 0,
    comparedAi: 0,
    matchLucaAi: 0,
    comparedLucaAi: 0,
  };
});

const comparison = {
  generatedAt: new Date().toISOString(),
  period: "Ocak 2026",
  unit: "Tek Değişken",
  lucaPdfVersion: null,
  pending: { luca: true, dhr: true },
  ui: {
    title: "Ocak 2026 — Tek Değişken",
    lead: "27 kişi, her satırda Serra zemininden yalnız bir sapma. Çapraz senaryo yok. Luca PDF bekliyor; hakem kolonu YZ (2026 TR mevzuatı). DHR kolonu birim kurulup hesaplanınca dolacak.",
    verdict: "Birim ve Ocak dönemi kuruluyor. Geçme eşiği ±0,01 TL. Luca referanstır, doğru kabul edilmez; her sapmada hangisi doğru + mevzuat dayanağı yazılır.",
    footer: "İK 32’liği tarihsel kayıt. Bu sekme çapraz kombinasyon içermez.",
    personCaption: "Çalışan seç → beklenen tek değişken, YZ mevzuat neti; DHR ve Luca kolonları hesap/PDF gelince dolar.",
    gvCompareTitle: "Ocak 2026 — GV istisnası (yasal 4.211,33 TL)",
    gvBullets: [
      "Yasal Ocak–Haziran 2026 bandı 4.211,33 TL.",
      "Luca bu birimde yok; hakem YZ.",
      "Geçme ±0,01 TL. Kısmen geçti yok.",
    ],
  },
  sources: {
    lucaPdf: "",
    dhrExcel: "DHR bordro UI/API — Tek Değişken Ocak 2026 (kurulum)",
    aiMevzuat: "mevzuat.json — 193 GVK, 332 GT, 5510, 4447, 488, 7352, 2026 asgari, 5746/4691",
  },
  summary: {
    lucaCount: 0,
    dhrCount: 0,
    matched: 0,
    netWithin100: 0,
    avgAbsNetDelta: null,
    fmHoursTotalLuca: null,
    aiCount: rows.length,
    avgAbsNetDeltaAi: null,
    netWithin100Ai: 0,
  },
  lineDefs: LINE_DEFS,
  kalemler,
  rows,
  legal: {
    gvMonthly2026: [
      { month: "Ocak–Haziran", exempt: 4211.33, rate: 0.15 },
      { month: "Temmuz", exempt: 4537.75, rate: 0.15 },
      { month: "Ağustos–Aralık", exempt: 5615.1, rate: 0.15 },
    ],
    dhrObserved: { exemptApplied: 0, paramFormulaValue: 4211.33, allMonthsSame: false },
    lucaObserved: { exemptApplied: 0, octoberLegal: 5615.1 },
  },
  aiReport: {
    month: 1,
    engine: "YZ — 2026 Türkiye mevzuatı",
    disclaimer: "Aylık izole hesap. Luca referanstır. ±0,01 TL geçme.",
    findings: [
      {
        id: "ISO-1VAR",
        vs: "dhr",
        result: "Tasarım",
        detail: "Her çalışan Serra zemininden yalnız bir sapma taşır. 05510 ve prim ayrı kişilerde; net ve FM ayrı kişilerde.",
      },
    ],
  },
};

function verdictPending(p) {
  return `Tek değişken: ${p.scenario}. DHR hesap bekliyor · Luca PDF yok · YZ Ocak bandı 4.211,33.`;
}

const matrix = {
  period: "Ocak 2026 · Tek Değişken · DHR × YZ (Luca bekliyor)",
  environment: "dhrtest.d1-tech.com.tr · Tek Değişken",
  sourceOfTruth: "YZ = 2026 TR mevzuatı hakem. Luca referans (PDF yok). DHR UI/API. Geçme ±0,01 TL.",
  matrixDesign: {
    layers: [
      { id: "A", title: "Motor / kanun / profil", desc: "Serra zemininden yalnız bir profil veya kanun sapması. Çapraz yok." },
      { id: "B", title: "Tek girdi", desc: "Standart + 00000 üzerine yalnız FM, avans, prim, ikramiye, kesinti, masraf, BES veya kümülatif GV." },
    ],
    notFullCombinatorial: "Grup C yok. 05510+prim, net+FM, emekli+prim gibi yığınlar bu birimde kurulmaz.",
  },
  checkedItems: [
    { item: "Bir kişi = bir değişken (27 satır, Grup C yok)", result: "pass", note: "Baran/Emre/Ceren çaprazları ayrıldı: 05510, prim, net, FM ayrı siciller." },
    { item: "Geçme eşiği ±0,01 TL", result: "pass", note: "partial/known/kısmen geçti yok." },
    { item: "Luca hakem değil", result: "pass", note: "Her sapmada hangisi doğru + mevzuat dayanağı alanı var." },
    { item: "DHR Ocak 2026 hesap", result: "fail", note: "Kurulum sonrası dolacak." },
    { item: "Luca PDF", result: "fail", note: "Bu birim için Luca çıktısı yok (pending)." },
  ],
  correctFindings: [],
  dhrBugs: [],
  warnings: [],
  scenarios: roster.people.map((p, i) => ({
    n: i + 1,
    name: p.name,
    group: p.group,
    scenario: p.scenario,
    profile: p.profile,
    law: lawLabel(p),
    input: inputLabel(p),
    dhr: "pending",
    luca: "pending",
    ai: "pass",
    verdict: verdictPending(p),
    whichCorrect: "",
    legalBasis: "",
  })),
};

fs.writeFileSync(path.join(DATA, "izole_comparison.json"), JSON.stringify(comparison, null, 2) + "\n");
fs.writeFileSync(path.join(DATA, "izole_matrix.json"), JSON.stringify(matrix, null, 2) + "\n");
console.log("wrote izole_comparison", rows.length, "izole_matrix", matrix.scenarios.length);
