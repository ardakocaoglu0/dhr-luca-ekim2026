const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");
const BASE = "https://dhrtest.d1-tech.com.tr";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const state = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "faz1_seed_state.json"), "utf8"));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", "arda.kocaoglu@d1-tech.com");
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
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
  const del = await api("DELETE", "/api/EmployeePosition/decb27b2-2462-460f-b475-c379cefecf0f");
  console.log("DEL_BAD_B", del.status, String(del.text).slice(0, 120));
  const ozanEp = await api("GET", `/api/EmployeePosition/employee/${state.people["8061"].employeeId}`);
  console.log("OZAN_EP", JSON.stringify(ozanEp.data).slice(0, 700));
  const cerenKenar = await api("GET", `/api/OrganizationalUnitPosition/${state.people["8051"].positionId}`);
  const cerenSube = await api("GET", "/api/OrganizationalUnitPosition/126f9728-5b10-474b-add9-3f9b9de1632e");
  const ck = cerenKenar.data?.data || cerenKenar.data;
  const cs = cerenSube.data?.data || cerenSube.data;
  console.log("CEREN_KENAR_POS", ck?.employeeId, ck?.isTerminated, ck?.endDate);
  console.log("CEREN_SUBE_POS", cs?.employeeId, cs?.isTerminated, cs?.startDate, cs?.endDate);
  const a8025 = await api("GET", `/api/TechnoparkProject/assignments?employeeId=${state.people["8025"].employeeId}`);
  console.log("A8025", a8025.status, String(a8025.text).slice(0, 300));
  const retry = await api("POST", "/api/TechnoparkProject/assign", {
    employeeId: state.people["8025"].employeeId,
    technoparkProjectId: state.technoparkProjectId || "a6a12f87-6f58-4574-9126-4ccca9f9a622",
    startDate: "2026-01-06T00:00:00",
    isciTuru: "2",
    destekOncelik: 1,
    acikAtamayiKapat: true,
  });
  console.log("RETRY_8025", retry.status, String(retry.text).slice(0, 250));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
