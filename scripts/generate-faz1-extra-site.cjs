/**
 * Operasyon / Kenar / Takvim / Blokaj: YZ (Eylül 2026 mevzuat) + Luca BEKLİYOR.
 * DHR kolonları apply-testplan-site.cjs dump ile dolar. Bordro A.Ş. yok.
 */
const fs = require("fs");
const path = require("path");
const { oksFraction } = require("./oks-rate.cjs");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const roster = JSON.parse(fs.readFileSync(path.join(DATA, "faz1_roster.json"), "utf8"));
const MEVZUAT = JSON.parse(fs.readFileSync(path.join(DATA, "mevzuat.json"), "utf8"));

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nz = (n) => (n == null || !Number.isFinite(Number(n)) ? 0 : Number(n));

const LINE_DEFS = [
  { key: "salary", label: "Temel maaş / ücret", group: "kazanc" },
  { key: "meal", label: "Yemek yardımı", group: "kazanc" },
  { key: "transport", label: "Yol yardımı", group: "kazanc" },
  { key: "overtime", label: "Fazla mesai", group: "kazanc" },
  { key: "prim", label: "Prim", group: "kazanc" },
  { key: "ikramiye", label: "İkramiye", group: "kazanc" },
  { key: "masraf", label: "Masraf", group: "kazanc" },
  { key: "besEmployer", label: "BES işveren katkısı", group: "kazanc" },
  { key: "saglik", label: "Özel sağlık sigortası (işveren)", group: "kazanc" },
  { key: "gross", label: "Toplam kazanç", group: "ozet" },
  { key: "sgk", label: "SGK işçi", group: "kesinti" },
  { key: "unemployment", label: "İşsizlik işçi", group: "kesinti" },
  { key: "gv", label: "Gelir vergisi", group: "kesinti" },
  { key: "damga", label: "Damga vergisi", group: "kesinti" },
  { key: "bes", label: "BES kesintisi", group: "kesinti" },
  { key: "advance", label: "Avans", group: "kesinti" },
  { key: "kesinti", label: "Diğer kesinti (icra vb.)", group: "kesinti" },
  { key: "net", label: "Net ödenen", group: "ozet" },
];

const UNITS = [
  {
    key: "operasyon",
    expect: 3,
    period: "Eylül 2026",
    unit: "Operasyon",
    title: "Eylül 2026 — Operasyon",
    lead: "Operasyon 3 kişi. Luca PDF yok — Luca bilgisi bekleniyor. Hakem YZ (Eylül 5.615,10). DHR kolonu dhrtest2 Eylül hesap dump’ı ile dolar.",
  },
  {
    key: "kenar",
    expect: 53,
    period: "Eylül 2026",
    unit: "Kenar Durumlar",
    title: "Eylül 2026 — Kenar Durumlar",
    lead: "Kenar 53 kişi. Luca PDF yok — Luca bilgisi bekleniyor. Hakem YZ (Eylül 5.615,10). DHR kolonu dhrtest2 Eylül hesap dump’ı ile dolar.",
  },
  {
    key: "takvim",
    expect: 1,
    period: "Eylül 2026",
    unit: "Takvim",
    title: "Eylül 2026 — Takvim",
    lead: "Takvim 1 kişi (Cemre Ay). Luca PDF yok — Luca bilgisi bekleniyor. Hakem YZ. DHR kolonu dhrtest2 Eylül 2026 dump’ı ile dolar.",
  },
  {
    key: "blokaj",
    expect: 1,
    period: "Eylül 2026",
    unit: "Blokaj",
    title: "Eylül 2026 — Blokaj",
    lead: "Blokaj 1 kişi (Taner Uslu, SGK profili yok). Luca PDF yok — Luca bilgisi bekleniyor. Hakem YZ. DHR kolonu dhrtest2 Eylül dump’ı ile dolar.",
  },
];

function taxOnWage(matrah) {
  const m = Math.max(0, matrah);
  if (m <= 190000) return m * 0.15;
  if (m <= 400000) return 28500 + (m - 190000) * 0.2;
  if (m <= 1500000) return 70500 + (m - 400000) * 0.27;
  if (m <= 5300000) return 367500 + (m - 1500000) * 0.35;
  return 1697500 + (m - 5300000) * 0.4;
}

function disabilityGrade(p) {
  if (p.seedFlags?.disability) return Number(p.seedFlags.disability);
  const m = String(p.profile || "").match(/engelli\s*(\d)/i);
  return m ? Number(m[1]) : 0;
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
  const disExempt = r2(p.disabilityExempt?.[String(input.disability)] || 0);
  const gvMatrah = r2(Math.max(0, gross - sgk - unemployment - disExempt));
  const rawGv = r2(taxOnWage(gvMatrah));
  const exempt = stajyer ? rawGv : MEVZUAT.monthExemptTax["9"] || 5615.1;
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
    besEmployer: r2(input.besEmployer || 0),
    saglik: r2(input.saglik || 0),
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

function lawLabel(p) {
  if (p.law === "05510_2") return "05510 %2";
  if (p.law === "05510_5") return "05510 %5";
  if (p.law === "5746_05746") return "05746";
  if (p.law === "5746_15746") return "15746";
  if (p.law === "5746_GV") return "5746 GV";
  if (p.tax === "4691") return "4691";
  if (p.seedFlags?.emekli || /emekli/i.test(p.profile || "")) return "SGDP";
  if (p.seedFlags?.stajyer || /staj/i.test(p.profile || "")) return "STAJ";
  if (/yabancı/i.test(p.profile || "")) return "YABANCI";
  return "00000";
}

function inputLabel(p) {
  if (p.overtimeGrossHours) return `FM ${p.overtimeGrossHours}s`;
  if (p.overtimeNetTl) return `Net FM ${p.overtimeNetTl}`;
  if (p.avans) return `Avans ${p.avans}`;
  if (p.prim) return `Prim ${p.prim}`;
  if (p.ikramiye) return `İkramiye ${p.ikramiye}`;
  if (p.kesinti) return `Kesinti ${p.kesinti}`;
  if (p.icra) return `İcra ${p.icra}`;
  if (p.masraf) return `Masraf ${p.masraf}`;
  if (p.besEmployeePct) return "BES %3";
  if (p.seedFlags?.emekli) return "SGDP";
  if (p.salaryType === 1) return "NET";
  if ((p.leaves || []).length) return p.leaves[0].type || "İzin";
  if (p.hire && p.hire > "2026-09-01") return `Giriş ${p.hire.slice(8)}.${p.hire.slice(5, 7)}`;
  if (p.exit && p.exit < "2026-10-01") return `Çıkış ${p.exit.slice(8)}.${p.exit.slice(5, 7)}`;
  return "—";
}

function overtimeAmount(p) {
  if (p.overtimeNetTl) return r2(p.overtimeNetTl);
  if (p.overtimeGrossHours) return r2((nz(p.maas) / 225) * 1.5 * nz(p.overtimeGrossHours));
  return 0;
}

function buildUnit(spec) {
  const people = roster.people.filter((p) => p.unit === spec.key).sort((a, b) => Number(a.sicil) - Number(b.sicil));
  if (people.length !== spec.expect) {
    console.warn(spec.key, "roster", people.length, "expect", spec.expect);
  }

  const rows = people.map((p, i) => {
    const salary = nz(p.maas);
    const meal = nz(p.yemek);
    const transport = nz(p.yol);
    const overtime = overtimeAmount(p);
    const prim = nz(p.prim);
    const ikramiye = nz(p.ikramiye);
    const masraf = nz(p.masraf);
    const gross = r2(salary + meal + transport + overtime + prim + ikramiye + masraf);
    const bes = p.besEmployeePct ? r2(gross * oksFraction(p.besEmployeePct)) : 0;
    const advance = nz(p.avans);
    const kesinti = r2(nz(p.kesinti) + nz(p.icra));
    const emekli = !!p.seedFlags?.emekli || /emekli/i.test(p.profile || "");
    const stajyer = !!p.seedFlags?.stajyer || /staj/i.test(p.profile || "");
    const ai = computeAi({
      salary,
      meal,
      transport,
      overtime,
      prim,
      ikramiye,
      masraf,
      besEmployer: nz(p.besEmployer),
      saglik: nz(p.saglik),
      gross,
      bes,
      advance,
      kesinti,
      emekli,
      stajyer,
      disability: disabilityGrade(p),
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
      tc: String(p.sicil),
      sicil: String(p.sicil),
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
    period: spec.period,
    unit: spec.unit,
    lucaPdfVersion: null,
    pending: { luca: true, dhr: true },
    ui: {
      title: spec.title,
      lead: spec.lead,
      verdict: `${spec.unit}: Luca bilgisi bekleniyor. YZ ${rows.length} kişi (Eylül GV 5.615,10). DHR hesap dump’ı gelince dolar. Geçme ±0,01 TL. Luca referanstır, hakem değildir.`,
      footer: "İK / Ana Kadro / Paket / Yuvarlama / Bordro A.Ş. bu sekmeye karışmaz.",
      personCaption: "Çalışan seç → YZ mevzuat neti; DHR API dump’ı, Luca bilgisi bekleniyor.",
      gvCompareTitle: "Eylül 2026 — GV istisnası (yasal 5.615,10 TL)",
      gvBullets: [
        "Yasal Ağustos–Aralık 2026 bandı 5.615,10 TL.",
        "Luca PDF yok — Luca bilgisi bekleniyor. Hakem YZ.",
        "Geçme ±0,01 TL. Kısmen geçti yok.",
      ],
    },
    sources: {
      lucaPdf: "",
      dhrExcel: "https://dhrtest2.d1-tech.com.tr — Eylül 2026 hesap dump’ı bekleniyor",
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
      dhrObserved: { exemptApplied: 0, paramFormulaValue: 5615.1, allMonthsSame: false },
      lucaObserved: { exemptApplied: 0, octoberLegal: 5615.1 },
    },
    aiReport: {
      month: 9,
      engine: "YZ — 2026 Türkiye mevzuatı",
      disclaimer: "Aylık izole hesap. Luca bilgisi bekleniyor. ±0,01 TL geçme. Luca referanstır, hakem değildir.",
      findings: [
        {
          id: `${spec.key.toUpperCase()}-LUCA-WAIT`,
          vs: "luca",
          result: "bekliyor",
          detail: "Bu birim için Luca bordro PDF’i yok. Luca bilgisi bekleniyor. Hakem YZ Eylül bandı 5.615,10.",
        },
      ],
    },
  };

  const matrix = {
    period: `Eylül 2026 · ${spec.unit} · DHR × YZ (Luca bilgisi bekleniyor)`,
    environment: "dhrtest2.d1-tech.com.tr · " + spec.unit,
    sourceOfTruth: "YZ = 2026 TR mevzuatı hakem. Luca referans (PDF yok — Luca bilgisi bekleniyor). DHR UI/API. Geçme ±0,01 TL.",
    matrixDesign: {
      layers: [
        { id: "A", title: spec.unit, desc: "Faz 1 laboratuvar birimi. Bordro A.Ş. yok." },
        { id: "B", title: "YZ", desc: "Eylül 2026 asgari GV istisnası 5.615,10. Aylık izole." },
      ],
      notFullCombinatorial: "Luca PDF yok. Durum kolonu Luca gelene kadar BEKLİYOR.",
    },
    checkedItems: [
      { item: "Geçme eşiği ±0,01 TL", result: "pass", note: "partial/known/kısmen geçti yok." },
      { item: "Luca hakem değil", result: "pass", note: "Luca bilgisi bekleniyor; hakem YZ." },
      { item: "DHR Eylül 2026 hesap", result: "fail", note: "Dump sonrası dolacak." },
      { item: "Luca PDF", result: "fail", note: "Bu birim için Luca çıktısı yok (Luca bilgisi bekleniyor)." },
    ],
    correctFindings: [],
    dhrBugs: [],
    warnings: [],
    scenarios: people.map((p, i) => ({
      n: i + 1,
      name: p.name,
      group: p.group,
      scenario: p.note,
      profile: p.profile,
      law: lawLabel(p),
      input: inputLabel(p),
      dhr: "pending",
      luca: "pending",
      ai: "pass",
      verdict: `Luca bilgisi bekleniyor · YZ Eylül 5.615,10 · ${p.note}`,
      whichCorrect: "Hakem YZ. Luca referans, henüz yok.",
      legalBasis: "GVK 23, 332 GT, 5510, 488; Eylül GV istisnası 5.615,10.",
    })),
  };

  fs.writeFileSync(path.join(DATA, `${spec.key}_comparison.json`), JSON.stringify(comparison, null, 2) + "\n");
  fs.writeFileSync(path.join(DATA, `${spec.key}_matrix.json`), JSON.stringify(matrix, null, 2) + "\n");
  console.log("wrote", spec.key, rows.length);
}

for (const spec of UNITS) buildUnit(spec);
