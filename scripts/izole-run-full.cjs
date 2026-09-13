/**
 * Tek Değişken Ocak 2026: FM'i günlük limite böl, puantajı UI'dan kaydet,
 * calculate(onlyStaleEmployees:false), dump.
 *
 * Draft dönem hesaplamayı sessiz atlar; Kaydet puantaj şart.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const PERIOD = "a1013469-c82e-4c5d-8dac-4dbfe10d6fdd";
const OU = "eb55bafc-2549-47b4-be28-682f7128d11c";
const ROOT = "d93d6660-892d-4dcf-8fc2-36bed171017a";
const STATE_PATH = path.join(process.env.TEMP, "izole_seed_state.json");
const DUMP_PATH = path.join(process.env.TEMP, "izole_ocak_period.json");
const SUM_PATH = path.join(process.env.TEMP, "izole_ocak_summary.json");
const SHOT = path.join(process.env.TEMP, "izole_shots");
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
function arr(x) {
  if (Array.isArray(x)) return x;
  if (x?.items) return x.items;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && r.data?.isSuccess !== false;
}
function errText(r) {
  const t = r?.text || JSON.stringify(r?.data || "").slice(0, 400);
  return String(t).replace(/\s+/g, " ").slice(0, 240);
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

  const state = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) : { people: {} };
  const emp6219 = state.people?.["6219"]?.employeeId;

  console.log("PHASE ot-limit");
  const overtimeTypes = arr(unwrap(await api("GET", "/api/OvertimeType/all")));
  const otGross =
    overtimeTypes.find((t) => /hafta i[cç]i/i.test(t.name || "") && t.organizationalUnitId === ROOT) || overtimeTypes[0];
  for (const ep of [`/api/OvertimeSetting/effective/${OU}`, `/api/OvertimeSetting/by-ou/${OU}`, `/api/UnitOvertimeSetting/${OU}`]) {
    const g = await api("GET", ep);
    console.log("OT_SETTING_GET", ep, g.status, errText(g).slice(0, 120));
    const cur = unwrap(g);
    if (ok(g) && cur && !Array.isArray(cur)) {
      const body = {
        ...cur,
        organizationalUnitId: OU,
        dailyLimitHours: 12,
        maxDailyOvertimeHours: 12,
        dailyOvertimeLimit: 12,
        maxDailyHours: 12,
      };
      const put = await api("POST", "/api/OvertimeSetting", body);
      console.log("OT_SETTING_POST", put.status, ok(put), errText(put).slice(0, 120));
    }
  }

  if (emp6219 && otGross?.id) {
    const otDays = [
      ["2026-01-08T08:00:00", "2026-01-08T11:00:00"],
      ["2026-01-09T08:00:00", "2026-01-09T11:00:00"],
      ["2026-01-12T08:00:00", "2026-01-12T11:00:00"],
      ["2026-01-13T08:00:00", "2026-01-13T11:00:00"],
    ];
    for (const [startDate, endDate] of otDays) {
      const r = await api("POST", "/api/EmployeeOvertimeRequest/assign", {
        title: "Tek değişken FM 3s",
        description: "12 saat brüt (günlük 3s × 4 gün)",
        startDate,
        endDate,
        targetEmployeeId: emp6219,
        overtimeTypeId: otGross.id,
        compensationMode: 0,
      });
      console.log("OT 6219", startDate.slice(0, 10), r.status, ok(r) ? "ok" : errText(r));
    }
  }

  let p = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}`));
  const unsaved = (p?.periodEmployees || [])
    .filter((e) => !e.isPayrollAttendanceSaved)
    .map((e) => e.employee?.employeeNumber + " " + e.employee?.firstName);
  console.log(
    "BEFORE status",
    p?.payrollStatus,
    "att",
    (p?.periodEmployees || []).filter((e) => e.isPayrollAttendanceSaved).length + "/" + (p?.periodEmployees || []).length,
    "unsaved",
    unsaved.join(",")
  );

  console.log("PHASE puantaj UI");
  await page.goto(BASE + "/payroll-management", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.getByText(/^Dönemler$/).first().click().catch(() => {});
  await page.waitForTimeout(4500);
  const card = await page.evaluate(() => {
    const leaves = [...document.querySelectorAll("span, div")].filter(
      (el) => el.children.length === 0 && /Tek De[gğ]i[sş]ken/i.test((el.textContent || "").trim())
    );
    for (const leaf of leaves) {
      let c = leaf;
      for (let i = 0; i < 10 && c; i++) {
        c = c.parentElement;
        if (!c) break;
        const t = (c.innerText || "").replace(/\s+/g, " ").trim();
        if (c.querySelector("input[type=checkbox]") && t.length < 180) {
          let month = "?";
          let g = c;
          while (g && month === "?") {
            const m = (g.innerText || "").replace(/\s+/g, " ").match(/(OCAK|ŞUBAT|MART) \d{4}/);
            if (m) month = m[0];
            g = g.parentElement;
          }
          if (/OCAK 2026/i.test(month)) {
            leaf.click();
            return { month, t: t.slice(0, 200) };
          }
          break;
        }
      }
    }
    return null;
  });
  console.log("CARD", JSON.stringify(card));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOT, "card.png") });

  muts.length = 0;
  const goPuantaj = page.locator("button", { hasText: /Puantaja git/ }).first();
  if (await goPuantaj.count()) {
    await goPuantaj.click();
    await page.waitForTimeout(7000);
  }
  await page.screenshot({ path: path.join(SHOT, "puantaj.png") });
  const saveBtn = page.locator("button", { hasText: /^Kaydet \(\d+\)$/ }).first();
  console.log("SAVE_BTN", await saveBtn.count(), (await saveBtn.innerText().catch(() => "")).trim());
  if (await saveBtn.count()) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    const confirm = page.locator("button", { hasText: /^(Kaydet|Onayla|Evet|Tamam|Devam)$/ }).last();
    if (await confirm.count()) {
      console.log("CONFIRM", (await confirm.innerText()).trim());
      await confirm.click().catch(() => {});
    }
    await page.waitForTimeout(15000);
  }
  await page.screenshot({ path: path.join(SHOT, "saved.png") });
  console.log("SAVE_MUTS\n  " + [...new Set(muts)].join("\n  "));

  p = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}`));
  const attSaved = (p?.periodEmployees || []).filter((e) => e.isPayrollAttendanceSaved).length;
  const still = (p?.periodEmployees || [])
    .filter((e) => !e.isPayrollAttendanceSaved)
    .map((e) => e.employee?.employeeNumber + " " + e.employee?.firstName);
  console.log("PERIOD_STATUS", p?.payrollStatus, "attSaved", attSaved + "/" + (p?.periodEmployees || []).length, "still", still.join(","));

  const calc = await api("POST", `/api/PayrollPeriod/${PERIOD}/calculate`, { onlyStaleEmployees: false });
  const jobId = unwrap(calc.data)?.jobId;
  console.log("CALC", calc.status, jobId, errText(calc));

  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const job = jobId ? unwrap(await api("GET", `/api/background-jobs/${jobId}`)) : null;
    p = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}`));
    const pes = p?.periodEmployees || [];
    const withItems = pes.filter((e) => (e.payrollItemValues || []).length).length;
    console.log(
      `POLL ${i} job=${job?.jobStatus} pct=${job?.progressPercent} result=${String(job?.resultPayloadJson || "").slice(0, 180)} periodStatus=${p?.payrollStatus} items=${withItems}/${pes.length}`
    );
    if (job && job.jobStatus !== 0 && job.jobStatus !== 1 && i >= 1) break;
  }

  p = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}`));
  fs.writeFileSync(DUMP_PATH, JSON.stringify(p, null, 1));
  const summary = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}/employee-summary`));
  fs.writeFileSync(SUM_PATH, JSON.stringify(summary, null, 1));
  const pes = p?.periodEmployees || [];
  const withItems = pes.filter((e) => (e.payrollItemValues || []).length).length;
  console.log("DUMP", DUMP_PATH, "employees", pes.length, "withItems", withItems);
  console.log("SUMMARY rows", Array.isArray(summary) ? summary.length : typeof summary);
  if (pes[0]) {
    console.log("SAMPLE", pes[0].employee?.firstName, "items", (pes[0].payrollItemValues || []).length, "pays", (pes[0].paymentPeriodValues || []).length);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
