/**
 * Luca Personel Excel Aktarma — Tek Değişken (6201–6227).
 * Aynı şablon / kolonlar: Downloads/personel_giris_excel_IK32_dolu.xls
 * İşyeri: İK ile aynı. Bölüm: ekranda Tek Değişken seç.
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "izole_roster.json"), "utf8"));
const TEMPLATE = fs.existsSync("C:/Users/ardak/Downloads/personel_giris_excel_orijinal_yedek.xls")
  ? "C:/Users/ardak/Downloads/personel_giris_excel_orijinal_yedek.xls"
  : "C:/Users/ardak/Downloads/personel_giris_excel_IK32_dolu.xls";

const OUTS = [
  "C:/Users/ardak/Downloads/personel_giris_excel_TekDegisken.xls",
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_TekDegisken.xls"),
];

function makeTckn(seed) {
  let n = 100000001 + Math.abs(Number(seed) || 0) * 137 + 246813579;
  n = n % 900000000;
  if (n < 100000000) n += 100000000;
  const d = String(n).padStart(9, "1").split("").map(Number);
  d[0] = Math.max(1, d[0]);
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
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

function hireIso(p) {
  return p.hire || ROSTER.baseline.hire || "2025-06-02";
}

function kanunNo(p) {
  if (p.law === "05510_2" || p.law === "05510_5") return "05510";
  if (p.law === "5746_15746") return "15746";
  if (p.law === "5746_05746" || p.law === "5746_GV") return "05746";
  return "00000";
}

function ogrenim(p) {
  if (/Doktora/i.test(p.profile || "") || /doktora/i.test(p.scenario || "")) return "Doktora";
  if (/Yüksek Lisans|YL/i.test(p.profile || "") || /YL/.test(p.scenario || "")) return "Yüksek Lisans";
  if (/Stajyer/i.test(p.profile || "")) return "Lise";
  return "Lisans";
}

function meslekSigorta(p) {
  let meslek = "2421.03";
  let sig = "0";
  if (/Yönetici|İdari/i.test(p.profile || "") || /Müdür/i.test(p.title || "")) meslek = "1211.01";
  if (/Stajyer/i.test(p.profile || "")) {
    meslek = "9999.01";
    sig = "7";
  }
  if (p.seedFlags?.emekli || /Emekli/i.test(p.profile || "")) sig = "2";
  if (p.seedFlags?.foreign || /Yabancı/i.test(p.profile || "")) sig = "4";
  return `${meslek}/${sig}`;
}

function sakatlik(p) {
  const d = p.seedFlags?.disabilityDegree;
  if (d === 1 || d === 2 || d === 3) return String(d);
  return "";
}

function birthSlash(n) {
  const y = 1980 + (n % 15);
  const m = pad2((n % 12) + 1);
  const d = pad2(5 + (n % 20));
  return `${d}/${m}/${y}`;
}

function gender(p) {
  return p.gender === "Female" ? "K" : "E";
}

const people = ROSTER.people.slice().sort((a, b) => Number(a.sicil) - Number(b.sicil));
const wbTpl = XLSX.readFile(TEMPLATE);
const header = XLSX.utils.sheet_to_json(wbTpl.Sheets[wbTpl.SheetNames[0]], { header: 1, defval: "" }).slice(0, 3);
const colCount = header[2].length;

const rows = people.map((p) => {
  const n = parseInt(p.sicil, 10);
  const hire = hireIso(p);
  const [hy, hm] = hire.slice(0, 10).split("-").map(Number);
  const row = Array(colCount).fill("");
  row[0] = p.firstName;
  row[1] = p.lastName;
  row[2] = makeTckn(620000 + n);
  row[3] = Number(p.maas);
  row[4] = hy;
  row[5] = hm;
  row[6] = "AY";
  row[7] = p.salaryType === 1 ? "NET" : "BRÜT";
  row[8] = dateSlash(hire);
  row[12] = ogrenim(p);
  row[13] = gender(p);
  row[15] = p.title || "Bordro Uzmanı";
  row[16] = meslekSigorta(p);
  row[17] = kanunNo(p);
  row[18] = "01";
  row[19] = sakatlik(p);
  row[21] = String(p.sicil);
  row[24] = "İstanbul";
  row[25] = birthSlash(n);
  row[32] = `0533${String(162000 + (n % 1000)).slice(-7)}`;
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
  const wage = XLSX.utils.encode_cell({ r, c: 3 });
  outWs[wage] = { t: "n", v: Number(p.maas), z: "#,##0.00" };
  const giris = XLSX.utils.encode_cell({ r, c: 8 });
  outWs[giris] = { t: "s", v: dateSlash(hireIso(p)), z: "@" };
  const dogum = XLSX.utils.encode_cell({ r, c: 25 });
  outWs[dogum] = { t: "s", v: birthSlash(parseInt(p.sicil, 10)), z: "@" };
  if (p.seedFlags?.priorTaxFilled) {
    const gv = XLSX.utils.encode_cell({ r, c: 37 });
    outWs[gv] = { t: "n", v: 185000, z: "#,##0.00" };
  }
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

for (const p of OUTS) XLSX.writeFile(outWb, p, { bookType: "xls" });

const kanunDist = {};
for (const r of rows) kanunDist[r[17]] = (kanunDist[r[17]] || 0) + 1;

console.log(
  JSON.stringify(
    {
      count: rows.length,
      outs: OUTS,
      kanunDist,
      sample: rows.slice(0, 4).map((r) => ({
        ad: r[0],
        soyad: r[1],
        tc: r[2],
        sicil: r[21],
        ucret: r[3],
        yilAy: `${r[4]}-${r[5]}`,
        netbrut: r[7],
        giris: r[8],
        kanun: r[17],
      })),
      nazli: rows.find((r) => r[0] === "Nazli"),
      defne: rows.find((r) => r[0] === "Defne")?.slice(0, 9),
      cemilGv: rows.find((r) => r[0] === "Cemil")?.[37],
      kaanSak: rows.find((r) => r[0] === "Kaan")?.[19],
    },
    null,
    2
  )
);
