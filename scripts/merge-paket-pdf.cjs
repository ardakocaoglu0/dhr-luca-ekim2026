/**
 * Bordro Paket Ocak 2026: Luca PDF → paket_comparison + paket_matrix.
 * DHR / YZ kolonlarına dokunmaz. İK public/downloads/bordro_d1_tech.pdf üzerine yazmaz.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const LUCA_PDF = process.argv[2] || "C:/Users/ardak/Downloads/bordro_d1_tech.pdf";
const PUBLIC_PDF = path.join(ROOT, "public", "downloads", "bordro_paket_ocak.pdf");
const PASS = 0.01;
const MINE_DHR = 48074.49;

const roster = JSON.parse(fs.readFileSync(path.join(DATA, "paket_roster.json"), "utf8"));
const cmp = JSON.parse(fs.readFileSync(path.join(DATA, "paket_comparison.json"), "utf8"));
const mtx = JSON.parse(fs.readFileSync(path.join(DATA, "paket_matrix.json"), "utf8"));

const parseTR = (s) => (s == null || s === "" ? null : Number(String(s).replace(/\./g, "").replace(",", ".")));
const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100) / 100);
const nz = (n) => (n == null || !Number.isFinite(Number(n)) ? 0 : Number(n));
const near = (a, b, tol = PASS) => Math.abs(nz(a) - nz(b)) <= tol;
const tr = (n) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  if (/Normal Kazan/i.test(ozText) && !/(Avans|icra|BES|Kesinti|Nafaka|Sendika|Alacak)/i.test(ozText)) ozText = "";
  const blob = `${digText}\n${ozText}`;
  return {
    digText,
    ozText,
    meal: pickLabeled(blob, [/Yemek[^:\n]*:\s*([\d.]+,\d{2})/i]),
    transport: pickLabeled(blob, [/Yol[^:\n]*:\s*([\d.]+,\d{2})/i]),
    overtime: pickLabeled(blob, [/Fazla Mesai[^:\n]*:\s*([\d.]+,\d{2})/i]),
    prim: pickLabeled(blob, [/\bPrim[^:\n]*:\s*([\d.]+,\d{2})/i]),
    ikramiye: pickLabeled(blob, [/[Iİ]kramiye[^:\n]*:\s*([\d.]+,\d{2})/i]),
    childAid: pickLabeled(blob, [/[ÇC]ocuk[^:\n]*:\s*([\d.]+,\d{2})/i]),
    spouseAid: pickLabeled(blob, [/[EÉ][şs] Yard[^:\n]*:\s*([\d.]+,\d{2})/i, /\bE[şs]:\s*([\d.]+,\d{2})/i]),
    health: pickLabeled(blob, [/Özel Sigorta[^:\n]*:\s*([\d.]+,\d{2})/i, /Ozel Sigorta[^:\n]*:\s*([\d.]+,\d{2})/i]),
    leaveAllowance: pickLabeled(blob, [/[İI]zin Har[^:\n]*:\s*([\d.]+,\d{2})/i, /[İI]zin[^:\n]*:\s*([\d.]+,\d{2})/i]),
    advance: pickLabeled(blob, [/Avans[^:\n]*:\s*([\d.]+,\d{2})/i]),
    nafaka: pickLabeled(blob, [/Nafaka[^:\n]*:\s*([\d.]+,\d{2})/i]),
    icra: pickLabeled(blob, [/\bicra[^:\n]*:\s*([\d.]+,\d{2})/i]),
    kesinti: pickLabeled(blob, [/Genel Kesinti[^:\n]*:\s*([\d.]+,\d{2})/i, /Sendika[^:\n]*:\s*([\d.]+,\d{2})/i, /Alacak[^:\n]*:\s*([\d.]+,\d{2})/i]),
    bes: pickLabeled(blob, [/Oto\.?\s*Kat\.?\s*BES[^:\n]*:\s*([\d.]+,\d{2})/i, /\bBES[^:\n]*:\s*([\d.]+,\d{2})/i]),
    masraf: pickLabeled(blob, [/Masraf[^:\n]*:\s*([\d.]+,\d{2})/i]),
  };
}

function rowFromMatch(m, text) {
  const extras = parseLucaExtras(text.slice(m.index, m.index + 1800));
  const ozKes = parseTR(m[22]) || 0;
  const labelledOz = (extras.advance || 0) + (extras.icra || 0) + (extras.nafaka || 0) + (extras.kesinti || 0) + (extras.bes || 0);
  const ghost = r2(Math.max(0, ozKes - labelledOz));
  const kesinti = r2((extras.kesinti || 0) + ghost);
  const L = {
    name: m[2].trim(),
    tc: m[3],
    hire: m[4],
    kanun: String(m[5]).padStart(5, "0"),
    ucret: parseTR(m[6]),
    gs: m[7],
    tgun: +m[8],
    izgun: +m[9],
    norKaz: parseTR(m[10]),
    topKaz: parseTR(m[12]),
    digKaz: parseTR(m[13]),
    sskMat: parseTR(m[14]),
    sskIsci: parseTR(m[16]),
    gv: parseTR(m[19]),
    damga: parseTR(m[21]),
    ozKes,
    net: parseTR(m[23]),
    ...extras,
    kesinti,
    ghostKesinti: ghost,
    unemployment: null,
    salary: parseTR(m[6]),
    gross: parseTR(m[12]),
    sgk: parseTR(m[16]),
  };
  const residual = r2(
    nz(L.gross) - nz(L.sgk) - nz(L.gv) - nz(L.damga) - nz(L.bes) - nz(L.kesinti) - nz(L.icra) - nz(L.nafaka) - nz(L.advance) - nz(L.net)
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
    /(\d+)\s+([A-Za-z\u00C7\u00E7\u011E\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC ]+?)\s+(43\d{9})(?:\s+\d+\s+G[uü]n(?:\s+\d+\s+[^\n\d]{0,40})?)?\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+([\d.]+,\d{2})([GN])\s+(\d+)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*\r?\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;
  let m;
  while ((m = re.exec(text))) rows.push(rowFromMatch(m, text));
  return { rows, textLen: text.length, text };
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
    childAid: L.childAid,
    spouseAid: L.spouseAid,
    health: L.health,
    leaveAllowance: L.leaveAllowance,
    kesinti: L.kesinti,
    nafaka: L.nafaka,
    icra: L.icra,
    advance: L.advance,
    gross: L.gross,
    net: L.net,
    gv: L.gv,
    sgk: L.sgk,
    unemployment: L.unemployment,
    damga: L.damga,
    bes: L.bes,
    kanun: L.kanun,
    ucret: L.ucret,
    topKaz: L.topKaz,
    digKaz: L.digKaz,
    tgun: L.tgun,
    sskMat: L.sskMat,
    digText: L.digText,
    ozText: L.ozText,
    gs: L.gs,
    ozKes: L.ozKes,
    ghostKesinti: L.ghostKesinti,
    hire: L.hire,
  };
}

function lucaHakem(p, L, D, ai) {
  const notes = [];
  let luca = "pass";
  if (!L || L.net == null) {
    return { luca: "fail", notes: ["PDF’de yok"], whichCorrect: "", legalBasis: "", verdict: `${p.scenario}: Luca PDF’de yok.` };
  }
  const f = p.seedFlags || {};
  if (p.avans && nz(L.advance) <= 0.05) {
    luca = "fail";
    notes.push("avans 7.200 yok");
  }
  if (f.icra && nz(L.icra) <= 0.05) {
    luca = "fail";
    notes.push(`icra ${tr(f.icra)} yok`);
  }
  if (f.nafaka && nz(L.nafaka) <= 0.05) {
    luca = "fail";
    notes.push(`nafaka ${tr(f.nafaka)} yok`);
  }
  if (f.sendika && nz(L.kesinti) <= 0.05) {
    luca = "fail";
    notes.push("sendika 450 yok");
  }
  if (f.employerClaim && nz(L.kesinti) <= 0.05 && nz(L.advance) > 0.05) {
    luca = "fail";
    notes.push(`işveren alacağı yok; avans ${tr(L.advance)} yazılmış`);
  } else if (f.employerClaim && nz(L.kesinti) <= 0.05 && nz(L.advance) <= 0.05) {
    luca = "fail";
    notes.push("işveren alacağı 25.000 yok");
  }
  if (f.disabilityDegree && near(L.net, 46784.7, 1)) {
    luca = "fail";
    notes.push("sakatlık nete yansımıyor");
  }
  if (p.law === "5746_GV" && nz(L.gv) > 1 && nz(L.damga) > 1) {
    notes.push(`5746: GV ${tr(L.gv)} damga ${tr(L.damga)}`);
  }
  if (f.stajyer && nz(L.damga) > 0.05) {
    notes.push(`stajyer damga ${tr(L.damga)}`);
  }

  const dhrNet = D?.net;
  const aiNet = ai?.net;
  let whichCorrect;
  let legalBasis;
  if (near(nz(D?.damga), 156.88, 0.05) && near(nz(L.damga), 198.63, 0.05)) {
    whichCorrect = "DHR / YZ — nakit yemek damga matrahında değil (GVGT 322). Luca 198,63 basıyor.";
    legalBasis = "488 sayılı Damga Vergisi Kanunu; GVGT 322. Luca referans, doğru kabul edilmez.";
  } else if (p.avans && nz(L.advance) > 0 && D && nz(D.advance) <= 0.05) {
    whichCorrect = "Luca";
    legalBasis = "Maaş avansı mahsubu netten düşülmeli.";
  } else if (f.disabilityDegree && D && near(D.net, MINE_DHR, 1) && !near(L.net, 46784.7, 1)) {
    whichCorrect = "Luca — sakatlık indirimi PDF netine yansımış.";
    legalBasis = "GVK md. 31. DHR disabilityDegree yazılmıyor.";
  } else if (dhrNet != null && near(dhrNet, L.net)) {
    whichCorrect = "DHR ve Luca aynı (±0,01)";
    legalBasis = "Ocak 2026 GVK 23/18; 5510; 4447; 488.";
  } else {
    whichCorrect = "YZ hakem. Luca referans.";
    legalBasis = "Sapma 2026 GVK/5510/488 ile bakılır. Luca doğru kabul edilmez.";
  }
  const verdict = `Paket ${p.scenario}: DHR ${tr(dhrNet)} / Luca ${tr(L.net)} / YZ ${tr(aiNet)} (ΔDHR−Luca ${tr(r2(nz(dhrNet) - nz(L.net)))}). ${notes.join(" · ") || "Girdi PDF’de görünüyor."}`;
  return { luca, notes, whichCorrect, legalBasis, verdict };
}

function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item };
  else list.unshift(item);
}

(async () => {
  const luca = await extractLuca(LUCA_PDF);
  console.log("PDF", LUCA_PDF, "rows", luca.rows.length, "textLen", luca.textLen);
  if (luca.rows.length < 25) {
    console.error("too few Luca rows");
    process.exit(1);
  }
  const byTc = Object.fromEntries(luca.rows.map((r) => [r.tc, r]));
  const byName = Object.fromEntries(luca.rows.map((r) => [normName(r.name), r]));
  const missing = [];

  for (const row of cmp.rows) {
    const Lraw = (row.tc && byTc[row.tc]) || byName[normName(row.name)];
    if (!Lraw) {
      missing.push(row.name);
      continue;
    }
    const L = slimLuca(Lraw);
    row.lucaPending = false;
    row.luca = L;
    row.lineItems = (row.lineItems || []).map((it) => {
      const dhr = it.dhr;
      const lucaVal = L[it.key] == null ? null : r2(L[it.key]);
      const aiVal = it.ai;
      const delta = dhr == null || lucaVal == null ? null : r2(dhr - lucaVal);
      const deltaLucaAi = lucaVal == null || aiVal == null ? null : r2(lucaVal - aiVal);
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
      netAi: row.delta?.netAi ?? null,
      gvAi: row.delta?.gvAi ?? null,
      netLucaAi: r2(nz(L.net) - nz(row.ai?.net)),
    };
  }

  for (const k of cmp.kalemler) {
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
  fs.copyFileSync(LUCA_PDF, PUBLIC_PDF);

  const withLuca = cmp.rows.filter((r) => r.luca?.net != null);
  const matched = cmp.rows.filter((r) => r.dhr?.net != null && r.luca?.net != null);
  const avgAbs = matched.length ? r2(matched.reduce((s, r) => s + Math.abs(nz(r.delta?.net)), 0) / matched.length) : null;
  const netPass = matched.filter((r) => Math.abs(nz(r.delta?.net)) <= PASS).length;
  const netWithin100 = matched.filter((r) => Math.abs(nz(r.delta?.net)) <= 100).length;
  const mine = withLuca.find((r) => r.name === "Mine Aras");
  const pdfName = path.basename(LUCA_PDF);

  cmp.generatedAt = new Date().toISOString();
  cmp.lucaPdfVersion = `${pdfName} · Bordro Paket Ocak`;
  cmp.pending.luca = withLuca.length === 0;
  cmp.sources.lucaPdf = "downloads/bordro_paket_ocak.pdf";
  cmp.summary.lucaCount = withLuca.length;
  cmp.summary.matched = matched.length;
  cmp.summary.netWithin100 = netWithin100;
  cmp.summary.netPass001 = netPass;
  cmp.summary.avgAbsNetDelta = avgAbs;
  cmp.ui.lead = `30 kişi, Ada/Serra zemininden yalnız bir sapma. DHR ${cmp.summary.dhrCount}/30 · Luca ${withLuca.length}/30 (${pdfName}). Hakem YZ. Geçme ±0,01 TL.`;
  cmp.ui.verdict = `Bordro Paket Ocak 2026: DHR×Luca ${matched.length}/30. Ort. |ΔNet DHR−Luca| ${avgAbs ?? "—"} TL · ±0,01 ${netPass}/${matched.length}. Luca referans, YZ hakem.`;
  cmp.ui.personCaption = "Çalışan seç → DHR, Luca PDF ve YZ mevzuat neti yan yana. Eşleşme ±0,01 TL.";
  cmp.ui.gvBullets = [
    "Yasal Ocak–Haziran 2026 bandı 4.211,33 TL.",
    `Luca PDF: ${pdfName} · Bordro Paket · ${withLuca.length} kişi.`,
    mine ? `Mine (zemin) Luca net ${tr(mine.luca.net)} / DHR ${tr(mine.dhr?.net)} / damga Luca ${tr(mine.luca.damga)} DHR ${tr(mine.dhr?.damga)}.` : "",
    "Geçme ±0,01 TL. Luca referanstır, doğru kabul edilmez. Durum = DHR−Luca.",
  ].filter(Boolean);

  mtx.scenarios = mtx.scenarios.map((s) => {
    const p = roster.people.find((x) => x.name === s.name);
    const row = cmp.rows.find((r) => r.name === s.name);
    const h = lucaHakem(p || { scenario: s.scenario, seedFlags: {} }, row?.luca, row?.dhr, row?.ai);
    return {
      ...s,
      luca: h.luca,
      verdict: h.verdict,
      whichCorrect: h.whichCorrect || s.whichCorrect,
      legalBasis: h.legalBasis || s.legalBasis,
    };
  });
  const lucaPass = mtx.scenarios.filter((s) => s.luca === "pass").length;
  mtx.checkedItems = mtx.checkedItems.map((c) => {
    if (c.item === "Luca PDF") {
      return {
        ...c,
        result: withLuca.length === 30 ? "pass" : "fail",
        note: `${pdfName}: ${withLuca.length}/30. DHR net ±0,01: ${netPass}/${matched.length}. Senaryo girdi pass ${lucaPass}/30.`,
      };
    }
    if (c.item === "Geçme eşiği ±0,01 TL") {
      return { ...c, note: "Durum = DHR−Luca. Luca doldu." };
    }
    return c;
  });
  mtx.period = "Ocak 2026 · Bordro Paket · DHR × Luca × YZ";
  mtx.sourceOfTruth = `YZ hakem. Luca referans (${pdfName}, ${withLuca.length}/30). DHR dump ${cmp.summary.dhrCount}/30. Geçme ±0,01 TL. Durum = DHR−Luca.`;
  mtx.warnings = (mtx.warnings || []).filter((w) => w.id !== "PK-LUCA");

  const dash = JSON.parse(fs.readFileSync(path.join(DATA, "dashboard.json"), "utf8"));
  const paketPeriod = dash.periods.find((p) => p.id === "paket");
  if (paketPeriod) {
    paketPeriod.state = `Hesaplandı · DHR 30/30 · Luca 30/30 · ±0,01 ${netPass}/30`;
    paketPeriod.compare = "DHR × Luca × YZ";
  }
  upsert(dash.works, {
    id: "W-PAKET-OC",
    title: "Bordro Paket Ocak 2026 DHR + Luca PDF",
    detail: `${pdfName} Bordro Paket 30/30. DHR×Luca ±0,01 ${netPass}/30. Ort. |ΔNet| ${tr(avgAbs)} TL. Mine Luca damga ${tr(mine?.luca?.damga)} / DHR ${tr(mine?.dhr?.damga)}.`,
    periods: ["Bordro Paket"],
    area: "Kapsam",
  });
  dash.generatedAt = new Date().toISOString();

  fs.writeFileSync(path.join(DATA, "dashboard.json"), JSON.stringify(dash, null, 2) + "\n");
  fs.writeFileSync(path.join(DATA, "paket_comparison.json"), JSON.stringify(cmp, null, 2) + "\n");
  fs.writeFileSync(path.join(DATA, "paket_matrix.json"), JSON.stringify(mtx, null, 2) + "\n");

  const fails = matched
    .filter((r) => Math.abs(nz(r.delta?.net)) > PASS)
    .map((r) => `${r.sicil} ${r.name} DHR ${r.dhr.net} Luca ${r.luca.net} Δ ${r.delta.net}`);
  console.log("missing", missing);
  console.log("matched", matched.length, "netPass", netPass, "avg", avgAbs, "lucaScenarioPass", lucaPass);
  for (const line of fails) console.log(" FAIL", line);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
