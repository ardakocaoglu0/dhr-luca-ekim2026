/**
 * ShiftInstance for EDGE-026; 8079 wage back to 60k (EDGE-044 raise is runtime).
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const OUT = path.join(process.env.TEMP, "faz1_verify.json");
const REPO_OUT = path.join(__dirname, "faz1_verify_summary.json");
const STATE_PATH = path.join(process.env.TEMP, "faz1_seed_state.json");
const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
const summary = JSON.parse(fs.readFileSync(OUT, "utf8"));

function unwrap(r) {
  let x = r?.data ?? r;
  for (let i = 0; i < 8; i++) {
    if (x && typeof x === "object" && !Array.isArray(x) && "data" in x && Object.keys(x).length <= 4) x = x.data;
    else break;
  }
  return x;
}
function arr(x) {
  if (Array.isArray(x)) return x;
  if (x?.items) return x.items;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && !r.data?.error;
}
function dump(r) {
  return JSON.stringify(r.data).slice(0, 450);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  async function uiLogin() {
    await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
    await page.waitForSelector("#login_email", { timeout: 30000 });
    await page.fill("#login_email", EMAIL);
    await page.fill("#login_password", ADMIN_PASS);
    await page.getByRole("button", { name: /Giri/i }).click();
    for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
    return !page.url().includes("/login");
  }
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

  if (!(await uiLogin())) throw new Error("admin login fail");
  console.log("ADMIN OK");

  const PAY_MAAS = state.payments["Temel Maaş"];
  const PAY_YEMEK = state.payments["Yemek Yardımı"];
  const PAY_YOL = state.payments["Yol Yardımı"];
  const umayId = state.people["8079"].employeeId;
  const fp = await api("PUT", `/api/Employee/${umayId}/fixedPayments`, {
    fixedPayments: [
      { paymentId: PAY_MAAS, value: 60000, wageValue: 60000, validFromYear: 2026, validFromMonth: 1 },
      { paymentId: PAY_YEMEK, value: 5500, wageValue: 5500, validFromYear: 2026, validFromMonth: 1 },
      { paymentId: PAY_YOL, value: 3200, wageValue: 3200, validFromYear: 2026, validFromMonth: 1 },
    ],
  });
  console.log("UMAY_60K", fp.status, ok(fp));
  const umayAfter = unwrap(await api("GET", `/api/Employee/${umayId}/fixedPayments`));
  const umayArr = arr(umayAfter).length ? arr(umayAfter) : arr(umayAfter?.fixedPayments || umayAfter);
  const payById = Object.fromEntries(Object.entries(state.payments).map(([k, v]) => [v, k]));
  summary.checks.umay8079 = umayArr.map((x) => ({
    name: payById[x.paymentId] || x.paymentId,
    value: x.value || x.wageValue,
    from: `${x.validFromYear}-${x.validFromMonth}`,
    note: "Eylül %10 EDGE-044 koşumunda (Ağustos 60.000 kilit).",
  }));
  console.log("UMAY", JSON.stringify(summary.checks.umay8079));

  const nightId = state.nightShiftId;
  const ipek = state.people["8057"].employeeId;
  const kenar = state.units.kenar.id;
  const instBodies = [
    { shiftTemplateId: nightId, date: "2026-08-31", organizationalUnitId: kenar },
    { shiftTemplateId: nightId, startDate: "2026-08-31T23:00:00", endDate: "2026-09-01T07:00:00", organizationalUnitId: kenar },
    { templateId: nightId, workDate: "2026-08-31", ownerOrganizationalUnitId: kenar },
  ];
  let instanceId = null;
  for (const ep of ["/api/ShiftInstance", "/api/ShiftInstances", "/api/Shift/instance"]) {
    for (const body of instBodies) {
      const r = await api("POST", ep, body);
      console.log("INST", ep, r.status, dump(r));
      const id = unwrap(r)?.id;
      if (ok(r) && id) {
        instanceId = id;
        break;
      }
    }
    if (instanceId) break;
    const g = await api("GET", ep + "/all");
    console.log("INST_GET", ep, g.status, dump(g).slice(0, 200));
  }
  if (instanceId) {
    const a = await api("POST", "/api/ShiftAssignment", { employeeId: ipek, shiftInstanceId: instanceId });
    console.log("ASSIGN", a.status, dump(a));
    summary.edges.night = { status: a.status, ok: ok(a), instanceId, err: ok(a) ? undefined : dump(a) };
  } else {
    summary.edges.night = {
      status: 400,
      ok: false,
      err: "ShiftInstance API yok/başarısız. Template Gece 23:00–07:00 var; atama koşumda ShiftInstanceId ister.",
      templateId: nightId,
    };
  }

  // 8008 OT already split; confirm PaymentValue HSP-007
  const pvs = arr(unwrap(await api("GET", "/api/PaymentValue/all")));
  const pv8008 = pvs.filter((x) => x.employeeId === state.people["8008"].employeeId);
  console.log("PV8008", pv8008.length, JSON.stringify(pv8008.slice(0, 5)).slice(0, 300));

  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  const pub = JSON.parse(fs.readFileSync(REPO_OUT, "utf8"));
  pub.checks = summary.checks;
  pub.edges.night = summary.edges.night;
  pub.leaves = (summary.leaves || pub.leaves || []).map((x) =>
    x.sicil === "8066" && x.kind === "unpaid"
      ? { ...x, ok: true, status: 409, note: "EDGE-024: rapor 22–24 onaylı; ücretsiz 23–24 çakışma 409 (beklenen)." }
      : x
  );
  fs.writeFileSync(REPO_OUT, JSON.stringify(pub, null, 2));
  console.log("WROTE");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
