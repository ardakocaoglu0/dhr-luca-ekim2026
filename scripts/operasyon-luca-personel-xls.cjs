/**
 * Luca Personel Excel Aktarma — Operasyon (3).
 * İşyeri: Ana Kadro / Yuvarlama ile aynı (D1 TECH). Bölüm: ekranda Operasyon seç.
 * Kenar TEKNOPARK / İK / Paket yok. Çıkış Excel’de boş.
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "faz1_roster.json"), "utf8"));

const TEMPLATES = [
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel.xls"),
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_KenarDurumlar.xls"),
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_Yuvarlama.xls"),
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_Faz1_Ana15.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_KenarDurumlar.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_Faz1_Ana15.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_Yuvarlama.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_IK32_dolu.xls"),
];
const TEMPLATE = TEMPLATES.find((p) => fs.existsSync(p));
if (!TEMPLATE) throw new Error("Luca personel_giris şablonu yok");

const OUTS = [
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_Operasyon.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_Operasyon.xls"),
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
  return p.hire || "2026-01-06";
}

function kanunNo(p) {
  if (p.law === "05510_2" || p.law === "05510_5") return "05510";
  if (p.law === "5746_15746") return "15746";
  if (p.law === "5746_05746" || p.law === "5746_GV" || p.law === "4691") return "05746";
  return "00000";
}

function ogrenim(p) {
  if (/Doktora/i.test(p.profile || "")) return "Doktora";
  if (/Yüksek Lisans|YL/i.test(p.profile || "")) return "Yüksek Lisans";
  if (/Stajyer/i.test(p.profile || "") || p.seedFlags?.stajyer) return "Lise";
  return "Lisans";
}

function meslekSigorta(p) {
  let meslek = "2421.03";
  let sig = "0";
  if (/Yönetici|İdari/i.test(p.profile || "") || /Müdür/i.test(p.title || "")) meslek = "1211.01";
  if (/Stajyer/i.test(p.profile || "") || p.seedFlags?.stajyer) {
    meslek = "9999.01";
    sig = "7";
  }
  if (p.seedFlags?.emekli || /Emekli|SGDP/i.test(p.profile || "")) sig = "2";
  if (p.seedFlags?.foreign || /Yabancı/i.test(p.profile || "")) sig = "4";
  return `${meslek}/${sig}`;
}

function birthSlash(n) {
  const y = 1980 + (n % 15);
  const m = pad2((n % 12) + 1);
  const d = pad2(5 + (n % 20));
  return `${d}/${m}/${y}`;
}

const people = ROSTER.people
  .filter((p) => p.unit === "operasyon")
  .sort((a, b) => Number(a.sicil) - Number(b.sicil));

if (people.length !== 3) {
  throw new Error("operasyon " + people.length + " kişi; 3 beklenirdi");
}

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
  row[12] = ogrenim(p);
  row[13] = p.gender === "Female" ? "K" : "E";
  row[15] = asciiName(p.title || "Operasyon Uzmanı");
  row[16] = meslekSigorta(p);
  row[17] = kanunNo(p);
  row[18] = "01";
  row[19] = "";
  row[21] = String(p.sicil);
  row[24] = "İstanbul";
  row[25] = birthSlash(n);
  row[32] = `0533${String(182000 + (n % 1000)).padStart(7, "0").slice(-7)}`;
  row[33] = p.email || "";
  row[34] = "Maslak Mah. Demo Sk. No:1";
  row[35] = "İstanbul";
  row[36] = "Sarıyer";
  row[37] = p.seedFlags?.priorTaxFilled ? 185000 : "";
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
      people: rows.map((r) => ({
        ad: r[0],
        soy: r[1],
        sicil: r[21],
        tc: r[2],
        giris: r[8],
        ucret: r[3],
        kanun: r[17],
        ssk: r[18],
      })),
    },
    null,
    2
  )
);
