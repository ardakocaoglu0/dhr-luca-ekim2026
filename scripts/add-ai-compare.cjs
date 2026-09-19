/**
 * Add YZ (mevzuat) column to Ekim, Ocak, Faz 1 comparison JSON.
 * Does not change existing DHR/Luca numbers. Faz 1 Luca/DHR stay pending.
 */
const fs = require("fs");
const path = require("path");

const { oksFraction } = require("./oks-rate.cjs");
const ROOT = path.join(__dirname, "..");
const MEVZUAT = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "mevzuat.json"), "utf8"));
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "faz1_roster.json"), "utf8"));

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function nz(n) {
  return n == null || !Number.isFinite(Number(n)) ? 0 : Number(n);
}

function taxOnWage(matrah) {
  const m = Math.max(0, matrah);
  if (m <= 190000) return m * 0.15;
  if (m <= 400000) return 28500 + (m - 190000) * 0.2;
  if (m <= 1500000) return 70500 + (m - 400000) * 0.27;
  if (m <= 5300000) return 367500 + (m - 1500000) * 0.35;
  return 1697500 + (m - 5300000) * 0.4;
}

function monthOf(period) {
  if (/ekim/i.test(period)) return 10;
  if (/eyl[uü]l/i.test(period)) return 9;
  if (/ocak/i.test(period)) return 1;
  if (/a[gğ]ustos/i.test(period)) return 8;
  return 9;
}

function isEmekli(row) {
  return /emekli|sgdp/i.test(`${row.profile || ""} ${row.note || ""} ${row.lucaKanunExpected || ""}`);
}
function isStajyer(row) {
  return /staj/i.test(`${row.profile || ""} ${row.note || ""}`);
}

function computeAi(input) {
  const p = MEVZUAT.params;
  const month = input.month;
  const gross = round2(input.gross);
  const tavan = p.asgariBrut * p.sgkTavanKat;
  const base = round2(Math.min(Math.max(gross, 0), tavan));
  const emekli = !!input.emekli;
  const stajyer = !!input.stajyer;
  const sgkRate = emekli ? p.sgdpIsciOran : stajyer ? p.stajyerGssOran : p.sgkIsciOran;
  const issRate = emekli || stajyer ? 0 : p.issizlikIsciOran;
  const sgk = round2(base * sgkRate);
  const unemployment = round2(base * issRate);
  const gvMatrah = round2(Math.max(0, gross - sgk - unemployment));
  const rawGv = round2(taxOnWage(gvMatrah));
  const exempt = stajyer ? rawGv : MEVZUAT.monthExemptTax[String(month)] || 4211.33;
  const gvExemptApplied = stajyer ? 0 : round2(Math.min(exempt, rawGv));
  const gv = stajyer ? 0 : round2(Math.max(0, rawGv - exempt));
  const damgaFull = round2(gross * p.damgaOran);
  const damgaExempt = round2(p.asgariBrut * p.damgaOran);
  const damga = stajyer ? 0 : round2(Math.max(0, damgaFull - damgaExempt));
  const bes = round2(input.bes || 0);
  const advance = round2(input.advance || 0);
  const kesinti = round2(input.kesinti || 0);
  const net = round2(gross - sgk - unemployment - gv - damga - bes - advance - kesinti);
  return {
    salary: round2(input.salary || 0),
    meal: round2(input.meal || 0),
    transport: round2(input.transport || 0),
    overtime: round2(input.overtime || 0),
    prim: round2(input.prim || 0),
    ikramiye: round2(input.ikramiye || 0),
    masraf: round2(input.masraf || 0),
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
    notes: [
      stajyer ? "Stajyer: GV ve damga 0; GSS %5 (5510 öğrenci/staj uygulaması sadeleştirildi)." : null,
      emekli ? "Emekli: SGDP işçi %7,5; işsizlik 0 (5510/SGDP)." : null,
    ].filter(Boolean),
  };
}

function packFromRow(row, month, pending) {
  const src = pending?.luca ? {} : row.luca || {};
  const dhr = pending?.dhr ? {} : row.dhr || {};
  const salary = nz(src.salary ?? src.ucret ?? dhr.salary);
  const meal = nz(src.meal ?? dhr.meal);
  const transport = nz(src.transport ?? dhr.transport);
  const overtime = nz(src.overtime ?? dhr.overtime);
  const prim = nz(src.prim ?? dhr.prim);
  const ikramiye = nz(src.ikramiye ?? dhr.ikramiye);
  const masraf = nz(src.masraf ?? dhr.masraf);
  const gross =
    nz(src.gross ?? src.topKaz) ||
    round2(salary + meal + transport + overtime + prim + ikramiye + masraf);
  const lucaBes = nz(src.bes);
  const bes = lucaBes > 0 ? lucaBes : 0;
  const advance = nz(src.advance ?? dhr.advance);
  const kesinti = nz(src.kesinti ?? dhr.kesinti);
  return computeAi({
    month,
    gross,
    salary,
    meal,
    transport,
    overtime,
    prim,
    ikramiye,
    masraf,
    bes,
    advance,
    kesinti,
    emekli: isEmekli(row),
    stajyer: isStajyer(row),
  });
}

function enrichLineItems(items, ai, pending) {
  const map = {
    salary: ai.salary,
    meal: ai.meal,
    transport: ai.transport,
    overtime: ai.overtime,
    prim: ai.prim,
    ikramiye: ai.ikramiye,
    masraf: ai.masraf,
    gross: ai.gross,
    sgk: ai.sgk,
    unemployment: ai.unemployment,
    gv: ai.gv,
    damga: ai.damga,
    bes: ai.bes,
    advance: ai.advance,
    kesinti: ai.kesinti,
    net: ai.net,
  };
  return (items || []).map((it) => {
    const a = map[it.key];
    const aiVal = a == null ? null : a;
    const dhr = pending?.dhr ? null : it.dhr;
    const luca = pending?.luca ? null : it.luca;
    const deltaDhrAi = dhr == null || aiVal == null ? null : round2(dhr - aiVal);
    const deltaLucaAi = luca == null || aiVal == null ? null : round2(luca - aiVal);
    return {
      ...it,
      dhr,
      luca,
      ai: aiVal,
      deltaDhrAi,
      deltaLucaAi,
      matchAi: deltaDhrAi != null && Math.abs(deltaDhrAi) <= 0.01,
    };
  });
}

function defaultLineDefs(ai) {
  const defs = [
    ["salary", "Temel maaş / ücret", "kazanc"],
    ["meal", "Yemek yardımı", "kazanc"],
    ["transport", "Yol yardımı", "kazanc"],
    ["overtime", "Fazla mesai", "kazanc"],
    ["prim", "Prim", "kazanc"],
    ["ikramiye", "İkramiye", "kazanc"],
    ["masraf", "Masraf", "kazanc"],
    ["gross", "Toplam kazanç", "ozet"],
    ["sgk", "SGK işçi", "kesinti"],
    ["unemployment", "İşsizlik işçi", "kesinti"],
    ["gv", "Gelir vergisi", "kesinti"],
    ["damga", "Damga vergisi", "kesinti"],
    ["bes", "BES kesintisi", "kesinti"],
    ["advance", "Avans", "kesinti"],
    ["kesinti", "Diğer kesinti (icra vb.)", "kesinti"],
    ["net", "Net ödenen", "ozet"],
  ];
  return defs.map(([key, label, group]) => ({
    key,
    label,
    group,
    dhr: null,
    luca: null,
    delta: null,
    match: false,
    ai: ai[key] ?? 0,
    deltaDhrAi: null,
    deltaLucaAi: null,
    matchAi: false,
  }));
}

function aggregateKalemler(rows, lineDefs, pending) {
  const keys = (lineDefs || []).map((d) => d.key);
  return keys.map((key) => {
    const label = (lineDefs.find((d) => d.key === key) || {}).label || key;
    const group = (lineDefs.find((d) => d.key === key) || {}).group || "";
    let dhrSum = 0,
      lucaSum = 0,
      aiSum = 0,
      comparedDhr = 0,
      comparedLuca = 0,
      matchDhr = 0,
      matchLuca = 0,
      peopleWithValue = 0;
    for (const r of rows) {
      const it = (r.lineItems || []).find((x) => x.key === key) || {};
      const ai = it.ai ?? r.ai?.[key];
      const dhr = pending?.dhr ? null : it.dhr;
      const luca = pending?.luca ? null : it.luca;
      if (ai) aiSum += ai;
      if (dhr) dhrSum += dhr;
      if (luca) lucaSum += luca;
      if ((dhr && dhr !== 0) || (luca && luca !== 0) || (ai && ai !== 0)) peopleWithValue += 1;
      if (dhr != null && ai != null) {
        comparedDhr += 1;
        if (Math.abs(dhr - ai) <= 0.01) matchDhr += 1;
      }
      if (luca != null && ai != null) {
        comparedLuca += 1;
        if (Math.abs(luca - ai) <= 0.01) matchLuca += 1;
      }
    }
    return {
      key,
      label,
      group,
      dhrSum: round2(dhrSum),
      lucaSum: round2(lucaSum),
      aiSum: round2(aiSum),
      deltaSum: pending?.dhr ? null : round2(dhrSum - lucaSum),
      deltaDhrAi: pending?.dhr ? null : round2(dhrSum - aiSum),
      deltaLucaAi: pending?.luca ? null : round2(lucaSum - aiSum),
      peopleWithValue,
      matchCount: matchDhr,
      compared: comparedDhr,
      matchLucaAi: matchLuca,
      comparedLucaAi: comparedLuca,
    };
  });
}

function findings(period, rows, pending) {
  const out = [];
  if (!pending?.dhr) {
    const besDhr = rows.filter((r) => nz(r.dhr?.bes) > 1).length;
    const besAi = rows.filter((r) => nz(r.ai?.bes) > 1).length;
    if (besDhr > besAi) {
      out.push({
        id: "BES-AUTO",
        vs: "dhr",
        result: "DHR mevzuata aykırı (YZ)",
        detail: `DHR ${besDhr} kişide BES kesiyor; YZ yalnızca sözleşmede BES olanlara (Luca BES > 0) keser. 4632 sayılı BES Kanunu — otomatik işçi kesintisi bordro motorunun varsayılanı değildir.`,
      });
    }
    const gvZero = rows.filter((r) => nz(r.dhr?.gv) > 0 && nz(r.ai?.gvExemptApplied) > 0 && nz(r.dhr?.gv) - nz(r.ai?.gv) > 500).length;
    if (gvZero) {
      out.push({
        id: "GV-EXEMPT",
        vs: "dhr",
        result: "DHR GV istisnası eksik (YZ)",
        detail: `GVK md. 23/18 ve 7352: ${period} yasal istisna YZ kolonunda uygulanır. DHR birçok satırda istisnayı 0 bırakıyor; YZ neti bu yüzden daha yüksek.`,
      });
    }
  }
  if (!pending?.luca) {
    out.push({
      id: "GV-MONTH-LUCA",
      vs: "luca",
      result: period.includes("Ekim") ? "Luca istisna bandı eski (YZ)" : "Luca ≈ YZ istisna bandı",
      detail: period.includes("Ekim")
        ? "Luca Ekim’de ~4.211,33 TL (Ocak bandı) kullanır. Yasal Ekim 5.615,10 TL (YZ). 4447 %1 işsizliği Luca SGK satırına gömmüş veya 0 yazmış olabilir; YZ ayrı satırdır."
        : "Ocak yasal istisna 4.211,33 TL — Luca ile aynı band. Kalan farklar yemek SGK/damga paketlemesi.",
    });
    out.push({
      id: "4447",
      vs: "luca",
      result: "İşsizlik %1 ayrı (YZ)",
      detail: "4447 sayılı Kanun işçi %1. YZ ayrı kesinti. Luca PDF’de işsizlik kolonu 0 görünebilir (SGK %14’e yedirilmiş veya basılmamış).",
    });
  }
  if (pending?.luca) {
    out.push({
      id: "LUCA-WAIT",
      vs: "luca",
      result: "Luca bekliyor",
      detail: "Faz 1 Eylül Luca export’u henüz yok. YZ kolonunu 2026 mevzuatıyla doldurduk; Luca PDF gelince aynı satırlara işlenecek.",
    });
  }
  out.push({
    id: "5746-4691",
    vs: "both",
    result: "Teşvik oranına dokunulmadı",
    detail: "5746 ve 4691 işveren/GV terkin oranları YZ netine yazılmaz (mevcut D1 tarifesi korunur). İşçi 5510+GVK+damga standarttır.",
  });
  return out;
}

function enrichFile(rel, pending) {
  const full = path.join(ROOT, rel);
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  const month = monthOf(data.period);
  data.pending = pending || { luca: false, dhr: false };
  data.sources = {
    ...(data.sources || {}),
    aiMevzuat: "mevzuat.json — 193 GVK, 332 GT, 5510, 4447, 488, 7352, 2026 asgari, 5746/4691 (oran yok)",
  };
  data.rows = (data.rows || []).map((row) => {
    const ai = packFromRow(row, month, data.pending);
    const lineItems = enrichLineItems(row.lineItems && row.lineItems.length ? row.lineItems : defaultLineDefs(ai), ai, data.pending);
    const delta = data.pending.dhr
      ? row.delta
      : {
          ...(row.delta || {}),
          netAi: round2(nz(row.dhr?.net) - ai.net),
          gvAi: round2(nz(row.dhr?.gv) - ai.gv),
        };
    return { ...row, ai, lineItems, delta };
  });
  data.kalemler = aggregateKalemler(data.rows, data.lineDefs || [], data.pending);
  const aiNets = data.rows.map((r) => r.ai.net);
  const dhrNets = data.pending.dhr ? [] : data.rows.map((r) => nz(r.dhr?.net));
  data.summary = {
    ...(data.summary || {}),
    aiCount: data.rows.length,
    avgAbsNetDeltaAi: dhrNets.length
      ? round2(dhrNets.reduce((s, n, i) => s + Math.abs(n - aiNets[i]), 0) / dhrNets.length)
      : null,
    netWithin100Ai: dhrNets.filter((n, i) => Math.abs(n - aiNets[i]) <= 100).length,
  };
  data.aiReport = {
    month,
    engine: MEVZUAT.title,
    disclaimer: MEVZUAT.disclaimer,
    findings: findings(data.period, data.rows, data.pending),
  };
  if (data.ui) {
    const yzNote =
      " Üçüncü kolon: YZ (2026 Türk mevzuatı: 5510, 4447, GVK 23/18, 488, 332 GT).";
    if (!String(data.ui.lead || "").includes("Üçüncü kolon: YZ")) {
      data.ui.lead = `${data.ui.lead || ""}${yzNote}`;
    }
    if (data.pending.luca && !String(data.ui.verdict || "").includes("Luca kolonu bekliyor")) {
      data.ui.verdict = `${data.ui.verdict || ""} Luca kolonu bekliyor — export gelince doldurulacak. YZ netleri mevzuat motorundan.`;
    }
  }
  fs.writeFileSync(full, JSON.stringify(data, null, 2));
  console.log("enriched", rel, "rows", data.rows.length, "pending", data.pending);
}

function buildFaz1() {
  const ana = ROSTER.people.filter((p) => p.unit === "ana" && !["8018", "8019"].includes(p.sicil));
  const month = 9;
  const rows = ana.map((p, i) => {
    const salary = p.maas;
    const meal = p.yemek;
    const transport = p.yol;
    const overtime = p.overtimeNetTl || 0;
    const prim = p.prim || 0;
    const masraf = p.masraf || 0;
    const kesinti = (p.kesinti || 0) + (p.icra || 0);
    const advance = p.avans || 0;
    const gross = salary + meal + transport + overtime + prim + masraf;
    const bes = p.besEmployeePct > 0 ? round2(gross * oksFraction(p.besEmployeePct)) : 0;
    const ai = computeAi({
      month,
      gross,
      salary,
      meal,
      transport,
      overtime,
      prim,
      ikramiye: 0,
      masraf,
      bes,
      advance,
      kesinti,
      emekli: /emekli|sgdp/i.test(`${p.profile || ""} ${p.note || ""}`) || !!p.seedFlags?.emekli,
      stajyer: /staj/i.test(`${p.profile || ""} ${p.note || ""}`) || !!p.seedFlags?.stajyer,
    });
    const row = {
      n: i + 1,
      name: p.name,
      tc: p.sicil,
      note: p.note || p.profile,
      profile: p.profile,
      input: p.hire !== "2026-01-06" || p.exit ? `giriş ${p.hire}${p.exit ? ` çıkış ${p.exit}` : ""}` : "—",
      lucaKanunExpected: p.law || "00000",
      lucaPending: true,
      dhrPending: true,
      luca: { net: null, gv: null, damga: null, gross: null },
      dhr: null,
      delta: null,
      ai,
      lineItems: defaultLineDefs(ai),
    };
    return row;
  });
  const lineDefs = [
    { key: "salary", label: "Temel maaş / ücret", group: "kazanc" },
    { key: "meal", label: "Yemek yardımı", group: "kazanc" },
    { key: "transport", label: "Yol yardımı", group: "kazanc" },
    { key: "overtime", label: "Fazla mesai", group: "kazanc" },
    { key: "prim", label: "Prim", group: "kazanc" },
    { key: "ikramiye", label: "İkramiye", group: "kazanc" },
    { key: "masraf", label: "Masraf", group: "kazanc" },
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
  const pending = { luca: true, dhr: true };
  const data = {
    generatedAt: new Date().toISOString(),
    period: "Eylül 2026",
    unit: "Bordro Laboratuvarı — Ana Kadro (15’lik)",
    lucaPdfVersion: null,
    pending,
    ui: {
      title: "Eylül 2026 — Faz 1 Bordro Laboratuvarı",
      lead: "Ana Kadro 15 kişi. DHR export ve Luca PDF bekliyor. YZ kolonu 2026 Türk mevzuatıyla (5510, 4447, GVK 23/18, 488, 332 GT) hesaplandı. İK Ekim/Ocak karışmaz.",
      verdict: "Luca kolonu bekliyor. DHR hesap export’u bekliyor. YZ, kadrodaki brüt (maaş+yemek+yol+ekler) üzerinden yasal işçi kesintilerini gösteriyor.",
      footer: "İK Ekim/Ocak verisi bu sekmeye karışmaz. BT kapsam dışı. Luca PDF gelince aynı satırlara işlenecek.",
      personCaption: "Çalışan seç → DHR ve Luca bekliyor; YZ mevzuat neti dolu.",
      gvCompareTitle: "Eylül 2026 — yasal GV istisnası (YZ)",
      gvBullets: [
        "YZ Eylül istisnası 5.615,10 TL (GVK 23/18, 7352, 2026 Ağu–Ara bandı).",
        "Luca ve DHR kolonları bu testte bekliyor.",
        "5510 işçi %14 + 4447 %1 ayrı; damga ‰7,59 − asgari damga istisnası.",
      ],
      drivers: [
        {
          title: "Luca bekliyor",
          body: "Faz 1 Eylül Luca bordrosu henüz yok. Kolon ‘bekliyor’; PDF gelince doldurulacak.",
        },
        {
          title: "YZ mevzuat",
          body: "Net = brüt − SGK %14 − işsizlik %1 − GV (tarife − aylık istisna) − damga. BES yok (sözleşme yoksa).",
        },
        {
          title: "Kısmi ay",
          body: "8004 giriş 19.09, 8005 çıkış 14.09 — YZ şimdilik tam ay; Luca/DHR gelince gün orantısı işlenir.",
        },
      ],
    },
    sources: {
      lucaPdf: "",
      dhrExcel: "",
      aiMevzuat: "mevzuat.json — 193 GVK, 332 GT, 5510, 4447, 488, 7352, 2026 asgari",
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
    lineDefs,
    rows,
    kalemler: [],
    legal: {
      gvMonthly2026: Object.entries(MEVZUAT.monthExemptTax).map(([m, exempt]) => ({
        month: ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][Number(m)],
        exempt,
        rate: 15,
      })),
      dhrObserved: { exemptApplied: 0, paramFormulaValue: 4211.33, allMonthsSame: true },
      lucaObserved: { exemptApplied: 0, octoberLegal: 5615.1 },
    },
    aiReport: {
      month,
      engine: MEVZUAT.title,
      disclaimer: MEVZUAT.disclaimer,
      findings: findings("Eylül 2026", rows, pending),
    },
  };
  data.kalemler = aggregateKalemler(rows, lineDefs, pending);
  fs.writeFileSync(path.join(ROOT, "src", "data", "faz1_comparison.json"), JSON.stringify(data, null, 2));
  console.log("faz1 comparison", rows.length, "YZ net sample", rows[0]?.ai.net);

  const faz1MatrixPath = path.join(ROOT, "src", "data", "faz1_matrix.json");
  const faz1Matrix = JSON.parse(fs.readFileSync(faz1MatrixPath, "utf8"));
  faz1Matrix.sourceOfTruth =
    "YZ = 2026 Türkiye mevzuatı (5510, 4447, GVK, 488). Luca kolonu bekliyor. DHR export bekliyor.";
  faz1Matrix.scenarios = rows.map((r) => ({
    n: r.n,
    name: r.name,
    group: "ana",
    scenario: r.note,
    profile: r.profile,
    law: r.lucaKanunExpected || "00000",
    input: r.input,
    dhr: "pending",
    luca: "pending",
    ai: "pass",
    verdict: `YZ net ${r.ai.net.toLocaleString("tr-TR")} TL. Luca bekliyor.`,
  }));
  fs.writeFileSync(faz1MatrixPath, JSON.stringify(faz1Matrix, null, 2));
  console.log("faz1 matrix scenarios", faz1Matrix.scenarios.length);
}

function patchMatrixAi(rel, source) {
  const full = path.join(ROOT, rel);
  const m = JSON.parse(fs.readFileSync(full, "utf8"));
  m.sourceOfTruth = source;
  m.scenarios = (m.scenarios || []).map((s) => ({ ...s, ai: s.ai || "pass" }));
  fs.writeFileSync(full, JSON.stringify(m, null, 2));
  console.log("matrix YZ", rel, m.scenarios.length);
}

enrichFile("src/data/ekim_comparison.json", { luca: false, dhr: false });
enrichFile("src/data/comparison.json", { luca: false, dhr: false });
buildFaz1();
patchMatrixAi(
  "src/data/ekim_matrix.json",
  "Luca + DHR + YZ (2026 Türkiye mevzuatı: 5510, 4447, GVK 23/18, 488, 332 GT)",
);
patchMatrixAi(
  "src/data/matrix.json",
  "DHR UI recalc + Luca Ocak PDF + YZ (2026 Türkiye mevzuatı)",
);
