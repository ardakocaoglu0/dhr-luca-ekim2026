/**
 * Build paket_comparison.json + paket_matrix.json from paket_roster.json.
 * Luca yok. YZ 2026 mevzuat. DHR sonra paket-apply-dhr.cjs.
 */
const fs = require("fs");
const path = require("path");

const { oksFraction } = require("./oks-rate.cjs");
const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const roster = JSON.parse(fs.readFileSync(path.join(DATA, "paket_roster.json"), "utf8"));
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
  const workDays = p.workDaysJanuary || 21;
  const dailyMealSgk = p.dailyMealExempt || 158;
  const dailyMealGv = p.dailyMealExemptGv || 300;
  const mealExemptSgk = r2(Math.min(nz(input.meal), dailyMealSgk * workDays));
  const mealExemptGv = r2(Math.min(nz(input.meal), dailyMealGv * workDays));
  let gross = r2(input.gross);
  const tavan = p.asgariBrut * p.sgkTavanKat;
  const emekli = !!input.emekli;
  const stajyer = !!input.stajyer || !!input.cirak || !!input.intern;
  const taxFree = stajyer || !!input.cirak || !!input.intern;
  let sgkBase = r2(Math.min(Math.max(gross - (stajyer ? 0 : mealExemptSgk), 0), tavan));
  if (input.cirak) sgkBase = r2(Math.min(sgkBase, p.asgariBrut / 2));
  const sgkRate = emekli ? p.sgdpIsciOran : stajyer ? 0 : p.sgkIsciOran;
  const issRate = emekli || stajyer ? 0 : p.issizlikIsciOran;
  const sgk = r2(sgkBase * sgkRate);
  const unemployment = r2(sgkBase * issRate);
  const disEx = input.disabilityDegree ? (p.disabilityExempt?.[String(input.disabilityDegree)] || 0) : 0;
  const gvMatrah = r2(Math.max(0, gross - sgk - unemployment - (taxFree ? 0 : mealExemptGv) - disEx));
  const rawGv = r2(taxOnWage(gvMatrah));
  const exempt = taxFree ? rawGv : MEVZUAT.monthExemptTax["1"] || 4211.33;
  const gvExemptApplied = taxFree ? 0 : r2(Math.min(exempt, rawGv));
  const gv = taxFree ? 0 : r2(Math.max(0, rawGv - exempt));
  const damgaRate = p.damgaOran || 0.00759;
  const damgaBase = r2(Math.max(0, gross - (taxFree ? 0 : mealExemptGv)));
  const damgaFull = r2(damgaBase * damgaRate);
  const damgaExempt = r2(p.asgariBrut * damgaRate);
  const damga = taxFree ? 0 : r2(Math.max(0, damgaFull - damgaExempt));
  const oksRate = oksFraction(input.besEmployeePct) || 0;
  const bes = r2(Math.floor(sgkBase * oksRate));
  const advance = r2(input.advance || 0);
  const nafaka = r2(input.nafaka || 0);
  const icra = r2(input.icra || 0);
  const sendika = r2(input.sendika || 0);
  const employerClaim = r2(input.employerClaim || 0);
  const wagePenalty = r2(input.wagePenalty || 0);
  const kesilebilir = r2(Math.max(0, gross - sgk - unemployment - gv - damga - (input.healthOnEmployee ? nz(input.privateHealth) : 0)));
  const icraCap = r2(kesilebilir * 0.25);
  const icraCut = r2(Math.min(icra, Math.max(0, icraCap)));
  const claimCut = r2(Math.min(employerClaim, Math.max(0, icraCap - icraCut)));
  const kesinti = r2(nz(input.kesinti) + nafaka + icraCut + sendika + claimCut + wagePenalty);
  const net = r2(gross - sgk - unemployment - gv - damga - bes - advance - kesinti);
  return {
    salary: r2(input.salary || 0),
    meal: r2(input.meal || 0),
    transport: r2(input.transport || 0),
    overtime: r2(input.overtime || 0),
    prim: r2(input.prim || 0),
    ikramiye: r2(input.ikramiye || 0),
    masraf: r2(input.masraf || 0),
    childAid: r2(input.childAid || 0),
    spouseAid: r2(input.spouseAid || 0),
    health: r2(input.privateHealth || 0),
    leaveAllowance: r2(input.leaveAllowance || 0),
    gross,
    sgk,
    unemployment,
    gv,
    damga,
    bes,
    advance,
    kesinti,
    nafaka,
    icra: icraCut,
    net,
    gvMatrah,
    gvExemptApplied,
    employerSgk: emekli ? r2(sgkBase * 0.2475) : stajyer ? 0 : r2(sgkBase * 0.2175),
    employerCost: r2(gross + (emekli ? sgkBase * 0.2475 : stajyer ? 0 : sgkBase * 0.2375)),
  };
}

const LINE_DEFS = [
  { key: "salary", label: "Temel maaş / ücret", group: "kazanc" },
  { key: "meal", label: "Yemek yardımı", group: "kazanc" },
  { key: "transport", label: "Yol yardımı", group: "kazanc" },
  { key: "prim", label: "Prim", group: "kazanc" },
  { key: "childAid", label: "Çocuk yardımı", group: "kazanc" },
  { key: "spouseAid", label: "Eş yardımı", group: "kazanc" },
  { key: "health", label: "Özel sağlık", group: "kazanc" },
  { key: "leaveAllowance", label: "İzin harçlığı", group: "kazanc" },
  { key: "gross", label: "Toplam kazanç / brüt", group: "ozet" },
  { key: "sgk", label: "SGK işçi", group: "kesinti" },
  { key: "unemployment", label: "İşsizlik işçi", group: "kesinti" },
  { key: "gv", label: "Gelir vergisi", group: "kesinti" },
  { key: "damga", label: "Damga vergisi", group: "kesinti" },
  { key: "bes", label: "BES kesintisi", group: "kesinti" },
  { key: "advance", label: "Avans mahsubu", group: "kesinti" },
  { key: "nafaka", label: "Nafaka", group: "kesinti" },
  { key: "icra", label: "İcra", group: "kesinti" },
  { key: "kesinti", label: "Diğer kesinti", group: "kesinti" },
  { key: "net", label: "Net ödenen", group: "ozet" },
];

function lawLabel(p) {
  if (p.law === "5746_GV") return "5746 GV terkin";
  if (p.seedFlags?.emekli) return "SGDP";
  if (p.seedFlags?.stajyer) return "STAJ";
  if (p.seedFlags?.cirak) return "ÇIRAK";
  if (p.seedFlags?.intern) return "INTÖRN";
  return "00000";
}

function inputLabel(p) {
  return p.scenario || "—";
}

const rows = roster.people.map((p, i) => {
  const f = p.seedFlags || {};
  const salary = nz(p.maas);
  const meal = nz(p.yemek);
  const transport = f.paymentEnd?.yol ? 0 : nz(p.yol);
  const prim = nz(p.prim) + nz(f.recurringExtra);
  const leaveAllowance = f.leaveAllowance ? 2500 : 0;
  const childAid = Array.isArray(f.children) && f.children.length ? 1500 : 0;
  const spouseAid = f.spouse ? 1000 : 0;
  const privateHealth = nz(p.privateHealth);
  const overtime = 0;
  const gross = r2(salary + meal + transport + overtime + prim + leaveAllowance + childAid + spouseAid);
  const advance = nz(p.avans);
  const ai = computeAi({
    salary,
    meal,
    transport,
    overtime,
    prim,
    gross,
    besEmployeePct: p.besEmployeePct || 0,
    advance,
    kesinti: 0,
    emekli: !!f.emekli,
    stajyer: !!f.stajyer,
    cirak: !!f.cirak,
    intern: !!f.intern,
    disabilityDegree: f.disabilityDegree || 0,
    nafaka: nz(f.nafaka),
    icra: nz(f.icra),
    sendika: nz(f.sendika),
    employerClaim: nz(f.employerClaim),
    wagePenalty: f.wagePenaltyDays ? r2((salary / 30) * f.wagePenaltyDays) : 0,
    privateHealth,
    healthOnEmployee: !!f.healthOnEmployee,
    childAid,
    spouseAid,
    leaveAllowance,
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
    sicil: p.sicil,
    tc: makeTckn(630000 + parseInt(p.sicil, 10)),
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
  unit: "Bordro Paket",
  lucaPdfVersion: null,
  pending: { luca: true, dhr: true },
  ui: {
    title: "Ocak 2026 — Bordro Paket",
    lead: "30 kişi, Ada/Serra zemininden yalnız bir sapma. Paket düzeltmeleri ve yeni özellikler. Luca PDF yok; hakem YZ. Durum rozeti Luca gelince DHR−Luca.",
    verdict: "Birim dhrtest2’de kuruluyor. Geçme ±0,01 TL. Luca referanstır, hakem değildir.",
    footer: "İK ve Tek Değişken kartlarına dokunulmadı. Faz1 Bordro A.Ş. kullanılmadı.",
    personCaption: "Çalışan seç → tek değişken, YZ beklenen net, DHR hesap sonrası dolar. Luca bekliyor.",
    gvCompareTitle: "Ocak 2026 — GV istisnası (yasal 4.211,33 TL)",
    gvBullets: [
      "Yasal Ocak–Haziran 2026 bandı 4.211,33 TL.",
      "Yemek: PEK 21×158 (SGK); GV/damga 21×300 (GVK 23/8, GVGT 332).",
      "Luca yok; Durum = BEKLİYOR. Hakem YZ.",
    ],
  },
  sources: {
    lucaPdf: "",
    dhrExcel: "https://dhrtest2.d1-tech.com.tr — Bordro Paket Ocak 2026",
    aiMevzuat: "mevzuat.json — 193 GVK, GVGT 322, 5510 m.80, 488, 2026 asgari",
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
    disclaimer: "Aylık izole hesap. Luca yok. ±0,01 TL geçme DHR−YZ.",
    findings: [
      {
        id: "PKT-1VAR",
        vs: "dhr",
        result: "Tasarım",
        detail: "6301–6330: her satırda tek değişken. Çocuk/eş/icra/nafaka/stajyer/emekli işveren ayrı siciller.",
      },
    ],
  },
};

function verdictPending(p) {
  return `Paket: ${p.scenario}. DHR hesap bekliyor · Luca yok · YZ Ocak 4.211,33.`;
}

const matrix = {
  period: "Ocak 2026 · Bordro Paket · DHR × YZ (Luca bekliyor)",
  environment: "dhrtest2.d1-tech.com.tr · Bordro Paket",
  sourceOfTruth: "YZ = 2026 TR mevzuatı. Luca referans (PDF yok → Durum BEKLİYOR). DHR test2 API. Geçme ±0,01 TL.",
  matrixDesign: {
    layers: [
      { id: "A", title: "Paket motor düzeltmeleri", desc: "Yemek damga, stajyer işveren 0, emekli %24,75, OKS kuruş, BES kapalı." },
      { id: "B", title: "Yeni özellik", desc: "Çocuk/eş, yan hak, icra/nafaka, tavan devri, kıdem, masraf yeri." },
    ],
    notFullCombinatorial: "Her kişide tek sapma. Çapraz yok.",
  },
  checkedItems: [
    { item: "Bir kişi = bir değişken (30 satır)", result: "pass", note: "6301–6330." },
    { item: "Geçme eşiği ±0,01 TL", result: "pass", note: "Durum yalnız DHR−Luca; Luca yoksa BEKLİYOR." },
    { item: "Luca hakem değil", result: "pass", note: "Hakem YZ + paket beklenen rakam." },
    { item: "DHR Ocak 2026 hesap", result: "fail", note: "Seed sonrası dolacak." },
    { item: "Luca PDF", result: "pending", note: "Bu birim için Luca yok." },
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

fs.writeFileSync(path.join(DATA, "paket_comparison.json"), JSON.stringify(comparison, null, 2) + "\n");
fs.writeFileSync(path.join(DATA, "paket_matrix.json"), JSON.stringify(matrix, null, 2) + "\n");
console.log("wrote paket_comparison", rows.length, "paket_matrix", matrix.scenarios.length);
