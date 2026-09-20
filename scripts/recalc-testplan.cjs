/**
 * Recalculate every payroll period on the comparison site (test plan) and
 * diff against the DHR numbers currently stored in src/data.
 *
 * Default env: https://dhrtest2.d1-tech.com.tr
 * Always recalculates (onlyStaleEmployees:false). Does not PUT employees,
 * İK cards, BT, or Sude.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest2.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const OUT_DIR = path.join(process.env.TEMP, "testplan_recalc");
const DATA = path.join(__dirname, "..", "src", "data");

const ONLY = (process.env.RECALC_ONLY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TARGETS = [
  { key: "ekim", year: 2026, month: 10, unitNeedles: ["insan kaynak", "ik"], expect: 32, site: "ekim_comparison.json", label: "İK Ekim 2026" },
  { key: "ocak", year: 2026, month: 1, unitNeedles: ["insan kaynak", "ik"], expect: 32, site: "comparison.json", label: "İK Ocak 2026" },
  { key: "izole", year: 2026, month: 1, unitNeedles: ["tek degisken", "tek değişken"], expect: 27, site: "izole_comparison.json", label: "Tek Değişken Ocak 2026" },
  { key: "paket", year: 2026, month: 1, unitNeedles: ["bordro paket"], expect: 30, site: "paket_comparison.json", label: "Bordro Paket Ocak 2026" },
  { key: "faz1", year: 2026, month: 9, unitNeedles: ["ana kadro"], expect: 15, site: "faz1_comparison.json", label: "Faz 1 Ana Eylül 2026" },
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
const COMPARE_KEYS = [
  "gross",
  "net",
  "gv",
  "damga",
  "sgk",
  "unemployment",
  "bes",
  "salary",
  "meal",
  "transport",
  "overtime",
  "prim",
  "ikramiye",
  "masraf",
  "kesinti",
  "advance",
];

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function unwrap(x) {
  let v = x?.data ?? x;
  for (let i = 0; i < 8; i++) {
    if (v && typeof v === "object" && !Array.isArray(v) && "data" in v) v = v.data;
    else break;
  }
  return v;
}
function arr(x) {
  const v = unwrap(x);
  if (Array.isArray(v)) return v;
  if (v?.items && Array.isArray(v.items)) return v.items;
  if (v?.results && Array.isArray(v.results)) return v.results;
  return [];
}
function fold(s) {
  return String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}
function unitBlob(p) {
  return fold(
    [
      p.organizationalUnitName,
      p.organizationalUnit?.name,
      p.unitName,
      p.name,
      p.periodName,
      p.description,
    ]
      .filter(Boolean)
      .join(" ")
  );
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
      sicil: String(emp.employeeNumber || ""),
      name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
      sgkDays: pe.workedDays,
      calculationStatus: pe.calculationStatus,
      lastCalculatedAt: pe.lastCalculatedAt,
      anomalyCount: pe.anomalyCount,
    };
    for (const [k, names] of Object.entries(PAY)) row[k] = r2(names.reduce((a, n) => a + (payments.get(n) || 0), 0));
    for (const [k, name] of Object.entries(ITEM)) row[k] = items.has(name) ? r2(items.get(name)) : null;
    for (const [k, name] of Object.entries(DED)) row[k] = deds.has(name) ? r2(deds.get(name).value || 0) : null;
    row.advance = r2((pe.advancePeriodDeductions || []).reduce((a, d) => a + (d.amount ?? d.value ?? 0), 0));
    const key = row.sicil || row.name;
    if (key) out[key] = row;
  }
  return out;
}

function siteMap(file) {
  const site = JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  const bySicil = {};
  const byName = {};
  for (const r of site.rows || []) {
    if (!r.dhr) continue;
    if (r.tc) bySicil[String(r.tc)] = { ...r.dhr, name: r.name, sicil: String(r.tc) };
    if (r.name) byName[fold(r.name)] = { ...r.dhr, name: r.name, sicil: String(r.tc || "") };
  }
  return { bySicil, byName };
}

function pickSite(site, row) {
  return (row.sicil && site.bySicil[row.sicil]) || site.byName[fold(row.name)] || null;
}

function diffMaps(before, after, site, label) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const vsBefore = [];
  const vsSite = [];
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (!a || !b) {
      vsBefore.push({ key: k, missing: !a ? "before" : "after" });
      continue;
    }
    const fields = {};
    for (const ck of COMPARE_KEYS) {
      const d = r2((b[ck] ?? 0) - (a[ck] ?? 0));
      if (Math.abs(d) > 0.01) fields[ck] = { from: a[ck] ?? null, to: b[ck] ?? null, delta: d };
    }
    if (Object.keys(fields).length) vsBefore.push({ key: k, name: b.name, sicil: b.sicil, fields });
    const s = pickSite(site, b);
    if (!s) {
      vsSite.push({ key: k, name: b.name, missing: "site" });
      continue;
    }
    const sf = {};
    for (const ck of COMPARE_KEYS) {
      const d = r2((b[ck] ?? 0) - (s[ck] ?? 0));
      if (Math.abs(d) > 0.01) sf[ck] = { from: s[ck] ?? null, to: b[ck] ?? null, delta: d };
    }
    if (Object.keys(sf).length) vsSite.push({ key: k, name: b.name, sicil: b.sicil, fields: sf });
  }
  console.log(`\n### ${label}: hesap öncesi→sonrası ${vsBefore.filter((x) => x.fields).length} kişi`);
  for (const c of vsBefore.slice(0, 40)) {
    if (c.missing) console.log(`  ${c.key}: yalnız ${c.missing}`);
    else {
      const parts = Object.entries(c.fields).map(([fk, v]) => `${fk} ${v.from} → ${v.to} (${v.delta > 0 ? "+" : ""}${v.delta})`);
      console.log(`  ${c.sicil || ""} ${c.name}: ${parts.join(" | ")}`);
    }
  }
  console.log(`### ${label}: site DHR → yeni hesap ${vsSite.filter((x) => x.fields).length} kişi`);
  for (const c of vsSite.slice(0, 40)) {
    if (c.missing) console.log(`  ${c.name || c.key}: sitede yok`);
    else {
      const parts = Object.entries(c.fields).map(([fk, v]) => `${fk} ${v.from} → ${v.to} (${v.delta > 0 ? "+" : ""}${v.delta})`);
      console.log(`  ${c.sicil || ""} ${c.name}: ${parts.join(" | ")}`);
    }
  }
  return { vsBefore, vsSite };
}

(async () => {
  if (!ADMIN_PASS) throw new Error("DHR_PASSWORD required");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email", { timeout: 30000 });
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 120 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  console.log("LOGIN", page.url(), "BASE", BASE);
  if (page.url().includes("/login")) throw new Error("login failed");

  async function api(method, urlPath, body) {
    return page.evaluate(
      async ({ method, urlPath, body }) => {
        await fetch("/api/antiforgery/token", { credentials: "include" }).catch(() => {});
        const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
        const token = m ? decodeURIComponent(m[1]) : "";
        const headers = { Accept: "application/json", "X-XSRF-TOKEN": token, "X-CSRF-TOKEN": token };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const res = await fetch(urlPath, {
          method,
          credentials: "include",
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        return { status: res.status, data, text: String(text).slice(0, 700) };
      },
      { method, urlPath, body }
    );
  }

  async function getPeriod(id) {
    const tmp = path.join(OUT_DIR, `_period_${id}.json`);
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 180000 }),
          page.evaluate(async (periodId) => {
            await fetch("/api/antiforgery/token", { credentials: "include" }).catch(() => {});
            const res = await fetch(`/api/PayrollPeriod/${periodId}`, { credentials: "include" });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "period.json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }, id),
        ]);
        await download.saveAs(tmp);
        const parsed = JSON.parse(fs.readFileSync(tmp, "utf8"));
        const full = unwrap(parsed);
        const n = (full?.periodEmployees || []).length;
        console.log(" GET period", id, "people", n, "bytes", fs.statSync(tmp).size, "try", attempt);
        if (n > 0) return full;
        lastErr = new Error("empty periodEmployees");
      } catch (e) {
        lastErr = e;
        console.log(" GET period fail", id, "try", attempt, e.message);
      }
      await sleep(8000);
    }
    throw lastErr || new Error("getPeriod failed " + id);
  }

  const list1 = await api("GET", "/api/PayrollPeriod/list?page=1&pageSize=400");
  let periods = arr(list1.data);
  console.log("LIST", list1.status, periods.length, String(list1.text).slice(0, 180));
  if (!periods.length) periods = arr((await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")).data);
  if (!periods.length) periods = arr((await api("GET", "/api/PayrollPeriod/all")).data);
  const slim = periods.map((p) => ({
    id: p.id,
    year: p.year,
    month: p.month,
    status: p.payrollStatus,
    name: p.name,
    unit: p.organizationalUnitName || p.organizationalUnit?.name,
    people: (p.periodEmployees || []).length || p.employeeCount,
    stale: p.staleEmployeeCount,
  }));
  fs.writeFileSync(path.join(OUT_DIR, "period_list.json"), JSON.stringify(slim, null, 1));
  console.log("PERIODS", slim.length);
  for (const p of slim) console.log(" ", p.year, p.month, p.status, p.unit || "-", p.name || "", p.id, "n", p.people);

  const report = { runAt: new Date().toISOString(), base: BASE, periods: {} };
  const runTargets = ONLY.length ? TARGETS.filter((t) => ONLY.includes(t.key)) : TARGETS;
  console.log("TARGETS", runTargets.map((t) => t.key).join(","));

  for (const t of runTargets) {
    const hits = periods.filter((p) => p.year === t.year && p.month === t.month && t.unitNeedles.some((n) => unitBlob(p).includes(fold(n))));
    const hit = hits.sort((a, b) => (b.periodEmployees?.length || b.employeeCount || 0) - (a.periodEmployees?.length || a.employeeCount || 0))[0];
    if (!hit) {
      console.log(`\n=== ${t.label}: DÖNEM YOK`);
      report.periods[t.key] = { found: false };
      continue;
    }
    console.log(`\n=== ${t.label} id=${hit.id} status=${hit.payrollStatus} unit=${hit.organizationalUnitName || hit.organizationalUnit?.name || hit.name}`);
    const beforeFull = await getPeriod(hit.id);
    const before = extract(beforeFull);
    fs.writeFileSync(path.join(OUT_DIR, `${t.key}_before.json`), JSON.stringify(before, null, 1));
    console.log("people before", Object.keys(before).length, "expect", t.expect);

    let calc = { status: 0, data: null, text: "" };
    let jobId = null;
    for (let attempt = 0; attempt < 4 && !jobId; attempt++) {
      calc = await api("POST", `/api/PayrollPeriod/${hit.id}/calculate`, { onlyStaleEmployees: false });
      jobId = unwrap(calc.data)?.jobId || null;
      console.log("CALC", t.key, "try", attempt, calc.status, jobId, String(calc.text).slice(0, 180));
      if (!jobId) await sleep(15000);
    }
    let job = null;
    if (jobId) {
      for (let i = 0; i < 72; i++) {
        await sleep(5000);
        try {
          job = unwrap((await api("GET", `/api/background-jobs/${jobId}`)).data);
        } catch (e) {
          console.log(" POLL err", t.key, i, e.message);
          continue;
        }
        console.log(" POLL", t.key, i, job?.jobStatus, job?.progressPercent, job?.failedCount);
        if (job && job.jobStatus > 1) break;
      }
    } else {
      console.log(" CALC no jobId, skip poll");
    }
    const afterFull = await getPeriod(hit.id);
    const after = extract(afterFull);
    fs.writeFileSync(path.join(OUT_DIR, `${t.key}_after.json`), JSON.stringify(after, null, 1));
    fs.writeFileSync(path.join(OUT_DIR, `${t.key}_full.json`), JSON.stringify(afterFull));
    const site = siteMap(t.site);
    const diffs = diffMaps(before, after, site, t.label);
    report.periods[t.key] = {
      found: true,
      id: hit.id,
      status: afterFull?.payrollStatus,
      people: Object.keys(after).length,
      jobStatus: job?.jobStatus,
      failedCount: job?.failedCount,
      calcStatus: calc.status,
      changedVsBefore: diffs.vsBefore.filter((x) => x.fields).length,
      changedVsSite: diffs.vsSite.filter((x) => x.fields).length,
      vsBefore: diffs.vsBefore,
      vsSite: diffs.vsSite,
    };
  }

  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 1));
  console.log("\nDONE", OUT_DIR);
  console.log(JSON.stringify(
    Object.fromEntries(Object.entries(report.periods).map(([k, v]) => [k, { found: v.found, people: v.people, vsBefore: v.changedVsBefore, vsSite: v.changedVsSite, status: v.status }])),
    null,
    2
  ));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
