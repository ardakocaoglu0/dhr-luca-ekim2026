/**
 * Ensure OKS rates are fractions, recalculate Ana Eylül, dump period JSON.
 * Does not touch İK 6101–6132, BT, Sude.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");
const { oksFraction } = require("./oks-rate.cjs");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const ANA = "fe993870-b937-4756-8097-58b358f16a8e";
const IK = "6e473120-9b10-48d1-81df-08b4f798e4dd";
const BT = "c358d645-00b6-4a78-b0e1-e1aad87e4df2";
const OUT = path.join(process.env.TEMP, "faz1_ana_sep_period.json");

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
  return Array.isArray(v) ? v : v ? [v] : [];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!ADMIN_PASS) throw new Error("DHR_PASSWORD required");
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
        return { status: res.status, data, text: String(text).slice(0, 500) };
      },
      { method, urlPath, body }
    );
  }

  const emps = arr((await api("GET", "/api/Employee/filteredByUnitAbilities")).data);
  console.log("EMPS", emps.length);
  const fixed = [];
  const already = [];
  for (const e of emps) {
    const n = Number(e.employeeNumber);
    const email = String(e.email || "").toLowerCase();
    const ou = e.organizationalUnitId || e.unitId || e.organizationalUnit?.id;
    if ((n >= 6101 && n <= 6132) || email.includes("sude.cinay") || ou === IK || ou === BT) continue;
    let oks = unwrap((await api("GET", `/api/EmployeeOksEnrollment/by-employee/${e.id}`)).data);
    if (Array.isArray(oks)) oks = oks[0] || null;
    if (!oks || oks.contributionRateOverride == null) continue;
    const rate = Number(oks.contributionRateOverride);
    const next = oksFraction(rate);
    const row = { sicil: e.employeeNumber, name: `${e.firstName} ${e.lastName}`, rate, next, uiPct: Math.round(rate * 1e4) / 100 };
    if (rate > 1) {
      const up = await api("POST", "/api/EmployeeOksEnrollment/upsert", {
        id: oks.id,
        employeeId: e.id,
        oksStatus: oks.oksStatus,
        contributionRateOverride: next,
        enrollmentDate: oks.enrollmentDate || "2026-01-06",
        withdrawalDate: oks.withdrawalDate || null,
        pauseStartDate: oks.pauseStartDate || null,
        pauseEndDate: oks.pauseEndDate || null,
        pensionCompany: oks.pensionCompany || null,
        certificateNumber: oks.certificateNumber || null,
      });
      fixed.push({ ...row, status: up.status });
      console.log("FIX", row.sicil, row.name, rate, "->", next, up.status);
    } else if (rate > 0) {
      already.push(row);
    }
  }
  console.log("ALREADY", JSON.stringify(already));
  console.log("FIXED", JSON.stringify(fixed));

  const calc = await api("POST", `/api/PayrollPeriod/${ANA}/calculate`, { onlyStaleEmployees: false });
  const jobId = unwrap(calc.data)?.jobId;
  console.log("CALC", calc.status, jobId, String(calc.text).slice(0, 200));
  for (let i = 0; i < 48; i++) {
    await sleep(5000);
    const job = jobId ? unwrap((await api("GET", `/api/background-jobs/${jobId}`)).data) : null;
    console.log("POLL", i, job?.jobStatus, job?.progressPercent, job?.failedCount);
    if (job && job.jobStatus > 1) break;
  }

  const period = unwrap((await api("GET", `/api/PayrollPeriod/${ANA}`)).data);
  fs.writeFileSync(OUT, JSON.stringify(period, null, 1));
  const pe = (period.periodEmployees || []).find((x) => x.employee?.employeeNumber === "8010");
  const bes = (pe?.deductionStructureValues || []).find((d) => /BES|OKS/i.test(d.deductionStructure?.name || ""));
  const net = (pe?.payrollItemValues || []).find((i) => i.payrollItem?.name === "Net Maaş");
  console.log("8010 BES", bes?.value, "base", bes?.baseAmount, "NET", net?.value, "status", period.payrollStatus, "n", (period.periodEmployees || []).length);
  console.log("WROTE", OUT);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
