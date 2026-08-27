/**
 * Build comparison JSON from Luca PDF + DHR Excel for the static site.
 * Includes line-item (kalem) DHR x Luca comparison per employee.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");
const XLSX = require("xlsx");

const LUCA_PDF =
  process.argv[2] ||
  "C:/Users/ardak/Downloads/bordro_d1_tech (10).pdf";
const DHR_XLSX =
  process.argv[3] ||
  path.join(__dirname, "..", "public", "downloads", "Payroll_Ekim_2026.xlsx");
const SEED = JSON.parse(
  fs.readFileSync(path.join(__dirname, "dhr_ik_seed_32.json"), "utf8"),
);

const OUT = path.join(__dirname, "..", "src", "data", "comparison.json");
const PUBLIC_PDF = path.join(__dirname, "..", "public", "downloads", "bordro_d1_tech.pdf");

/** Ordered line-item keys shown on the site */
const LINE_DEFS = [
  { key: "salary", label: "Temel maas / ucret", group: "kazanc" },
  { key: "meal", label: "Yemek yardimi", group: "kazanc" },
  { key: "transport", label: "Yol yardimi", group: "kazanc" },
  { key: "overtime", label: "Fazla mesai", group: "kazanc" },
  { key: "prim", label: "Prim", group: "kazanc" },
  { key: "ikramiye", label: "Ikramiye", group: "kazanc" },
  { key: "masraf", label: "Masraf", group: "kazanc" },
  { key: "gross", label: "Toplam kazanc", group: "ozet" },
  { key: "sgk", label: "SGK isci", group: "kesinti" },
  { key: "unemployment", label: "Issizlik isci", group: "kesinti" },
  { key: "gv", label: "Gelir vergisi", group: "kesinti" },
  { key: "damga", label: "Damga vergisi", group: "kesinti" },
  { key: "bes", label: "BES kesintisi", group: "kesinti" },
  { key: "advance", label: "Avans", group: "kesinti" },
  { key: "kesinti", label: "Diger kesinti (icra vb.)", group: "kesinti" },
  { key: "net", label: "Net odenen", group: "ozet" },
];

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\u0131/g, "i")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
}

function parseTR(s) {
  if (s == null || s === "") return null;
  return Number(String(s).replace(/\./g, "").replace(",", "."));
}

function round2(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function pickLabeled(slice, patterns) {
  for (const re of patterns) {
    const m = slice.match(re);
    if (m) return parseTR(m[1]);
  }
  return 0;
}

function col(row, ...candidates) {
  for (const c of candidates) {
    if (row[c] != null && row[c] !== "") return row[c];
  }
  // fuzzy: normalize keys
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const nc = normName(cand);
    const hit = keys.find((k) => normName(k) === nc);
    if (hit && row[hit] != null && row[hit] !== "") return row[hit];
  }
  return null;
}

function parseLucaExtras(slice) {
  const digM = slice.match(/Di[gğ]er Kazan[cç]lar:\s*([^\n]*)/i);
  const ozM = slice.match(/[OÖ]zel Kesintiler:\s*([^\n]*)/i);
  let digText = digM ? digM[1].trim() : "";
  let ozText = ozM ? ozM[1].trim() : "";
  if (/^--\s*\d/.test(digText)) digText = "";
  if (/Normal Kazan/i.test(ozText) && !/(Avans|icra|BES)/i.test(ozText)) ozText = "";
  const blob = `${digText}\n${ozText}`;

  return {
    digText,
    ozText,
    meal: pickLabeled(blob, [/Yemek[^:\n]*:\s*([\d.]+,\d{2})/i]),
    transport: pickLabeled(blob, [/Yol[^:\n]*:\s*([\d.]+,\d{2})/i]),
    overtime: pickLabeled(blob, [/Fazla Mesai[^:\n]*:\s*([\d.]+,\d{2})/i]),
    prim: pickLabeled(blob, [/\bPrim[^:\n]*:\s*([\d.]+,\d{2})/i]),
    ikramiye: pickLabeled(blob, [/[Iİ]kramiye[^:\n]*:\s*([\d.]+,\d{2})/i]),
    advance: pickLabeled(blob, [/Avans[^:\n]*:\s*([\d.]+,\d{2})/i]),
    kesinti: pickLabeled(blob, [/\bicra[^:\n]*:\s*([\d.]+,\d{2})/i]),
    bes: pickLabeled(blob, [
      /Oto\.?\s*Kat\.?\s*BES[^:\n]*:\s*([\d.]+,\d{2})/i,
      /\bBES[^:\n]*:\s*([\d.]+,\d{2})/i,
    ]),
  };
}

async function extractLuca(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();
  const rows = [];
  const re =
    /(\d+)\s+([A-Za-z\u00C7\u00E7\u011E\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC ]+?)\s+(43\d{9})(?:\s+\d+\s+G[uü]n)?\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+([\d.]+,\d{2})([GN])\s+(\d+)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*\r?\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;
  let m;
  while ((m = re.exec(text))) {
    const slice = text.slice(m.index, m.index + 1200);
    const extras = parseLucaExtras(slice);
    rows.push({
      name: m[2].trim(),
      tc: m[3],
      kanun: m[5],
      ucret: parseTR(m[6]),
      gs: m[7],
      tgun: +m[8],
      norKaz: parseTR(m[10]),
      topKaz: parseTR(m[12]),
      digKaz: parseTR(m[13]),
      sskMat: parseTR(m[14]),
      sskIsci: parseTR(m[16]),
      gv: parseTR(m[19]),
      damga: parseTR(m[21]),
      ozKes: parseTR(m[22]),
      net: parseTR(m[23]),
      digText: extras.digText,
      ozText: extras.ozText,
      meal: extras.meal,
      transport: extras.transport,
      overtime: extras.overtime,
      prim: extras.prim,
      ikramiye: extras.ikramiye,
      advance: extras.advance,
      kesinti: extras.kesinti,
      bes: extras.bes,
      unemployment: null,
      salary: parseTR(m[6]),
      gross: parseTR(m[12]),
      sgk: parseTR(m[16]),
      masraf: 0,
    });
  }

  if (!rows.find((r) => r.tc === "43056962656")) {
    const hm = text.match(
      /Hande Orhan\s+43056962656[\s\S]{0,80}?00000\s+([\d.]+,\d{2})G\s+(\d+)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*\r?\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/,
    );
    if (hm) {
      const slice = text.slice(text.indexOf("Hande Orhan"), text.indexOf("Hande Orhan") + 1200);
      const extras = parseLucaExtras(slice);
      rows.push({
        name: "Hande Orhan",
        tc: "43056962656",
        kanun: "00000",
        ucret: parseTR(hm[1]),
        gs: "G",
        tgun: +hm[2],
        norKaz: parseTR(hm[4]),
        topKaz: parseTR(hm[6]),
        digKaz: parseTR(hm[7]),
        sskMat: parseTR(hm[8]),
        sskIsci: parseTR(hm[10]),
        gv: parseTR(hm[13]),
        damga: parseTR(hm[15]),
        ozKes: parseTR(hm[16]),
        net: parseTR(hm[17]),
        digText: extras.digText,
        ozText: extras.ozText,
        meal: extras.meal,
        transport: extras.transport,
        overtime: extras.overtime,
        prim: extras.prim,
        ikramiye: extras.ikramiye,
        advance: extras.advance,
        kesinti: extras.kesinti,
        bes: extras.bes,
        unemployment: null,
        salary: parseTR(hm[1]),
        gross: parseTR(hm[6]),
        sgk: parseTR(hm[10]),
        masraf: 0,
      });
    }
  }

  const fmSummary = text.match(/Fazla Mesai Saat[\s\S]{0,40}?(\d+)/);
  return { rows, textLen: text.length, fmHoursTotal: fmSummary ? +fmSummary[1] : null };
}

function extractDhr(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const sheetName = wb.SheetNames.find((n) => /ekim|2026/i.test(n)) || wb.SheetNames[0];
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
  const seedByName = Object.fromEntries(SEED.created.map((c) => [normName(c.name), c]));
  const rows = [];
  for (const r of raw) {
    const name = col(r, "Çalışan Adı Soyadı", "Calisan Adi Soyadi");
    if (!name) continue;
    const seed = seedByName[normName(name)];
    if (!seed) continue;
    const num = (v) => {
      if (v == null || v === "") return null;
      if (typeof v === "number") return v;
      return parseTR(String(v));
    };
    rows.push({
      tc: seed.tc,
      name,
      employeeNo: col(r, "Çalışan No", "Calisan No"),
      salary: num(col(r, "Temel Maaş", "Temel Maas")),
      meal: num(col(r, "Yemek Yardımı", "Yemek Yardimi")) || 0,
      transport: num(col(r, "Yol Yardımı", "Yol Yardimi")) || 0,
      overtime: num(col(r, "Fazla Mesai")) || 0,
      prim: num(col(r, "Prim")) || 0,
      ikramiye: num(col(r, "İkramiye", "Ikramiye")) || 0,
      masraf: num(col(r, "Masraf")) || 0,
      kesinti: num(col(r, "Genel Kesinti")) || 0,
      advance: 0,
      gross: num(col(r, "Toplam Kazanç", "Toplam Kazanc")),
      net: num(col(r, "Net Maaş", "Net Maas")),
      gv: num(col(r, "Gelir Vergisi")),
      gvBase: num(col(r, "Gelir Vergisine Tabi Kazanç", "Gelir Vergisine Tabi Kazanc")),
      sgk: num(col(r, "SGK Primi İşçi Payı", "SGK Primi Isci Payi")),
      unemployment: num(
        col(r, "İşsizlik Sigortası Primi İşçi Payı", "Issizlik Sigortasi Primi Isci Payi"),
      ),
      damga: num(col(r, "Damga Vergisi")),
      bes: num(col(r, "Bireysel Emeklilik (BES) Kesintisi")) || 0,
      meta: {
        n: seed.n,
        note: seed.note,
        profile: seed.profile,
        lucaKanun: seed.lucaKanun,
        input: seed.input,
      },
    });
  }
  return rows;
}

function buildLineItems(D, L) {
  const get = (obj, key) => {
    if (!obj) return null;
    const v = obj[key];
    return v == null ? null : round2(v);
  };
  return LINE_DEFS.map((def) => {
    const dhr = get(D, def.key);
    const luca = get(L, def.key);
    const bothNull = dhr == null && luca == null;
    const d = dhr == null ? 0 : dhr;
    const l = luca == null ? 0 : luca;
    const delta = bothNull ? null : round2(d - l);
    const match =
      bothNull ||
      (dhr != null && luca != null && Math.abs(dhr - luca) <= 0.05) ||
      (dhr == null && luca === 0) ||
      (luca == null && dhr === 0);
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      dhr,
      luca,
      delta,
      match: !!match,
    };
  });
}

function merge(luca, dhr) {
  const dhrByTc = Object.fromEntries(dhr.map((r) => [r.tc, r]));
  const seedByTc = Object.fromEntries(SEED.created.map((c) => [c.tc, c]));
  return luca.rows.map((L) => {
    const D = dhrByTc[L.tc];
    const S = seedByTc[L.tc];
    const dhrSlim = D
      ? {
          salary: D.salary,
          meal: D.meal,
          transport: D.transport,
          overtime: D.overtime,
          prim: D.prim,
          ikramiye: D.ikramiye,
          masraf: D.masraf,
          kesinti: D.kesinti,
          advance: D.advance,
          gross: D.gross,
          net: D.net,
          gv: D.gv,
          sgk: D.sgk,
          unemployment: D.unemployment,
          damga: D.damga,
          bes: D.bes,
        }
      : null;
    const lucaSlim = {
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
      digText: L.digText,
      ozText: L.ozText,
      gs: L.gs,
    };
    const lineItems = buildLineItems(dhrSlim, lucaSlim);
    return {
      n: S?.n,
      name: L.name,
      tc: L.tc,
      note: S?.note || "",
      profile: S?.profile || "",
      input: S?.input || "",
      lucaKanunExpected: S?.lucaKanun,
      luca: lucaSlim,
      dhr: dhrSlim,
      delta: D
        ? {
            net: round2(D.net - L.net),
            gv: round2(D.gv - L.gv),
            damga: round2((D.damga || 0) - (L.damga || 0)),
            gross: round2(D.gross - L.topKaz),
            meal: round2((D.meal || 0) - (L.meal || 0)),
            transport: round2((D.transport || 0) - (L.transport || 0)),
            overtime: round2((D.overtime || 0) - (L.overtime || 0)),
            bes: round2((D.bes || 0) - (L.bes || 0)),
          }
        : null,
      lineItems,
    };
  });
}

function aggregateKalemler(rows) {
  const matched = rows.filter((r) => r.dhr && r.delta);
  return LINE_DEFS.map((def) => {
    let dhrSum = 0;
    let lucaSum = 0;
    let bothPresent = 0;
    let matchCount = 0;
    let nonzeroEither = 0;
    for (const r of matched) {
      const item = r.lineItems.find((i) => i.key === def.key);
      if (!item) continue;
      const d = item.dhr == null ? 0 : item.dhr;
      const l = item.luca == null ? 0 : item.luca;
      dhrSum += d;
      lucaSum += l;
      if (item.dhr != null && item.luca != null) {
        bothPresent += 1;
        if (item.match) matchCount += 1;
      }
      if (Math.abs(d) > 0.05 || Math.abs(l) > 0.05) nonzeroEither += 1;
    }
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      dhrSum: round2(dhrSum),
      lucaSum: round2(lucaSum),
      deltaSum: round2(dhrSum - lucaSum),
      peopleWithValue: nonzeroEither,
      matchCount,
      compared: bothPresent,
    };
  });
}

(async () => {
  if (!fs.existsSync(LUCA_PDF)) throw new Error("Luca PDF missing: " + LUCA_PDF);
  if (!fs.existsSync(DHR_XLSX)) throw new Error("DHR Excel missing: " + DHR_XLSX);

  const luca = await extractLuca(LUCA_PDF);
  const dhr = extractDhr(DHR_XLSX);
  const rows = merge(luca, dhr).sort((a, b) => (a.n || 0) - (b.n || 0));
  const matched = rows.filter((r) => r.dhr?.net != null);
  const kalemler = aggregateKalemler(rows);

  fs.mkdirSync(path.dirname(PUBLIC_PDF), { recursive: true });
  fs.copyFileSync(LUCA_PDF, PUBLIC_PDF);

  const payload = {
    generatedAt: new Date().toISOString(),
    period: "Ekim 2026",
    unit: "Insan Kaynaklari — dhrtest vs Luca",
    lucaPdfVersion: path.basename(LUCA_PDF),
    sources: {
      lucaPdf: "downloads/bordro_d1_tech.pdf",
      dhrExcel: "downloads/Payroll_Ekim_2026.xlsx",
    },
    summary: {
      lucaCount: luca.rows.length,
      dhrCount: dhr.length,
      matched: matched.length,
      netWithin100: matched.filter((r) => Math.abs(r.delta.net) <= 100).length,
      avgAbsNetDelta: matched.length
        ? round2(matched.reduce((s, r) => s + Math.abs(r.delta.net), 0) / matched.length)
        : null,
      fmHoursTotalLuca: luca.fmHoursTotal,
      mealOnLuca: matched.filter((r) => (r.luca.meal || 0) > 0).length,
      overtimeOnLuca: matched.filter((r) => (r.luca.overtime || 0) > 0).length,
      besOnLuca: matched.filter((r) => (r.luca.bes || 0) > 0).length,
    },
    lineDefs: LINE_DEFS,
    kalemler,
    rows,
    legal: {
      gvMonthly2026: [
        { month: "Ocak", exempt: 4211.33, rate: 15 },
        { month: "Subat", exempt: 4211.33, rate: 15 },
        { month: "Mart", exempt: 4211.33, rate: 15 },
        { month: "Nisan", exempt: 4211.33, rate: 15 },
        { month: "Mayis", exempt: 4211.33, rate: 15 },
        { month: "Haziran", exempt: 4211.33, rate: 15 },
        { month: "Temmuz", exempt: 4537.75, rate: 15 },
        { month: "Agustos", exempt: 5615.1, rate: 15 },
        { month: "Eylul", exempt: 5615.1, rate: 15 },
        { month: "Ekim", exempt: 5615.1, rate: 15 },
        { month: "Kasim", exempt: 5615.1, rate: 15 },
        { month: "Aralik", exempt: 5615.1, rate: 15 },
      ],
      dhrObserved: { exemptApplied: 0, paramFormulaValue: 4211.33, allMonthsSame: true },
      lucaObserved: { exemptApplied: 4211.33, octoberLegal: 5615.1 },
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(
    "Wrote",
    OUT,
    "rows",
    rows.length,
    "matched",
    matched.length,
    "mealLuca",
    payload.summary.mealOnLuca,
    "fmLuca",
    payload.summary.overtimeOnLuca,
    "besLuca",
    payload.summary.besOnLuca,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
