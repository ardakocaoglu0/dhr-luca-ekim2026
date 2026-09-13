/**
 * 8010 Hakan Işık: BES employee contribution was seeded as 3 and DHR applied
 * it as 300% (63.200 x 3 = 189.600 -> negative net). Read the enrollment,
 * re-set the rate as a fraction, recalculate and report both results.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const ANA_SEP = "fe993870-b937-4756-8097-58b358f16a8e";
const EMP_8010 = "692021c0-4375-4ff2-8322-d9589064f08b";
const APPLY = process.argv.includes("--apply");
const RATE = Number(process.env.BES_RATE || "0.03");

function unwrap(x) {
  let v = x?.data ?? x;
  for (let i = 0; i < 8; i++) {
    if (v && typeof v === "object" && !Array.isArray(v) && "data" in v) v = v.data;
    else break;
  }
  return v;
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
  for (let i = 0; i < 120 && page.url().includes("/login"); i++) await page.waitForTimeout(400);

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

  for (const ep of [
    `/api/EmployeeOksEnrollment/by-employee/${EMP_8010}`,
    `/api/EmployeeOksEnrollment/employee/${EMP_8010}`,
    `/api/EmployeeOksEnrollment/${EMP_8010}`,
  ]) {
    const r = await api("GET", ep);
    console.log("READ", ep, r.status, r.text.replace(/\s+/g, " ").slice(0, 400));
  }

  if (!APPLY) {
    console.log("dry run — pass --apply to change the rate to", RATE);
    await browser.close();
    return;
  }

  const up = await api("POST", "/api/EmployeeOksEnrollment/upsert", {
    employeeId: EMP_8010,
    oksStatus: 1,
    contributionRateOverride: RATE,
    enrollmentDate: "2026-01-06",
    withdrawalDate: null,
    pauseStartDate: null,
    pauseEndDate: null,
    pensionCompany: "Anadolu Hayat Emeklilik",
    certificateNumber: "AH-F1-8010",
  });
  console.log("UPSERT", up.status, up.text.replace(/\s+/g, " ").slice(0, 300));

  const calc = await api("POST", `/api/PayrollPeriod/${ANA_SEP}/calculate`, { onlyStaleEmployees: false });
  const jobId = unwrap(calc.data)?.jobId;
  console.log("CALC", calc.status, jobId);
  for (let i = 0; i < 40; i++) {
    await sleep(5000);
    const job = jobId ? unwrap(await api("GET", `/api/background-jobs/${jobId}`)) : null;
    console.log("POLL", i, job?.jobStatus, job?.progressPercent, String(job?.resultPayloadJson || "").slice(0, 120));
    if (job && job.jobStatus > 1) break;
  }

  const p = unwrap(await api("GET", `/api/PayrollPeriod/${ANA_SEP}`));
  fs.writeFileSync(path.join(process.env.TEMP, "faz1_ana_sep_period.json"), JSON.stringify(p, null, 1));
  const pe = (p.periodEmployees || []).find((e) => e.employee?.employeeNumber === "8010");
  const bes = (pe?.deductionStructureValues || []).find((d) => d.deductionStructure?.name?.includes("BES"));
  const net = (pe?.payrollItemValues || []).find((i) => i.payrollItem?.name === "Net Maaş");
  console.log("8010 BES", bes?.value, "base", bes?.baseAmount, "NET", net?.value);

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
