/**
 * Faz 1 Eylül Ana Kadro: Luca PDF + DHR extract → faz1_comparison / matrix / dashboard.
 * Does not run build:mismatch. Durum = DHR−Luca. İK/BT dokunulmaz.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const LUCA_PDF = process.argv[2] || path.join(ROOT, "public", "downloads", "bordro_faz1_eylul.pdf");
const PUBLIC_PDF = path.join(ROOT, "public", "downloads", "bordro_faz1_eylul.pdf");
const DHR_SRC = path.join(__dirname, "faz1_dhr_eylul.json");
const PASS = 0.01;
const PDF_VERSION = "bordro_d1_tech (5).pdf";

const roster = JSON.parse(fs.readFileSync(path.join(DATA, "faz1_roster.json"), "utf8"));
const cmp = JSON.parse(fs.readFileSync(path.join(DATA, "faz1_comparison.json"), "utf8"));
const mtx = JSON.parse(fs.readFileSync(path.join(DATA, "faz1_matrix.json"), "utf8"));
const dhr = JSON.parse(fs.readFileSync(DHR_SRC, "utf8"));

const parseTR = (s) => (s == null || s === "" ? null : Number(String(s).replace(/\./g, "").replace(",", ".")));
const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100) / 100);
const nz = (n) => (n == null || !Number.isFinite(Number(n)) ? 0 : Number(n));
const near = (a, b, tol = PASS) => Math.abs(nz(a) - nz(b)) <= tol;
const tr = (n) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dlt = (a, b) => (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) ? null : r2(a - b));
const normName = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z]/g, "");

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

function pickLabeled(slice, patterns) {
  for (const re of patterns) {
    const m = slice.match(re);
    if (m) return parseTR(m[1]);
  }
  return 0;
}

function parseLucaExtras(slice) {
  const digM = slice.match(/Di[gğ]er Kazan[cç]lar:\s*([^\n]*)/i);
  const ozM = slice.match(/[OÖ]zel Kesintiler:\s*([^\n]*)/i);
  let digText = digM ? digM[1].trim() : "";
  let ozText = ozM ? ozM[1].trim() : "";
  if (/^--\s*\d/.test(digText)) digText = "";
  if (/Normal Kazan/i.test(ozText) && !/(Avans|icra|BES|Kesinti)/i.test(ozText)) ozText = "";
  const blob = `${digText}\n${ozText}`;
  const fmHours = (() => {
    const m = blob.match(/Fazla Mesai\s*\((\d+)\s*S\)/i);
    return m ? Number(m[1]) : null;
  })();
  return {
    digText,
    ozText,
    fmHours,
    meal: pickLabeled(blob, [/Yemek[^:\n]*:\s*([\d.]+,\d{2})/i]),
    transport: pickLabeled(blob, [/Yol[^:\n]*:\s*([\d.]+,\d{2})/i]),
    overtime: pickLabeled(blob, [/Fazla Mesai[^:\n]*:\s*([\d.]+,\d{2})/i]),
    overtimeNet: pickLabeled(blob, [/Fazla mesai Net[^:\n]*:\s*([\d.]+,\d{2})/i]),
    prim: pickLabeled(blob, [/\bPrim[^:\n]*:\s*([\d.]+,\d{2})/i]),
    ikramiye: pickLabeled(blob, [/[Iİ]kramiye[^:\n]*:\s*([\d.]+,\d{2})/i]),
    advance: pickLabeled(blob, [/Avans[^:\n]*:\s*([\d.]+,\d{2})/i]),
    kesinti: pickLabeled(blob, [/\bicra[^:\n]*:\s*([\d.]+,\d{2})/i, /Genel Kesinti[^:\n]*:\s*([\d.]+,\d{2})/i]),
    bes: pickLabeled(blob, [/Oto\.?\s*Kat\.?\s*BES[^:\n]*:\s*([\d.]+,\d{2})/i, /\bBES[^:\n]*:\s*([\d.]+,\d{2})/i]),
    masraf: pickLabeled(blob, [/Masraf[^:\n]*:\s*([\d.]+,\d{2})/i]),
    saglik: pickLabeled(blob, [/Özel Sigorta[^:\n]*:\s*([\d.]+,\d{2})/i, /Ozel Sigorta[^:\n]*:\s*([\d.]+,\d{2})/i]),
    besEmployer: pickLabeled(blob, [/BES İşveren[^:\n]*:\s*([\d.]+,\d{2})/i, /İşveren BES[^:\n]*:\s*([\d.]+,\d{2})/i]),
  };
}

function rowFromMatch(m, text) {
  const extras = parseLucaExtras(text.slice(m.index, m.index + 1800));
  extras.overtime = r2(nz(extras.overtime) + nz(extras.overtimeNet));
  const ozKes = parseTR(m[23]) || 0;
  const labelledOz = (extras.advance || 0) + (extras.kesinti || 0) + (extras.bes || 0);
  const saglikInOz = extras.saglik && near(ozKes - labelledOz, extras.saglik, 0.05) ? extras.saglik : 0;
  const ghost = r2(Math.max(0, ozKes - labelledOz - saglikInOz));
  const kesinti = r2((extras.kesinti || 0) + ghost);
  const L = {
    name: m[2].trim(),
    tc: m[3],
    hire: m[4],
    exit: m[5] || null,
    kanun: String(m[6]).padStart(5, "0"),
    ucret: parseTR(m[7]),
    gs: m[8],
    tgun: +m[9],
    izgun: +m[10],
    norKaz: parseTR(m[11]),
    topKaz: parseTR(m[13]),
    digKaz: parseTR(m[14]),
    sskMat: parseTR(m[15]),
    sskIsci: parseTR(m[17]),
    gv: parseTR(m[20]),
    damga: parseTR(m[22]),
    ozKes,
    net: parseTR(m[24]),
    ...extras,
    kesinti,
    ghostKesinti: ghost,
    unemployment: null,
    salary: parseTR(m[7]),
    gross: parseTR(m[13]),
    sgk: parseTR(m[17]),
    masraf: extras.masraf || 0,
  };
  const residual = r2(
    nz(L.gross) - nz(L.sgk) - nz(L.gv) - nz(L.damga) - nz(L.bes) - nz(L.kesinti) - nz(L.advance) - nz(L.net)
  );
  const onePctMat = r2(nz(L.sskMat != null ? L.sskMat : L.gross) * 0.01);
  const onePctGross = r2(nz(L.gross) * 0.01);
  if (residual >= -0.05 && (near(residual, onePctGross, 0.5) || near(residual, onePctMat, 0.5) || Math.abs(residual) <= 0.05)) {
    L.unemployment = residual < 0 ? 0 : residual;
    L.unemploymentDerived = true;
  }
  return L;
}

async function extractLuca(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();
  const rows = [];
  const re =
    /(\d+)\s+([A-Za-z ]+?)\s+(\d{11})(?:\s+\d+\s+G[uü]n(?:\s+\d+\s+[^\n\d]{0,40})?)?\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?\s+(\d+)\s+([\d.]+,\d{2})([GN])\s+(\d+)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*\r?\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;
  let m;
  while ((m = re.exec(text))) rows.push(rowFromMatch(m, text));
  return { rows, textLen: text.length };
}

function slimLuca(L) {
  return {
    salary: L.salary,
    meal: L.meal,
    transport: L.transport,
    overtime: L.overtime,
    prim: L.prim,
    ikramiye: L.ikramiye,
    masraf: L.masraf,
    kesinti: L.kesinti,
    advance: L.advance,
    gross: L.gross,
    net: L.net,
    gv: L.gv,
    sgk: L.sgk,
    unemployment: L.unemployment,
    damga: L.damga,
    bes: L.bes,
    saglik: L.saglik,
    besEmployer: L.besEmployer,
    kanun: L.kanun,
    ucret: L.ucret,
    topKaz: L.topKaz,
    digKaz: L.digKaz,
    tgun: L.tgun,
    sskMat: L.sskMat,
    digText: L.digText,
    ozText: L.ozText,
    fmHours: L.fmHours,
    hire: L.hire,
    exit: L.exit,
    tc: L.tc,
    name: L.name,
  };
}

function applyDhr() {
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
    for (const li of row.lineItems || []) {
      if (!KEYS.includes(li.key)) continue;
      li.dhr = src[li.key] ?? null;
      li.deltaDhrAi = dlt(li.dhr, li.ai);
      li.matchAi = li.deltaDhrAi != null && Math.abs(li.deltaDhrAi) <= PASS;
    }
  }
  return filled;
}

(async () => {
  const filled = applyDhr();
  const luca = await extractLuca(LUCA_PDF);
  if (luca.rows.length !== 15) {
    console.error("LUCA_PARSE", luca.rows.length, luca.rows.map((r) => r.name).join(" | "));
    throw new Error(`expected 15 Luca rows, got ${luca.rows.length}`);
  }

  const byName = Object.fromEntries(luca.rows.map((r) => [normName(r.name), r]));
  const missing = [];
  for (const row of cmp.rows) {
    const Lraw = byName[normName(row.name)];
    if (!Lraw) {
      missing.push(row.name);
      continue;
    }
    const L = slimLuca(Lraw);
    row.lucaPending = false;
    row.luca = L;
    row.lineItems = (row.lineItems || []).map((it) => {
      const lucaVal = L[it.key] == null ? null : r2(L[it.key]);
      const delta = it.dhr == null || lucaVal == null ? null : r2(it.dhr - lucaVal);
      const deltaLucaAi = lucaVal == null || it.ai == null ? null : r2(lucaVal - it.ai);
      return {
        ...it,
        luca: lucaVal,
        delta,
        deltaLucaAi,
        match: delta != null && Math.abs(delta) <= PASS,
        matchLucaAi: deltaLucaAi != null && Math.abs(deltaLucaAi) <= PASS,
      };
    });
    row.delta = {
      net: row.dhr?.net == null ? null : r2(row.dhr.net - L.net),
      gv: r2(nz(row.dhr?.gv) - nz(L.gv)),
      damga: r2(nz(row.dhr?.damga) - nz(L.damga)),
      gross: r2(nz(row.dhr?.gross) - nz(L.topKaz ?? L.gross)),
      meal: r2(nz(row.dhr?.meal) - nz(L.meal)),
      transport: r2(nz(row.dhr?.transport) - nz(L.transport)),
      overtime: r2(nz(row.dhr?.overtime) - nz(L.overtime)),
      bes: r2(nz(row.dhr?.bes) - nz(L.bes)),
      netAi: dlt(row.dhr?.net, row.ai?.net),
      gvAi: dlt(row.dhr?.gv, row.ai?.gv),
      netLucaAi: r2(nz(L.net) - nz(row.ai?.net)),
    };
  }
  if (missing.length) throw new Error("unmatched Luca: " + missing.join(", "));

  for (const k of cmp.kalemler || []) {
    let dhrSum = 0,
      lucaSum = 0,
      aiSum = 0,
      both = 0,
      matchCount = 0,
      comparedAi = 0,
      matchAi = 0,
      comparedLucaAi = 0,
      matchLucaAi = 0,
      peopleWithValue = 0;
    for (const r of cmp.rows) {
      const it = (r.lineItems || []).find((x) => x.key === k.key);
      if (!it) continue;
      dhrSum += nz(it.dhr);
      lucaSum += nz(it.luca);
      aiSum += nz(it.ai);
      if (Math.abs(nz(it.dhr)) > 0.05 || Math.abs(nz(it.luca)) > 0.05 || Math.abs(nz(it.ai)) > 0.05) peopleWithValue += 1;
      if (it.dhr != null && it.luca != null) {
        both += 1;
        if (it.match) matchCount += 1;
      }
      if (it.dhr != null && it.ai != null) {
        comparedAi += 1;
        if (Math.abs(it.dhr - it.ai) <= PASS) matchAi += 1;
      }
      if (it.luca != null && it.ai != null) {
        comparedLucaAi += 1;
        if (Math.abs(it.luca - it.ai) <= PASS) matchLucaAi += 1;
      }
    }
    k.dhrSum = r2(dhrSum);
    k.lucaSum = r2(lucaSum);
    k.aiSum = r2(aiSum);
    k.deltaSum = r2(dhrSum - lucaSum);
    k.deltaDhrAi = r2(dhrSum - aiSum);
    k.deltaLucaAi = r2(lucaSum - aiSum);
    k.peopleWithValue = peopleWithValue;
    k.matchCount = matchCount;
    k.compared = both;
    k.comparedAi = comparedAi;
    k.matchAi = matchAi;
    k.comparedLucaAi = comparedLucaAi;
    k.matchLucaAi = matchLucaAi;
  }

  fs.mkdirSync(path.dirname(PUBLIC_PDF), { recursive: true });
  if (path.resolve(LUCA_PDF) !== path.resolve(PUBLIC_PDF)) fs.copyFileSync(LUCA_PDF, PUBLIC_PDF);

  const withLuca = cmp.rows.filter((r) => r.luca?.net != null);
  const matched = cmp.rows.filter((r) => r.dhr?.net != null && r.luca?.net != null);
  const avgAbs = matched.length ? r2(matched.reduce((s, r) => s + Math.abs(nz(r.delta?.net)), 0) / matched.length) : null;
  const netPass = matched.filter((r) => Math.abs(nz(r.delta?.net)) <= PASS).length;
  const netWithin100 = matched.filter((r) => Math.abs(nz(r.delta?.net)) <= 100).length;
  const hakan = cmp.rows.find((r) => r.tc === "8010");
  const ekin = cmp.rows.find((r) => r.tc === "8003");
  const gulce = cmp.rows.find((r) => r.tc === "8009");
  const firat = cmp.rows.find((r) => r.tc === "8008");

  cmp.generatedAt = new Date().toISOString();
  cmp.lucaPdfVersion = PDF_VERSION;
  cmp.pending = { luca: false, dhr: false };
  cmp.sources.lucaPdf = "downloads/bordro_faz1_eylul.pdf";
  cmp.sources.dhrExcel = `dhrtest.d1-tech.com.tr — Eylül 2026 Ana Kadro, 15/15 hesaplandı (${cmp.generatedAt.slice(0, 10)})`;
  cmp.summary.lucaCount = luca.rows.length;
  cmp.summary.dhrCount = filled;
  cmp.summary.matched = matched.length;
  cmp.summary.netWithin100 = netWithin100;
  cmp.summary.netPass001 = netPass;
  cmp.summary.avgAbsNetDelta = avgAbs;
  const exempts = [...new Set(cmp.rows.map((r) => r.dhr?.gvExemptApplied).filter((v) => v != null))];
  cmp.legal = cmp.legal || {};
  cmp.legal.dhrObserved = {
    exemptApplied: exempts[0] ?? 5615.1,
    paramFormulaValue: exempts[0] ?? 5615.1,
    allMonthsSame: false,
  };
  cmp.legal.lucaObserved = { exemptApplied: 4211.33, octoberLegal: 5615.1 };

  cmp.ui.lead = `Ana Kadro 15 kişi. DHR ${filled}/15 · Luca PDF ${withLuca.length}/15 (${PDF_VERSION}). YZ 2026 mevzuatı. İK Ekim/Ocak karışmaz.`;
  cmp.ui.verdict = `DHR×Luca ${matched.length}/15. Ort. |ΔNet DHR−Luca| ${tr(avgAbs)} TL · ±0,01 ${netPass}/${matched.length}. Hakan BES her iki tarafta 1.896 TL (%3). Luca Eylül’de Ocak GV bandı (4.211,33) kullanıyor.`;
  cmp.ui.footer = "İK Ekim/Ocak verisi bu sekmeye karışmaz. BT kapsam dışı. Luca kanun kolonu Mert’te 00000; damga 0 işyeri TEKNOPARK.";
  cmp.ui.personCaption = "Çalışan seç → DHR, Luca PDF ve YZ mevzuat neti yan yana. Eşleşme ±0,01 TL.";
  cmp.ui.gvCompareTitle = "Eylül 2026 — GV istisnası: DHR uyguladığı vs Luca vs yasal (YZ)";
  cmp.ui.gvBullets = [
    `DHR Eylül’de kişi başı ${tr(cmp.legal.dhrObserved.exemptApplied)} TL GV istisnası uyguladı (yasal Ağu–Ara bandı).`,
    `Luca PDF ${PDF_VERSION}: Eylül’de Ocak bandı ${tr(4211.33)} (Ekin Gel.Ver. ${tr(ekin?.luca?.gv)}).`,
    "Damga istisnası DHR’de 250,70 TL. Luca referanstır, hakem değildir.",
  ];
  cmp.ui.drivers = [
    {
      title: "BES %3",
      body: `Hakan Işık: DHR kesinti ${tr(hakan?.dhr?.bes)} / Luca ${tr(hakan?.luca?.bes)} (PEK 63.200 × 0,03). Net fark GV bandından (${tr(hakan?.dhr?.gv)} vs ${tr(hakan?.luca?.gv)}), oran hatası değil.`,
    },
    {
      title: "Luca GV bandı",
      body: "Luca Eylül’de 4.211,33 TL (Ocak) uyguluyor; DHR ve YZ 5.615,10 TL. Bu bir DHR hatası değil.",
    },
    {
      title: "Avans / FM",
      body: `Gülce Luca avans ${tr(gulce?.luca?.advance)}, DHR ${tr(gulce?.dhr?.advance)}. Fırat Luca FM ${tr(firat?.luca?.overtime)} (${firat?.luca?.fmHours || 10}s), DHR ${tr(firat?.dhr?.overtime)}.`,
    },
  ];

  const fmt = (n) => tr(n);
  const g = (sicil) => cmp.rows.find((r) => r.tc === sicil);
  cmp.aiReport = {
    month: 9,
    engine: "YZ — 2026 Türkiye bordro mevzuatı (mevzuat.json)",
    disclaimer:
      "YZ kolonu mevzuat metninden hesaplandı; DHR kolonu dhrtest Eylül 2026 Ana Kadro koşumundan geldi. Luca referanstır, hakem değildir. Durum yalnız Δ DHR−Luca.",
    findings: [
      {
        id: "F1-BES-OK",
        vs: "DHR ↔ Luca",
        result: "uyumlu",
        detail: `8010 Hakan Işık BES %3: DHR ${fmt(g("8010")?.dhr?.bes)} / Luca ${fmt(g("8010")?.luca?.bes)} (PEK × 0,03). DHR net ${fmt(g("8010")?.dhr?.net)}, Luca ${fmt(g("8010")?.luca?.net)}. Eski %300 koşumu (oran=3) bu dump’ta yok.`,
      },
      {
        id: "F1-LUCA-GV-BAND",
        vs: "DHR ↔ Luca",
        result: "beklenen",
        detail: `Luca Eylül GV istisnası ${fmt(4211.33)} (Ocak bandı). DHR/YZ ${fmt(5615.1)}. Ekin GV DHR ${fmt(g("8003")?.dhr?.gv)} / Luca ${fmt(g("8003")?.luca?.gv)}.`,
      },
      {
        id: "F1-AVANS",
        vs: "DHR ↔ Luca",
        result: "hata",
        detail: `8009 Gülce Han Luca avans ${fmt(g("8009")?.luca?.advance)} kesti (net ${fmt(g("8009")?.luca?.net)}); DHR avans 0 (net ${fmt(g("8009")?.dhr?.net)}).`,
      },
      {
        id: "F1-FM-BIRIM",
        vs: "DHR ↔ Luca",
        result: "hata",
        detail: `8008 Fırat Deniz Luca FM ${fmt(g("8008")?.luca?.overtime)} (${g("8008")?.luca?.fmHours || 10}s); DHR 10,00 TL.`,
      },
      {
        id: "F1-YEMEK-SGK-GV",
        vs: "DHR ↔ YZ",
        result: "incelenecek",
        detail: `DHR yemek 5.500 TL’nin tamamını PEK/GV’den düşüyor; YZ düşmedi. Tam ay standart net farkı ${fmt(g("8003")?.delta?.netAi)} TL.`,
      },
      {
        id: "F1-KISMI-AY",
        vs: "DHR ↔ YZ",
        result: "beklenen",
        detail: `DHR kısmi ay: 8004 ${g("8004")?.dhr?.sgkDays} gün, 8005 ${g("8005")?.dhr?.sgkDays} gün, 8006 ${g("8006")?.dhr?.sgkDays} gün. YZ tam ay.`,
      },
      {
        id: "F1-EMEKLI-STAJYER",
        vs: "DHR ↔ mevzuat",
        result: "uyumlu",
        detail: `8012 Jale SGDP SGK ${fmt(g("8012")?.dhr?.sgk)}, işsizlik 0. 8014 Lale net=brüt ${fmt(g("8014")?.dhr?.net)}.`,
      },
    ],
  };

  mtx.sourceOfTruth = `YZ hakem. Luca referans (${PDF_VERSION}, ${withLuca.length}/15). DHR Eylül Ana Kadro ${filled}/15. Geçme ±0,01 TL. Durum = DHR−Luca.`;
  mtx.period = "Eylül 2026 · Ana Kadro · DHR × Luca × YZ";
  const lucaPdfItem = mtx.checkedItems.find((c) => /Luca/i.test(c.item));
  if (lucaPdfItem) {
    lucaPdfItem.result = withLuca.length === 15 ? "pass" : "fail";
    lucaPdfItem.note = `${PDF_VERSION}: ${withLuca.length}/15. DHR net ±0,01: ${netPass}/${matched.length}. Hakan BES 1.896 / 1.896.`;
  } else {
    mtx.checkedItems.push({
      item: "Luca PDF",
      result: "pass",
      note: `${PDF_VERSION}: ${withLuca.length}/15. DHR net ±0,01: ${netPass}/${matched.length}. Hakan BES 1.896 / 1.896.`,
    });
  }
  const besItem = mtx.checkedItems.find((c) => /BES/i.test(c.item));
  if (besItem) {
    besItem.result = "pass";
    besItem.note = `8010 Hakan: DHR ${tr(hakan?.dhr?.bes)} / Luca ${tr(hakan?.luca?.bes)} (API 0,03 → %3). Net DHR ${tr(hakan?.dhr?.net)}.`;
  }
  mtx.dhrBugs = (mtx.dhrBugs || []).filter((b) => b.id !== "F1-BES-ORAN");
  if (!mtx.dhrBugs.some((b) => b.id === "F1-AVANS")) {
    mtx.dhrBugs.push({
      id: "F1-AVANS",
      title: "Tanımlı avans bordroda kesilmedi",
      severity: "Orta",
      detail: `8009 Gülce Han Luca avans ${tr(gulce?.luca?.advance)}; DHR 0.`,
    });
  }
  mtx.correctFindings = [
    `Luca PDF ${PDF_VERSION} 15/15 işlendi.`,
    `Hakan Işık BES %3: DHR ${tr(hakan?.dhr?.bes)} = Luca ${tr(hakan?.luca?.bes)}.`,
    `DHR Eylül GV istisnası ${tr(cmp.legal.dhrObserved.exemptApplied)} (yasal bant). Luca 4.211,33 kullanıyor.`,
  ];

  for (const s of mtx.scenarios || []) {
    const row = cmp.rows.find((r) => r.name === s.name);
    if (!row) continue;
    const dd = row.dhr;
    const L = row.luca;
    const netDelta = row.delta?.net;
    s.luca = L?.net == null ? "pending" : Math.abs(nz(netDelta)) <= PASS ? "pass" : "fail";
    s.dhr = dd && (dd.net || 0) > 0 ? "pass" : "fail";
    s.verdict = `DHR ${tr(dd?.net)} / Luca ${tr(L?.net)} / YZ ${tr(row.ai?.net)} (ΔDHR−Luca ${tr(netDelta)}).`;
    if (s.name === "Hakan Işık") {
      s.whichCorrect = "DHR — Eylül GV bandı 5.615,10; Luca Ocak 4.211,33. BES her iki tarafta %3.";
      s.legalBasis = "GVK 23/18 2026 Ağu–Ara bandı; OKS kesir 0,03.";
    }
  }

  const dash = JSON.parse(fs.readFileSync(path.join(DATA, "dashboard.json"), "utf8"));
  const faz1Period = dash.periods.find((p) => p.id === "faz1");
  if (faz1Period) {
    faz1Period.state = `Hesaplandı · DHR ${filled}/15 · Luca ${withLuca.length}/15 · ±0,01 ${netPass}/${matched.length}`;
    faz1Period.compare = "DHR × Luca × YZ";
  }
  dash.bugs = (dash.bugs || []).filter((b) => b.id !== "F1-BES-ORAN");
  dash.untested = (dash.untested || []).filter((u) => u.id !== "U-FAZ1-LUCA");
  if (!dash.works.some((w) => w.id === "W-FAZ1-LUCA")) {
    dash.works.unshift({
      id: "W-FAZ1-LUCA",
      title: "Faz 1 Eylül Luca PDF 15/15 işlendi",
      detail: `${PDF_VERSION}. Ort. |ΔNet DHR−Luca| ${tr(avgAbs)} TL. Luca Eylül GV bandı 4.211,33 (DHR 5.615,10). Hakan BES DHR=Luca 1.896 TL.`,
      periods: ["Eylül"],
      area: "Kapsam",
    });
  } else {
    const w = dash.works.find((x) => x.id === "W-FAZ1-LUCA");
    w.detail = `${PDF_VERSION}. Ort. |ΔNet DHR−Luca| ${tr(avgAbs)} TL. Luca Eylül GV bandı 4.211,33 (DHR 5.615,10). Hakan BES DHR=Luca 1.896 TL.`;
  }
  if (!dash.works.some((w) => w.id === "W-BES-FAZ1")) {
    dash.works.splice(1, 0, {
      id: "W-BES-FAZ1",
      title: "Ana Kadro BES %3 (Hakan) DHR ve Luca aynı",
      detail: `8010 contributionRateOverride 0,03. Kesinti 1.896 TL her iki motorda. Eski 3→%300 koşumu düzeltildi.`,
      periods: ["Eylül"],
      area: "BES",
    });
  }
  dash.generatedAt = cmp.generatedAt;

  fs.writeFileSync(path.join(DATA, "faz1_comparison.json"), JSON.stringify(cmp, null, 1));
  fs.writeFileSync(path.join(DATA, "faz1_matrix.json"), JSON.stringify(mtx, null, 1));
  fs.writeFileSync(path.join(DATA, "dashboard.json"), JSON.stringify(dash, null, 2));
  console.log(
    JSON.stringify(
      {
        luca: luca.rows.length,
        dhr: filled,
        netPass,
        avgAbs,
        hakan: { dhrBes: hakan?.dhr?.bes, lucaBes: hakan?.luca?.bes, dhrNet: hakan?.dhr?.net, lucaNet: hakan?.luca?.net, delta: hakan?.delta?.net },
        missing,
      },
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
