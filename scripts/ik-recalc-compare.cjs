/**
 * Recalculate the İnsan Kaynakları Ekim 2026 and Ocak 2026 payroll periods in
 * DHR and report what moved: DHR before vs after, and after vs the numbers the
 * site currently shows.
 *
 * Run without flags to only read (no calculation), with --apply to recalculate.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const APPLY = process.argv.includes("--apply");
const OUT_DIR = path.join(process.env.TEMP, "ik_recalc");
if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const TARGETS = [
  { key: "ekim", year: 2026, month: 10, unit: "İnsan Kaynakları", site: "ekim_comparison.json" },
  { key: "ocak", year: 2026, month: 1, unit: "İnsan Kaynakları", site: "comparison.json" },
];

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
};
const DED = {
  sgk: "SGK Primi İşçi Payı",
  unemployment: "İşsizlik Sigortası Primi İşçi Payı",
  gv: "Gelir Vergisi",
  damga: "Damga Vergisi",
  bes: "Bireysel Emeklilik (BES) Kesintisi",
};
const ITEM = { gross: "Toplam Kazanç", net: "Net Maaş", gvMatrah: "Gelir Vergisine Tabi Kazanç", sgkBase: "Prime Esas Kazanç" };
const COMPARE_KEYS = ["gross", "net", "gv", "damga", "sgk", "unemployment", "bes", "salary", "meal", "transport", "overtime", "prim", "ikramiye", "masraf", "kesinti"];

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function unwrap(x) {
  let v = x?.data ?? x;
  for (let i = 0; i < 8; i++) {
    if (v && typeof v === "object" && !Array.isArray(v) && "data" in v) v = v.data;
    else break;
  }
  return v;
}

function extract(period) {
  const out = {};
  for (const pe of period?.periodEmployees || []) {
    const emp = pe.employee || {};
    const payments = new Map();
    for (const pv of pe.paymentPeriodValues || []) {
      const name = pv.payment?.name || pv.paymentValue?.payment?.name;
      if (name) payments.set(name, (payments.get(name) || 0) + (pv.value || 0));
    }
    const items = new Map();
    for (const iv of pe.payrollItemValues || []) if (iv.payrollItem?.name) items.set(iv.payrollItem.name, iv.value || 0);
    const deds = new Map();
    for (const dv of pe.deductionStructureValues || []) if (dv.deductionStructure?.name) deds.set(dv.deductionStructure.name, dv);

    const row = {
      sicil: emp.employeeNumber,
      name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
      tc: emp.identityNumber || emp.nationalIdentityNumber || emp.tckn || null,
      sgkDays: pe.workedDays,
      missingDays: pe.totalMissingDays,
      calculationStatus: pe.calculationStatus,
      lastCalculatedAt: pe.lastCalculatedAt,
      anomalyCount: pe.anomalyCount,
    };
    for (const [k, names] of Object.entries(PAY)) row[k] = r2(names.reduce((a, n) => a + (payments.get(n) || 0), 0));
    for (const [k, name] of Object.entries(ITEM)) row[k] = items.has(name) ? r2(items.get(name)) : null;
    for (const [k, name] of Object.entries(DED)) row[k] = deds.has(name) ? r2(deds.get(name).value || 0) : null;
    row.advance = r2((pe.advancePeriodDeductions || []).reduce((a, d) => a + (d.amount ?? d.value ?? 0), 0));
    row.gvExemptApplied = deds.get(DED.gv) ? r2(deds.get(DED.gv).exemptionAmount || 0) : null;
    row.gvCumulativeBase = deds.get(DED.gv) ? r2(deds.get(DED.gv).cumulativeBase || 0) : null;
    if (row.name) out[row.name] = row;
  }
  return out;
}

function diff(a, b, label) {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const changed = [];
  for (const n of names) {
    const x = a[n];
    const y = b[n];
    if (!x || !y) {
      changed.push({ name: n, missing: !x ? "before/site" : "after" });
      continue;
    }
    const fields = {};
    for (const k of COMPARE_KEYS) {
      const va = x[k];
      const vb = y[k];
      if (va == null && vb == null) continue;
      const d = r2((vb ?? 0) - (va ?? 0));
      if (Math.abs(d) > 0.01) fields[k] = { from: va ?? null, to: vb ?? null, delta: d };
    }
    if (Object.keys(fields).length) changed.push({ name: n, fields });
  }
  console.log(`\n### ${label}: ${changed.length} kişide fark`);
  for (const c of changed) {
    if (c.missing) {
      console.log(`  ${c.name}: yalnız ${c.missing} tarafında var`);
      continue;
    }
    const parts = Object.entries(c.fields).map(([k, v]) => `${k} ${v.from} → ${v.to} (${v.delta > 0 ? "+" : ""}${v.delta})`);
    console.log(`  ${c.name}: ${parts.join(" | ")}`);
  }
  return changed;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 120 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  console.log("LOGIN", page.url());

  async function api(method, urlPath, body) {
    return page.evaluate(
      async ({ method, urlPath, body }) => {
        await fetch("/api/antiforgery/token", { credentials: "include" }).catch(() => {});
        const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
        const token = m ? decodeURIComponent(m[1]) : "";
        const headers = { Accept: "application/json", "X-XSRF-TOKEN": token, "X-CSRF-TOKEN": token };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const res = await fetch(urlPath, { method, credentials: "include", headers, body: body !== undefined ? JSON.stringify(body) : undefined });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        return { status: res.status, data, text: String(text).slice(0, 900) };
      },
      { method, urlPath, body }
    );
  }

  const list = unwrap(await api("GET", "/api/PayrollPeriod/list?page=1&pageSize=300"));
  const periods = Array.isArray(list) ? list : list?.items || [];
  console.log("PERIODS", periods.length, "sampleKeys", periods[0] ? Object.keys(periods[0]).join(",") : "-");

  const report = { runAt: new Date().toISOString(), applied: APPLY, periods: {} };
  for (const t of TARGETS) {
    const hit = periods.find(
      (p) => p.year === t.year && p.month === t.month && (p.organizationalUnitName || p.organizationalUnit?.name || "").includes(t.unit)
    );
    if (!hit) {
      console.log(`\n=== ${t.key}: dönem bulunamadı`);
      continue;
    }
    console.log(
      `\n=== ${t.key} ${t.year}-${String(t.month).padStart(2, "0")} ${t.unit} id=${hit.id} status=${hit.payrollStatus} stale=${hit.staleEmployeeCount} anomaly=${hit.anomalyCount} needsRecalc=${hit.needsRecalculation}`
    );

    const before = extract(unwrap(await api("GET", `/api/PayrollPeriod/${hit.id}`)));
    fs.writeFileSync(path.join(OUT_DIR, `${t.key}_before.json`), JSON.stringify(before, null, 1));
    console.log("people:", Object.keys(before).length);

    const site = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", t.site), "utf8"));
    const siteByName = {};
    for (const r of site.rows) if (r.dhr) siteByName[r.name] = r.dhr;
    diff(siteByName, before, `${t.key}: sitedeki DHR → DHR şu anki hâli (hesaplamadan önce)`);

    let after = before;
    if (APPLY) {
      const calc = await api("POST", `/api/PayrollPeriod/${hit.id}/calculate`, { onlyStaleEmployees: false });
      const jobId = unwrap(calc.data)?.jobId;
      console.log("CALC", calc.status, jobId);
      for (let i = 0; i < 60; i++) {
        await sleep(5000);
        const job = jobId ? unwrap(await api("GET", `/api/background-jobs/${jobId}`)) : null;
        console.log(`  poll ${i} status=${job?.jobStatus} pct=${job?.progressPercent} ${String(job?.resultPayloadJson || "").slice(0, 100)}`);
        if (job && job.jobStatus > 1) break;
      }
      after = extract(unwrap(await api("GET", `/api/PayrollPeriod/${hit.id}`)));
      fs.writeFileSync(path.join(OUT_DIR, `${t.key}_after.json`), JSON.stringify(after, null, 1));
      diff(before, after, `${t.key}: hesaplama öncesi → sonrası`);
      diff(siteByName, after, `${t.key}: sitedeki DHR → yeni hesaplama`);
    }
    report.periods[t.key] = { id: hit.id, year: t.year, month: t.month, status: hit.payrollStatus, people: Object.keys(after).length };
  }

  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 1));
  console.log("\nDUMPS", OUT_DIR);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
