/**
 * Turn the raw Eylül 2026 Ana Kadro period dump into the flat per-person
 * numbers the site uses. Prints a DHR vs YZ comparison; writes the extract to
 * scripts/faz1_dhr_eylul.json.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(process.env.TEMP, "faz1_ana_sep_period.json");
const OUT = path.join(__dirname, "faz1_dhr_eylul.json");
const period = JSON.parse(fs.readFileSync(SRC, "utf8"));
const comparison = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "faz1_comparison.json"), "utf8"));

const PAY = {
  salary: ["Temel Maaş"],
  meal: ["Yemek Yardımı"],
  transport: ["Yol Yardımı"],
  overtime: ["Fazla Mesai", "Net Fazla Mesai"],
  prim: ["Prim"],
  ikramiye: ["İkramiye"],
  masraf: ["Masraf"],
  kesinti: ["Genel Kesinti", "İcra"],
  saglik: ["Özel Sağlık Sigortası (İşveren)"],
  besEmployer: ["BES İşveren Katkısı"],
  rounding: ["Yuvarlama Farkı"],
};
const DED = {
  sgk: "SGK Primi İşçi Payı",
  unemployment: "İşsizlik Sigortası Primi İşçi Payı",
  gv: "Gelir Vergisi",
  damga: "Damga Vergisi",
  bes: "Bireysel Emeklilik (BES) Kesintisi",
};
const ITEM = {
  gross: "Toplam Kazanç",
  net: "Net Maaş",
  gvMatrah: "Gelir Vergisine Tabi Kazanç",
  sgkBase: "Prime Esas Kazanç",
  damgaBase: "Damga Vergisi Hesaplama Bazı",
  deductionTotal: "Kesintiler Toplamı",
  employerCost: "İşveren Maliyeti",
};
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const out = {};
for (const pe of period.periodEmployees || []) {
  const sicil = pe.employee?.employeeNumber;
  if (!sicil) continue;
  // One-off entries (prim, masraf, kesinti) carry the payment definition one
  // level deeper, under paymentValue.
  const payments = new Map();
  const unresolved = [];
  for (const pv of pe.paymentPeriodValues || []) {
    const name = pv.payment?.name || pv.paymentValue?.payment?.name;
    if (name) payments.set(name, (payments.get(name) || 0) + (pv.value || 0));
    else if (pv.value) unresolved.push({ id: pv.paymentId || pv.paymentValue?.paymentId, value: pv.value });
  }
  const items = new Map();
  for (const iv of pe.payrollItemValues || []) {
    const name = iv.payrollItem?.name;
    if (name) items.set(name, iv.value || 0);
  }
  const deds = new Map();
  for (const dv of pe.deductionStructureValues || []) {
    const name = dv.deductionStructure?.name;
    if (name) deds.set(name, dv);
  }

  const row = {
    sicil,
    name: `${pe.employee?.firstName || ""} ${pe.employee?.lastName || ""}`.trim(),
    sgkDays: pe.workedDays,
    missingDays: pe.totalMissingDays,
    calculationStatus: pe.calculationStatus,
  };
  for (const [key, names] of Object.entries(PAY)) row[key] = r2(names.reduce((a, n) => a + (payments.get(n) || 0), 0));
  for (const [key, name] of Object.entries(ITEM)) row[key] = items.has(name) ? r2(items.get(name)) : null;
  for (const [key, name] of Object.entries(DED)) row[key] = deds.has(name) ? r2(deds.get(name).value || 0) : null;
  row.advance = r2((pe.advancePeriodDeductions || []).reduce((a, d) => a + (d.amount ?? d.value ?? 0), 0));
  const gvDed = deds.get(DED.gv);
  row.gvExemptApplied = gvDed ? r2(gvDed.exemptionAmount || 0) : null;
  row.gvCumulativeBase = gvDed ? r2(gvDed.cumulativeBase || 0) : null;
  const damgaDed = deds.get(DED.damga);
  row.damgaExemptApplied = damgaDed ? r2(damgaDed.exemptionAmount || 0) : null;
  row.sgkEmployer = deds.has("SGK Primi İşveren Payı") ? r2(deds.get("SGK Primi İşveren Payı").value || 0) : null;
  row.lawVariant = gvDed?.payrollLawCode || gvDed?.payrollLawVariantName || null;
  row.payments = Object.fromEntries([...payments].filter(([, v]) => v));
  if (unresolved.length) row.unresolvedPayments = unresolved;
  out[sicil] = row;
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log("WROTE", OUT, Object.keys(out).length, "people\n");

const pad = (s, n) => String(s).padEnd(n);
const num = (v) => (v == null ? "—".padStart(11) : Number(v).toFixed(2).padStart(11));
const head = (s) => String(s).padStart(11);
console.log(
  pad("sicil", 6) + pad("isim", 15) + "gün  " + head("gross") + head("sgkBase") + head("sgk") + head("issiz") + head("gv") + head("damga") + head("net") + "   " + head("YZ net") + head("Δnet")
);
for (const r of comparison.rows) {
  const d = out[r.tc];
  if (!d) {
    console.log(pad(r.tc, 6) + pad(r.name, 15) + "YOK");
    continue;
  }
  const dNet = d.net != null && r.ai?.net != null ? r2(d.net - r.ai.net) : null;
  console.log(
    pad(d.sicil, 6) +
      pad(d.name, 15) +
      String(d.sgkDays).padEnd(5) +
      num(d.gross) +
      num(d.sgkBase) +
      num(d.sgk) +
      num(d.unemployment) +
      num(d.gv) +
      num(d.damga) +
      num(d.net) +
      "   " +
      num(r.ai?.net ?? null) +
      num(dNet)
  );
}
