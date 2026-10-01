/**
 * Compact DHR İnsan Kaynakları 2026 year JSON from TEMP/_ik_year_{periodId}.json dumps.
 * Luca/YZ are not included. Avans uses deductionAmount.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "src", "data");
const MONTH_DIR = path.join(DATA, "yillik");
const TEMP = process.env.TEMP || process.env.TMPDIR || "/tmp";
const OUT = path.join(DATA, "yillik_ik.json");

const MONTHS = [
  { month: 1, label: "Ocak", short: "Oca", id: "67d5ddbc-5000-48b3-abac-b89e429cf5c2" },
  { month: 2, label: "Şubat", short: "Şub", id: "496ecb2f-d6ee-488c-bb37-23554687a9f7" },
  { month: 3, label: "Mart", short: "Mar", id: "3d538661-14a7-4fed-87cb-a679f8b66f27" },
  { month: 4, label: "Nisan", short: "Nis", id: "98f3d7db-e3c2-4bef-851e-dd8cb133b375" },
  { month: 5, label: "Mayıs", short: "May", id: "56166598-89d7-4d58-9a7a-05c514966a8a" },
  { month: 6, label: "Haziran", short: "Haz", id: "db155db2-d0f1-4723-840d-96ab76fe8996" },
  { month: 7, label: "Temmuz", short: "Tem", id: "2e141a81-0457-4b2f-a359-134810f5e401" },
  { month: 8, label: "Ağustos", short: "Ağu", id: "2091de48-6a30-4e30-acdd-ba48a9a47514" },
  { month: 9, label: "Eylül", short: "Eyl", id: "1bc90034-2c9e-42e4-b0a6-372b561ebbe3" },
  { month: 10, label: "Ekim", short: "Eki", id: "9d85c4e1-d469-4f35-8eb4-4f1cd6dabe2a" },
  { month: 11, label: "Kasım", short: "Kas", id: "2dffd054-b0f8-4bb6-8526-176c6ba6364b" },
  { month: 12, label: "Aralık", short: "Ara", id: "f89f4f17-90d1-4cad-8f67-703fa13c06be" },
];

const PAY = {
  salary: ["Temel Maaş"],
  meal: ["Yemek Yardımı"],
  transport: ["Yol Yardımı"],
  overtime: ["Fazla Mesai"],
  overtimeNet: ["Net Fazla Mesai"],
  prim: ["Prim"],
  ikramiye: ["İkramiye"],
  masraf: ["Masraf"],
  kesinti: ["Genel Kesinti", "Sendika Aidatı", "İşveren Alacağı", "Ücret Kesme Cezası"],
  health: ["Özel Sağlık Sigortası (İşveren)", "Özel Sağlık Sigortası (İşveren Üstlenir)"],
  besEmployer: ["BES İşveren Katkısı"],
  childAid: ["Çocuk Yardımı"],
  spouseAid: ["Eş Yardımı"],
  leaveAllowance: ["İzin Harçlığı"],
  nafaka: ["Nafaka"],
  icra: ["İcra"],
  kidem: ["Kıdem Tazminatı (Muaf)", "Kıdem Tazminatı (Vergiye Tabi)"],
  ihbar: ["İhbar Tazminatı"],
  rounding: ["Yuvarlama Farkı"],
};

const ITEM = {
  gross: "Toplam Kazanç",
  net: "Net Maaş",
  gvMatrah: "Gelir Vergisine Tabi Kazanç",
  sgkBase: "Prime Esas Kazanç",
  employerCost: "İşveren Maliyeti",
  deductionTotal: "Kesintiler Toplamı",
};

const DED = {
  sgk: "SGK Primi İşçi Payı",
  unemployment: "İşsizlik Sigortası Primi İşçi Payı",
  gv: "Gelir Vergisi",
  damga: "Damga Vergisi",
  bes: "Bireysel Emeklilik (BES) Kesintisi",
  employerSgk: "SGK Primi İşveren Payı",
  employerUnemp: "İşsizlik Sigortası Primi İşveren Hissesi",
  disability: "Engellilik İndirimi",
};

const SUM_KEYS = [
  "salary",
  "meal",
  "transport",
  "overtime",
  "overtimeNet",
  "prim",
  "ikramiye",
  "masraf",
  "kesinti",
  "health",
  "besEmployer",
  "childAid",
  "spouseAid",
  "leaveAllowance",
  "nafaka",
  "icra",
  "kidem",
  "ihbar",
  "rounding",
  "gross",
  "net",
  "gv",
  "damga",
  "bes",
  "sgk",
  "unemployment",
  "advance",
  "sgkDays",
  "missingDays",
  "sgkBase",
  "gvMatrah",
  "gvExempt",
  "damgaExempt",
  "employerCost",
  "employerSgk",
  "employerUnemp",
  "disability",
  "deductionTotal",
];

const r2 = (n) =>
  n == null || !Number.isFinite(Number(n)) ? 0 : Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const fold = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");

function unwrap(raw) {
  let v = raw;
  for (let i = 0; i < 8; i++) {
    if (v && typeof v === "object" && !Array.isArray(v) && "data" in v) v = v.data;
    else break;
  }
  return v;
}

function emptyPay() {
  const row = {};
  for (const k of SUM_KEYS) row[k] = 0;
  row.gvCum = 0;
  return row;
}

function addPay(a, b) {
  const out = emptyPay();
  for (const k of SUM_KEYS) out[k] = r2((a[k] || 0) + (b[k] || 0));
  out.gvCum = r2(b.gvCum || a.gvCum || 0);
  return out;
}

function extractPe(pe) {
  const payments = new Map();
  for (const pv of pe.paymentPeriodValues || []) {
    const name = pv.payment?.name || pv.paymentValue?.payment?.name;
    if (name) payments.set(name, (payments.get(name) || 0) + (pv.value || 0));
  }
  const items = new Map();
  for (const iv of pe.payrollItemValues || []) {
    if (iv.payrollItem?.name) items.set(iv.payrollItem.name, iv.value || 0);
  }
  const deds = new Map();
  for (const dv of pe.deductionStructureValues || []) {
    if (dv.deductionStructure?.name) deds.set(dv.deductionStructure.name, dv);
  }
  const row = emptyPay();
  for (const [k, names] of Object.entries(PAY)) {
    row[k] = r2(names.reduce((a, n) => a + (payments.get(n) || 0), 0));
  }
  for (const [k, name] of Object.entries(ITEM)) {
    row[k] = items.has(name) ? r2(items.get(name)) : 0;
  }
  for (const [k, name] of Object.entries(DED)) {
    row[k] = deds.has(name) ? r2(deds.get(name).value || 0) : 0;
  }
  const gvDed = deds.get(DED.gv);
  const damgaDed = deds.get(DED.damga);
  row.gvExempt = r2(gvDed?.exemptionAmount || 0);
  row.gvCum = r2(gvDed?.cumulativeBase || 0);
  row.damgaExempt = r2(damgaDed?.exemptionAmount || 0);
  row.advance = r2(
    (pe.advancePeriodDeductions || []).reduce((a, d) => a + (d.deductionAmount ?? d.amount ?? d.value ?? 0), 0),
  );
  row.sgkDays = r2(pe.workedDays ?? 0);
  row.missingDays = r2(pe.totalMissingDays ?? pe.missingDays ?? 0);
  return row;
}

function loadDump(id) {
  const p = path.join(TEMP, `_ik_year_${id}.json`);
  if (!fs.existsSync(p)) throw new Error(`Dump yok: ${p}`);
  const v = unwrap(JSON.parse(fs.readFileSync(p, "utf8")));
  if (!Array.isArray(v.periodEmployees)) throw new Error(`periodEmployees yok: ${id}`);
  return v;
}

const ekim = JSON.parse(fs.readFileSync(path.join(DATA, "ekim_comparison.json"), "utf8"));
const roster = (ekim.rows || []).map((r) => ({
  n: r.n,
  name: r.name,
  tc: r.tc || "",
  note: r.note || "",
  profile: r.profile || "",
}));
const rosterByFold = new Map(roster.map((r) => [fold(r.name), r]));

const monthMeta = [];
const byFold = new Map();

for (const m of MONTHS) {
  const dump = loadDump(m.id);
  const pes = dump.periodEmployees;
  let lastCalc = null;
  for (const pe of pes) {
    if (pe.lastCalculatedAt && (!lastCalc || pe.lastCalculatedAt > lastCalc)) lastCalc = pe.lastCalculatedAt;
  }
  monthMeta.push({
    month: m.month,
    label: m.label,
    short: m.short,
    periodId: m.id,
    lastCalculatedAt: lastCalc,
    people: pes.length,
    status: dump.payrollStatus ?? dump.status ?? null,
    stale: dump.staleEmployeeCount ?? null,
  });
  for (const pe of pes) {
    const emp = pe.employee || {};
    const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
    const key = fold(name);
    const rec = rosterByFold.get(key);
    if (!rec) {
      console.warn(`Roster’da yok: ${name} (${emp.employeeNumber})`);
    }
    if (!byFold.has(key)) {
      byFold.set(key, {
        n: rec?.n ?? 99,
        sicil: String(emp.employeeNumber || ""),
        name: rec?.name || name,
        tc: rec?.tc || "",
        note: rec?.note || "",
        profile: rec?.profile || "",
        months: Array.from({ length: 12 }, () => emptyPay()),
      });
    }
    const person = byFold.get(key);
    if (!person.sicil && emp.employeeNumber) person.sicil = String(emp.employeeNumber);
    person.months[m.month - 1] = extractPe(pe);
  }
  console.log(`${m.label}: ${pes.length} kişi`);
}

const people = [...byFold.values()].sort((a, b) => (a.n || 0) - (b.n || 0));
for (const p of people) {
  p.year = p.months.reduce((acc, m) => addPay(acc, m), emptyPay());
  p.year.gvCum = r2(p.months[11]?.gvCum || 0);
}

const totalsMonths = MONTHS.map((_, i) => people.reduce((acc, p) => addPay(acc, p.months[i]), emptyPay()));
const totalsYear = totalsMonths.reduce((acc, m) => addPay(acc, m), emptyPay());
totalsYear.gvCum = r2(totalsMonths[11]?.gvCum || 0);

fs.mkdirSync(MONTH_DIR, { recursive: true });
for (const m of MONTHS) {
  const file = {
    month: m.month,
    label: m.label,
    short: m.short,
    periodId: m.id,
    people: people.map((p) => ({ sicil: p.sicil, pay: p.months[m.month - 1] })),
  };
  const dest = path.join(MONTH_DIR, `m${String(m.month).padStart(2, "0")}.json`);
  fs.writeFileSync(dest, JSON.stringify(file) + "\n");
  console.log(`yazıldı ${path.relative(ROOT, dest)} ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
}

const index = {
  generatedAt: new Date().toISOString(),
  environment: "https://dhrtest2.d1-tech.com.tr",
  unit: "İnsan Kaynakları",
  year: 2026,
  source: "DHR /api/PayrollPeriod/{id} blob dump · 12 ay · Luca/YZ yok",
  months: monthMeta,
  people: people.map(({ months: _months, ...rest }) => rest),
  totals: { months: totalsMonths, year: totalsYear },
};

fs.writeFileSync(OUT, JSON.stringify(index) + "\n");
console.log(`yazıldı ${path.relative(ROOT, OUT)} ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · ${people.length} kişi`);

const dashPath = path.join(DATA, "dashboard.json");
if (fs.existsSync(dashPath)) {
  const dash = JSON.parse(fs.readFileSync(dashPath, "utf8"));
  const state = `DHR 12/12 ay · Luca Ocak/Ekim · YZ 12 ay · yıl net ${totalsYear.net.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
  const entry = {
    id: "yillik",
    label: "2026 Yıllık Bordro",
    unit: "İnsan Kaynakları",
    people: people.length,
    state,
    compare: "DHR × Luca × YZ (Luca Ocak/Ekim, diğer aylar bekliyor)",
  };
  const idx = (dash.periods || []).findIndex((p) => p.id === "yillik");
  if (idx >= 0) dash.periods[idx] = entry;
  else {
    const ocak = (dash.periods || []).findIndex((p) => p.id === "ocak");
    if (ocak >= 0) dash.periods.splice(ocak + 1, 0, entry);
    else dash.periods.unshift(entry);
  }
  fs.writeFileSync(dashPath, JSON.stringify(dash, null, 2) + "\n");
  console.log("dashboard.json yillik dönemi güncellendi");
}
