/**
 * Refresh the site's DHR column for the İK Ekim 2026 and Ocak 2026 periods from
 * the 13.09.2026 full recalculation, then rewrite the deltas, aggregates,
 * narrative and matrix verdicts that depend on them.
 *
 * Input: %TEMP%/ik_recalc/{ekim,ocak}_after.json (scripts/ik-recalc-compare.cjs --apply)
 */
const fs = require("fs");
const path = require("path");

const DUMPS = path.join(process.env.TEMP, "ik_recalc");
const DATA = path.join(__dirname, "..", "src", "data");
const RUN_LABEL = "13.09.2026 tam yeniden hesaplama (API)";
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const nz = (v) => (v == null ? 0 : v);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

const DHR_KEYS = [
  "salary", "meal", "transport", "overtime", "prim", "ikramiye", "masraf",
  "kesinti", "advance", "gross", "net", "gv", "sgk", "unemployment", "damga", "bes",
];

function applyDhr(row, fresh) {
  const dhr = { ...(row.dhr || {}) };
  for (const k of DHR_KEYS) dhr[k] = fresh[k] == null ? 0 : round2(fresh[k]);
  dhr.sgkDays = fresh.sgkDays ?? null;
  dhr.sgkBase = fresh.sgkBase ?? null;
  dhr.gvMatrah = fresh.gvMatrah ?? null;
  dhr.gvExemptApplied = fresh.gvExemptApplied ?? null;
  if ("gvExemption" in dhr) dhr.gvExemption = fresh.gvExemptApplied ?? null;
  if ("gvCumBase" in dhr) dhr.gvCumBase = fresh.gvCumulativeBase ?? null;
  if ("workedDays" in dhr) dhr.workedDays = fresh.sgkDays ?? null;
  if ("missingDays" in dhr) dhr.missingDays = fresh.missingDays ?? 0;
  return dhr;
}

function rebuildRow(row) {
  const D = row.dhr;
  const L = row.luca;
  const ai = row.ai;
  row.lineItems = (row.lineItems || []).map((it) => {
    const dhr = D ? (D[it.key] == null ? null : round2(D[it.key])) : null;
    const luca = it.luca == null ? null : round2(it.luca);
    const aiVal = it.ai == null ? (ai?.[it.key] ?? null) : it.ai;
    const bothNull = dhr == null && luca == null;
    const delta = bothNull ? null : round2(nz(dhr) - nz(luca));
    const match =
      bothNull ||
      (dhr != null && luca != null && Math.abs(dhr - luca) <= 0.05) ||
      (dhr == null && luca === 0) ||
      (luca == null && dhr === 0);
    const deltaDhrAi = dhr == null || aiVal == null ? null : round2(dhr - aiVal);
    const deltaLucaAi = luca == null || aiVal == null ? null : round2(luca - aiVal);
    return { ...it, dhr, luca, ai: aiVal, delta, match: !!match, deltaDhrAi, deltaLucaAi, matchAi: deltaDhrAi != null && Math.abs(deltaDhrAi) <= 0.01 };
  });
  if (D && L) {
    row.delta = {
      ...(row.delta || {}),
      net: round2(D.net - L.net),
      gv: round2(D.gv - L.gv),
      damga: round2(nz(D.damga) - nz(L.damga)),
      gross: round2(D.gross - nz(L.gross ?? L.topKaz)),
      meal: round2(nz(D.meal) - nz(L.meal)),
      transport: round2(nz(D.transport) - nz(L.transport)),
      overtime: round2(nz(D.overtime) - nz(L.overtime)),
      bes: round2(nz(D.bes) - nz(L.bes)),
    };
    if (ai) {
      row.delta.netAi = round2(D.net - nz(ai.net));
      row.delta.gvAi = round2(D.gv - nz(ai.gv));
    }
  }
  return row;
}

function aggregate(data) {
  data.kalemler = data.kalemler.map((k) => {
    let dhrSum = 0, lucaSum = 0, aiSum = 0, comparedDhr = 0, matchDhr = 0, comparedAi = 0, matchAi = 0, comparedLucaAi = 0, matchLucaAi = 0, peopleWithValue = 0;
    for (const r of data.rows) {
      const it = (r.lineItems || []).find((x) => x.key === k.key);
      if (!it) continue;
      const { dhr, luca, ai } = it;
      dhrSum += nz(dhr);
      lucaSum += nz(luca);
      aiSum += nz(ai);
      if (Math.abs(nz(dhr)) > 0.05 || Math.abs(nz(luca)) > 0.05 || Math.abs(nz(ai)) > 0.05) peopleWithValue += 1;
      if (dhr != null && luca != null) {
        comparedDhr += 1;
        if (it.match) matchDhr += 1;
      }
      if (dhr != null && ai != null) {
        comparedAi += 1;
        if (Math.abs(dhr - ai) <= 0.01) matchAi += 1;
      }
      if (luca != null && ai != null) {
        comparedLucaAi += 1;
        if (Math.abs(luca - ai) <= 0.01) matchLucaAi += 1;
      }
    }
    return {
      ...k,
      dhrSum: round2(dhrSum),
      lucaSum: round2(lucaSum),
      aiSum: round2(aiSum),
      deltaSum: round2(dhrSum - lucaSum),
      deltaDhrAi: round2(dhrSum - aiSum),
      deltaLucaAi: round2(lucaSum - aiSum),
      peopleWithValue,
      matchCount: matchDhr,
      compared: comparedDhr,
      matchAi,
      comparedAi,
      matchLucaAi,
      comparedLucaAi,
    };
  });

  const withDhr = data.rows.filter((r) => r.dhr?.net != null && r.delta);
  data.summary = {
    ...data.summary,
    dhrCount: withDhr.length,
    matched: withDhr.length,
    netWithin100: withDhr.filter((r) => Math.abs(r.delta.net) <= 100).length,
    avgAbsNetDelta: withDhr.length ? round2(withDhr.reduce((s, r) => s + Math.abs(r.delta.net), 0) / withDhr.length) : null,
    netWithin100Ai: withDhr.filter((r) => r.delta.netAi != null && Math.abs(r.delta.netAi) <= 100).length,
    avgAbsNetDeltaAi: withDhr.length ? round2(withDhr.reduce((s, r) => s + Math.abs(nz(r.delta.netAi)), 0) / withDhr.length) : null,
  };
}

// ---- Ekim ------------------------------------------------------------------
const ekimFresh = readJson(path.join(DUMPS, "ekim_after.json"));
const ekim = readJson(path.join(DATA, "ekim_comparison.json"));
const missingEkim = [];
for (const row of ekim.rows) {
  const fresh = ekimFresh[row.name];
  if (!fresh) {
    missingEkim.push(row.name);
    continue;
  }
  row.dhr = applyDhr(row, fresh);
  rebuildRow(row);
}
aggregate(ekim);

ekim.generatedAt = new Date().toISOString();
ekim.sources.dhrExcel = `API dump /api/PayrollPeriod/9d85c4e1… — ${RUN_LABEL}`;
ekim.legal.dhrObserved = { exemptApplied: 5615.1, paramFormulaValue: 5615.1, allMonthsSame: false };
ekim.ui.verdict =
  `${RUN_LABEL}: DHR’de GV istisnası artık yasal Ekim değeriyle (5.615,10 TL) uygulanıyor, BES yalnız sözleşmesi olan Pelin’den kesiliyor, ` +
  `Ar-Ge/5746/4691 profillerinde GV–damga terkini, emeklide SGDP %7,5 ve stajyerde kesintisizlik çalışıyor. ` +
  `Ort. |ΔNet| ${ekim.summary.avgAbsNetDelta} TL. Kalan ana sürücü: tam hesaplama tek seferlik prim/ikramiye/masraf/kesinti kalemlerini bordroya yazmıyor (DHR-PPV-DROP, 8 kişi).`;
ekim.ui.gvBullets = [
  "Düzeldi: Ekim istisnası 5.615,10 TL olarak uygulanıyor (önce fiilen 0 idi).",
  "Aylık ayrım da düzeldi: Ocak dönemi 4.211,33, Ekim dönemi 5.615,10 uyguluyor.",
  "Luca hâlâ ~4.211 TL (Ocak bandı) kullanıyor; Ekim farkı 1.403,77 TL → net etki ~210,57 TL/kişi.",
];
ekim.ui.drivers = [
  {
    title: "Tek seferlik kalemler",
    body: "Prim/ikramiye/masraf/kesinti kayıtları PaymentValue’da status 1 duruyor ama tam hesaplama bordroya yazmıyor: Baran 4.500, Metin 5.000, Ufuk 3.500, Yasin 10.000, Nilay 1.200, Vesile 800, Okan 750.",
  },
  {
    title: "GV istisnası",
    body: "DHR artık 5.615,10 TL uyguluyor (yasal Ekim). Luca ~4.211 TL’de kalıyor; kalan GV farkının ana kaynağı bu.",
  },
  {
    title: "BES",
    body: "DHR artık yalnız Pelin’den kesiyor (1.836 TL; hedef 1.740). Önceki 32/32 otomatik kesinti sorunu kapandı.",
  },
];
ekim.aiReport.findings = [
  {
    id: "BES-AUTO",
    vs: "dhr",
    result: `Düzeldi (${RUN_LABEL})`,
    detail: "Önce 32/32 kişide BES kesiliyordu. Yeniden hesaplamada yalnız OKS kaydı olan Pelin Zengin’den 1.836 TL (PEK 61.200 × %3) kesiliyor; 4632 sayılı Kanun ile uyumlu.",
  },
  {
    id: "GV-EXEMPT",
    vs: "dhr",
    result: `Düzeldi (${RUN_LABEL})`,
    detail: "GVK md. 23/18 + 7352 asgari ücret istisnası artık uygulanıyor: Ekim döneminde 5.615,10 TL, Ocak döneminde 4.211,33 TL. Önce fiilen 0 uygulanıyordu.",
  },
  {
    id: "ARGE-TERKIN",
    vs: "dhr",
    result: `Düzeldi (${RUN_LABEL})`,
    detail: "5746/4691 profillerinde GV ve damga terkini işliyor: Alper Hancer, Berna Işıklı, Cemil Jaleoğlu satırlarında GV 0 ve damga 0. Selin Bayraktar’da asgari ücret istisnası GV’yi sıfırlıyor.",
  },
  {
    id: "SGDP-STAJ",
    vs: "dhr",
    result: `Düzeldi (${RUN_LABEL})`,
    detail: "Emeklide SGDP %7,5 ve işsizlik muafiyeti (Dilek Kartal, Ufuk Demirel: PEK 45.200 → SGK 3.390, işsizlik 0), stajyerde kesintisizlik (İlker Pamuk: net = brüt 18.000) uygulanıyor.",
  },
  {
    id: "PPV-DROP",
    vs: "dhr",
    result: "DHR eksik hesaplıyor (YZ)",
    detail: "2026-10-15 tarihli Prim/İkramiye/Masraf/Genel Kesinti PaymentValue kayıtları status 1 duruyor; tam hesaplama sonrası bordroda hiç görünmüyor. YZ kolonu bu kalemleri içerdiği için ΔDHR−YZ 8 kişide kalem tutarı kadar açılıyor.",
  },
  {
    id: "YEMEK-SGK",
    vs: "dhr",
    result: "Dönemler arası tutarsız (YZ)",
    detail: "Aynı çalışanda yemek 5.500 TL’nin SGK matrahı: Ekim döneminde tamamı istisna (PEK 53.700), Ocak döneminde 3.476 TL istisna (PEK 55.724). 5510 md. 80 kapsamında yalnız biri doğru olabilir.",
  },
  {
    id: "NET-GROSSUP",
    vs: "dhr",
    result: "Kapsam değişti (YZ)",
    detail: "Net ücret senaryolarında (Vildan Ertem, Ceren Toprak) brütleştirme artık yalnız maaşa uygulanıyor; yemek/yol yüz değerinden geçiyor. Toplam net iki kişide de 480 TL düştü (50.700→50.220 ve 54.060→53.580).",
  },
  {
    id: "GV-MONTH-LUCA",
    vs: "luca",
    result: "Luca istisna bandı eski (YZ)",
    detail: "Luca Ekim’de ~4.211,33 TL (Ocak bandı) kullanır. Yasal Ekim 5.615,10 TL. DHR bu bandı artık doğru uyguladığı için fark Luca tarafında kaldı.",
  },
  {
    id: "4447",
    vs: "luca",
    result: "İşsizlik %1 ayrı (YZ)",
    detail: "4447 sayılı Kanun işçi %1. YZ ayrı kesinti. Luca PDF’de işsizlik kolonu 0 görünebilir (SGK %14’e yedirilmiş veya basılmamış).",
  },
  {
    id: "5746-4691",
    vs: "both",
    result: "Teşvik oranına dokunulmadı",
    detail: "5746 ve 4691 işveren/GV terkin oranları YZ netine yazılmaz (mevcut D1 tarifesi korunur). İşçi 5510+GVK+damga standarttır.",
  },
];
writeJson(path.join(DATA, "ekim_comparison.json"), ekim);

// ---- Ocak ------------------------------------------------------------------
const ocakFresh = readJson(path.join(DUMPS, "ocak_after.json"));
const ocak = readJson(path.join(DATA, "comparison.json"));
const missingOcak = [];
const ocakChanged = [];
for (const row of ocak.rows) {
  const fresh = ocakFresh[row.name];
  if (!fresh) {
    missingOcak.push(row.name);
    continue;
  }
  const before = { net: row.dhr?.net, damga: row.dhr?.damga };
  row.dhr = applyDhr(row, fresh);
  rebuildRow(row);
  if (before.net !== row.dhr.net || before.damga !== row.dhr.damga) ocakChanged.push(`${row.name} net ${before.net}→${row.dhr.net} damga ${before.damga}→${row.dhr.damga}`);
}
aggregate(ocak);
ocak.generatedAt = new Date().toISOString();
ocak.sources.dhrExcel = `API dump /api/PayrollPeriod/67d5ddbc… — ${RUN_LABEL}`;
if (ocak.ui) {
  ocak.ui.verdict = `${(ocak.ui.verdict || "").replace(/\s*Yeniden hesaplama.*$/, "")} Yeniden hesaplama (${RUN_LABEL}) Ocak dönemini neredeyse aynen doğruladı: tek fark Pelin Zengin damga 268,76 → 255,55 (işveren BES katkısı artık damga matrahında değil).`.trim();
}
writeJson(path.join(DATA, "comparison.json"), ocak);

console.log("EKIM eksik kişi:", missingEkim.length ? missingEkim.join(", ") : "yok");
console.log("EKIM özet:", JSON.stringify(ekim.summary));
console.log("OCAK eksik kişi:", missingOcak.length ? missingOcak.join(", ") : "yok");
console.log("OCAK değişen:", ocakChanged.length ? ocakChanged.join(" | ") : "yok");
console.log("OCAK özet:", JSON.stringify(ocak.summary));
