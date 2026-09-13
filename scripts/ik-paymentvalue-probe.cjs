/**
 * DHR-PPV-DROP follow-up: list the one-off PaymentValue records for the İK
 * employees whose prim/ikramiye/masraf/kesinti vanished from the Ekim period
 * output after a full recalculation.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const OUT = path.join(process.env.TEMP, "ik_recalc");
const SICILS = ["6129", "6119", "6126", "6128", "6120", "6121", "6127", "6122", "6117"];
const ONEOFF = /Prim|kramiye|Masraf|Genel Kesinti|İcra|Icra/i;

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
        return { status: res.status, data, text: String(text).slice(0, 400) };
      },
      { method, urlPath, body }
    );
  }

  const res = await api("GET", "/api/PaymentValue/all");
  const all = unwrap(res.data);
  const list = Array.isArray(all) ? all : all?.items || [];
  console.log("PaymentValue/all", res.status, "count", list.length, "keys", list[0] ? Object.keys(list[0]).join(",") : "-");
  fs.writeFileSync(path.join(OUT, "paymentvalues.json"), JSON.stringify(list, null, 1));

  const rows = list.filter((v) => {
    const name = v.paymentName || v.payment?.name || "";
    const sicil = String(v.employeeNumber || v.employee?.employeeNumber || "");
    return ONEOFF.test(name) && SICILS.includes(sicil);
  });
  console.log("\nİK tek seferlik kayıtlar:", rows.length);
  for (const v of rows) {
    console.log(
      `  ${v.employeeNumber || v.employee?.employeeNumber} ${(v.employeeName || `${v.employee?.firstName || ""} ${v.employee?.lastName || ""}`).trim()} | ${v.paymentName || v.payment?.name} | ${v.value} | date=${(v.date || v.effectiveDate || v.startDate || "").slice(0, 10)} | status=${v.status} | net=${v.isNet} | desc=${v.description || ""}`
    );
  }

  const byName = {};
  for (const v of list) {
    const n = v.paymentName || v.payment?.name || "?";
    byName[n] = (byName[n] || 0) + 1;
  }
  console.log("\nTüm ödeme adları:", JSON.stringify(byName));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
