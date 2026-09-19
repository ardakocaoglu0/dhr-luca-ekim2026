/**
 * Luca Personel Excel Aktarma — Bordro Paket (6301–6330).
 * Aynı şablon / kolonlar: personel_giris_excel_IK32_dolu.xls
 * İşyeri: İK / Tek Değişken / Faz1 ile aynı. Bölüm: ekranda Bordro Paket seç.
 * Yönetici 6300 yok (karşılaştırmada yok).
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const ROSTER = JSON.parse(fs.readFileSync(path.join(DATA, "paket_roster.json"), "utf8"));
const CMP = JSON.parse(fs.readFileSync(path.join(DATA, "paket_comparison.json"), "utf8"));

const TEMPLATES = [
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_IK32_dolu.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_TekDegisken.xls"),
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_Faz1_Ana15.xls"),
  "C:/Users/ardak/Downloads/personel_giris_excel_IK32_dolu.xls",
  "C:/Users/ardak/Downloads/personel_giris_excel_orijinal_yedek.xls",
];
const TEMPLATE = TEMPLATES.find((p) => fs.existsSync(p));
if (!TEMPLATE) throw new Error("Luca personel_giris şablonu bulunamadı (IK32 / TekDegisken).");

const OUTS = [
  path.join(process.env.USERPROFILE, "Desktop", "personel_giris_excel_BordroPaket.xls"),
  path.join(process.env.USERPROFILE, "Downloads", "personel_giris_excel_BordroPaket.xls"),
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
  return p.hire || ROSTER.baseline?.hire || "2025-06-02";
}

function kanunNo(p) {
  if (p.law === "05510_2" || p.law === "05510_5") return "05510";
  if (p.law === "5746_15746") return "15746";
  if (p.law === "5746_05746" || p.law === "5746_GV" || p.law === "4691") return "05746";
  return "00000";
}

function isStudent(p) {
  const f = p.seedFlags || {};
  return !!(f.stajyer || f.cirak || f.intern || /Stajyer|Çırak|Cırak|İntörn|Intern/i.test(p.profile || ""));
}

function ogrenim(p) {
  if (/Doktora/i.test(p.profile || "") || /doktora/i.test(p.scenario || "")) return "Doktora";
  if (/Yüksek Lisans|YL/i.test(p.profile || "")) return "Yüksek Lisans";
  if (isStudent(p)) return "Lise";
  return "Lisans";
}

function meslekSigorta(p) {
  let meslek = "2421.03";
  let sig = "0";
  if (/Yönetici|İdari/i.test(p.profile || "") || /Müdür/i.test(p.title || "")) meslek = "1211.01";
  if (isStudent(p)) {
    meslek = "9999.01";
    sig = "7";
  }
  if (p.seedFlags?.emekli || /Emekli|SGDP/i.test(p.profile || "")) sig = "2";
  if (p.seedFlags?.foreign || /Yabancı/i.test(p.profile || "")) sig = "4";
  return `${meslek}/${sig}`;
}

function sakatlik() {
  // İK/Tek Değişken/Faz1: kod yazınca Luca “verileri hatalı”. Kartta Sakatlık İnd. Uyg.
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

const tcBySicil = {};
for (const r of CMP.rows || []) {
  if (r.sicil && r.tc) tcBySicil[String(r.sicil)] = String(r.tc);
}

const people = ROSTER.people.slice().sort((a, b) => Number(a.sicil) - Number(b.sicil));
if (people.length !== 30) throw new Error(`Paket ${people.length} kişi; 30 beklenirdi.`);

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
  row[2] = tcBySicil[String(p.sicil)] || makeTckn(630000 + n);
  row[3] = Number(p.maas);
  row[4] = hy;
  row[5] = hm;
  row[6] = "AY";
  row[7] = p.salaryType === 1 ? "NET" : "BRÜT";
  row[8] = dateSlash(hire);
  // Yeni aktarımda Çıkış Tarihi Luca’yı düşürüyor. Rüya 6328 çıkışı karttan: 31/01/2026.
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
  row[32] = `0539${String(6300000 + n).slice(-7)}`;
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
  if (p.seedFlags?.priorTaxFilled) {
    outWs[XLSX.utils.encode_cell({ r, c: 37 })] = { t: "n", v: 185000, z: "#,##0.00" };
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

const kanunDist = {};
for (const r of rows) kanunDist[r[17]] = (kanunDist[r[17]] || 0) + 1;
const meslekDist = {};
for (const r of rows) meslekDist[r[16]] = (meslekDist[r[16]] || 0) + 1;

console.log(
  JSON.stringify(
    {
      template: TEMPLATE,
      count: rows.length,
      outs: written,
      kanunDist,
      meslekDist,
      sample: rows.slice(0, 3).map((r) => ({
        ad: `${r[0]} ${r[1]}`,
        sicil: r[21],
        tc: r[2],
        ucret: r[3],
        yilAy: `${r[4]}-${r[5]}`,
        giris: r[8],
        kanun: r[17],
        meslek: r[16],
      })),
      specials: {
        poyraz: rows.find((r) => r[21] === "6304")?.slice(0, 18),
        sarp: rows.find((r) => r[21] === "6306")?.slice(15, 18),
        tuna: rows.find((r) => r[21] === "6307")?.slice(15, 18),
        ufuk: rows.find((r) => r[21] === "6308")?.[16],
        ahu: rows.find((r) => r[21] === "6312")?.[17],
        barisSak: rows.find((r) => r[21] === "6313")?.[19],
        ruyaGiris: rows.find((r) => r[21] === "6328")?.[8],
        ruyaCikis: rows.find((r) => r[21] === "6328")?.[9],
        pinarUcret: rows.find((r) => r[21] === "6327")?.[3],
        gizem: rows.find((r) => r[21] === "6318")?.[21],
      },
      afterImport: [
        "Personel → Personel Excel Aktarma → aynı işyeri, bölüm Bordro Paket (yoksa oluştur).",
        "Yemek 5.500 B + yol 3.200 B (Nuri yemek 0; Oya yemek 12.000; Gizem yol 0; stajyer/çırak/intörn 0; Pınar yemek/yol 0).",
        "6304–6307: meslek 9999.01/7 (stajyer sigorta). 6308 Ufuk: sigorta kodu 2 (SGDP).",
        "6312 Ahu: kanun 05746 Excel’de; stopaj terkin kartta.",
        "6313 Barış: Sakatlık Excel’de boş. Kartta Sakatlık İnd. Uyg. = 1.",
        "6328 Rüya: Excel’de çıkış yok. Karttan çıkış 31/01/2026 + kıdem/ihbar.",
        "Yönetici Yaman 6300 bu dosyada yok (onay için DHR’de duruyor).",
      ],
    },
    null,
    2
  )
);
