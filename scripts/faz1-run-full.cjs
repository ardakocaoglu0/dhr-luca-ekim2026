/**
 * Faz 1 Eylül 2026 (Ana Kadro): save puantaj through the UI so the period
 * leaves Draft, run the payroll calculation, then dump the results.
 *
 * A Draft period silently skips calculation
 * ({"skipped":true,"reason":"InvalidStatusForCalculation"}), which is why the
 * puantaj save has to happen first.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const ANA_SEP = "fe993870-b937-4756-8097-58b358f16a8e";
const SHOT = path.join(process.env.TEMP, "faz1_shots");
if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}
fs.mkdirSync(SHOT, { recursive: true });

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
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const muts = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/") && r.method() !== "GET" && !r.url().includes("/Auth/login"))
      muts.push(`${r.method()} ${r.url().replace(BASE, "")}`);
  });

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
        return { status: res.status, data, text: String(text).slice(0, 1200) };
      },
      { method, urlPath, body }
    );
  }

  // ---- 1. Puantaj kaydet -------------------------------------------------
  await page.goto(BASE + "/payroll-management", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.getByText(/^Dönemler$/).first().click();
  await page.waitForTimeout(4500);
  const card = await page.evaluate(() => {
    const leaves = [...document.querySelectorAll("span, div")].filter(
      (el) => el.children.length === 0 && (el.textContent || "").trim() === "Ana Kadro"
    );
    for (const leaf of leaves) {
      let c = leaf;
      for (let i = 0; i < 8 && c; i++) {
        c = c.parentElement;
        if (!c) break;
        const t = (c.innerText || "").replace(/\s+/g, " ").trim();
        if (c.querySelector("input[type=checkbox]") && t.length < 140) {
          let month = "?";
          let g = c;
          while (g && month === "?") {
            const m = (g.innerText || "").replace(/\s+/g, " ").match(/(OCAK|ŞUBAT|MART|NISAN|MAYIS|HAZIRAN|TEMMUZ|AĞUSTOS|EYLÜL|EKIM|KASIM|ARALIK) \d{4}/);
            if (m) month = m[0];
            g = g.parentElement;
          }
          if (month === "EYLÜL 2026" && /Ana Kadro 15\b/.test(t)) {
            leaf.click();
            return t;
          }
          break;
        }
      }
    }
    return null;
  });
  console.log("CARD", JSON.stringify(card));
  await page.waitForTimeout(3500);
  await page.locator("button", { hasText: /Puantaja git/ }).first().click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(SHOT, "full-puantaj.png") });

  muts.length = 0;
  const saveBtn = page.locator("button", { hasText: /^Kaydet \(\d+\)$/ }).first();
  console.log("SAVE_BTN", await saveBtn.count(), (await saveBtn.innerText().catch(() => "")).trim());
  await saveBtn.click();
  await page.waitForTimeout(3000);
  const confirm = page.locator("button", { hasText: /^(Kaydet|Onayla|Evet|Tamam|Devam)$/ }).last();
  if (await confirm.count()) {
    console.log("CONFIRM", (await confirm.innerText()).trim());
    await confirm.click().catch(() => {});
  }
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(SHOT, "full-saved.png") });
  console.log("SAVE_MUTS\n  " + [...new Set(muts)].join("\n  "));
  const tail = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 700));
  console.log("AFTER_SAVE_TEXT", tail);

  let p = unwrap(await api("GET", `/api/PayrollPeriod/${ANA_SEP}`));
  const attSaved = (p?.periodEmployees || []).filter((e) => e.isPayrollAttendanceSaved).length;
  console.log("PERIOD_STATUS", p?.payrollStatus, "attSaved", attSaved + "/" + (p?.periodEmployees || []).length);

  // ---- 2. Hesapla --------------------------------------------------------
  const calc = await api("POST", `/api/PayrollPeriod/${ANA_SEP}/calculate`, { onlyStaleEmployees: false });
  const jobId = unwrap(calc.data)?.jobId;
  console.log("CALC", calc.status, "job", jobId);

  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const job = jobId ? unwrap(await api("GET", `/api/background-jobs/${jobId}`)) : null;
    p = unwrap(await api("GET", `/api/PayrollPeriod/${ANA_SEP}`));
    const pes = p?.periodEmployees || [];
    const withItems = pes.filter((e) => (e.payrollItemValues || []).length).length;
    console.log(
      `POLL ${i} jobStatus=${job?.jobStatus} pct=${job?.progressPercent} result=${String(job?.resultPayloadJson || "").slice(0, 120)} periodStatus=${p?.payrollStatus} withItems=${withItems}/${pes.length}`
    );
    if (job && job.jobStatus !== 0 && job.jobStatus !== 1 && i >= 1) break;
  }

  fs.writeFileSync(path.join(process.env.TEMP, "faz1_ana_sep_period.json"), JSON.stringify(p, null, 1));
  const summary = unwrap(await api("GET", `/api/PayrollPeriod/${ANA_SEP}/employee-summary`));
  fs.writeFileSync(path.join(process.env.TEMP, "faz1_ana_sep_summary.json"), JSON.stringify(summary, null, 1));
  console.log("SAVED period + summary; summaryRows =", Array.isArray(summary) ? summary.length : "n/a");
  const pes = p?.periodEmployees || [];
  if (pes[0]) {
    console.log("ITEM_SAMPLE", JSON.stringify(pes[0].payrollItemValues || []).slice(0, 1500));
    console.log("DEDUCT_SAMPLE", JSON.stringify(pes[0].deductionStructureValues || []).slice(0, 800));
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
