/**
 * Follow-up: Ana period employeeIds → Employee + OKS + SGK (read-only).
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const ANA = "fe993870-b937-4756-8097-58b358f16a8e";
const OUT = process.env.TEMP + "/faz1_ana15_cards.json";

function unwrap(x) {
  let v = x?.data ?? x;
  for (let i = 0; i < 8; i++) {
    if (v && typeof v === "object" && !Array.isArray(v) && "data" in v) v = v.data;
    else break;
  }
  return v;
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

  async function api(method, urlPath) {
    return page.evaluate(
      async ({ method, urlPath }) => {
        await fetch("/api/antiforgery/token", { credentials: "include" }).catch(() => {});
        const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
        const token = m ? decodeURIComponent(m[1]) : "";
        const res = await fetch(urlPath, {
          method,
          credentials: "include",
          headers: { Accept: "application/json", "X-XSRF-TOKEN": token, "X-CSRF-TOKEN": token },
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        return { status: res.status, data };
      },
      { method, urlPath }
    );
  }

  const period = unwrap((await api("GET", `/api/PayrollPeriod/${ANA}`)).data);
  const cards = [];
  for (const pe of period.periodEmployees || []) {
    const id = pe.employeeId || pe.employee?.id;
    const sicil = pe.employee?.employeeNumber;
    const emp = unwrap((await api("GET", `/api/Employee/${id}`)).data);
    let oks = unwrap((await api("GET", `/api/EmployeeOksEnrollment/by-employee/${id}`)).data);
    if (Array.isArray(oks)) oks = oks[0] || null;
    let sgk = unwrap((await api("GET", `/api/EmployeeSgkProfile/by-employee/${id}`)).data);
    if (Array.isArray(sgk)) sgk = sgk[0] || null;
    const rate = oks?.contributionRateOverride;
    cards.push({
      sicil,
      id,
      name: `${emp?.firstName || pe.employee?.firstName} ${emp?.lastName || pe.employee?.lastName}`,
      hire: String(emp?.companyStartDate || "").slice(0, 10),
      exit: String(emp?.terminationDate || emp?.exitDate || "").slice(0, 10),
      disabilityDegree: emp?.disabilityDegree,
      lawCode: emp?.defaultPayrollLawVariant?.code || emp?.defaultPayrollLawVariant?.name,
      lawId: emp?.defaultPayrollLawVariantId,
      salaryType: emp?.salaryType,
      oksStatus: oks?.oksStatus,
      contributionRateOverride: rate,
      uiWouldShowPct: rate == null ? null : Math.round(rate * 1e4) / 100,
      engineWouldDeductOn63200: rate == null ? null : Math.round(63200 * rate * 100) / 100,
      oksEnrollment: String(oks?.enrollmentDate || "").slice(0, 10),
      meslek: sgk?.meslekKodu,
      sigortaliTuru: sgk?.sigortaliTuru,
      kismi: sgk?.kismiSureliCalisiyor,
      belgeTuru: sgk?.belgeTuru,
    });
  }
  fs.writeFileSync(OUT, JSON.stringify(cards, null, 2));
  console.log(JSON.stringify(cards, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
