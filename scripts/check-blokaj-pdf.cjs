/**
 * Audit Luca PDF vs Blokaj roster (Taner Uslu 8078) + site DHR.
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const PDF = process.argv[2] || "C:/Users/HONOR/Downloads/bordro_d1_tech (37).pdf";
const ROOT = path.join(__dirname, "..");
const roster = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "faz1_roster.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "blokaj_comparison.json"), "utf8"));
const OUT = path.join(process.env.TEMP, path.basename(PDF, ".pdf").replace(/\s+/g, "-") + "-bl-audit.json");

const parseTR = (s) => (s == null || s === "" ? null : Number(String(s).replace(/\./g, "").replace(",", ".")));
const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100) / 100);
const nz = (n) => (n == null || !Number.isFinite(Number(n)) ? 0 : Number(n));

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

function pick(blob, re) {
  const m = blob.match(re);
  return m ? parseTR(m[1]) : 0;
}

function extras(slice) {
  const digM = slice.match(/Di[gğ]er Kazan[cç]lar:\s*([^\n]*)/i);
  const ozM = slice.match(/[OÖ]zel Kesintiler:\s*([^\n]*)/i);
  let digText = digM ? digM[1].trim() : "";
  let ozText = ozM ? ozM[1].trim() : "";
  if (/^--\s*\d/.test(digText)) digText = "";
  const blob = `${digText}\n${ozText}`;
  return {
    digText,
    ozText,
    meal: pick(blob, /Yemek[^:\n]*:\s*([\d.]+,\d{2})/i),
    mealBN: (blob.match(/Yemek[^:\n]*:\s*[\d.]+,\d{2}\s*([BN])/i) || [])[1] || "",
    transport: pick(blob, /Yol[^:\n]*:\s*([\d.]+,\d{2})/i),
    yolBN: (blob.match(/Yol[^:\n]*:\s*[\d.]+,\d{2}\s*([BN])/i) || [])[1] || "",
    prim: pick(blob, /\bPrim[^:\n]*:\s*([\d.]+,\d{2})/i),
    overtime: pick(blob, /Fazla Mesai[^:\n]*:\s*([\d.]+,\d{2})/i),
    unpaidHint: /[uü]cretsiz/i.test(slice),
    raporHint: /rapor|istirahat/i.test(slice),
    yillikHint: /[uü]cretli izin|y[ıi]ll[ıi]k izin/i.test(slice),
  };
}

(async () => {
  if (!fs.existsSync(PDF)) throw new Error("PDF yok: " + PDF);
  const parser = new PDFParse({ data: fs.readFileSync(PDF) });
  const { text } = await parser.getText();
  const header = text.slice(0, 1200).replace(/\s+/g, " ");

  const re =
    /(\d+)\s+([A-Za-z0-9\u00C7\u00E7\u011E\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC ]+?)\s+((?:43|45)\d{9})(?:\s+\d+\s+G[uü]n(?:\s+\d+\s+[^\n\d]{0,48})?)?\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?\s+(\d+)\s+([\d.]+,\d{2})([GN])\s+(\d+)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*\r?\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;

  const slips = [];
  let m;
  while ((m = re.exec(text))) {
    const ex = extras(text.slice(m.index, m.index + 2500));
    slips.push({
      n: +m[1],
      name: m[2].trim(),
      tc: m[3],
      hire: m[4],
      exit: m[5] || "",
      kanun: String(m[6]).padStart(5, "0"),
      ucret: parseTR(m[7]),
      gs: m[8],
      tgun: +m[9],
      izgun: +m[10],
      norKaz: parseTR(m[11]),
      topKaz: parseTR(m[13]),
      digKaz: parseTR(m[14]),
      gv: parseTR(m[20]),
      damga: parseTR(m[22]),
      ozKes: parseTR(m[23]),
      net: parseTR(m[24]),
      ...ex,
    });
  }

  const bl = roster.people.filter((p) => p.unit === "blokaj").sort((a, b) => Number(a.sicil) - Number(b.sicil));
  const siteBy = Object.fromEntries((site.rows || []).map((r) => [String(r.sicil), r]));
  const byTc = Object.fromEntries(slips.map((s) => [s.tc, s]));
  const byName = Object.fromEntries(slips.map((s) => [s.name.toLocaleLowerCase("tr"), s]));

  const people = bl.map((p) => {
    const L = byTc[makeTckn45(p.sicil)] || byName[p.name.toLocaleLowerCase("tr")];
    const S = siteBy[p.sicil];
    const miss = [];
    if (!L) {
      miss.push("PAKETTE YOK");
      return { sicil: p.sicil, name: p.name, note: p.note, miss, inPdf: false, dhr: S?.dhr || null };
    }
    if (L.hire !== "06/01/2026") miss.push(`giriş ${L.hire} (06/01/2026)`);
    if (L.exit) miss.push(`çıkış ${L.exit} olmamalı`);
    if (L.kanun !== "00000") miss.push(`kanun ${L.kanun} (00000)`);
    if (L.ucret !== 60000) miss.push(`ücret ${L.ucret} (60.000)`);
    if (L.gs !== "G") miss.push(`ücret türü ${L.gs} (G/BRÜT)`);
    if (L.tgun !== 30) miss.push(`T.Gün ${L.tgun} (olmalı 30)`);
    if (L.izgun > 0) miss.push(`İz.Gün ${L.izgun} (izin yok)`);
    if (L.unpaidHint) miss.push("ücretsiz satırı olmamalı");
    if (L.raporHint) miss.push("rapor/01 İstirahat olmamalı");
    if (L.yillikHint) miss.push("ücretli/yıllık izin olmamalı");
    if (nz(L.meal) === 0) miss.push("yemek yok (5.500 B)");
    if (nz(L.meal) > 0 && L.mealBN && L.mealBN !== "B") miss.push(`yemek ${L.mealBN} (B)`);
    if (nz(L.transport) === 0) miss.push("yol yok (formda 3.200 B)");
    if (nz(L.transport) > 0 && L.yolBN === "N") miss.push("yol N (formda B; PDF N basabilir — Taner’i N için düzeltme)");
    if (nz(L.prim) > 0) miss.push(`prim ${L.prim} olmamalı`);
    return {
      sicil: p.sicil,
      name: p.name,
      note: p.note,
      inPdf: true,
      miss,
      ...L,
      dhrNet: S?.dhr?.net ?? null,
      dhrDays: S?.dhr?.sgkDays ?? null,
      dNet: S?.dhr?.net != null ? r2(S.dhr.net - L.net) : null,
    };
  });

  const extra = slips.filter((s) => !people.some((p) => p.tc === s.tc || p.name === s.name));
  const out = { pdf: PDF, header: header.slice(0, 600), slipCount: slips.length, people, extra, names: slips.map((s) => s.name) };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(
    JSON.stringify(
      {
        out: OUT,
        slipCount: slips.length,
        names: out.names,
        people: people.map((p) => ({
          sicil: p.sicil,
          name: p.name,
          inPdf: p.inPdf,
          tgun: p.tgun,
          izgun: p.izgun,
          meal: p.meal,
          mealBN: p.mealBN,
          yol: p.transport,
          yolBN: p.yolBN,
          net: p.net,
          dhrNet: p.dhrNet,
          dNet: p.dNet,
          miss: p.miss,
          digText: p.digText,
        })),
      },
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
