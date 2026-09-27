/**
 * 6316/6317 sağlık: sabit ödeme (PPV değil). dhrtest2 only.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest2.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const STATE = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "fill_dhr_gaps_state.json"), "utf8"));

if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}

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
  if (v?.fixedPayments) return v.fixedPayments;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && r.data?.isSuccess !== false && !r.data?.error;
}
function errText(r) {
  return String(r?.text || JSON.stringify(r?.data || "")).replace(/\s+/g, " ").slice(0, 240);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  if (page.url().includes("/login")) throw new Error("login fail");
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
        return { status: res.status, data, text: String(text).slice(0, 700) };
      },
      { method, urlPath, body }
    );
  }

  const jobs = [
    { sicil: "6316", pay: "Özel Sağlık Sigortası (İşveren)", value: 1500 },
    { sicil: "6317", pay: "Özel Sağlık Sigortası (İşveren Üstlenir)", value: 1500 },
  ];
  for (const j of jobs) {
    const emp = STATE.people[j.sicil];
    const paymentId = STATE.payments[j.pay];
    if (!emp?.id || !paymentId) {
      console.log("SKIP", j.sicil, j.pay);
      continue;
    }
    const cur = unwrap(await api("GET", `/api/Employee/${emp.id}/fixedPayments`));
    const list = arr(cur);
    console.log("CUR", j.sicil, list.length, list.map((x) => `${x.paymentId}:${x.value || x.wageValue}`).join(" | ").slice(0, 240));
    const next = list
      .filter((x) => x.paymentId !== paymentId)
      .map((x) => ({
        paymentId: x.paymentId,
        value: x.value ?? x.wageValue,
        wageValue: x.wageValue ?? x.value,
        validFromYear: x.validFromYear || 2026,
        validFromMonth: x.validFromMonth || 1,
        validToYear: x.validToYear ?? null,
        validToMonth: x.validToMonth ?? null,
      }));
    next.push({
      paymentId,
      value: j.value,
      wageValue: j.value,
      validFromYear: 2026,
      validFromMonth: 1,
    });
    let r = await api("PUT", `/api/Employee/${emp.id}/fixedPayments`, { fixedPayments: next });
    if (!ok(r)) r = await api("PUT", `/api/Employee/${emp.id}/fixedPayments`, { fixedPayments: next.map((x) => ({ paymentId: x.paymentId, value: x.value })) });
    const after = arr(unwrap(await api("GET", `/api/Employee/${emp.id}/fixedPayments`)));
    const hit = after.find((x) => x.paymentId === paymentId);
    console.log("FP", j.sicil, j.pay, r.status, ok(r) ? "ok" : errText(r), "got", hit?.value ?? hit?.wageValue);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
