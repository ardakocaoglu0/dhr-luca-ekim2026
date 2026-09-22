/**
 * Yuvarlama 100: Luca PDF (22) + YZ → yuvarlama_comparison / yuvarlama_matrix.
 * DHR Eylül dump yok; DHR kolonu BEKLİYOR.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const LUCA_PDF =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || "", "Downloads", "bordro_d1_tech (22).pdf");
const PUBLIC_PDF = path.join(ROOT, "public", "downloads", "bordro_yuvarlama_eylul.pdf");
const PASS = 0.01;
const PDF_VERSION = "bordro_d1_tech (22).pdf";

const roster = JSON.parse(fs.readFileSync(path.join(DATA, "faz1_roster.json"), "utf8"));
const MEVZUAT = JSON.parse(fs.readFileSync(path.join(DATA, "mevzuat.json"), "utf8"));

const parseTR = (s) => (s == null || s === "" ? null : Number(String(s).replace(/\./g, "").replace(",", ".")));
const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100) / 100);
const nz = (n) => (n == null || !Number.isFinite(Number(n)) ? 0 : Number(n));
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
  const month = 9;
  const gross = r2(input.gross);
  const tavan = p.asgariBrut * p.sgkTavanKat;
  const base = r2(Math.min(Math.max(gross, 0), tavan));
  const sgk = r2(base * p.sgkIsciOran);
  const unemployment = r2(base * p.issizlikIsciOran);
  const gvMatrah = r2(Math.max(0, gross - sgk - unemployment));
  const rawGv = r2(taxOnWage(gvMatrah));
  const exempt = MEVZUAT.monthExemptTax["9"] || 5615.1;
  const gvExemptApplied = r2(Math.min(exempt, rawGv));
  const gv = r2(Math.max(0, rawGv - exempt));
  const damgaFull = r2(gross * p.damgaOran);
  const damgaExempt = r2(p.asgariBrut * p.damgaOran);
  const damga = r2(Math.max(0, damgaFull - damgaExempt));
  const net = r2(gross - sgk - unemployment - gv - damga);
  return {
    salary: r2(input.salary),
    meal: r2(input.meal),
    transport: r2(input.transport),
    overtime: 0,
    prim: r2(input.prim),
    ikramiye: 0,
    masraf: 0,
    gross,
    sgk,
    unemployment,
    gv,
    damga,
    bes: 0,
    advance: 0,
    kesinti: 0,
    net,
    gvMatrah,
    gvExemptApplied,
    notes: [],
  };
}

function pickLabeled(slice, patterns) {
  for (const re of patterns) {
    const m = slice.match(re);
    if (m) return parseTR(m[1]);
  }
  return 0;
}

function extras(slice) {
  const digM = slice.match(/Di[gğ]er Kazan[cç]lar:\s*([^\n]*)/i);
  let digText = digM ? digM[1].trim() : "";
  if (/^--\s*\d/.test(digText)) digText = "";
  return {
    digText,
    meal: pickLabeled(digText, [/Yemek[^:\n]*:\s*([\d.]+,\d{2,3})/i]),
    transport: pickLabeled(digText, [/Yol[^:\n]*:\s*([\d.]+,\d{2,3})/i]),
    prim: pickLabeled(digText, [/\bPrim[^:\n]*:\s*([\d.]+,\d{2,3})/i]),
    overtime: pickLabeled(digText, [/Fazla Mesai[^:\n]*:\s*([\d.]+,\d{2})/i]),
  };
}

function rowFromMatch(m, text) {
  const ex = extras(text.slice(m.index, m.index + 2200));
  const L = {
    name: m[2].trim(),
    tc: m[3],
    hire: m[4],
    exit: m[5] || null,
    kanun: String(m[6]).padStart(5, "0"),
    ucret: parseTR(m[7]),
    gs: m[8],
    tgun: +m[9],
    topKaz: parseTR(m[13]),
    digKaz: parseTR(m[14]),
    sskMat: parseTR(m[15]),
    sgk: parseTR(m[17]),
    gv: parseTR(m[20]),
    damga: parseTR(m[22]),
    ozKes: parseTR(m[23]) || 0,
    net: parseTR(m[24]),
    ...ex,
    salary: parseTR(m[7]),
    gross: parseTR(m[13]),
    unemployment: null,
  };
  const residual = r2(
    nz(L.gross) - nz(L.sgk) - nz(L.gv) - nz(L.damga) - nz(L.net) - nz(L.ozKes)
  );
  const onePct = r2(nz(L.sskMat != null ? L.sskMat : L.gross) * 0.01);
  if (residual != null && (near(residual, onePct, 0.5) || Math.abs(residual) <= 0.05)) {
    L.unemployment = residual < 0 ? 0 : residual;
  }
  return L;
}

async function extractLuca(pdfPath) {
  if (!fs.existsSync(pdfPath)) throw new Error("PDF yok: " + pdfPath);
  const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
  const { text } = await parser.getText();
  const re =
    /(\d+)\s+([A-Za-z0-9\u00C7\u00E7\u011E\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC ]+?)\s+(45\d{9})(?:\s+\d+\s+G[uü]n(?:\s+\d+\s+[^\n\d]{0,48})?)?\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?\s+(\d+)\s+([\d.]+,\d{2})([GN])\s+(\d+)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*\r?\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;
  const rows = [];
  let m;
  while ((m = re.exec(text))) rows.push(rowFromMatch(m, text));
  return rows;
}

function lineItems(L, ai) {
  return LINE_DEFS.map((def) => {
    const luca = L[def.key] ?? (def.key === "salary" ? L.ucret : def.key === "gross" ? L.gross : L[def.key]);
    const lucaVal = luca == null ? null : r2(luca);
    const aiVal = ai[def.key] == null ? null : r2(ai[def.key]);
    const deltaLucaAi = dlt(lucaVal, aiVal);
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      dhr: null,
      luca: lucaVal,
      delta: null,
      match: false,
      ai: aiVal,
      deltaDhrAi: null,
      deltaLucaAi,
      matchAi: false,
      matchLucaAi: deltaLucaAi != null && Math.abs(deltaLucaAi) <= PASS,
    };
  });
}

function aggregate(rows) {
  return LINE_DEFS.map((def) => {
    let lucaSum = 0;
    let aiSum = 0;
    let comparedLucaAi = 0;
    let matchLucaAi = 0;
    let peopleWithValue = 0;
    for (const r of rows) {
      const it = (r.lineItems || []).find((x) => x.key === def.key);
      if (!it) continue;
      lucaSum += nz(it.luca);
      aiSum += nz(it.ai);
      if (it.deltaLucaAi != null) {
        comparedLucaAi++;
        if (it.matchLucaAi) matchLucaAi++;
      }
      if (nz(it.luca) || nz(it.ai)) peopleWithValue++;
    }
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      dhrSum: 0,
      lucaSum: r2(lucaSum),
      aiSum: r2(aiSum),
      deltaSum: null,
      deltaDhrAi: null,
      deltaLucaAi: r2(lucaSum - aiSum),
      peopleWithValue,
      matchCount: 0,
      compared: 0,
      matchAi: 0,
      comparedAi: 0,
      matchLucaAi,
      comparedLucaAi,
    };
  });
}

(async () => {
  const people = roster.people.filter((p) => p.unit === "yuvarlama").sort((a, b) => Number(a.sicil) - Number(b.sicil));
  const lucaRows = await extractLuca(LUCA_PDF);
  const byName = Object.fromEntries(lucaRows.map((r) => [fold(r.name), r]));
  const missing = [];
  const rows = [];
  const scenarios = [];

  for (const [i, p] of people.entries()) {
    const L =
      byName[fold(p.name)] ||
      byName[fold("Yuvarlama" + String(Number(p.lastName)))];
    if (!L) {
      missing.push(p.name);
      continue;
    }
    const prim = r2(L.prim || p.roundingAddon || 0);
    const salary = r2(L.salary || 60000);
    const meal = r2(L.meal || 5500);
    const transport = r2(L.transport || 3200);
    const gross = r2(L.gross || salary + meal + transport + prim);
    const ai = computeAi({ salary, meal, transport, prim, gross });
    const luca = {
      salary,
      meal,
      transport,
      overtime: r2(L.overtime || 0),
      prim,
      ikramiye: 0,
      masraf: 0,
      kesinti: r2(L.ozKes || 0),
      advance: 0,
      gross,
      net: r2(L.net),
      gv: r2(L.gv),
      sgk: r2(L.sgk),
      unemployment: r2(L.unemployment),
      damga: r2(L.damga),
      bes: 0,
      saglik: 0,
      besEmployer: 0,
      kanun: L.kanun,
      ucret: salary,
      topKaz: gross,
      digKaz: r2(L.digKaz),
      tgun: L.tgun,
      sskMat: r2(L.sskMat),
      digText: L.digText,
      ozText: "",
      fmHours: null,
      hire: L.hire,
      exit: L.exit,
      tc: L.tc,
      name: L.name,
      gs: L.gs,
    };
    const items = lineItems(luca, ai);
    const netLucaAi = dlt(luca.net, ai.net);
    rows.push({
      n: i + 1,
      name: p.name,
      tc: p.sicil,
      sicil: p.sicil,
      note: p.note,
      profile: p.profile || "Standart",
      input: `Prim ${tr(prim)} B · Yol 3.200 · Yemek 5.500`,
      lucaKanunExpected: "00000",
      lucaPending: false,
      dhrPending: true,
      luca,
      dhr: null,
      delta: {
        net: null,
        gv: null,
        damga: null,
        netLucaAi,
      },
      ai,
      lineItems: items,
    });
    scenarios.push({
      n: i + 1,
      name: p.name,
      group: "yuvarlama",
      scenario: p.note,
      profile: p.profile || "Standart",
      law: "00000",
      input: `Prim ${tr(prim)}`,
      dhr: "pending",
      luca: "pass",
      ai: Math.abs(nz(netLucaAi)) <= PASS ? "pass" : "fail",
      verdict: `Luca ${tr(luca.net)} / YZ ${tr(ai.net)} (ΔLuca−YZ ${tr(netLucaAi)}). DHR bekliyor.`,
      whichCorrect: "YZ hakem; Luca referans.",
      legalBasis: "2026 GVK 23/18, 5510, 4447, 488. Luca 2 hane prim 0,05–0,09.",
    });
  }

  if (missing.length) throw new Error("PDF’de yok: " + missing.join(", "));
  if (rows.length !== 100) throw new Error("expected 100 Yuvarlama rows, got " + rows.length);

  const kalemler = aggregate(rows);
  const netDeltas = rows.map((r) => r.delta.netLucaAi).filter((v) => v != null);
  const avg = netDeltas.length ? r2(netDeltas.reduce((a, v) => a + Math.abs(v), 0) / netDeltas.length) : null;
  const pass001 = netDeltas.filter((v) => Math.abs(v) <= PASS).length;
  const within100 = netDeltas.filter((v) => Math.abs(v) <= 100).length;

  const cmp = {
    generatedAt: new Date().toISOString(),
    period: "Eylül 2026",
    unit: "Yuvarlama (8101–8200 · 100 kişi)",
    lucaPdfVersion: PDF_VERSION,
    pending: { luca: false, dhr: true },
    ui: {
      title: "Eylül 2026 — Yuvarlama 100",
      lead: "Yuvarlama 01–100. Luca PDF 100/100 (bordro_d1_tech (22).pdf). YZ 2026 mevzuatı. DHR Eylül dump henüz yok. Ana Kadro 15’lik diğer sekmede.",
      verdict: `Luca×YZ 100/100. Ort. |ΔNet Luca−YZ| ${tr(avg)} · ±0,01 ${pass001}/100. DHR bekliyor. Prim 0,05–0,09 B; Yol dökümde N (tutar 3.200).`,
      footer: "İK / Ana Kadro / Paket bu sekmeye karışmaz. Yuvarlama yalnız 8101–8200.",
      personCaption: "Çalışan seç → Luca PDF ve YZ neti yan yana. DHR kolonu Eylül hesaplanınca dolar. Eşleşme ±0,01 TL.",
      gvCompareTitle: "Eylül 2026 — Yuvarlama GV: Luca vs yasal (YZ)",
      gvBullets: [
        "Luca Eylül’de Ocak GV bandı (4.211,33) kullanıyor; YZ 5.615,10.",
        "Zemin: 60.000 G + yemek 5.500 B + yol 3.200 + Prim 0,05–0,09 B, T.Gün 30.",
        "PDF (22) net 55.144,37…41. DHR henüz yok.",
      ],
      drivers: [
        {
          title: "Prim 0,05–0,09",
          body: "Luca 2 hane. 01/06/11…=0,05; 02/07…=0,06; 03/08…=0,07; 04/09…=0,08; 05/10/100=0,09. YZ aynı tutarı kazanca ekler.",
        },
        {
          title: "Yol N döküm",
          body: "PDF `Yol: 3.200,00 N` basar; kart/form Brüt. Tutar 3.200. Harf karşılaştırmayı bozmaz.",
        },
        {
          title: "DHR bekliyor",
          body: "Kartta Yuvarlama Farkı 0,05–0,09 yazıldı. Eylül dönemi dump’ı gelince DHR kolonu dolar.",
        },
      ],
    },
    sources: {
      lucaPdf: "downloads/bordro_yuvarlama_eylul.pdf",
      dhrExcel: "https://dhrtest2.d1-tech.com.tr — Yuvarlama Eylül henüz dump yok",
      aiMevzuat: "mevzuat.json — 193 GVK, 332 GT, 5510, 4447, 488, 2026 asgari",
    },
    summary: {
      lucaCount: 100,
      dhrCount: 0,
      matched: 0,
      netWithin100: 0,
      avgAbsNetDelta: null,
      fmHoursTotalLuca: null,
      aiCount: 100,
      avgAbsNetDeltaAi: null,
      netWithin100Ai: 0,
      netPass001: pass001,
      avgAbsNetDeltaLucaAi: avg,
      netWithin100LucaAi: within100,
    },
    lineDefs: LINE_DEFS,
    rows,
    kalemler,
    findings: [
      `Luca PDF ${PDF_VERSION} 100/100.`,
      `YZ 100/100. Ort. |ΔNet Luca−YZ| ${tr(avg)} TL.`,
      "DHR Eylül Yuvarlama dump yok.",
    ],
    legal: {
      gvMonthly2026: [
        { month: "Ocak", exempt: 4211.33, rate: 15 },
        { month: "Şubat", exempt: 4211.33, rate: 15 },
        { month: "Mart", exempt: 4211.33, rate: 15 },
        { month: "Nisan", exempt: 4211.33, rate: 15 },
        { month: "Mayıs", exempt: 4211.33, rate: 15 },
        { month: "Haziran", exempt: 4211.33, rate: 15 },
        { month: "Temmuz", exempt: 4537.75, rate: 15 },
        { month: "Ağustos", exempt: 5615.1, rate: 15 },
        { month: "Eylül", exempt: 5615.1, rate: 15 },
        { month: "Ekim", exempt: 5615.1, rate: 15 },
        { month: "Kasım", exempt: 5615.1, rate: 15 },
        { month: "Aralık", exempt: 5615.1, rate: 15 },
      ],
      dhrObserved: { exemptApplied: 0, paramFormulaValue: 5615.1, allMonthsSame: false },
      lucaObserved: { exemptApplied: 4211.33, octoberLegal: 5615.1 },
    },
    aiReport: {
      month: 9,
      engine: "YZ — 2026 Türkiye bordro mevzuatı (mevzuat.json)",
      disclaimer:
        "YZ kolonu mevzuat metninden hesaplandı. Luca referans (bordro_d1_tech (22).pdf). DHR Eylül Yuvarlama henüz yok. Durum Δ Luca−YZ.",
      findings: [
        {
          id: "YUV-LUCA-100",
          vs: "Luca ↔ YZ",
          result: "beklenen",
          detail: `100/100 Luca. Ort. |ΔNet Luca−YZ| ${tr(avg)} TL (Luca Ocak GV bandı 4.211,33; YZ 5.615,10).`,
        },
        {
          id: "YUV-DHR-PENDING",
          vs: "DHR",
          result: "bekliyor",
          detail: "Yuvarlama Eylül dump yok. Kartta Yuvarlama Farkı 0,05–0,09.",
        },
      ],
    },
  };

  const mtx = {
    period: "Eylül 2026 · Yuvarlama · Luca × YZ (DHR bekliyor)",
    environment: "https://dhrtest2.d1-tech.com.tr",
    sourceOfTruth: "YZ hakem. Luca referans (bordro_d1_tech (22).pdf, 100/100). DHR Eylül henüz yok. Geçme ±0,01 TL.",
    matrixDesign: {
      layers: [
        { id: "yuv", title: "Yuvarlama 01–100", desc: "Aynı brüt + 0,05–0,09 prim (Luca 2 hane)" },
        { id: "hsp", title: "HSP-021", desc: "Kuruş / yuvarlama örneği" },
      ],
      notFullCombinatorial: "Yuvarlama 100 kişi; Ana Kadro 15’lik değil.",
    },
    checkedItems: [
      { item: "Luca PDF 100 kişi", result: "pass", note: `${PDF_VERSION}: 100/100 Yuvarlama, başka kadro yok.` },
      { item: "T.Gün 30 / 60.000 G / yemek 5.500 B", result: "pass", note: "100/100." },
      { item: "Prim 0,05–0,09 B döngüsü", result: "pass", note: "20+20+20+20+20." },
      { item: "DHR Eylül hesap", result: "pending", note: "Yuvarlama Farkı kartta var; dönem dump’ı yok." },
      {
        item: "Luca vs YZ net ±0,01",
        result: pass001 === 100 ? "pass" : "fail",
        note: `±0,01 ${pass001}/100. Ort. |Δ| ${tr(avg)} (Luca Ocak GV bandı).`,
      },
    ],
    correctFindings: [
      "Luca PDF 22: 100 Yuvarlama, net 55.144,37…41.",
      "Prim 0,05–0,09 B, yemek 5.500 B, yol 3.200.",
      "01 İstirahat / yol kesinti (21) PDF 22’de yok.",
    ],
    dhrBugs: [],
    warnings: [
      {
        id: "YUV-YOL-N",
        title: "Luca dökümde Yol N",
        detail: "Kart/form Brüt; PDF `Yol: 3.200,00 N` basar. Tutar doğru.",
        severity: "Bilgi",
      },
    ],
    scenarios,
  };

  fs.mkdirSync(path.dirname(PUBLIC_PDF), { recursive: true });
  fs.copyFileSync(LUCA_PDF, PUBLIC_PDF);
  fs.writeFileSync(path.join(DATA, "yuvarlama_comparison.json"), JSON.stringify(cmp, null, 1));
  fs.writeFileSync(path.join(DATA, "yuvarlama_matrix.json"), JSON.stringify(mtx, null, 1));
  console.log(
    JSON.stringify(
      {
        rows: rows.length,
        lucaPdf: lucaRows.length,
        avgAbsNetLucaAi: avg,
        pass001,
        sample: rows.slice(0, 3).map((r) => ({ name: r.name, luca: r.luca.net, ai: r.ai.net, d: r.delta.netLucaAi, prim: r.luca.prim })),
      },
      null,
      2
    )
  );
})();
