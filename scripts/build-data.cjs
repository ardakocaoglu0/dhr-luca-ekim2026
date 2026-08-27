/**
 * Build comparison JSON from Luca PDF + DHR Excel for the static site.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");
const XLSX = require("xlsx");

const LUCA_PDF =
  process.argv[2] ||
  "C:/Users/ardak/Downloads/bordro_d1_tech (1).pdf";
const DHR_XLSX =
  process.argv[3] ||
  "C:/Users/ardak/Downloads/Payroll_Ekim 2026_2026-08-27 (1).xlsx";
const SEED = JSON.parse(
  fs.readFileSync(path.join(__dirname, "dhr_ik_seed_32.json"), "utf8"),
);

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
}
const OUT = path.join(__dirname, "..", "src", "data", "comparison.json");

function parseTR(s) {
  if (s == null || s === "") return null;
  return Number(String(s).replace(/\./g, "").replace(",", "."));
}

async function extractLuca(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();
  const rows = [];
  const re =
    /(\d+)\s+([A-Za-zçğıöşüÇĞİÖŞÜ ]+?)\s+(43\d{9})(?:\s+\d+\s+Gün)?\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+([\d\.]+,\d{2})([GN])\s+(\d+)\s+(\d+)\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s*\r?\n\s*([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})/g;
  let m;
  while ((m = re.exec(text))) {
    const slice = text.slice(m.index, m.index + 900);
    const dig = slice.match(/Diğer Kazançlar:\s*([^\n]*)/);
    const oz = slice.match(/Özel Kesintiler:\s*([^\n]*)/);
    rows.push({
      name: m[2].trim(),
      tc: m[3],
      kanun: m[5],
      ucret: parseTR(m[6]),
      gs: m[7],
      tgun: +m[8],
      topKaz: parseTR(m[12]),
      digKaz: parseTR(m[13]),
      sskMat: parseTR(m[14]),
      sskIsci: parseTR(m[16]),
      gv: parseTR(m[19]),
      damga: parseTR(m[21]),
      ozKes: parseTR(m[22]),
      net: parseTR(m[23]),
      digText: dig ? dig[1].trim() : "",
      ozText: oz ? oz[1].trim() : "",
    });
  }
  // Hande special line
  if (!rows.find((r) => r.tc === "43056962656")) {
    const hm = text.match(
      /Hande Orhan 43056962656 5 Gün 01\/03\/2024 00000 53\.000,00G 26 0 45\.933,33 0,00 45\.933,33 0,00 45\.933,33 9\.990,50\r?\n\s*6\.430,67 39\.043,33 39\.043,33 1\.645,17 1\.645,17 97,93 0,00 37\.300,23/,
    );
    if (hm) {
      rows.push({
        name: "Hande Orhan",
        tc: "43056962656",
        kanun: "00000",
        ucret: 53000,
        gs: "G",
        tgun: 26,
        topKaz: 45933.33,
        digKaz: 0,
        sskMat: 45933.33,
        sskIsci: 6430.67,
        gv: 1645.17,
        damga: 97.93,
        ozKes: 0,
        net: 37300.23,
        digText: "",
        ozText: "",
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
  const seedByName = Object.fromEntries(
    SEED.created.map((c) => [normName(c.name), c]),
  );
  const rows = [];
  for (const r of raw) {
    const name = r["Çalışan Adı Soyadı"] || r["Calisan Adi Soyadi"];
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
      employeeNo: r["Çalışan No"],
      gross: num(r["Toplam Kazanç"]),
      net: num(r["Net Maaş"]),
      gv: num(r["Gelir Vergisi"]),
      gvBase: num(r["Gelir Vergisine Tabi Kazanç"]),
      sgk: num(r["SGK Primi İşçi Payı"]),
      damga: num(r["Damga Vergisi"]),
      bes: num(r["Bireysel Emeklilik (BES) Kesintisi"]),
      meal: num(r["Yemek Yardımı"]),
      transport: num(r["Yol Yardımı"]),
      overtime: num(r["Fazla Mesai"]),
      prim: num(r["Prim"]),
      meta: {
        n: seed.n,
        note: seed.note,
        profile: seed.profile,
        lucaKanun: seed.lucaKanun,
      },
    });
  }
  return rows;
}

function merge(luca, dhr) {
  const dhrByTc = Object.fromEntries(dhr.map((r) => [r.tc, r]));
  const seedByTc = Object.fromEntries(SEED.created.map((c) => [c.tc, c]));
  return luca.rows.map((L) => {
    const D = dhrByTc[L.tc];
    const S = seedByTc[L.tc];
    return {
      n: S?.n,
      name: L.name,
      tc: L.tc,
      note: S?.note || "",
      profile: S?.profile || "",
      lucaKanunExpected: S?.lucaKanun,
      luca: L,
      dhr: D
        ? {
            gross: D.gross,
            net: D.net,
            gv: D.gv,
            sgk: D.sgk,
            damga: D.damga,
            bes: D.bes,
            meal: D.meal,
            transport: D.transport,
          }
        : null,
      delta: D
        ? {
            net: +(D.net - L.net).toFixed(2),
            gv: +(D.gv - L.gv).toFixed(2),
            damga: +((D.damga || 0) - (L.damga || 0)).toFixed(2),
          }
        : null,
    };
  });
}

(async () => {
  const luca = await extractLuca(LUCA_PDF);
  const dhr = extractDhr(DHR_XLSX);
  const rows = merge(luca, dhr);
  const matched = rows.filter((r) => r.dhr?.net != null);
  const payload = {
    generatedAt: new Date().toISOString(),
    period: "Ekim 2026",
    unit: "İnsan Kaynakları — dhrtest vs Luca",
    sources: {
      lucaPdf: "public/downloads/bordro_d1_tech.pdf",
      dhrExcel: "public/downloads/Payroll_Ekim_2026.xlsx",
    },
    summary: {
      lucaCount: luca.rows.length,
      dhrCount: dhr.length,
      matched: matched.length,
      netWithin100: matched.filter((r) => Math.abs(r.delta.net) <= 100).length,
      avgAbsNetDelta: matched.length
        ? +(matched.reduce((s, r) => s + Math.abs(r.delta.net), 0) / matched.length).toFixed(2)
        : null,
      fmHoursTotalLuca: luca.fmHoursTotal,
    },
    rows: rows.sort((a, b) => (a.n || 0) - (b.n || 0)),
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
      dhrObserved: { exemptApplied: 0, paramFormulaValue: 4211.33, allMonthsSame: true },
      lucaObserved: { exemptApplied: 4211.33, octoberLegal: 5615.1 },
    },
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log("Wrote", OUT, "rows", rows.length, "matched", matched.length);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
