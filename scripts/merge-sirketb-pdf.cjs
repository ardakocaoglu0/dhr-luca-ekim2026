/**
 * Faz1 Bordro A.Ş. Eylül: Luca PDF → sirketb_comparison / matrix / dashboard.
 * DHR henüz yok (dump yok). İK/Kenar yok.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const LUCA_PDF = process.argv[2] || path.join(process.env.USERPROFILE || "", "Downloads", "bordro_d1_tech (39).pdf");
const PUBLIC_PDF = path.join(ROOT, "public", "downloads", "bordro_sirketb_eylul.pdf");
const PASS = 0.01;
const PDF_VERSION = path.basename(LUCA_PDF);
const MEVZUAT = JSON.parse(fs.readFileSync(path.join(DATA, "mevzuat.json"), "utf8"));
const roster = JSON.parse(fs.readFileSync(path.join(DATA, "faz1_roster.json"), "utf8"));
const legal = JSON.parse(fs.readFileSync(path.join(DATA, "blokaj_comparison.json"), "utf8")).legal;
const mtx = JSON.parse(fs.readFileSync(path.join(DATA, "sirketb_matrix.json"), "utf8"));

const parseTR = (s) => (s == null || s === "" ? null : Number(String(s).replace(/\./g, "").replace(",", ".")));
const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100) / 100);
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
  const sgk = r2(base * p.sgkIsciOran);
  const unemployment = r2(base * p.issizlikIsciOran);
  const gvMatrah = r2(Math.max(0, gross - sgk - unemployment));
  const rawGv = r2(taxOnWage(gvMatrah));
  const exempt = MEVZUAT.monthExemptTax["9"] || 5615.1;
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
    prim: 0,
    ikramiye: 0,
    masraf: 0,
    besEmployer: 0,
    saglik: 0,
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
    gvExemptApplied: r2(Math.min(exempt, rawGv)),
  };
}

function payFor(p) {
  if (String(p.sicil) === "8061") return { salary: 40000, meal: 5500, transport: 3200 };
  return { salary: 60000, meal: 5500, transport: 3200 };
}

function bootstrapCmp() {
  const people = roster.people.filter((p) => p.unit === "sirket-b").sort((a, b) => Number(a.sicil) - Number(b.sicil));
  const rows = people.map((p, i) => {
    const pay = payFor(p);
    const gross = r2(pay.salary + pay.meal + pay.transport);
    const ai = computeAi({ ...pay, gross });
    const empty = Object.fromEntries(LINE_DEFS.map((d) => [d.key, null]));
    return {
      n: i + 1,
      name: p.name,
      tc: String(p.sicil),
      sicil: String(p.sicil),
      note: p.note,
      profile: p.profile,
      input: String(p.sicil) === "8061" ? "EDGE-018" : "—",
      lucaKanunExpected: "00000",
      lucaPending: true,
      dhrPending: true,
      luca: { ...empty },
      dhr: null,
      ai,
      delta: null,
      lineItems: LINE_DEFS.map((d) => ({
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
      })),
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    period: "Eylül 2026",
    unit: "Faz1 Bordro A.Ş.",
    lucaPdfVersion: null,
    pending: { luca: true, dhr: true },
    ui: { title: "Eylül 2026 — Faz1 Bordro A.Ş." },
    sources: {
      lucaPdf: "",
      dhrExcel: "https://dhrtest2.d1-tech.com.tr — Bordro A.Ş. DHR dump yok",
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
      netPass001: 0,
    },
    lineDefs: LINE_DEFS,
    kalemler: LINE_DEFS.map((d) => ({ ...d, dhrSum: 0, lucaSum: 0, aiSum: 0, deltaSum: null, peopleWithValue: 0, matchCount: 0, compared: 0 })),
    rows,
    legal,
  };
}

const cmp = bootstrapCmp();

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
    kesinti: r2(
      nz(pickLabeled(blob, [/\bicra[^:\n]*:\s*([\d.]+,\d{2})/i])) +
        nz(pickLabeled(blob, [/Genel Kesinti[^:\n]*:\s*([\d.]+,\d{2})/i])) +
        nz(pickLabeled(blob, [/[Iİ]şveren Alaca[gğ][ıi][^:\n]*:\s*([\d.]+,\d{2})/i]))
    ),
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
    /(\d+)\s+([A-Za-z0-9\u00C7\u00E7\u011E\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC ]+?)\s+((?:43|45)\d{9})(?:\s+\d+\s+G[uü]n(?:\s+\d+\s+[^\n\d]{0,48})?)?\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?\s+(\d+)\s+([\d.]+,\d{2})([GN])\s+(\d+)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*\r?\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;
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

function makeTckn45(sicil) {
  const n = Number(sicil);
  const body = 452800000 + (n - 8000);
  const d = String(body).padStart(9, "0").split("").map(Number);
  d[0] = 4;
  d[1] = 5;
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = (d.reduce((a, b) => a + b, 0) + d10) % 10;
  return d.join("") + d10 + d11;
}

(async () => {
  if (!fs.existsSync(LUCA_PDF)) throw new Error("PDF yok: " + LUCA_PDF);
  const luca = await extractLuca(LUCA_PDF);
  console.log("LUCA_PARSE", luca.rows.length, "text", luca.textLen);
  if (luca.rows.length < 2) {
    console.error(luca.rows.map((r) => r.name).join(" | "));
    throw new Error(`Bordro A.Ş. Luca satır az: ${luca.rows.length}`);
  }

  const byName = Object.fromEntries(luca.rows.map((r) => [normName(r.name), r]));
  const byTc = Object.fromEntries(luca.rows.map((r) => [String(r.tc), r]));
  const used = new Set();
  const missing = [];
  for (const row of cmp.rows) {
    const Lraw = byTc[makeTckn45(row.sicil)] || byName[normName(row.name)];
    if (!Lraw) {
      missing.push(row.name);
      row.lucaPending = true;
      continue;
    }
    used.add(normName(Lraw.name));
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
  const extra = luca.rows.filter((r) => !used.has(normName(r.name))).map((r) => r.name);
  if (missing.length) console.log("UNMATCHED_SITE", missing.length, missing.join(" | "));
  if (extra.length) console.log("EXTRA_PDF", extra.length, extra.join(" | "));

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
  const eda = cmp.rows.find((r) => r.sicil === "8062" || /eda/i.test(r.name));
  const ozan = cmp.rows.find((r) => r.sicil === "8061" || /ozan/i.test(r.name));

  cmp.generatedAt = new Date().toISOString();
  cmp.lucaPdfVersion = PDF_VERSION;
  cmp.pending = { luca: withLuca.length === 0, dhr: true };
  cmp.summary.dhrCount = 0;
  cmp.sources.lucaPdf = "downloads/bordro_sirketb_eylul.pdf";
  cmp.summary.lucaCount = withLuca.length;
  cmp.summary.matched = matched.length;
  cmp.summary.netWithin100 = netWithin100;
  cmp.summary.netPass001 = netPass;
  cmp.summary.avgAbsNetDelta = avgAbs;
  cmp.summary.aiCount = cmp.rows.filter((r) => r.ai?.net != null).length;

  cmp.ui.title = "Eylül 2026 — Faz1 Bordro A.Ş.";
  cmp.ui.lead = `Bordro A.Ş. ${cmp.rows.length} kişi. DHR bekleniyor · Luca PDF ${withLuca.length}/${cmp.rows.length} (${PDF_VERSION}). Hakem YZ. Kenar / İK karışmaz.`;
  cmp.ui.verdict = `Luca ${withLuca.length}/${cmp.rows.length}. DHR henüz yok. Eda Luca ${tr(eda?.luca?.net)} · Ozan Luca ${tr(ozan?.luca?.net)}. Luca referans, YZ hakem.`;
  cmp.ui.footer = "İK / Ana Kadro / Paket / Yuvarlama / Kenar / Operasyon / Takvim / Blokaj bu sekmeye karışmaz.";
  cmp.ui.personCaption = "Çalışan seç → Luca PDF ve YZ mevzuat neti. DHR dump gelince dolar.";
  cmp.ui.gvCompareTitle = "Eylül 2026 — GV istisnası (yasal 5.615,10 TL)";
  cmp.ui.gvBullets = [
    "Yasal Ağustos–Aralık 2026 bandı 5.615,10 TL.",
    `Luca PDF ${PDF_VERSION}: ${withLuca.length}/${cmp.rows.length}. Eda Luca ${tr(eda?.luca?.net)}. Ozan Luca ${tr(ozan?.luca?.net)} (T.Gün 20, giriş 11/09).`,
    "Geçme ±0,01 TL. Luca referanstır, hakem değildir. Yol PDF’de N basılabilir; zemin B’dir, N için kişi düzeltilmez.",
  ];

  fs.writeFileSync(path.join(DATA, "sirketb_comparison.json"), JSON.stringify(cmp, null, 2) + "\n");

  mtx.period = "Eylül 2026 · Faz1 Bordro A.Ş. · Luca × YZ (DHR bekleniyor)";
  mtx.sourceOfTruth = `YZ hakem. Luca referans (${PDF_VERSION}, ${withLuca.length}/${cmp.rows.length}). DHR yok. Geçme ±0,01 TL.`;
  mtx.matrixDesign.notFullCombinatorial = `Luca PDF ${PDF_VERSION} ${withLuca.length}/${cmp.rows.length}. DHR dump yok.`;
  mtx.checkedItems = [
    { item: "Geçme eşiği ±0,01 TL", result: "pass", note: "partial/known/kısmen geçti yok." },
    { item: "Luca hakem değil", result: "pass", note: "Luca referans, hakem YZ." },
    { item: "DHR Eylül 2026 hesap", result: "pending", note: "Bordro A.Ş. DHR dump yok." },
    { item: "Luca PDF", result: withLuca.length === cmp.rows.length ? "pass" : "fail", note: `${PDF_VERSION}: ${withLuca.length}/${cmp.rows.length}.` },
  ];
  mtx.correctFindings = [
    `Luca PDF ${PDF_VERSION} ${withLuca.length}/${cmp.rows.length} işlendi.`,
    "Eda T.Gün 30 zemin. Ozan giriş 11/09 T.Gün 20, yemek/yol tam 5.500/3.200.",
  ];
  for (const s of mtx.scenarios || []) {
    const row = cmp.rows.find((r) => r.name === s.name);
    if (!row) continue;
    s.luca = row.luca?.net == null ? "pending" : "pass";
    s.dhr = "pending";
    s.verdict = `Luca ${tr(row.luca?.net)} · DHR bekleniyor · YZ ${tr(row.ai?.net)}`;
    s.whichCorrect = "Hakem YZ. Luca referans, doğru kabul edilmez.";
  }
  fs.writeFileSync(path.join(DATA, "sirketb_matrix.json"), JSON.stringify(mtx, null, 2) + "\n");

  const dash = JSON.parse(fs.readFileSync(path.join(DATA, "dashboard.json"), "utf8"));
  let p = dash.periods.find((x) => x.id === "sirketb");
  if (!p) {
    p = { id: "sirketb", label: "Eylül 2026 — Faz1 Bordro A.Ş.", unit: "Faz1 Bordro A.Ş.", people: 2 };
    dash.periods.push(p);
  }
  p.state = `Luca ${withLuca.length}/${cmp.rows.length} · DHR bekleniyor · YZ ${cmp.summary.aiCount}`;
  p.compare = "Luca × YZ (DHR bekleniyor)";
  p.people = 2;
  dash.generatedAt = new Date().toISOString();
  dash.untested = (dash.untested || []).map((u) => {
    if (u.id !== "U-DIGER-BIRIMLER") return u;
    return {
      ...u,
      title: "Faz1 Bordro A.Ş. DHR dump yok",
      detail: `Bordro A.Ş. Luca ${PDF_VERSION} ${withLuca.length}/2 sitede. DHR henüz yok. Operasyon (35), Takvim (36), Blokaj (37), Kenar (31) Luca duruyor.`,
      blocker: "dhrtest2 Bordro A.Ş. Eylül onlyStale dump; full recalc yok.",
    };
  });
  const sbWork = {
    id: "W-SB-LUCA",
    title: "Bordro A.Ş. Eylül Luca PDF (39)",
    detail: `${PDF_VERSION}: ${withLuca.length}/2. Eda Luca ${tr(eda?.luca?.net)}. Ozan Luca ${tr(ozan?.luca?.net)} (20 gün). DHR yok.`,
    periods: ["Eylül"],
    area: "Kapsam",
  };
  const wi = dash.works.findIndex((w) => w.id === "W-SB-LUCA");
  if (wi >= 0) dash.works[wi] = sbWork;
  else dash.works.unshift(sbWork);
  fs.writeFileSync(path.join(DATA, "dashboard.json"), JSON.stringify(dash, null, 2) + "\n");

  console.log("OK luca", withLuca.length, "matched", matched.length, "pass", netPass, "missing", missing.length);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
