/**
 * Scan dhrtest OKS enrollments. If contributionRateOverride > 1 (e.g. 3 = 300%),
 * rewrite as a fraction (0.03). Does not touch İK 6101–6132, BT, Sude.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const { oksFraction } = require("./oks-rate.cjs");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const IK = "6e473120-9b10-48d1-81df-08b4f798e4dd";
const BT = "c358d645-00b6-4a78-b0e1-e1aad87e4df2";
const APPLY = !process.argv.includes("--dry");

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
function sicilOf(e) {
  return String(e?.employeeNumber || e?.registrationNumber || "");
}
function protectedEmployee(e) {
  const n = Number(sicilOf(e));
  if (n >= 6101 && n <= 6132) return "IK";
  const email = String(e?.email || "").toLowerCase();
  if (email.includes("sude.cinay")) return "Sude";
  const ou = e?.organizationalUnitId || e?.unitId || e?.organizationalUnit?.id;
  if (ou === IK) return "IK-unit";
  if (ou === BT) return "BT";
  return null;
}

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
        return { status: res.status, data, text: String(text).slice(0, 400) };
      },
      { method, urlPath, body }
    );
  }

  let emps = arr((await api("GET", "/api/Employee/filteredByUnitAbilities")).data);
  if (!emps.length) emps = arr((await api("GET", "/api/Employee/all")).data);
  console.log("EMPS", emps.length, "APPLY", APPLY);

  const allList = await api("GET", "/api/EmployeeOksEnrollment/all");
  console.log("OKS_ALL", allList.status, Array.isArray(unwrap(allList.data)) ? unwrap(allList.data).length : typeof unwrap(allList.data));

  const found = [];
  const skipped = [];
  const okAlready = [];
  for (const e of emps) {
    const id = e.id;
    if (!id) continue;
    let oks = unwrap((await api("GET", `/api/EmployeeOksEnrollment/by-employee/${id}`)).data);
    if (Array.isArray(oks)) oks = oks[0] || null;
    if (!oks) continue;
    const rate = oks.contributionRateOverride;
    if (rate == null) continue;
    const row = {
      sicil: sicilOf(e),
      name: `${e.firstName || ""} ${e.lastName || ""}`.trim(),
      id,
      rate,
      uiPct: Math.round(Number(rate) * 1e4) / 100,
      oksStatus: oks.oksStatus,
    };
    const prot = protectedEmployee(e);
    if (Number(rate) > 1) {
      if (prot) {
        skipped.push({ ...row, reason: prot });
        continue;
      }
      found.push({ ...row, oks });
    } else if (Number(rate) > 0) {
      okAlready.push(row);
    }
  }

  console.log("OK_FRACTION", JSON.stringify(okAlready, null, 2));
  console.log("SKIP_PROTECTED", JSON.stringify(skipped, null, 2));
  console.log("NEED_FIX", JSON.stringify(found.map(({ oks, ...r }) => r), null, 2));

  const results = [];
  if (APPLY) {
    for (const row of found) {
      const oks = row.oks;
      const next = oksFraction(row.rate);
      const up = await api("POST", "/api/EmployeeOksEnrollment/upsert", {
        id: oks.id,
        employeeId: row.id,
        oksStatus: oks.oksStatus,
        contributionRateOverride: next,
        enrollmentDate: oks.enrollmentDate || "2026-01-06",
        withdrawalDate: oks.withdrawalDate || null,
        pauseStartDate: oks.pauseStartDate || null,
        pauseEndDate: oks.pauseEndDate || null,
        pensionCompany: oks.pensionCompany || null,
        certificateNumber: oks.certificateNumber || null,
      });
      results.push({ sicil: row.sicil, name: row.name, from: row.rate, to: next, status: up.status });
      console.log("UPSERT", row.sicil, row.name, row.rate, "->", next, up.status);
    }
  }

  console.log("DONE", JSON.stringify({ okAlready: okAlready.length, skipped: skipped.length, fixed: results }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
