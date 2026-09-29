/**
 * Luca Personel Excel Aktarma — Faz1 Bordro A.Ş. (Eda 8062, Ozan 8061).
 * İşyeri: TEKNOPARK. Bölüm: Faz1 Bordro A.Ş. Kenar paketine Ozan koyma.
 * Ozan B giriş 11/09/2026 (Kenar çıkış 10/09 Kenar kartında kalır).
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "faz1_roster.json"), "utf8"));

const TEMPLATES = [
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel.xls"),
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_Blokaj.xls"),
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_Operasyon.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_Blokaj.xls"),
];
const TEMPLATE = TEMPLATES.find((p) => fs.existsSync(p));
if (!TEMPLATE) throw new Error("Luca personel_giris şablonu yok");

const OUTS = [
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_BordroAS.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_BordroAS.xls"),
];

function asciiName(s) {
  return String(s || "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateSlash(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

function hireIso(p) {
  if (p.sicil === "8061" && p.companyBHire) return p.companyBHire;
  return p.hire || "2026-01-06";
}

function meslekSigorta(p) {
  if (/Yönetici|İdari|Müdür/i.test(p.profile || "") || /Müdür/i.test(p.title || "")) return "1211.01/0";
  return "2421.03/0";
}

function birthSlash(n) {
  const y = 1980 + (n % 15);
  const m = pad2((n % 12) + 1);
  const d = pad2(5 + (n % 20));
  return `${d}/${m}/${y}`;
}

const people = ROSTER.people.filter((p) => p.unit === "sirket-b").sort((a, b) => Number(a.sicil) - Number(b.sicil));
if (people.length !== 2) throw new Error("sirket-b " + people.length + " kişi; 2 beklenirdi");

const wbTpl = XLSX.readFile(TEMPLATE);
const header = XLSX.utils.sheet_to_json(wbTpl.Sheets[wbTpl.SheetNames[0]], { header: 1, defval: "" }).slice(0, 3);
const colCount = header[2].length;

const rows = people.map((p) => {
  const n = parseInt(p.sicil, 10);
  const hire = hireIso(p);
  const [hy, hm] = hire.slice(0, 10).split("-").map(Number);
  const row = Array(colCount).fill("");
  row[0] = asciiName(p.firstName);
  row[1] = asciiName(p.lastName);
  row[2] = makeTckn45(p.sicil);
  row[3] = Number(p.maas);
  row[4] = hy;
  row[5] = hm;
  row[6] = "AY";
  row[7] = p.salaryType === 1 ? "NET" : "BRÜT";
  row[8] = dateSlash(hire);
  row[9] = "";
  row[12] = "Lisans";
  row[13] = p.gender === "Female" ? "K" : "E";
  row[15] = asciiName(p.title || "Uzman");
  row[16] = meslekSigorta(p);
  row[17] = "00000";
  row[18] = "01";
  row[21] = String(p.sicil);
  row[24] = "İstanbul";
  row[25] = birthSlash(n);
  row[32] = `0533${String(182000 + (n % 1000)).padStart(7, "0").slice(-7)}`;
  row[33] = p.email || "";
  row[34] = "Maslak Mah. Demo Sk. No:1";
  row[35] = "İstanbul";
  row[36] = "Sarıyer";
  return row;
});

const outWs = XLSX.utils.aoa_to_sheet([...header, ...rows]);
people.forEach((p, i) => {
  const r = 3 + i;
  outWs[XLSX.utils.encode_cell({ r, c: 3 })] = { t: "n", v: Number(p.maas), z: "#,##0.00" };
  outWs[XLSX.utils.encode_cell({ r, c: 8 })] = { t: "s", v: dateSlash(hireIso(p)), z: "@" };
  outWs[XLSX.utils.encode_cell({ r, c: 25 })] = { t: "s", v: birthSlash(parseInt(p.sicil, 10)), z: "@" };
});
outWs["!cols"] = Array(colCount)
  .fill(0)
  .map((_, i) => ({ wch: i < 3 ? 18 : 12 }));
outWs["!ref"] = XLSX.utils.encode_range({
  s: { r: 0, c: 0 },
  e: { r: 2 + people.length, c: Math.max(colCount - 1, 39) },
});

const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, outWs, "Sheet1");
XLSX.utils.book_append_sheet(outWb, XLSX.utils.aoa_to_sheet([]), "Sheet2");
XLSX.utils.book_append_sheet(outWb, XLSX.utils.aoa_to_sheet([]), "Sheet3");

const written = [];
for (const p of OUTS) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    XLSX.writeFile(outWb, p, { bookType: "xls" });
    written.push(p);
  } catch (e) {
    console.error("yazılamadı", p, e.message);
  }
}

console.log(
  JSON.stringify(
    {
      template: TEMPLATE,
      count: rows.length,
      outs: written,
      people: rows.map((r) => ({ ad: r[0], soy: r[1], sicil: r[21], tc: r[2], giris: r[8], ucret: r[3], kanun: r[17], meslek: r[16] })),
    },
    null,
    2
  )
);
