/**
 * Luca Personel Excel Aktarma — Faz 1 Ana Kadro 15 (8003–8017).
 * Aynı şablon / kolonlar: personel_giris_excel_IK32_dolu.xls
 * İşyeri: İK / Tek Değişken ile aynı. Bölüm: ekranda Ana Kadro seç.
 * Pasif 8018–8019 ve yöneticiler 8001–8002 yok (Eylül 15’lik değil).
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "faz1_roster.json"), "utf8"));

const TEMPLATES = [
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_IK32_dolu.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_TekDegisken.xls"),
  "C:/Users/ardak/Downloads/personel_giris_excel_IK32_dolu.xls",
  "C:/Users/ardak/Downloads/personel_giris_excel_orijinal_yedek.xls",
];
const TEMPLATE = TEMPLATES.find((p) => fs.existsSync(p));
if (!TEMPLATE) throw new Error("Luca personel_giris şablonu bulunamadı (IK32 / TekDegisken).");

const OUTS = [
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_Faz1_Ana15.xls"),
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_Faz1_Ana15.xls"),
];

function asciiName(s) {
  return String(s || "")
    .replace(/İ/g, "I")
    .replace(/I/g, "I")
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
  if (/Doktora/i.test(p.profile || "") || /doktora/i.test(p.scenario || "")) return "Doktora";
  if (/Yüksek Lisans|YL/i.test(p.profile || "")) return "Yüksek Lisans";
  if (/Stajyer/i.test(p.profile || "") || p.seedFlags?.stajyer) return "Lise";
  return "Lisans";
}

function meslekSigorta(p) {
  let meslek = "2421.03";
  let sig = "0";
  if (/Yönetici|İdari/i.test(p.profile || "") || /Müdür/i.test(p.title || "")) meslek = "1211.01";
  if (/Ar-Ge/i.test(p.profile || "") || p.seedFlags?.arge) meslek = "2421.03";
  if (/Stajyer/i.test(p.profile || "") || p.seedFlags?.stajyer) {
    meslek = "9999.01";
    sig = "7";
  }
  if (p.seedFlags?.emekli || /Emekli|SGDP/i.test(p.profile || "")) sig = "2";
  if (p.seedFlags?.foreign || /Yabancı/i.test(p.profile || "")) sig = "4";
  return `${meslek}/${sig}`;
}

function sakatlik() {
  // Tek Değişken: "1" Kaan’da geçti sanıldı; Faz 1 Nihan’da "1" de “verileri hatalı”.
  // Kolon boş. Derece kartta: Sakatlık İnd. Uyg.
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

const people = ROSTER.people
  .filter((p) => p.unit === "ana" && p.group === "ana-aktif")
  .sort((a, b) => Number(a.sicil) - Number(b.sicil));

if (people.length !== 15) {
  throw new Error(`Ana aktif ${people.length} kişi; 15 beklenirdi.`);
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
  row[2] = makeTckn(800000 + n);
  row[3] = Number(p.maas);
  row[4] = hy;
  row[5] = hm;
  row[6] = "AY";
  row[7] = p.salaryType === 1 ? "NET" : "BRÜT";
  row[8] = dateSlash(hire);
  // Yeni personel aktarımında Çıkış Tarihi + boş SSK nedeni Luca “verileri hatalı” veriyor.
  // Cansu 8005 çıkışı karttan: 14/09/2026.
  row[9] = "";
  row[12] = ogrenim(p);
  row[13] = gender(p);
  row[15] = asciiName(p.title || "Bordro Uzmanı");
  row[16] = meslekSigorta(p);
  row[17] = kanunNo(p);
  row[18] = "01";
  row[19] = sakatlik();
  row[21] = String(p.sicil);
  row[24] = "İstanbul";
  row[25] = birthSlash(n);
  row[32] = `0533${String(180000 + (n % 1000)).slice(-7)}`;
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

function writeXls(wb, paths) {
  const ok = [];
  for (const p of paths) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      XLSX.writeFile(wb, p, { bookType: "xls" });
      ok.push(p);
    } catch (e) {
      console.error("yazılamadı", p, e.message);
    }
  }
  return ok;
}

const written = writeXls(outWb, OUTS);

const retryIdx = people
  .map((p, i) => (/^8005$|^8016$/.test(p.sicil) ? i : -1))
  .filter((i) => i >= 0);
const retryWs = XLSX.utils.aoa_to_sheet([...header, ...retryIdx.map((i) => rows[i])]);
retryIdx.forEach((src, j) => {
  const p = people[src];
  const r = 3 + j;
  retryWs[XLSX.utils.encode_cell({ r, c: 3 })] = { t: "n", v: Number(p.maas), z: "#,##0.00" };
  retryWs[XLSX.utils.encode_cell({ r, c: 8 })] = { t: "s", v: dateSlash(hireIso(p)), z: "@" };
  retryWs[XLSX.utils.encode_cell({ r, c: 25 })] = { t: "s", v: birthSlash(parseInt(p.sicil, 10)), z: "@" };
});
retryWs["!cols"] = outWs["!cols"];
retryWs["!ref"] = XLSX.utils.encode_range({
  s: { r: 0, c: 0 },
  e: { r: 2 + retryIdx.length, c: Math.max(colCount - 1, 39) },
});
const retryWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(retryWb, retryWs, "Sheet1");
XLSX.utils.book_append_sheet(retryWb, XLSX.utils.aoa_to_sheet([]), "Sheet2");
XLSX.utils.book_append_sheet(retryWb, XLSX.utils.aoa_to_sheet([]), "Sheet3");
const retryOuts = writeXls(retryWb, [
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_Faz1_Ana15_CansuNihan.xls"),
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_Faz1_Ana15_CansuNihan.xls"),
]);

const kanunDist = {};
for (const r of rows) kanunDist[r[17]] = (kanunDist[r[17]] || 0) + 1;

console.log(
  JSON.stringify(
    {
      template: TEMPLATE,
      count: rows.length,
      outs: written,
      kanunDist,
      people: rows.map((r, i) => ({
        sicil: r[21],
        ad: `${r[0]} ${r[1]}`,
        ucret: r[3],
        netbrut: r[7],
        giris: r[8],
        cikis: r[9] || null,
        kanun: r[17],
        meslek: r[16],
        sak: r[19] || null,
        note: people[i].note,
      })),
      afterImport: [
        "Personel → Personel Excel Aktarma → aynı işyeri, bölüm Ana Kadro.",
        "Yemek 5.500 B + yol 3.200 B (Lale hariç; stajyerde 0).",
        "8004 Baran: giriş 19.09 — sağlık 2.500 / işveren BES 1.800 kartta (Excel’de yok).",
        "8005 Cansu: Excel’de çıkış yok (Luca yeni aktarımda reddetti). Karttan çıkış 14/09/2026.",
        "8008 Fırat: 10s brüt + 5s net FM puantaj (Excel’de yok).",
        "8009 Gülce: prim 7.500, masraf 4.368, kesinti 1.500, avans 2.000.",
        "8010 Hakan: çalışan BES %3.",
        "8011 İrem: kanun 05510 Excel’de; %2 kartta.",
        "8012 Jale: sigorta kodu 2 (SGDP) Excel’de.",
        "8013 Korhan: kısmi 80 saat / 10 prim günü kartta.",
        "8014 Lale: stajyer 18.000, meslek 9999.01/7.",
        "8015 Mert: kanun 05746; 5746 lisans kartı.",
        "8016 Nihan: Sakatlık Excel’de boş (Luca “1” de reddetti). Kartta Sakatlık İnd. Uyg. = 1.",
      ],
      retry: retryOuts,
      retryNames: retryIdx.map((i) => `${rows[i][0]} ${rows[i][1]} ${people[i].sicil}`),
    },
    null,
    2
  )
);
