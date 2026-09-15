/**
 * Tek Değişken Ocak 2026: Luca PDF → izole_comparison + izole_matrix.
 * DHR / YZ kolonlarına dokunmaz. İK comparison.json üzerine yazmaz.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const LUCA_PDF = process.argv[2] || "C:/Users/ardak/Downloads/bordro_d1_tech (26).pdf";
const PUBLIC_PDF = path.join(ROOT, "public", "downloads", "bordro_tek_degisken.pdf");
const SRC_PDF = path.join(ROOT, "downloads", "bordro_tek_degisken.pdf");
const PASS = 0.01;
const ADA_DHR = 48052.89;

const roster = JSON.parse(fs.readFileSync(path.join(DATA, "izole_roster.json"), "utf8"));
const cmp = JSON.parse(fs.readFileSync(path.join(DATA, "izole_comparison.json"), "utf8"));
const mtx = JSON.parse(fs.readFileSync(path.join(DATA, "izole_matrix.json"), "utf8"));

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
    prim: pickLabeled(blob, [/\bPrim[^:\n]*:\s*([\d.]+,\d{2})/i]),
    ikramiye: pickLabeled(blob, [/[Iİ]kramiye[^:\n]*:\s*([\d.]+,\d{2})/i]),
    advance: pickLabeled(blob, [/Avans[^:\n]*:\s*([\d.]+,\d{2})/i]),
    kesinti: pickLabeled(blob, [/\bicra[^:\n]*:\s*([\d.]+,\d{2})/i, /Genel Kesinti[^:\n]*:\s*([\d.]+,\d{2})/i]),
    bes: pickLabeled(blob, [/Oto\.?\s*Kat\.?\s*BES[^:\n]*:\s*([\d.]+,\d{2})/i, /\bBES[^:\n]*:\s*([\d.]+,\d{2})/i]),
    masraf: pickLabeled(blob, [/Masraf[^:\n]*:\s*([\d.]+,\d{2})/i]),
  };
}

function rowFromMatch(m, text) {
  const extras = parseLucaExtras(text.slice(m.index, m.index + 1600));
  const ozKes = parseTR(m[22]) || 0;
  const labelledOz = (extras.advance || 0) + (extras.kesinti || 0) + (extras.bes || 0);
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
    masraf: extras.masraf || 0,
  };
  const residual = r2(
    nz(L.gross) - nz(L.sgk) - nz(L.gv) - nz(L.damga) - nz(L.bes) - nz(L.kesinti) - nz(L.advance) - nz(L.net),
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
  const fmSummary = text.match(/Fazla Mesai Saat[\s\S]{0,40}?(\d+)/);
  return { rows, fmHoursTotal: fmSummary ? +fmSummary[1] : null, textLen: text.length, text };
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
    fmHours: L.fmHours,
    hire: L.hire,
  };
}

function expectedKanun(p) {
  if (p.law === "05510_2" || p.law === "05510_5") return "05510";
  if (p.law === "5746_15746") return "15746";
  if (p.law === "5746_05746" || p.law === "5746_GV") return "05746";
  return "00000";
}

function lucaHakem(p, L, D, ai) {
  const notes = [];
  let luca = "pass";
  if (!L || L.net == null) {
    return { luca: "fail", notes: ["PDF’de yok"], whichCorrect: "", legalBasis: "" };
  }
  const expK = expectedKanun(p);
  const is5746 = String(p.law || "").includes("5746");
  if (L.kanun !== expK) {
    if (is5746 && nz(L.damga) <= 0.01) {
      notes.push(`PDF kanun ${L.kanun} (beklenen ${expK}); damga 0 — 5746 damga terkin işliyor`);
    } else {
      luca = "fail";
      notes.push(`kanun PDF ${L.kanun} (beklenen ${expK})`);
    }
  }
  if (p.salaryType === 1) {
    if (!near(L.ucret ?? L.salary, 42000, 0.05)) {
      luca = "fail";
      notes.push(`ücret ${tr(L.ucret)} (beklenen net 42.000)`);
    } else if (L.gs !== "N") {
      notes.push("kart 42.000 net; PDF G/S=G (Luca brütleştirmiş)");
    }
  }
  if (p.seedFlags?.partTime && nz(L.tgun) >= 30) {
    luca = "fail";
    notes.push(`kısmi ay T.Gün ${L.tgun}`);
  }
  if (p.seedFlags?.stajyer && nz(L.meal) > 0.05) {
    luca = "fail";
    notes.push(`stajyer yemek ${tr(L.meal)}`);
  }
  if (p.seedFlags?.emekli && near(L.net, 48049.1, 1)) {
    luca = "fail";
    notes.push("SGDP yok — net Ada zemini");
  }
  if (p.seedFlags?.priorTaxFilled && near(L.gv, 2635.42, 1)) {
    luca = "fail";
    notes.push("kümülatif GV 185.000 yok — GV Ada ile aynı");
  }
  if (p.overtimeGrossHours && nz(L.overtime) <= 0.05) {
    luca = "fail";
    notes.push("FM 12s yok");
  }
  if (p.avans && nz(L.advance) <= 0.05) {
    luca = "fail";
    notes.push("avans 7.200 yok");
  }
  if (p.prim && nz(L.prim) <= 0.05) {
    luca = "fail";
    notes.push("prim 5.000 yok");
  }
  if (p.ikramiye && nz(L.ikramiye) <= 0.05) {
    luca = "fail";
    notes.push("ikramiye 10.000 yok");
  }
  if (p.kesinti && nz(L.kesinti) <= 0.05) {
    luca = "fail";
    notes.push("kesinti 1.200 yok");
  }
  if (p.masraf) {
    if (nz(L.masraf) <= 0.05 && near(L.kesinti, p.masraf, 0.05)) {
      luca = "fail";
      notes.push("masraf 750 icra kesintisi olarak yazılmış");
    } else if (nz(L.masraf) <= 0.05) {
      luca = "fail";
      notes.push("masraf 750 yok");
    }
  }
  if (p.besEmployeePct && nz(L.bes) <= 0.05) {
    luca = "fail";
    notes.push("BES %3 yok");
  }
  if (p.tax === "4691" && nz(L.gv) > 1) {
    luca = "fail";
    notes.push(`4691 terkin yok (GV ${tr(L.gv)})`);
  }
  if (p.seedFlags?.disabilityDegree && near(L.net, 48049.1, 1)) {
    luca = "fail";
    notes.push(`sakatlık ${p.seedFlags.disabilityDegree}. derece nete yansımıyor`);
  }
  if (!p.seedFlags?.stajyer && nz(p.yemek) > 0 && !near(L.meal, p.yemek, 0.05)) {
    notes.push(`yemek ${tr(L.meal)} (beklenen ${tr(p.yemek)})`);
  }

  const dhrNet = D?.net;
  const aiNet = ai?.net;
  const mealPack = D && near(Math.abs(nz(D.damga) - nz(L.damga)), 41.75, 2) && Math.abs(nz(dhrNet) - nz(L.net)) < 50;
  let whichCorrect;
  let legalBasis;
  if (p.tax === "4691" && D && nz(D.gv) <= 0.01 && nz(L.gv) > 1) {
    whichCorrect = "DHR";
    legalBasis = "4691 sayılı Teknoloji Geliştirme Bölgeleri Kanunu — GV/damga terkini.";
  } else if (is5746 && nz(L.damga) <= 0.01 && D && nz(D.damga) > 1) {
    whichCorrect = "Luca — 5746 damga terkin (PDF kanun 00000).";
    legalBasis = "5746 sayılı kanun damga terkini; GV stopaj terkin bu slip’te yok (GV Ada ile aynı).";
  } else if (p.overtimeGrossHours && nz(L.overtime) > 0 && D && nz(D.overtime) <= 0.05) {
    whichCorrect = "Luca";
    legalBasis = "Fazla mesai bordroya yansımalı (İşK md. 41).";
  } else if (p.avans && nz(L.advance) > 0 && D && nz(D.advance) <= 0.05) {
    whichCorrect = "Luca";
    legalBasis = "Maaş avansı mahsubu netten düşülmeli.";
  } else if (p.masraf && nz(L.masraf) <= 0.05 && near(L.kesinti, p.masraf, 0.05)) {
    whichCorrect = "YZ — masraf kazanç, icra değil.";
    legalBasis = "Masraf net/istisna kalemidir; icra kesintisi değildir.";
  } else if (p.seedFlags?.emekli || p.seedFlags?.priorTaxFilled || p.seedFlags?.disabilityDegree) {
    whichCorrect = D && !near(D.net, ADA_DHR, 1) ? "DHR" : "YZ";
    legalBasis = p.seedFlags?.emekli
      ? "5510 SGDP işçi oranı; normal %14+%1 uygulanmamalı."
      : p.seedFlags?.priorTaxFilled
        ? "GVK md. 103 kümülatif tarife."
        : "GVK md. 31 sakatlık indirimi.";
  } else if (mealPack) {
    whichCorrect = "Luca — nakit yemek damga matrahında değil (488). YZ hakem; Luca referans.";
    legalBasis = "488 sayılı Damga Vergisi Kanunu; GVK md. 23 nakit yemek. Luca referans, doğru kabul edilmez.";
  } else if (dhrNet != null && near(dhrNet, L.net)) {
    whichCorrect = "DHR ve Luca aynı (±0,01)";
    legalBasis = "Ocak 2026 GVK 23/18; 5510; 4447; 488.";
  } else {
    whichCorrect = "YZ hakem. Luca referans.";
    legalBasis = "Sapma 2026 GVK/5510/488 ile bakılır. Luca doğru kabul edilmez.";
  }

  const verdict = `Tek değişken ${p.scenario}: DHR ${tr(dhrNet)} / Luca ${tr(L.net)} / YZ ${tr(aiNet)} (ΔDHR−Luca ${tr(r2(nz(dhrNet) - nz(L.net)))}). ${notes.join(" · ") || "Girdi PDF’de görünüyor."}`;
  return { luca, notes, whichCorrect, legalBasis, verdict };
}

(async () => {
  const luca = await extractLuca(LUCA_PDF);
  const byTc = Object.fromEntries(luca.rows.map((r) => [r.tc, r]));
  const byName = Object.fromEntries(luca.rows.map((r) => [normName(r.name), r]));
  const missing = [];
  let mealOn = 0,
    otOn = 0,
    besOn = 0,
    ghostN = 0;

  for (const row of cmp.rows) {
    const person = roster.people.find((p) => p.name === row.name);
    const Lraw = byTc[row.tc] || byName[normName(row.name)];
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
      overtime: r2(nz(row.dhr?.overtime) - nz(L.overtime)),
      bes: r2(nz(row.dhr?.bes) - nz(L.bes)),
      netAi: row.delta?.netAi ?? null,
      gvAi: row.delta?.gvAi ?? null,
      netLucaAi: r2(nz(L.net) - nz(row.ai?.net)),
    };
    if (nz(L.meal) > 0) mealOn += 1;
    if (nz(L.overtime) > 0) otOn += 1;
    if (nz(L.bes) > 0) besOn += 1;
    if (nz(L.ghostKesinti) > 0.05) ghostN += 1;
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
  fs.mkdirSync(path.dirname(SRC_PDF), { recursive: true });
  fs.copyFileSync(LUCA_PDF, SRC_PDF);

  const withLuca = cmp.rows.filter((r) => r.luca?.net != null);
  const matched = cmp.rows.filter((r) => r.dhr?.net != null && r.luca?.net != null);
  const avgAbs = matched.length ? r2(matched.reduce((s, r) => s + Math.abs(nz(r.delta?.net)), 0) / matched.length) : null;
  const netPass = matched.filter((r) => Math.abs(nz(r.delta?.net)) <= PASS).length;
  const netWithin100 = matched.filter((r) => Math.abs(nz(r.delta?.net)) <= 100).length;
  const ada = withLuca.find((r) => r.name === "Ada Korkmaz");

  cmp.generatedAt = new Date().toISOString();
  cmp.lucaPdfVersion = path.basename(LUCA_PDF);
  cmp.pending.luca = withLuca.length === 0;
  cmp.sources.lucaPdf = "downloads/bordro_tek_degisken.pdf";
  cmp.summary.lucaCount = luca.rows.length;
  cmp.summary.matched = matched.length;
  cmp.summary.netWithin100 = netWithin100;
  cmp.summary.netPass001 = netPass;
  cmp.summary.avgAbsNetDelta = avgAbs;
  cmp.summary.fmHoursTotalLuca = luca.fmHoursTotal;
  cmp.summary.mealOnLuca = mealOn;
  cmp.summary.overtimeOnLuca = otOn;
  cmp.summary.besOnLuca = besOn;
  cmp.summary.ghostKesintiPeople = ghostN;
  if (ada?.luca?.gv != null) {
    cmp.legal.lucaObserved.exemptApplied = 4211.33;
  }
  cmp.ui.lead = `27 kişi, her satırda Serra zemininden yalnız bir sapma. DHR ${cmp.summary.dhrCount}/27 · Luca ${withLuca.length}/27 (${path.basename(LUCA_PDF)}). Hakem YZ. Geçme ±0,01 TL.`;
  cmp.ui.verdict = `Tek Değişken Ocak 2026: DHR×Luca ${matched.length}/27. Ort. |ΔNet DHR−Luca| ${avgAbs ?? "—"} TL · ±0,01 ${netPass}/${matched.length}. Luca referans, YZ hakem.`;
  cmp.ui.personCaption = "Çalışan seç → DHR, Luca PDF ve YZ mevzuat neti yan yana. Eşleşme ±0,01 TL.";
  cmp.ui.gvBullets = [
    "Yasal Ocak–Haziran 2026 bandı 4.211,33 TL.",
    `Luca PDF: ${path.basename(LUCA_PDF)} · Tek Değişken bölüm · ${withLuca.length} kişi.`,
    ada ? `Ada (zemin) Luca net ${tr(ada.luca.net)} / DHR ${tr(ada.dhr?.net)} / damga Luca ${tr(ada.luca.damga)} DHR ${tr(ada.dhr?.damga)}.` : "",
    "Geçme ±0,01 TL. Luca referanstır, doğru kabul edilmez.",
  ].filter(Boolean);

  mtx.scenarios = mtx.scenarios.map((s) => {
    const p = roster.people.find((x) => x.name === s.name);
    const row = cmp.rows.find((r) => r.name === s.name);
    const h = lucaHakem(p || { scenario: s.scenario }, row?.luca, row?.dhr, row?.ai);
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
        result: withLuca.length === 27 ? "pass" : "fail",
        note: `${path.basename(LUCA_PDF)}: ${withLuca.length}/27 satır. DHR net ±0,01: ${netPass}/${matched.length}. Senaryo girdi pass ${lucaPass}/27.`,
      };
    }
    return c;
  });
  mtx.period = "Ocak 2026 · Tek Değişken · DHR × Luca × YZ";
  mtx.sourceOfTruth = `YZ = 2026 TR mevzuatı hakem. Luca referans (${path.basename(LUCA_PDF)}, ${withLuca.length}/27). DHR UI/API dump ${cmp.summary.dhrCount}/27. Geçme ±0,01 TL.`;

  const lucaFindings = [];
  const adaL = ada?.luca;
  if (adaL && near(adaL.net, 48049.1, 0.05)) {
    lucaFindings.push(`Ada Luca net ${tr(adaL.net)} ≈ İK Serra Luca zemin (yemek 5.500 B / yol 3.200 N, damga ${tr(adaL.damga)}).`);
  }
  const tolga = withLuca.find((r) => r.name === "Tolga Ergin");
  if (tolga && nz(tolga.luca.overtime) > 0) lucaFindings.push(`Tolga FM Luca ${tr(tolga.luca.overtime)} (${tolga.luca.fmHours || "?"}s).`);
  const volkan = withLuca.find((r) => r.name === "Volkan Ates");
  if (volkan && nz(volkan.luca.prim) > 0) lucaFindings.push(`Volkan prim Luca ${tr(volkan.luca.prim)}.`);
  const umay = withLuca.find((r) => r.name === "Umay Gunes");
  if (umay && nz(umay.luca.advance) > 0) lucaFindings.push(`Umay avans Luca ${tr(umay.luca.advance)} (DHR 0).`);
  const yelda = withLuca.find((r) => r.name === "Yelda Kurt");
  if (yelda && nz(yelda.luca.ikramiye) > 0) lucaFindings.push(`Yelda ikramiye Luca ${tr(yelda.luca.ikramiye)}.`);
  const nazli = withLuca.find((r) => r.name === "Nazli Er");
  if (nazli && nz(nazli.luca.tgun) < 30) lucaFindings.push(`Nazlı Luca T.Gün ${nazli.luca.tgun} (kısmi 05/01).`);
  const bora = withLuca.find((r) => r.name === "Bora Elci");
  if (bora && nz(bora.luca.bes) > 0) lucaFindings.push(`Bora Oto.Kat.BES Luca ${tr(bora.luca.bes)}.`);

  const extraBugs = [];
  const asya = withLuca.find((r) => r.name === "Asya Duru");
  const asyaMasrafOk = asya && nz(asya.luca.masraf) > 0.05;
  if (asya && !asyaMasrafOk && near(asya.luca.kesinti, 750, 0.05)) {
    extraBugs.push({
      id: "IZ-LUCA-MASRAF-ICRA",
      title: "Asya masraf 750 Luca’da icra kesintisi",
      severity: "Orta",
      detail: "Puantajda masraf yerine icra/özel kesinti 750 yazılmış. Net Ada−750; kazanç değil kesinti.",
    });
  }
  if (asyaMasrafOk) lucaFindings.push(`Asya masraf Luca ${tr(asya.luca.masraf)} N (Ada+750, Δ 3,79).`);
  const jale = withLuca.find((r) => r.name === "Jale Kaya");
  if (jale && !near(jale.luca.net, 48049.1, 1)) lucaFindings.push(`Jale SGDP Luca net ${tr(jale.luca.net)}.`);
  const kaan = withLuca.find((r) => r.name === "Kaan Oz");
  if (kaan && nz(kaan.luca.gv) < 2000) lucaFindings.push(`Kaan/Leman/Mert sakatlık GV Luca ${tr(kaan.luca.gv)} / Leman ${tr(withLuca.find((r) => r.name === "Leman Su")?.luca.gv)} / Mert ${tr(withLuca.find((r) => r.name === "Mert Acar")?.luca.gv)}.`);
  mtx.correctFindings = [...new Set([...lucaFindings, ...(mtx.correctFindings || []).filter((x) => !/Luca PDF bu birimde yok/i.test(x))])];
  mtx.dhrBugs = [
    ...extraBugs,
    ...(mtx.dhrBugs || []).filter((b) => {
      if (b.id === "IZ-LUCA-MASRAF-ICRA" && asyaMasrafOk) return false;
      return !extraBugs.some((x) => x.id === b.id);
    }),
  ];

  const dashPath = path.join(DATA, "dashboard.json");
  const dash = JSON.parse(fs.readFileSync(dashPath, "utf8"));
  const izolePeriod = dash.periods.find((p) => p.id === "izole");
  if (izolePeriod) {
    izolePeriod.state = `Hesaplandı · DHR ${cmp.summary.dhrCount}/27 · Luca ${withLuca.length}/27 · ±0,01 ${netPass} · girdi pass ${lucaPass}`;
    izolePeriod.compare = "DHR × Luca × YZ";
  }
  const avansBug = (dash.bugs || []).find((b) => b.id === "IZ-AVANS");
  if (avansBug) {
    avansBug.detail =
      "Umay Gunes (6220): DHR Ocak neti Ada baseline (avans 0). Luca PDF avans 7.200 kesti (net 40.849,10). F1-AVANS ile aynı DHR sınıfı.";
  }
  const dashExtra = [
    {
      id: "IZ-LUCA-MASRAF-ICRA",
      title: "Tek Değişken: Asya masrafı Luca’da icra",
      severity: "Orta",
      detail: "Asya Duru 750 TL masraf Luca Öz.Kesinti icra olarak yazılmış; net Ada−750. DHR masrafı kazanca ekliyor.",
      periods: ["Tek Değişken"],
      impact: "Masraf senaryosu Luca’da ters işaretli.",
      area: "Puantaj",
    },
    {
      id: "IZ-LUCA-4691",
      title: "Tek Değişken: Luca 4691 terkin uygulamıyor",
      severity: "Yüksek",
      detail: "Hakan/Işık Luca net Ada zemini (GV 2.635,42). DHR GV 0 / net 50.841,40.",
      periods: ["Tek Değişken"],
      impact: "Teknopark GV/damga terkini Luca kartında yok.",
      area: "Teşvik",
    },
  ];
  dash.bugs = dash.bugs || [];
  if (asyaMasrafOk) dash.bugs = dash.bugs.filter((b) => b.id !== "IZ-LUCA-MASRAF-ICRA");
  for (const b of dashExtra) {
    if (b.id === "IZ-LUCA-MASRAF-ICRA" && asyaMasrafOk) continue;
    if (!dash.bugs.some((x) => x.id === b.id)) dash.bugs.unshift(b);
  }
  dash.generatedAt = cmp.generatedAt;
  fs.writeFileSync(dashPath, JSON.stringify(dash, null, 2) + "\n");
  fs.writeFileSync(path.join(DATA, "izole_comparison.json"), JSON.stringify(cmp, null, 2) + "\n");
  fs.writeFileSync(path.join(DATA, "izole_matrix.json"), JSON.stringify(mtx, null, 2) + "\n");

  const table = withLuca.map((r) => ({
    name: r.name,
    kanun: r.luca.kanun,
    gs: r.luca.gs,
    tgun: r.luca.tgun,
    net: r.luca.net,
    dhr: r.dhr?.net,
    dNet: r.delta?.net,
    meal: r.luca.meal,
    yol: r.luca.transport,
    fm: r.luca.overtime,
    prim: r.luca.prim,
    ikr: r.luca.ikramiye,
    masraf: r.luca.masraf,
    avans: r.luca.advance,
    kes: r.luca.kesinti,
    bes: r.luca.bes,
    gv: r.luca.gv,
    damga: r.luca.damga,
    oz: r.luca.ozText,
    dig: r.luca.digText,
  }));
  console.log(
    JSON.stringify(
      {
        parsed: luca.rows.length,
        matched: matched.length,
        missing,
        avgAbsNetDelta: avgAbs,
        netPass001: netPass,
        lucaPass,
        mealOn,
        otOn,
        besOn,
        ghostN,
        pdf: path.basename(LUCA_PDF),
        table,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
