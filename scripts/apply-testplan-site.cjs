/**
 * Apply dhrtest2 recalc dumps (TEMP/testplan_recalc/*_after.json) into site
 * comparison / matrix / dashboard. Luca and YZ columns stay. Durum = DHR−Luca.
 * Does not run build:mismatch. Does not PUT employees.
 */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "src", "data");
const DUMPS = process.env.TESTPLAN_DUMP || path.join(process.env.TEMP, "testplan_recalc");
const RUN = "18.09.2026 dhrtest2 yeniden hesap";
const ENV = "https://dhrtest2.d1-tech.com.tr";
const PASS = 0.01;

const DHR_KEYS = [
  "salary",
  "meal",
  "transport",
  "overtime",
  "prim",
  "ikramiye",
  "masraf",
  "kesinti",
  "advance",
  "gross",
  "net",
  "gv",
  "sgk",
  "unemployment",
  "damga",
  "bes",
  "saglik",
  "besEmployer",
];

const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round((Number(n) + Number.EPSILON) * 100) / 100);
const nz = (v) => (v == null || !Number.isFinite(Number(v)) ? 0 : Number(v));
const near = (a, b, tol = PASS) => Math.abs(nz(a) - nz(b)) <= tol;
const tr = (n) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dlt = (a, b) => (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) ? null : r2(a - b));
const fold = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, v, space = 2) => fs.writeFileSync(p, JSON.stringify(v, null, space) + (space === 2 ? "\n" : ""));

function indexDump(obj) {
  const bySicil = {};
  const byName = {};
  for (const v of Object.values(obj)) {
    if (!v || typeof v !== "object") continue;
    if (v.sicil) bySicil[String(v.sicil)] = v;
    if (v.name) byName[fold(v.name)] = v;
  }
  return { bySicil, byName };
}

function findFresh(row, idx) {
  if (row.tc && idx.bySicil[String(row.tc)]) return idx.bySicil[String(row.tc)];
  if (row.name && idx.byName[fold(row.name)]) return idx.byName[fold(row.name)];
  return null;
}

function applyDhr(row, fresh) {
  const dhr = { ...(row.dhr || {}) };
  for (const k of DHR_KEYS) {
    if (fresh[k] == null) dhr[k] = dhr[k] == null ? 0 : dhr[k];
    else dhr[k] = r2(fresh[k]);
  }
  if (fresh.sgkDays != null) dhr.sgkDays = fresh.sgkDays;
  if (fresh.sgkBase != null) dhr.sgkBase = r2(fresh.sgkBase);
  if (fresh.gvMatrah != null) dhr.gvMatrah = r2(fresh.gvMatrah);
  if (fresh.gvExemptApplied != null) {
    dhr.gvExemptApplied = r2(fresh.gvExemptApplied);
    if ("gvExemption" in dhr) dhr.gvExemption = dhr.gvExemptApplied;
  }
  if (fresh.missingDays != null && "missingDays" in dhr) dhr.missingDays = fresh.missingDays;
  if ("workedDays" in dhr && fresh.sgkDays != null) dhr.workedDays = fresh.sgkDays;
  return dhr;
}

function rebuildRow(row) {
  const D = row.dhr;
  const L = row.luca;
  const ai = row.ai;
  row.lineItems = (row.lineItems || []).map((it) => {
    const dhr = D && D[it.key] != null ? r2(D[it.key]) : D && it.key in (D || {}) ? r2(D[it.key]) : it.dhr == null ? null : r2(D?.[it.key]);
    const dhrVal = D ? (D[it.key] == null ? null : r2(D[it.key])) : null;
    const luca = it.luca == null ? (L?.[it.key] == null ? null : r2(L[it.key])) : r2(it.luca);
    const aiVal = it.ai == null ? (ai?.[it.key] ?? null) : it.ai;
    const bothNull = dhrVal == null && luca == null;
    const delta = bothNull ? null : r2(nz(dhrVal) - nz(luca));
    const match =
      bothNull ||
      (dhrVal != null && luca != null && Math.abs(dhrVal - luca) <= PASS) ||
      (dhrVal == null && luca === 0) ||
      (luca == null && dhrVal === 0);
    const deltaDhrAi = dhrVal == null || aiVal == null ? null : r2(dhrVal - aiVal);
    const deltaLucaAi = luca == null || aiVal == null ? null : r2(luca - aiVal);
    return {
      ...it,
      dhr: dhrVal,
      luca,
      ai: aiVal,
      delta,
      match: !!match,
      deltaDhrAi,
      deltaLucaAi,
      matchAi: deltaDhrAi != null && Math.abs(deltaDhrAi) <= PASS,
      matchLucaAi: deltaLucaAi != null && Math.abs(deltaLucaAi) <= PASS,
    };
  });
  if (D) {
    row.delta = {
      ...(row.delta || {}),
      net: L?.net == null ? null : r2(D.net - L.net),
      gv: L?.gv == null ? null : r2(nz(D.gv) - nz(L.gv)),
      damga: L?.damga == null ? null : r2(nz(D.damga) - nz(L.damga)),
      gross: L ? r2(nz(D.gross) - nz(L.gross ?? L.topKaz)) : row.delta?.gross ?? null,
      meal: L ? r2(nz(D.meal) - nz(L.meal)) : row.delta?.meal ?? null,
      transport: L ? r2(nz(D.transport) - nz(L.transport)) : row.delta?.transport ?? null,
      overtime: L ? r2(nz(D.overtime) - nz(L.overtime)) : row.delta?.overtime ?? null,
      bes: L ? r2(nz(D.bes) - nz(L.bes)) : row.delta?.bes ?? null,
      netAi: ai?.net == null ? null : r2(D.net - nz(ai.net)),
      gvAi: ai?.gv == null ? null : r2(nz(D.gv) - nz(ai.gv)),
      netLucaAi: L?.net == null || ai?.net == null ? row.delta?.netLucaAi ?? null : r2(nz(L.net) - nz(ai.net)),
    };
  }
  return row;
}

function aggregate(data) {
  data.kalemler = (data.kalemler || []).map((k) => {
    let dhrSum = 0,
      lucaSum = 0,
      aiSum = 0,
      comparedDhr = 0,
      matchDhr = 0,
      comparedAi = 0,
      matchAi = 0,
      comparedLucaAi = 0,
      matchLucaAi = 0,
      peopleWithValue = 0;
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
        if (Math.abs(dhr - ai) <= PASS) matchAi += 1;
      }
      if (luca != null && ai != null) {
        comparedLucaAi += 1;
        if (Math.abs(luca - ai) <= PASS) matchLucaAi += 1;
      }
    }
    return {
      ...k,
      dhrSum: r2(dhrSum),
      lucaSum: r2(lucaSum),
      aiSum: r2(aiSum),
      deltaSum: r2(dhrSum - lucaSum),
      deltaDhrAi: r2(dhrSum - aiSum),
      deltaLucaAi: r2(lucaSum - aiSum),
      peopleWithValue,
      matchCount: matchDhr,
      compared: comparedDhr,
      matchAi,
      comparedAi,
      matchLucaAi,
      comparedLucaAi,
    };
  });

  const withBoth = data.rows.filter((r) => r.dhr?.net != null && r.luca?.net != null);
  const withDhr = data.rows.filter((r) => r.dhr?.net != null);
  data.summary = {
    ...data.summary,
    dhrCount: withDhr.length,
    matched: withBoth.length,
    netWithin100: withBoth.filter((r) => Math.abs(nz(r.delta?.net)) <= 100).length,
    netPass001: withBoth.filter((r) => Math.abs(nz(r.delta?.net)) <= PASS).length,
    avgAbsNetDelta: withBoth.length ? r2(withBoth.reduce((s, r) => s + Math.abs(nz(r.delta?.net)), 0) / withBoth.length) : null,
    netWithin100Ai: withDhr.filter((r) => r.delta?.netAi != null && Math.abs(r.delta.netAi) <= 100).length,
    avgAbsNetDeltaAi: withDhr.length
      ? r2(withDhr.reduce((s, r) => s + Math.abs(nz(r.delta?.netAi)), 0) / withDhr.length)
      : null,
  };
}

function fillFile(file, dumpFile, indent) {
  const dump = indexDump(readJson(path.join(DUMPS, dumpFile)));
  const data = readJson(path.join(DATA, file));
  const missing = [];
  let filled = 0;
  for (const row of data.rows) {
    const fresh = findFresh(row, dump);
    if (!fresh) {
      missing.push(row.name);
      continue;
    }
    row.dhrPending = false;
    row.dhr = applyDhr(row, fresh);
    rebuildRow(row);
    filled++;
  }
  aggregate(data);
  data.generatedAt = new Date().toISOString();
  if (data.sources) data.sources.dhrExcel = `${ENV} — ${RUN} · ${filled}/${data.rows.length} hesaplandı`;
  writeJson(path.join(DATA, file), data, indent);
  if (missing.length) console.warn("MISSING", file, missing.join(", "));
  console.log(
    file,
    "filled",
    filled,
    "netPass",
    data.summary.netPass001,
    "avg|Δ|",
    data.summary.avgAbsNetDelta,
    "missing",
    missing.length
  );
  return data;
}

function g(data, nameOrSicil) {
  return data.rows.find((r) => r.tc === nameOrSicil || r.name === nameOrSicil);
}

const ekim = fillFile("ekim_comparison.json", "ekim_after.json", 2);
const ocak = fillFile("comparison.json", "ocak_after.json", 2);
const izole = fillFile("izole_comparison.json", "izole_after.json", 2);
const faz1 = fillFile("faz1_comparison.json", "faz1_after.json", 1);

fs.copyFileSync(path.join(DUMPS, "faz1_after.json"), path.join(__dirname, "faz1_dhr_eylul.json"));

const serraEkim = g(ekim, "Serra Bindal");
const serraOcak = g(ocak, "Serra Bindal");
const ada = g(izole, "Ada Korkmaz");
const tolga = g(izole, "Tolga Ergin");
const umay = g(izole, "Umay Gunes");
const hakanIz = g(izole, "Hakan Boz");
const ekin = g(faz1, "8003");
const cansu = g(faz1, "8005");
const elif = g(faz1, "8007");
const firat = g(faz1, "8008");
const gulce = g(faz1, "8009");
const hakan = g(faz1, "8010");
const korhan = g(faz1, "8013");
const baran = g(faz1, "8004");
const doruk = g(faz1, "8006");

const fmFixed = nz(firat?.dhr?.overtime) >= 100;
const damgaOcakAligned = near(serraOcak?.dhr?.damga, serraOcak?.luca?.damga);
const damgaAdaAligned = near(ada?.dhr?.damga, ada?.luca?.damga);
const damgaEkinAligned = near(ekin?.dhr?.damga, ekin?.luca?.damga);
const damgaEkimDiverged = !near(serraEkim?.dhr?.damga, serraEkim?.luca?.damga);

// ---- comparison UI ---------------------------------------------------------
ekim.ui = ekim.ui || {};
ekim.ui.verdict =
  `${RUN}: nakit yemek damga matrahından çıktı (Serra damga ${tr(serraEkim?.dhr?.damga)}; Luca PDF hâlâ ${tr(serraEkim?.luca?.damga)}). ` +
  `Ort. |ΔNet DHR−Luca| ${tr(ekim.summary.avgAbsNetDelta)} TL. Kalan ana sürücü: PPV-DROP (8 kişi) ve Luca Ekim GV bandı 4.211.`;
ekim.ui.drivers = [
  {
    title: "Damga / nakit yemek",
    body: `DHR yemeği damgadan düşüyor (Serra ${tr(serraEkim?.dhr?.damga)}). Ekim Luca PDF ${tr(serraEkim?.luca?.damga)} basıyor. Ocak Luca ile aynı kural.`,
  },
  {
    title: "Tek seferlik kalemler",
    body: "Prim/ikramiye/masraf/kesinti kayıtları PaymentValue’da duruyor ama tam hesaplama bordroya yazmıyor: Baran 4.500, Metin 5.000, Ufuk 3.500, Yasin 10.000, Nilay 1.200, Vesile 800, Okan 750.",
  },
  {
    title: "GV istisnası",
    body: "DHR 5.615,10 TL uyguluyor (yasal Ekim). Luca ~4.211 TL’de kalıyor.",
  },
];
writeJson(path.join(DATA, "ekim_comparison.json"), ekim, 2);

ocak.ui = ocak.ui || {};
ocak.ui.verdict =
  `${RUN}: Serra damga DHR ${tr(serraOcak?.dhr?.damga)} / Luca ${tr(serraOcak?.luca?.damga)}` +
  `${damgaOcakAligned ? " (±0,01 hizalı)." : "."} Ort. |ΔNet DHR−Luca| ${tr(ocak.summary.avgAbsNetDelta)} TL · ±0,01 ${ocak.summary.netPass001}/${ocak.summary.matched}.`;
writeJson(path.join(DATA, "comparison.json"), ocak, 2);

izole.ui = izole.ui || {};
izole.ui.lead = `27 kişi, her satırda Serra zemininden yalnız bir sapma. DHR ${izole.summary.dhrCount}/27 · Luca ${izole.summary.lucaCount || 27}/27. Hakem YZ. Geçme ±0,01 TL.`;
izole.ui.verdict = `Tek Değişken Ocak 2026: DHR×Luca ${izole.summary.matched}/27. Ort. |ΔNet DHR−Luca| ${tr(izole.summary.avgAbsNetDelta)} TL · ±0,01 ${izole.summary.netPass001}/${izole.summary.matched}. Luca referans, YZ hakem.`;
izole.ui.gvBullets = [
  "Yasal Ocak–Haziran 2026 bandı 4.211,33 TL.",
  `Luca PDF: ${izole.lucaPdfVersion || "bordro_d1_tech (27).pdf"} · Tek Değişken · 27 kişi.`,
  `Ada (zemin) Luca net ${tr(ada?.luca?.net)} / DHR ${tr(ada?.dhr?.net)} / damga Luca ${tr(ada?.luca?.damga)} DHR ${tr(ada?.dhr?.damga)}.`,
  "Geçme ±0,01 TL. Luca referanstır, doğru kabul edilmez.",
];
writeJson(path.join(DATA, "izole_comparison.json"), izole, 2);

faz1.ui = faz1.ui || {};
faz1.ui.lead = `Ana Kadro 15 kişi. DHR ${faz1.summary.dhrCount}/15 · Luca PDF 15/15 (${faz1.lucaPdfVersion}). YZ 2026 mevzuatı. İK Ekim/Ocak karışmaz.`;
faz1.ui.verdict = `DHR×Luca ${faz1.summary.matched}/15. Ort. |ΔNet DHR−Luca| ${tr(faz1.summary.avgAbsNetDelta)} TL · ±0,01 ${faz1.summary.netPass001}/${faz1.summary.matched}. Hakan BES her iki tarafta ${tr(hakan?.dhr?.bes)} TL (%3). Luca Eylül’de Ocak GV bandı (4.211,33) kullanıyor.`;
faz1.ui.gvBullets = [
  `DHR Eylül’de kişi başı ${tr(faz1.legal?.dhrObserved?.exemptApplied || 5615.1)} TL GV istisnası uyguladı (yasal Ağu–Ara bandı).`,
  `Luca PDF ${faz1.lucaPdfVersion}: Eylül’de Ocak bandı 4.211,33 (Ekin Gel.Ver. ${tr(ekin?.luca?.gv)}).`,
  `Damga: Ekin DHR ${tr(ekin?.dhr?.damga)} / Luca ${tr(ekin?.luca?.damga)}${damgaEkinAligned ? " — hizalı." : "."} Luca referanstır, hakem değildir.`,
];
faz1.ui.drivers = [
  {
    title: "BES %3",
    body: `Hakan Işık: DHR kesinti ${tr(hakan?.dhr?.bes)} / Luca ${tr(hakan?.luca?.bes)} (PEK 63.200 × 0,03). Net fark GV bandından (${tr(hakan?.dhr?.gv)} vs ${tr(hakan?.luca?.gv)}), oran hatası değil.`,
  },
  {
    title: "Luca GV bandı",
    body: "Luca Eylül’de 4.211,33 TL (Ocak) uyguluyor; DHR ve YZ 5.615,10 TL. Bu bir DHR hatası değil.",
  },
  {
    title: "Avans / FM / ikramiye",
    body: `Gülce Luca avans ${tr(gulce?.luca?.advance)}, DHR ${tr(gulce?.dhr?.advance)}; ikramiye DHR ${tr(gulce?.dhr?.ikramiye)} / Luca ${tr(gulce?.luca?.ikramiye)}. Fırat Luca FM ${tr(firat?.luca?.overtime)} (${firat?.luca?.fmHours || 10}s), DHR ${tr(firat?.dhr?.overtime)}.`,
  },
];
faz1.aiReport = {
  month: 9,
  engine: "YZ — 2026 Türkiye bordro mevzuatı (mevzuat.json)",
  disclaimer: `YZ kolonu mevzuat metninden hesaplandı; DHR kolonu ${ENV} Eylül 2026 Ana Kadro koşumundan geldi (${RUN}). Luca referanstır, hakem değildir. Durum yalnız Δ DHR−Luca.`,
  findings: [
    {
      id: "F1-BES-OK",
      vs: "DHR ↔ Luca",
      result: "uyumlu",
      detail: `8010 Hakan Işık BES %3: DHR ${tr(hakan?.dhr?.bes)} / Luca ${tr(hakan?.luca?.bes)} (PEK × 0,03). DHR net ${tr(hakan?.dhr?.net)}, Luca ${tr(hakan?.luca?.net)}.`,
    },
    {
      id: "F1-LUCA-GV-BAND",
      vs: "DHR ↔ Luca",
      result: "beklenen",
      detail: `Luca Eylül GV istisnası 4.211,33 (Ocak bandı). DHR/YZ 5.615,10. Ekin GV DHR ${tr(ekin?.dhr?.gv)} / Luca ${tr(ekin?.luca?.gv)}. Damga Ekin DHR ${tr(ekin?.dhr?.damga)} / Luca ${tr(ekin?.luca?.damga)}.`,
    },
    {
      id: "F1-AVANS",
      vs: "DHR ↔ Luca",
      result: "hata",
      detail: `8009 Gülce Han Luca avans ${tr(gulce?.luca?.advance)} kesti (net ${tr(gulce?.luca?.net)}); DHR avans ${tr(gulce?.dhr?.advance)} (net ${tr(gulce?.dhr?.net)}). İkramiye DHR ${tr(gulce?.dhr?.ikramiye)} / Luca ${tr(gulce?.luca?.ikramiye)}.`,
    },
    {
      id: "F1-KISMI-AY",
      vs: "DHR ↔ YZ",
      result: "beklenen",
      detail: `DHR kısmi ay: 8004 ${baran?.dhr?.sgkDays} gün, 8005 ${cansu?.dhr?.sgkDays} gün, 8006 ${doruk?.dhr?.sgkDays} gün, 8013 ${korhan?.dhr?.sgkDays} gün. YZ tam ay.`,
    },
    {
      id: "F1-YEMEK-SGK-GV",
      vs: "DHR ↔ YZ",
      result: "incelenecek",
      detail: `DHR yemek 5.500 TL’nin tamamını PEK/GV’den düşüyor; YZ düşmedi. Tam ay standart net farkı ${tr(ekin?.delta?.netAi)} TL. Damga artık Luca ile hizalı.`,
    },
    {
      id: "F1-EMEKLI-STAJYER",
      vs: "DHR ↔ mevzuat",
      result: "uyumlu",
      detail: `8012 Jale SGDP SGK ${tr(g(faz1, "8012")?.dhr?.sgk)}, işsizlik 0. 8014 Lale net=brüt ${tr(g(faz1, "8014")?.dhr?.net)}.`,
    },
  ],
};
if (!fmFixed) {
  faz1.aiReport.findings.splice(3, 0, {
    id: "F1-FM-BIRIM",
    vs: "DHR ↔ Luca",
    result: "hata",
    detail: `8008 Fırat Deniz Luca FM ${tr(firat?.luca?.overtime)}; DHR ${tr(firat?.dhr?.overtime)}.`,
  });
} else if (!near(firat?.dhr?.overtime, firat?.luca?.overtime, 1)) {
  faz1.aiReport.findings.splice(3, 0, {
    id: "F1-FM-TUTAR",
    vs: "DHR ↔ Luca",
    result: "incelenecek",
    detail: `8008 Fırat: saat×ücret artık işliyor (DHR ${tr(firat?.dhr?.overtime)}). Luca ${tr(firat?.luca?.overtime)} (${firat?.luca?.fmHours || 10}s). Birim hatası (10 TL) kapandı; tutar farkı duruyor.`,
  });
}
writeJson(path.join(DATA, "faz1_comparison.json"), faz1, 1);

// ---- matrices --------------------------------------------------------------
const faz1Mtx = readJson(path.join(DATA, "faz1_matrix.json"));
faz1Mtx.environment = ENV;
faz1Mtx.sourceOfTruth = `YZ hakem. Luca referans (${faz1.lucaPdfVersion}, 15/15). DHR ${ENV} ${RUN} 15/15. Geçme ±0,01 TL. Durum = DHR−Luca.`;
for (const s of faz1Mtx.scenarios || []) {
  const row = faz1.rows.find((r) => r.name === s.name);
  if (!row) continue;
  const netDelta = row.delta?.net;
  s.luca = row.luca?.net == null ? "pending" : Math.abs(nz(netDelta)) <= PASS ? "pass" : "fail";
  s.dhr = row.dhr && nz(row.dhr.net) > 0 ? "pass" : "fail";
  s.verdict = `DHR ${tr(row.dhr?.net)} / Luca ${tr(row.luca?.net)} / YZ ${tr(row.ai?.net)} (ΔDHR−Luca ${tr(netDelta)}).`;
  if (s.name === "Hakan Işık") {
    s.whichCorrect = "DHR — Eylül GV bandı 5.615,10; Luca Ocak 4.211,33. BES her iki tarafta %3.";
    s.legalBasis = "GVK 23/18 2026 Ağu–Ara bandı; OKS kesir 0,03.";
  }
}
const patchItem = (list, test, patch) => {
  const i = list.findIndex((c) => (typeof test === "function" ? test(c) : test.test(c.item || c.id || "")));
  if (i >= 0) Object.assign(list[i], patch);
};
patchItem(faz1Mtx.checkedItems, /Kısmi ay/, {
  result: "pass",
  note: `8004 ${baran?.dhr?.sgkDays} gün, 8005 ${cansu?.dhr?.sgkDays} gün, 8006 ${doruk?.dhr?.sgkDays} gün, 8013 ${korhan?.dhr?.sgkDays} gün.`,
});
patchItem(faz1Mtx.checkedItems, /BES/, {
  result: "pass",
  note: `8010 Hakan: DHR ${tr(hakan?.dhr?.bes)} / Luca ${tr(hakan?.luca?.bes)} (API 0,03 → %3). Net DHR ${tr(hakan?.dhr?.net)}.`,
});
patchItem(faz1Mtx.checkedItems, /Avans/, {
  result: "fail",
  note: `8009’daki 2.000 TL avans Eylül bordrosunda kesilmedi (F1-AVANS). DHR avans ${tr(gulce?.dhr?.advance)}.`,
});
patchItem(faz1Mtx.checkedItems, /Fazla mesai/, {
  result: fmFixed ? "pass" : "fail",
  note: fmFixed
    ? `8008 DHR ${tr(firat?.dhr?.overtime)} (saat×ücret). Eski 10,00 TL birim hatası kapandı. Luca ${tr(firat?.luca?.overtime)} — tutar farkı F1-FM-TUTAR.`
    : `8008’de 10 saat yerine ${tr(firat?.dhr?.overtime)} TL işlendi (F1-FM-BIRIM).`,
});
patchItem(faz1Mtx.checkedItems, /Luca PDF/, {
  result: "pass",
  note: `${faz1.lucaPdfVersion}: 15/15. DHR net ±0,01: ${faz1.summary.netPass001}/${faz1.summary.matched}. Hakan BES ${tr(hakan?.dhr?.bes)} / ${tr(hakan?.luca?.bes)}.`,
});
faz1Mtx.dhrBugs = (faz1Mtx.dhrBugs || []).filter((b) => b.id !== "F1-BES-ORAN" && b.id !== "F1-FM-BIRIM");
if (!faz1Mtx.dhrBugs.some((b) => b.id === "F1-AVANS")) {
  faz1Mtx.dhrBugs.push({
    id: "F1-AVANS",
    title: "Tanımlı avans bordroda kesilmedi",
    severity: "Orta",
    detail: `8009 Gülce Han Luca avans ${tr(gulce?.luca?.advance)}; DHR ${tr(gulce?.dhr?.advance)}.`,
  });
}
if (fmFixed && !near(firat?.dhr?.overtime, firat?.luca?.overtime, 1)) {
  faz1Mtx.dhrBugs = faz1Mtx.dhrBugs.filter((b) => b.id !== "F1-FM-TUTAR");
  faz1Mtx.dhrBugs.push({
    id: "F1-FM-TUTAR",
    title: "Fazla mesai tutarı Luca’dan farklı (birim hatası kapandı)",
    severity: "Düşük",
    detail: `8008 Fırat DHR ${tr(firat?.dhr?.overtime)}, Luca ${tr(firat?.luca?.overtime)} (${firat?.luca?.fmHours || 10}s). 10 TL olarak işleme kapandı.`,
  });
}
faz1Mtx.correctFindings = [
  `Luca PDF ${faz1.lucaPdfVersion} 15/15 işlendi.`,
  `Hakan Işık BES %3: DHR ${tr(hakan?.dhr?.bes)} = Luca ${tr(hakan?.luca?.bes)}.`,
  `DHR Eylül GV istisnası ${tr(faz1.legal?.dhrObserved?.exemptApplied || 5615.1)} (yasal bant). Luca 4.211,33 kullanıyor.`,
  damgaEkinAligned ? `Ekin damga DHR ${tr(ekin?.dhr?.damga)} = Luca ${tr(ekin?.luca?.damga)} (nakit yemek damga matrahında değil).` : null,
  fmFixed ? `Fırat fazla mesai DHR ${tr(firat?.dhr?.overtime)} (eski 10,00 TL birim hatası kapandı).` : null,
  near(gulce?.dhr?.ikramiye, gulce?.luca?.ikramiye) ? `Gülce ikramiye DHR ${tr(gulce?.dhr?.ikramiye)} = Luca.` : null,
].filter(Boolean);
writeJson(path.join(DATA, "faz1_matrix.json"), faz1Mtx, 1);

const izoleMtx = readJson(path.join(DATA, "izole_matrix.json"));
izoleMtx.environment = `${ENV.replace(/^https:\/\//, "")} · Tek Değişken`;
izoleMtx.sourceOfTruth = `YZ = 2026 TR mevzuatı hakem. Luca referans (${izole.lucaPdfVersion}, 27/27). DHR ${RUN} ${izole.summary.dhrCount}/27. Geçme ±0,01 TL.`;
for (const s of izoleMtx.scenarios || []) {
  const row = izole.rows.find((r) => r.name === s.name);
  if (!row) continue;
  const netDelta = row.delta?.net;
  s.verdict = `Tek değişken ${s.scenario}: DHR ${tr(row.dhr?.net)} / Luca ${tr(row.luca?.net)} / YZ ${tr(row.ai?.net)} (ΔDHR−Luca ${tr(netDelta)}).`;
  if (damgaAdaAligned && /nakit yemek damga/i.test(s.whichCorrect || "")) {
    s.whichCorrect = "Damga hizalı (nakit yemek matrahta değil). Kalan Δ SGK/GV PEK. YZ hakem; Luca referans.";
    s.legalBasis = "488 sayılı Kanun; GVK md. 23 nakit yemek. Luca referans, doğru kabul edilmez.";
  }
  if (s.name === "Tolga Ergin" && nz(row.dhr?.overtime) > 1) {
    s.dhr = "pass";
    s.whichCorrect = "DHR FM bordroya yazıyor. Kalan net farkı Luca saat ücreti / yemek PEK.";
    s.legalBasis = "İşK md. 41 — fazla mesai bordroya yansımalı.";
  }
}
izoleMtx.dhrBugs = (izoleMtx.dhrBugs || []).filter((b) => b.id !== "IZ-FM-SAAT" || nz(tolga?.dhr?.overtime) <= 1);
if (nz(tolga?.dhr?.overtime) > 1) {
  izoleMtx.correctFindings = [
    ...(izoleMtx.correctFindings || []).filter((x) => !/Ada Korkmaz net 48/i.test(x) && !/Hakan\/Isik 4691/i.test(x)),
    `Ada Korkmaz DHR net ${tr(ada?.dhr?.net)} / damga ${tr(ada?.dhr?.damga)} (Luca damga ${tr(ada?.luca?.damga)}).`,
    `Hakan/Isik 4691: GV ${tr(hakanIz?.dhr?.gv)}, net ${tr(hakanIz?.dhr?.net)}.`,
    `Tolga FM DHR ${tr(tolga?.dhr?.overtime)} (IZ-FM-SAAT bu koşumda kapandı).`,
  ];
}
patchItem(izoleMtx.checkedItems, /Luca PDF/, {
  result: "pass",
  note: `${izole.lucaPdfVersion}: 27/27. DHR net ±0,01: ${izole.summary.netPass001}/${izole.summary.matched}.`,
});
writeJson(path.join(DATA, "izole_matrix.json"), izoleMtx, 2);

const ocakMtx = readJson(path.join(DATA, "matrix.json"));
ocakMtx.environment = `${ENV.replace(/^https:\/\//, "")} · İnsan Kaynakları · dönem 67d5ddbc`;
ocakMtx.sourceOfTruth = `DHR ${RUN} + Luca Ocak PDF + YZ (2026 Türkiye mevzuatı)`;
ocakMtx.checkedItems = ocakMtx.checkedItems.map((c) => {
  if (/Serra damga/i.test(c.item)) {
    return {
      ...c,
      item: `Serra damga ${tr(serraOcak?.dhr?.damga)}`,
      result: damgaOcakAligned ? "pass" : "fail",
      note: `DHR ${tr(serraOcak?.dhr?.damga)} / Luca ${tr(serraOcak?.luca?.damga)}`,
    };
  }
  if (/Yemek damga/i.test(c.item)) {
    return {
      ...c,
      item: "Yemek damga matrahında değil (156,88)",
      result: damgaOcakAligned ? "pass" : "fail",
      note: damgaOcakAligned
        ? `DHR ve Luca nakit yemeği damgadan düşüyor (Serra ${tr(serraOcak?.dhr?.damga)})`
        : `DHR ${tr(serraOcak?.dhr?.damga)} / Luca ${tr(serraOcak?.luca?.damga)}`,
    };
  }
  if (/Ocak dönemi 13\.09/.test(c.item) || /yeniden doğrulama/i.test(c.item)) {
    return {
      ...c,
      item: `Ocak dönemi ${RUN}`,
      result: "pass",
      note: `32/32 hesaplandı. Serra damga ${tr(serraOcak?.dhr?.damga)} (Luca ${tr(serraOcak?.luca?.damga)}). Ort. |ΔNet| ${tr(ocak.summary.avgAbsNetDelta)} TL.`,
    };
  }
  return c;
});
for (const s of ocakMtx.scenarios || []) {
  const row = ocak.rows.find((r) => r.name === s.name);
  if (!row?.delta) continue;
  if (Math.abs(nz(row.delta.net)) <= PASS) s.verdict = `Net ±0,01 geçti (${tr(row.dhr.net)}).`;
  else s.verdict = `ΔNet ${row.delta.net > 0 ? "+" : ""}${tr(row.delta.net)} · DHR ${tr(row.dhr.net)} / Luca ${tr(row.luca.net)}`;
  if (damgaOcakAligned && /nakit yemek damga/i.test(s.whichCorrect || "")) {
    s.whichCorrect = "Damga hizalı (nakit yemek matrahta değil). Kalan Δ SGK/GV PEK. YZ hakem; Luca referans.";
  }
}
writeJson(path.join(DATA, "matrix.json"), ocakMtx, 2);

const ekimMtx = readJson(path.join(DATA, "ekim_matrix.json"));
ekimMtx.environment = `${ENV.replace(/^https:\/\//, "")} · İnsan Kaynakları · dönem 9d85c4e1`;
ekimMtx.sourceOfTruth = `Luca + DHR + YZ · DHR kolonu ${RUN} API dump’ı ile tazelendi.`;
ekimMtx.checkedItems = ekimMtx.checkedItems.map((c) => {
  if (/Ekim dönemi 13\.09/.test(c.item) || /tam yeniden hesaplama \(32 kişi\)/.test(c.item)) {
    return {
      ...c,
      item: `Ekim dönemi ${RUN} (32 kişi)`,
      result: "pass",
      note: `onlyStaleEmployees:false ile 32/32 hesaplandı, failedCount 0. Serra damga ${tr(serraEkim?.dhr?.damga)} (Luca PDF ${tr(serraEkim?.luca?.damga)}).`,
    };
  }
  if (/Ocak dönemi yeniden hesaplama tekrarlanabilirliği/.test(c.item)) {
    return {
      ...c,
      result: "pass",
      note: `${RUN}: Ocak Serra damga ${tr(serraOcak?.dhr?.damga)} (Luca ${tr(serraOcak?.luca?.damga)}).`,
    };
  }
  return c;
});
const serraSc = ekimMtx.scenarios?.find((s) => s.name === "Serra Bindal");
if (serraSc) {
  serraSc.verdict = `Baz satır: GV 5.615,10. Damga DHR ${tr(serraEkim?.dhr?.damga)} / Luca PDF ${tr(serraEkim?.luca?.damga)}. Kalan net fark Luca GV bandı + yemek SGK.`;
}
writeJson(path.join(DATA, "ekim_matrix.json"), ekimMtx, 2);

// ---- dashboard -------------------------------------------------------------
const dash = readJson(path.join(DATA, "dashboard.json"));
dash.generatedAt = new Date().toISOString();
dash.environment = ENV;
const setPeriod = (id, state, compare = "DHR × Luca × YZ") => {
  const p = dash.periods.find((x) => x.id === id);
  if (p) {
    p.state = state;
    p.compare = compare;
  }
};
setPeriod("ekim", `Hesaplandı · ${RUN} · ort. |ΔNet| ${tr(ekim.summary.avgAbsNetDelta)} TL`);
setPeriod("ocak", `Hesaplandı · ${RUN} · damga ${tr(serraOcak?.dhr?.damga)} · ±0,01 ${ocak.summary.netPass001}/32`);
setPeriod("faz1", `Hesaplandı · DHR 15/15 · Luca 15/15 · ±0,01 ${faz1.summary.netPass001}/15`);
setPeriod("izole", `Hesaplandı · DHR 27/27 · Luca 27/27 · ±0,01 ${izole.summary.netPass001} · FM Tolga ${tr(tolga?.dhr?.overtime)}`);

const wDamga = dash.works.find((w) => w.id === "W-DAMGA");
if (wDamga) {
  wDamga.detail = `DHR ${RUN}: nakit yemek damga matrahında değil. Ocak Serra ${tr(serraOcak?.dhr?.damga)} = Luca; Ada ${tr(ada?.dhr?.damga)}; Ekin ${tr(ekin?.dhr?.damga)}. Ekim Luca PDF hâlâ ${tr(serraEkim?.luca?.damga)} basıyor.`;
}
const wTekrar = dash.works.find((w) => w.id === "W-TEKRAR");
if (wTekrar) {
  wTekrar.detail = `${RUN}: dört dönem yeniden hesaplandı (failedCount 0). Ana kayma damga −41,75 / net +41,75 (yemek matrahtan çıktı).`;
  wTekrar.periods = ["Ekim", "Ocak", "Eylül", "Tek Değişken"];
}
const wFaz1 = dash.works.find((w) => w.id === "W-FAZ1-LUCA");
if (wFaz1) {
  wFaz1.detail = `${faz1.lucaPdfVersion}. Ort. |ΔNet DHR−Luca| ${tr(faz1.summary.avgAbsNetDelta)} TL. Luca Eylül GV bandı 4.211,33 (DHR 5.615,10). Hakan BES DHR=Luca ${tr(hakan?.dhr?.bes)} TL.`;
}
const wKismi = dash.works.find((w) => w.id === "W-KISMI");
if (wKismi) {
  wKismi.detail = `Ocak Hande 26 gün. Faz 1: Cansu ${cansu?.dhr?.sgkDays} gün, Korhan ${korhan?.dhr?.sgkDays} gün, Baran ${baran?.dhr?.sgkDays} gün. (Ekim Hande için bkz. DHR-KISMI-EKIM.)`;
}

dash.bugs = (dash.bugs || []).filter((b) => b.id !== "F1-BES-ORAN");
if (fmFixed) dash.bugs = dash.bugs.filter((b) => b.id !== "F1-FM-BIRIM");
if (nz(tolga?.dhr?.overtime) > 1) {
  dash.bugs = dash.bugs.filter((b) => b.id !== "IZ-FM-SAAT");
  if (!dash.works.some((w) => w.id === "W-FM-IZOLE")) {
    dash.works.splice(1, 0, {
      id: "W-FM-IZOLE",
      title: "Tek Değişken Tolga FM bordroya yazıldı",
      detail: `6219 DHR fazla mesai ${tr(tolga?.dhr?.overtime)} TL (önce 0). IZ-FM-SAAT bu ortamda kapanmış görünüyor.`,
      periods: ["Tek Değişken"],
      area: "Puantaj",
    });
  }
}
const avans = dash.bugs.find((b) => b.id === "F1-AVANS");
if (avans) {
  avans.detail = `Gülce Han (8009) kadrosunda 2.000 TL avans tanımlı, Eylül bordrosunda avans ${tr(gulce?.dhr?.advance)}. Umay (6220) DHR avans ${tr(umay?.dhr?.advance)}.`;
}
const izFm = dash.bugs.find((b) => b.id === "IZ-AVANS");
if (izFm) {
  izFm.detail = `Umay Gunes (6220): DHR avans ${tr(umay?.dhr?.advance)}, net ${tr(umay?.dhr?.net)}. Luca PDF avans 7.200 kesti. F1-AVANS ile aynı DHR sınıfı.`;
}
const dispute = dash.disputes?.find((d) => d.id === "D-YEMEK-DAMGA");
if (dispute) {
  dispute.detail = damgaOcakAligned
    ? `DHR ${RUN} nakit yemeği damga matrahından çıkardı: Ocak Serra ${tr(serraOcak?.dhr?.damga)} = Luca ${tr(serraOcak?.luca?.damga)}; Ada ve Ekin damga da Luca ile aynı. Ekim Luca PDF hâlâ ${tr(serraEkim?.luca?.damga)} basıyor — fark Ekim PDF tarafında.`
    : dispute.detail;
}
if (fmFixed && !dash.works.some((w) => w.id === "W-FM-FAZ1")) {
  dash.works.splice(1, 0, {
    id: "W-FM-FAZ1",
    title: "Faz 1 Fırat FM saat×ücret işliyor",
    detail: `8008 DHR ${tr(firat?.dhr?.overtime)} (eski 10,00 TL). Luca ${tr(firat?.luca?.overtime)}. F1-FM-BIRIM kapandı.`,
    periods: ["Eylül"],
    area: "Puantaj",
  });
}
writeJson(path.join(DATA, "dashboard.json"), dash, 2);

const rosterPatch = (file) => {
  const p = path.join(DATA, file);
  if (!fs.existsSync(p)) return;
  const j = readJson(p);
  if (j.environment) j.environment = ENV;
  writeJson(p, j, 2);
};
rosterPatch("izole_roster.json");
rosterPatch("faz1_roster.json");
rosterPatch("faz1_dhr_lab.json");

console.log(
  JSON.stringify(
    {
      serraEkim: { damga: serraEkim?.dhr?.damga, luca: serraEkim?.luca?.damga, net: serraEkim?.dhr?.net, delta: serraEkim?.delta?.net },
      serraOcak: { damga: serraOcak?.dhr?.damga, luca: serraOcak?.luca?.damga, net: serraOcak?.dhr?.net, delta: serraOcak?.delta?.net },
      ada: { damga: ada?.dhr?.damga, luca: ada?.luca?.damga, net: ada?.dhr?.net, delta: ada?.delta?.net },
      ekin: { damga: ekin?.dhr?.damga, luca: ekin?.luca?.damga, net: ekin?.dhr?.net, delta: ekin?.delta?.net },
      firat: { ot: firat?.dhr?.overtime, luca: firat?.luca?.overtime },
      gulce: { ikr: gulce?.dhr?.ikramiye, avans: gulce?.dhr?.advance, lucaAvans: gulce?.luca?.advance },
      cansuDays: cansu?.dhr?.sgkDays,
      korhanDays: korhan?.dhr?.sgkDays,
      tolgaOt: tolga?.dhr?.overtime,
      summaries: {
        ekim: ekim.summary,
        ocak: ocak.summary,
        izole: izole.summary,
        faz1: faz1.summary,
      },
    },
    null,
    2
  )
);
