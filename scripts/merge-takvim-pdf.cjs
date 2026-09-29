/**
 * Takvim Eylül: Luca PDF → takvim_comparison / matrix / dashboard.
 * DHR kolonuna dokunmaz. İK/Kenar/Operasyon yok.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const LUCA_PDF = process.argv[2] || path.join(process.env.USERPROFILE || "", "Downloads", "bordro_d1_tech (36).pdf");
const PUBLIC_PDF = path.join(ROOT, "public", "downloads", "bordro_takvim_eylul.pdf");
const PASS = 0.01;
const PDF_VERSION = path.basename(LUCA_PDF);

const cmp = JSON.parse(fs.readFileSync(path.join(DATA, "takvim_comparison.json"), "utf8"));
const mtx = JSON.parse(fs.readFileSync(path.join(DATA, "takvim_matrix.json"), "utf8"));

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
  if (luca.rows.length < 1) {
    console.error(luca.rows.map((r) => r.name).join(" | "));
    throw new Error(`Takvim Luca satır az: ${luca.rows.length}`);
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
  const cemre = cmp.rows.find((r) => r.sicil === "8063" || /cemre/i.test(r.name));

  cmp.generatedAt = new Date().toISOString();
  cmp.lucaPdfVersion = PDF_VERSION;
  cmp.pending = { luca: withLuca.length === 0, dhr: (cmp.summary.dhrCount || 0) === 0 };
  cmp.sources.lucaPdf = "downloads/bordro_takvim_eylul.pdf";
  cmp.summary.lucaCount = withLuca.length;
  cmp.summary.matched = matched.length;
  cmp.summary.netWithin100 = netWithin100;
  cmp.summary.netPass001 = netPass;
  cmp.summary.avgAbsNetDelta = avgAbs;

  cmp.ui.lead = `Takvim ${cmp.rows.length} kişi. DHR ${cmp.summary.dhrCount}/${cmp.rows.length} · Luca PDF ${withLuca.length}/${cmp.rows.length} (${PDF_VERSION}). Hakem YZ. İK / Ana Kadro / Kenar / Operasyon karışmaz.`;
  cmp.ui.verdict = `DHR×Luca ${matched.length}/${cmp.rows.length}. Ort. |ΔNet DHR−Luca| ${tr(avgAbs)} TL · ±0,01 ${netPass}/${matched.length}. Luca referans, YZ hakem.`;
  cmp.ui.footer = "İK / Ana Kadro / Paket / Yuvarlama / Kenar / Operasyon / Bordro A.Ş. bu sekmeye karışmaz.";
  cmp.ui.personCaption = "Çalışan seç → DHR, Luca PDF ve YZ mevzuat neti yan yana. Eşleşme ±0,01 TL.";
  cmp.ui.gvCompareTitle = "Eylül 2026 — GV istisnası (yasal 5.615,10 TL)";
  cmp.ui.gvBullets = [
    "Yasal Ağustos–Aralık 2026 bandı 5.615,10 TL.",
    `Luca PDF ${PDF_VERSION}: ${withLuca.length}/${cmp.rows.length}. Cemre Luca ${tr(cemre?.luca?.net)} / DHR ${tr(cemre?.dhr?.net)}.`,
    "Geçme ±0,01 TL. Luca referanstır, hakem değildir. Yol PDF’de N basılabilir; zemin B’dir, N için kişi düzeltilmez.",
  ];

  fs.writeFileSync(path.join(DATA, "takvim_comparison.json"), JSON.stringify(cmp, null, 2) + "\n");

  mtx.period = "Eylül 2026 · Takvim · DHR × Luca × YZ";
  mtx.sourceOfTruth = `YZ hakem. Luca referans (${PDF_VERSION}, ${withLuca.length}/${cmp.rows.length}). DHR ${cmp.summary.dhrCount}/${cmp.rows.length}. Geçme ±0,01 TL. Durum = DHR−Luca.`;
  mtx.matrixDesign.notFullCombinatorial = `Luca PDF ${PDF_VERSION} ${withLuca.length}/${cmp.rows.length}. Durum = DHR−Luca.`;
  mtx.checkedItems = (mtx.checkedItems || []).map((c) => {
    if (/Luca PDF/.test(c.item)) {
      return { ...c, result: withLuca.length === cmp.rows.length ? "pass" : "fail", note: `${PDF_VERSION}: ${withLuca.length}/${cmp.rows.length}. DHR net ±0,01: ${netPass}/${matched.length}.` };
    }
    if (/Luca hakem/.test(c.item)) {
      return { ...c, result: "pass", note: "Luca referans, hakem YZ." };
    }
    return c;
  });
  mtx.correctFindings = [
    `Luca PDF ${PDF_VERSION} ${withLuca.length}/${cmp.rows.length} işlendi.`,
    `DHR×Luca ±0,01 ${netPass}/${matched.length}. Ort. |ΔNet| ${tr(avgAbs)}.`,
    "Cemre Ay Eylül zemin: T.Gün 30, izin/rapor yok. Şubat 2027/2028 ayrı tur.",
  ];
  for (const s of mtx.scenarios || []) {
    const row = cmp.rows.find((r) => r.name === s.name);
    if (!row) continue;
    const netDelta = row.delta?.net;
    s.luca = row.luca?.net == null ? "pending" : Math.abs(nz(netDelta)) <= PASS ? "pass" : "fail";
    s.dhr = row.dhr?.net != null ? (Math.abs(nz(row.delta?.netAi)) <= PASS ? "pass" : "fail") : "pending";
    s.verdict =
      row.luca?.net == null
        ? `DHR net ${tr(row.dhr?.net)} · Luca bilgisi bekleniyor · YZ ${tr(row.ai?.net)}`
        : `DHR ${tr(row.dhr?.net)} / Luca ${tr(row.luca.net)} / YZ ${tr(row.ai?.net)} (ΔDHR−Luca ${tr(netDelta)})`;
    s.whichCorrect = "Hakem YZ. Luca referans, doğru kabul edilmez.";
  }
  fs.writeFileSync(path.join(DATA, "takvim_matrix.json"), JSON.stringify(mtx, null, 2) + "\n");

  const dash = JSON.parse(fs.readFileSync(path.join(DATA, "dashboard.json"), "utf8"));
  const p = dash.periods.find((x) => x.id === "takvim");
  if (p) {
    p.state = `Hesaplandı · DHR ${cmp.summary.dhrCount}/${cmp.rows.length} · Luca ${withLuca.length}/${cmp.rows.length} · ±0,01 ${netPass}/${matched.length}`;
    p.compare = "DHR × Luca × YZ";
  }
  dash.generatedAt = new Date().toISOString();
  dash.untested = (dash.untested || []).map((u) => {
    if (u.id !== "U-DIGER-BIRIMLER") return u;
    return {
      ...u,
      detail: `Şirket B (2) kapsam dışı. Operasyon 3/3 + Luca (35), Takvim 1/1 + Luca ${PDF_VERSION} ${withLuca.length}/${cmp.rows.length}, Kenar 53/53 + Luca (31), Yuvarlama 100/100, Blokaj 1/1. Blokaj Luca bilgisi bekleniyor; hakem YZ.`,
      blocker: "Bordro A.Ş. bu koşumda yok. Blokaj Eylül Taner net 56.548,11.",
    };
  });
  const tkWork = {
    id: "W-TK-LUCA",
    title: "Takvim Eylül Luca PDF (36) + DHR 1/1",
    detail: `${PDF_VERSION}: ${withLuca.length}/${cmp.rows.length}. Ort. |ΔNet DHR−Luca| ${tr(avgAbs)} TL · ±0,01 ${netPass}/${matched.length}. Cemre DHR ${tr(cemre?.dhr?.net)} / Luca ${tr(cemre?.luca?.net)}.`,
    periods: ["Eylül"],
    area: "Kapsam",
  };
  const wi = dash.works.findIndex((w) => w.id === "W-TK-LUCA");
  if (wi >= 0) dash.works[wi] = tkWork;
  else dash.works.unshift(tkWork);
  fs.writeFileSync(path.join(DATA, "dashboard.json"), JSON.stringify(dash, null, 2) + "\n");

  console.log("OK luca", withLuca.length, "matched", matched.length, "pass", netPass, "missing", missing.length);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
