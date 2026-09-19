const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");
const BASE = process.env.DHR_URL || "https://dhrtest2.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const PERIOD = "b38418d0-5b60-442a-8b3a-13868ca81789";
const OUT = path.join(process.env.TEMP, "paket_ocak_period.json");

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
  if (v?.items) return v.items;
  if (v?.results) return v.results;
  return [];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  if (page.url().includes("/login")) throw new Error("login fail");
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
        return { status: res.status, data, text: String(text).slice(0, 900) };
      },
      { method, urlPath, body }
    );
  }

  const probes = [
    `/api/PayrollPeriod/${PERIOD}`,
    `/api/PayrollPeriod/${PERIOD}/details`,
    `/api/PayrollItemValue/by-period/${PERIOD}`,
    `/api/PayrollItemValue/period/${PERIOD}`,
    `/api/PeriodEmployee/by-period/${PERIOD}`,
    `/api/PayrollPeriodEmployeeAnomaly/by-period/${PERIOD}`,
    `/api/PayrollItem/filteredByUnitAbilities`,
  ];
  for (const u of probes) {
    const r = await api("GET", u);
    const d = unwrap(r.data);
    const n = Array.isArray(d) ? d.length : Array.isArray(d?.periodEmployees) ? d.periodEmployees.length : d ? Object.keys(d).length : 0;
    console.log("GET", r.status, u, "n", n, String(r.text).slice(0, 160).replace(/\s+/g, " "));
  }

  const full0 = unwrap((await api("GET", `/api/PayrollPeriod/${PERIOD}`)).data);
  const pe0 = (full0?.periodEmployees || [])[0];
  if (pe0?.id) {
    for (const u of [
      `/api/PeriodEmployee/${pe0.id}`,
      `/api/PayrollPeriod/${PERIOD}/employees/${pe0.employeeId}`,
      `/api/PayrollItemValue/by-period-employee/${pe0.id}`,
    ]) {
      const r = await api("GET", u);
      console.log("PE", r.status, u, String(r.text).slice(0, 220).replace(/\s+/g, " "));
    }
  }

  const setting = unwrap((await api("GET", `/api/PayrollSetting/${full0.organizationalUnitId}`)).data);
  console.log("PS requirePrev", setting?.requirePeriodCompletionBeforeNew, "netItem", setting?.netSummaryPayrollItemId);

  const items = arr(unwrap((await api("GET", "/api/PayrollItem/filteredByUnitAbilities")).data));
  const ouItems = items.filter((x) => x.organizationalUnitId === full0.organizationalUnitId);
  const rootItems = items.filter((x) => x.organizationalUnitId === "d93d6660-892d-4dcf-8fc2-36bed171017a");
  console.log("items total", items.length, "unit", ouItems.length, "root", rootItems.length, rootItems.slice(0, 8).map((x) => x.name).join("|"));

  const calc = await api("POST", `/api/PayrollPeriod/${PERIOD}/calculate`, { onlyStaleEmployees: false });
  const jobId = unwrap(calc.data)?.jobId;
  console.log("CALC", calc.status, jobId);
  for (let i = 0; i < 40; i++) {
    await sleep(4000);
    const job = jobId ? unwrap((await api("GET", `/api/background-jobs/${jobId}`)).data) : null;
    const full = unwrap((await api("GET", `/api/PayrollPeriod/${PERIOD}`)).data);
    const pes = full?.periodEmployees || [];
    const withItems = pes.filter((e) => (e.payrollItemValues || []).length).length;
    console.log("POLL", i, job?.jobStatus, job?.progressPercent, job?.failedCount, "items", withItems);
    if (job && job.jobStatus > 1 && i >= 2) {
      fs.writeFileSync(OUT, JSON.stringify(full));
      const sample = pes.find((e) => String(e.employee?.employeeNumber) === "6301") || pes[0];
      console.log("SAMPLE", sample.employee?.firstName, "items", (sample.payrollItemValues || []).length, (sample.payrollItemValues || []).map((x) => x.payrollItem?.name + "=" + x.value).join(","));
      break;
    }
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
