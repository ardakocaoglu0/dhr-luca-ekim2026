/**
 * Duplicate PaymentValue temizliği, İcra kalem bağlama, tatil/puantaj yeniden.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");
const BASE = process.env.DHR_URL || "https://dhrtest2.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const ROOT = "d93d6660-892d-4dcf-8fc2-36bed171017a";
const PAKET = "5b82b05e-69c5-428b-b4d5-20f67586025d";
const PERIOD = "b38418d0-5b60-442a-8b3a-13868ca81789";
const STATE = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "paket_seed_state.json"), "utf8"));
const DUMP = path.join(process.env.TEMP, "paket_ocak_period.json");
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
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && !r.data?.error;
}
function errText(r) {
  const e = r?.data?.error || r?.data?.title;
  return String(e?.message || (Array.isArray(e?.errors) ? e.errors[0] : e) || r?.text || r?.status).slice(0, 220);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 80 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  async function api(method, url, body) {
    return page.evaluate(async ({ method, url, body }) => {
      await fetch("/api/antiforgery/token", { credentials: "include" }).catch(() => {});
      const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
      const token = m ? decodeURIComponent(m[1]) : "";
      const headers = { Accept: "application/json", "X-XSRF-TOKEN": token, "X-CSRF-TOKEN": token };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const res = await fetch(url, { method, credentials: "include", headers, body: body !== undefined ? JSON.stringify(body) : undefined });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = text; }
      return { status: res.status, data, text: String(text).slice(0, 400) };
    }, { method, url, body });
  }

  const empIds = new Set(Object.values(STATE.people).map((p) => p.employeeId));
  const pvs = arr((await api("GET", "/api/PaymentValue/all")).data).filter((v) => empIds.has(v.employeeId));
  const groups = {};
  for (const v of pvs) {
    const k = v.employeeId + "|" + v.paymentId;
    (groups[k] = groups[k] || []).push(v);
  }
  let del = 0;
  for (const list of Object.values(groups)) {
    if (list.length < 2) continue;
    list.sort((a, b) => String(b.createdDate || "").localeCompare(String(a.createdDate || "")));
    for (const extra of list.slice(1)) {
      const r = await api("DELETE", `/api/PaymentValue/${extra.id}`);
      console.log("DEL DUP", extra.paymentId, extra.value, r.status, ok(r) ? "ok" : errText(r));
      if (ok(r)) del++;
    }
  }
  console.log("dup deleted", del, "pv", pvs.length);

  const pays = arr((await api("GET", `/api/Payment/ownerOrganizationalUnit/${ROOT}`)).data);
  const icra = pays.find((p) => p.name === "İcra");
  const items = arr((await api("GET", `/api/PayrollItem/ownerOrganizationalUnit/${ROOT}`)).data);
  const net = items.find((i) => i.name === "Net Maaş");
  const kes = items.find((i) => i.name === "Kesintiler Toplamı");
  if (icra && net) {
    for (const [item, effect] of [[net, "Decrease"], [kes, "Increase"]]) {
      if (!item) continue;
      const already = (item.payrollItemPayments || []).some((l) => l.paymentId === icra.id);
      if (already) {
        console.log("ICRA already on", item.name);
        continue;
      }
      const r = await api("POST", "/api/PayrollItemPayment", { payrollItemId: item.id, paymentId: icra.id, effectType: effect });
      console.log("LINK ICRA", item.name, effect, r.status, ok(r) ? "ok" : errText(r));
    }
  }

  const holidays = arr((await api("GET", `/api/PublicHoliday/ownerOrganizationalUnit/${PAKET}`)).data);
  const profiles = arr((await api("GET", `/api/OrganizationalUnitProfile/organizationalUnit/${PAKET}`)).data);
  const ids = holidays.map((h) => h.id).filter(Boolean);
  console.log("holidays", holidays.length, holidays.filter((h) => /Yılbaşı|Yilbasi/i.test(h.name)).map((h) => h.startDate));
  for (const p of profiles.filter((x) => x.status !== 3)) {
    const r = await api("PUT", `/api/OrganizationalUnitProfile/${p.id}/public-holidays`, ids);
    console.log("HOLIDAY PROF", p.name || p.id, r.status, ok(r) ? "ok" : errText(r));
  }

  const attGet = await api("GET", `/api/PayrollPeriod/${PERIOD}/payroll-attendance`);
  console.log("ATT GET", attGet.status, String(attGet.text).slice(0, 160).replace(/\s+/g, " "));

  for (const u of [
    ["POST", `/api/PayrollPeriod/${PERIOD}/attendance/reset`, {}],
    ["POST", `/api/PayrollPeriod/${PERIOD}/attendance/unsave`, {}],
    ["POST", `/api/PayrollPeriod/${PERIOD}/reopen-attendance`, {}],
  ]) {
    const r = await api(u[0], u[1], u[2]);
    console.log(u[0], u[1], r.status, ok(r) ? "ok" : errText(r));
  }

  const auto = await api("POST", `/api/PayrollPeriod/${PERIOD}/attendance/bulk-save-auto`, { filter: null, search: null, onlyFullyDerived: false });
  console.log("ATT AUTO", auto.status, JSON.stringify(unwrap(auto.data)).slice(0, 180));

  const calcR = await api("POST", `/api/PayrollPeriod/${PERIOD}/calculate`, { onlyStaleEmployees: false });
  const jobId = unwrap(calcR.data)?.jobId;
  console.log("CALC", calcR.status, jobId);
  let full = null;
  for (let i = 0; i < 40; i++) {
    await sleep(5000);
    const job = jobId ? unwrap((await api("GET", `/api/background-jobs/${jobId}`)).data) : null;
    full = unwrap((await api("GET", `/api/PayrollPeriod/${PERIOD}`)).data);
    const pes = full?.periodEmployees || [];
    const withItems = pes.filter((e) => (e.payrollItemValues || []).length).length;
    const mine = pes.find((e) => e.employee?.employeeNumber === "6301");
    console.log("POLL", i, job?.jobStatus, job?.progressPercent, "items", withItems, "biz", mine?.businessDays);
    if (job && job.jobStatus > 1 && i >= 1) break;
  }
  if (full) {
    fs.writeFileSync(DUMP, JSON.stringify(full));
    const mine = full.periodEmployees.find((e) => e.employee?.employeeNumber === "6301");
    const koray = full.periodEmployees.find((e) => e.employee?.employeeNumber === "6322");
    const pinar = full.periodEmployees.find((e) => e.employee?.employeeNumber === "6327");
    const netOf = (pe) => (pe.payrollItemValues || []).find((x) => x.payrollItem?.name === "Net Maaş")?.value;
    const grossOf = (pe) => (pe.payrollItemValues || []).find((x) => x.payrollItem?.name === "Toplam Kazanç")?.value;
    console.log("MINE net", netOf(mine), "biz", mine.businessDays);
    console.log("KORAY net", netOf(koray), "icra PPV", (koray.paymentPeriodValues || []).filter((x) => (x.payment?.name || x.paymentValue?.payment?.name) === "İcra").map((x) => x.value));
    console.log("PINAR gross", grossOf(pinar), "prim", (pinar.paymentPeriodValues || []).filter((x) => (x.payment?.name || x.paymentValue?.payment?.name) === "Prim").map((x) => x.value));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
