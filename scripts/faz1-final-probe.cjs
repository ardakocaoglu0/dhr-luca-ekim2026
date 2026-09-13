const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");
const state = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "faz1_seed_state.json"), "utf8"));
const ADMIN_PASS = process.env.DHR_PASSWORD;
const BASE = "https://dhrtest.d1-tech.com.tr";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", "arda.kocaoglu@d1-tech.com");
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);

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
        return { status: res.status, data, text: String(text).slice(0, 1500) };
      },
      { method, urlPath, body }
    );
  }

  const ana = await api("GET", "/api/PayrollPeriod/fe993870-b937-4756-8097-58b358f16a8e");
  const emps = ((((ana.data || {}).data || ana.data) || {}).employees) || [];
  const nums = emps.map((e) => e.employee?.employeeNumber || e.employeeNumber).sort();
  console.log("ANA_NUMS", nums.length, nums.join(","));
  console.log("ANA_HAS_PASIF", nums.includes("8018") || nums.includes("8019"));

  for (const sicil of ["8004", "8005"]) {
    const r = await api("GET", `/api/OrganizationalUnitPosition/${state.people[sicil].positionId}`);
    const d = r.data?.data || r.data;
    console.log("POSKEYS", sicil, r.status, d && typeof d === "object" ? Object.keys(d).join(",") : r.text.slice(0, 200));
    console.log("POSDATES", sicil, d?.startDate, d?.endDate, d?.hireDate, d?.employmentStartDate, d?.terminationDate, d?.isTerminated);
  }

  const ozanId = state.people["8061"].employeeId;
  const get1 = await api("GET", `/api/Employee/${ozanId}`);
  const e = get1.data?.data || get1.data;
  const put = await api("PUT", `/api/Employee/${ozanId}`, {
    firstName: e.firstName,
    lastName: e.lastName,
    employeeNumber: e.employeeNumber,
    email: e.email,
    gender: e.gender,
    phoneNumber: e.phoneNumber,
    birthDate: e.birthDate,
    initialCumulativeTaxBase: 1000,
    initialCumulativeTaxBaseYear: 2026,
  });
  console.log("TAXPUT", put.status, String(put.text).slice(0, 250));
  const get2 = await api("GET", `/api/Employee/${ozanId}`);
  const e2 = get2.data?.data || get2.data;
  console.log("TAXGET", e2?.initialCumulativeTaxBase, e2?.initialCumulativeTaxBaseYear);

  // SPA routes for period remove
  for (const url of [
    "/payroll-periods/" + "12f9269c-a37b-4cb8-a18a-5f65c9cd1ada",
    "/payroll/period/" + "12f9269c-a37b-4cb8-a18a-5f65c9cd1ada",
    "/period-detail/" + "12f9269c-a37b-4cb8-a18a-5f65c9cd1ada",
  ]) {
    const resp = await page.goto(BASE + url, { waitUntil: "commit", timeout: 20000 }).catch(() => null);
    console.log("NAV", url, page.url(), resp?.status?.());
  }

  const hits = await page.evaluate(async () => {
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src).filter((s) => s.includes("/assets/"));
    const found = [];
    for (const src of scripts.slice(0, 20)) {
      const t = await (await fetch(src, { credentials: "include" })).text();
      if (/PayrollPeriodEmployee|removeEmployee|excludeEmployee/i.test(t)) {
        const apis = [...new Set(t.match(/\/api\/PayrollPeriod[A-Za-z0-9_./{}-]*/g) || [])];
        found.push({ src: src.slice(-40), apis: apis.slice(0, 30) });
      }
    }
    return found;
  });
  console.log("JS_HITS", JSON.stringify(hits).slice(0, 1500));

  const otList = await api("GET", `/api/EmployeeOvertimeRequest/employee/${state.people["8008"].employeeId}`);
  console.log("OT8008", otList.status, String(otList.text).slice(0, 300));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
