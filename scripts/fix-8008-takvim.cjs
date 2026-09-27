/**
 * Undo 8008 Net Fazla Mesai PV (formula treated 2000 as hours) and try Takvim attendance.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const STATE = JSON.parse(require("fs").readFileSync(require("path").join(process.env.TEMP, "fill_dhr_gaps_state.json"), "utf8"));
const BASE = process.env.DHR_URL || "https://dhrtest2.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const PV_ID = "e3015885-3057-47be-bbc8-9ae028505bf9";
const TAKVIM = STATE.takvimPeriodId;
const ANA = "fe993870-b937-4756-8097-58b358f16a8e";

if (!ADMIN_PASS) process.exit(1);

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
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && r.data?.isSuccess !== false && !r.data?.error;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
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
        return { status: res.status, data, text: String(text).slice(0, 800) };
      },
      { method, urlPath, body }
    );
  }

  const del = await api("DELETE", `/api/PaymentValue/${PV_ID}`);
  console.log("DEL PV 8008", del.status, ok(del) ? "ok" : String(del.text).slice(0, 200));

  const ots = arr(unwrap(await api("GET", "/api/OvertimeType/all"))).concat(arr(unwrap(await api("GET", "/api/OvertimeType/filteredByUnitAbilities"))));
  console.log(
    "OT TYPES",
    ots.map((t) => `${t.name} net=${t.isNet} id=${t.id}`).join(" | ").slice(0, 400)
  );

  if (TAKVIM) {
    const auto = await api("POST", `/api/PayrollPeriod/${TAKVIM}/attendance/bulk-save-auto`, {
      filter: null,
      search: null,
      onlyFullyDerived: false,
    });
    console.log("TAKVIM ATT", auto.status, JSON.stringify(unwrap(auto) || auto.data).slice(0, 250));
    const calc = await api("POST", `/api/PayrollPeriod/${TAKVIM}/calculate`, { onlyStaleEmployees: false });
    const jobId = unwrap(calc)?.jobId;
    console.log("TAKVIM CALC", calc.status, jobId);
    if (jobId) {
      for (let i = 0; i < 24; i++) {
        await sleep(4000);
        const job = unwrap(await api("GET", `/api/background-jobs/${jobId}`));
        console.log(" POLL tak", i, job?.jobStatus, job?.progressPercent);
        if (job && job.jobStatus > 1) break;
      }
    }
  }

  const calcA = await api("POST", `/api/PayrollPeriod/${ANA}/calculate`, { onlyStaleEmployees: false });
  const jobA = unwrap(calcA)?.jobId;
  console.log("ANA CALC", calcA.status, jobA);
  if (jobA) {
    for (let i = 0; i < 40; i++) {
      await sleep(4000);
      const job = unwrap(await api("GET", `/api/background-jobs/${jobA}`));
      console.log(" POLL ana", i, job?.jobStatus, job?.progressPercent);
      if (job && job.jobStatus > 1) break;
    }
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
