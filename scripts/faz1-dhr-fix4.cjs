/**
 * Faz1 closer 4: 8079 zam rows, 8066 unpaid retry, ShiftAssignment 400 dump, period status.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const DEMO_PASS = "Bordro123!";
if (!ADMIN_PASS) process.exit(1);
const STATE_PATH = path.join(process.env.TEMP, "faz1_seed_state.json");
const REPO_OUT = path.join(__dirname, "faz1_verify_summary.json");
const OUT = path.join(process.env.TEMP, "faz1_verify.json");
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
  if (x?.results) return x.results;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && !r.data?.error;
}
function dump(r) {
  return JSON.stringify(r.data).slice(0, 500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  async function uiLogin(p, email, password) {
    await p.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
    await p.waitForSelector("#login_email", { timeout: 30000 });
    await p.fill("#login_email", email);
    await p.fill("#login_password", password);
    await p.getByRole("button", { name: /Giri/i }).click();
    for (let i = 0; i < 90 && p.url().includes("/login"); i++) await p.waitForTimeout(400);
    return !p.url().includes("/login");
  }
  async function api(p, method, urlPath, body) {
    return p.evaluate(
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

  if (!(await uiLogin(page, EMAIL, ADMIN_PASS))) throw new Error("admin login fail");
  console.log("ADMIN OK");

  const hours = arr(unwrap(await api(page, "GET", "/api/WorkingHourType/all")));
  const wh = hours.find((h) => /tam g[uü]n 09/i.test(h.name || "")) || hours[0];
  const PAY_MAAS = state.payments["Temel Maaş"];
  const PAY_YEMEK = state.payments["Yemek Yardımı"];
  const PAY_YOL = state.payments["Yol Yardımı"];
  const umayId = state.people["8079"].employeeId;

  const fpBody = {
    fixedPayments: [
      { paymentId: PAY_MAAS, value: 60000, wageValue: 60000, validFromYear: 2026, validFromMonth: 1, validToYear: 2026, validToMonth: 8 },
      { paymentId: PAY_MAAS, value: 66000, wageValue: 66000, validFromYear: 2026, validFromMonth: 9 },
      { paymentId: PAY_YEMEK, value: 5500, wageValue: 5500, validFromYear: 2026, validFromMonth: 1 },
      { paymentId: PAY_YOL, value: 3200, wageValue: 3200, validFromYear: 2026, validFromMonth: 1 },
    ],
  };
  let fp = await api(page, "PUT", `/api/Employee/${umayId}/fixedPayments`, fpBody);
  console.log("UMAY_FP", fp.status, ok(fp), dump(fp));
  const umayAfter = unwrap(await api(page, "GET", `/api/Employee/${umayId}/fixedPayments`));
  const umayArr = arr(umayAfter).length ? arr(umayAfter) : arr(umayAfter?.fixedPayments || umayAfter);
  const payById = Object.fromEntries(Object.entries(state.payments).map(([k, v]) => [v, k]));
  summary.checks.umay8079 = umayArr.map((x) => ({
    name: payById[x.paymentId] || x.paymentId,
    value: x.value || x.wageValue,
    from: `${x.validFromYear}-${x.validFromMonth}`,
    to: x.validToYear ? `${x.validToYear}-${x.validToMonth}` : null,
  }));
  console.log("UMAY_AFTER", JSON.stringify(summary.checks.umay8079));

  // Period statuses
  for (const [tag, id] of [
    ["ana-08", state.periods["ana-2026-08"]?.id],
    ["ana-09", "fe993870-b937-4756-8097-58b358f16a8e"],
    ["op-09", state.periods["op-2026-09"]?.id],
    ["b-09", "0fbc3cbc-687a-4640-b386-514fa3d9555c"],
  ]) {
    const p = unwrap(await api(page, "GET", `/api/PayrollPeriod/${id}`));
    console.log("PSTATUS", tag, p?.status, p?.payrollPeriodStatus, p?.isCompleted, p?.state);
  }

  // Night: dump full 400 + GET list + try more payloads
  const nightId = state.nightShiftId;
  const ipek = state.people["8057"].employeeId;
  const kenar = state.units.kenar.id;
  const tries = [
    { employeeIds: [ipek], shiftTemplateId: nightId, date: "2026-08-31T00:00:00" },
    { employeeId: ipek, shiftTemplateId: nightId, assignmentDate: "2026-08-31T00:00:00" },
    { employeeId: ipek, shiftTemplateId: nightId, start: "2026-08-31T23:00:00", end: "2026-09-01T07:00:00" },
    {
      employeeId: ipek,
      shiftTemplateId: nightId,
      organizationalUnitId: kenar,
      startLocalDate: "2026-08-31",
      endLocalDate: "2026-09-01",
    },
  ];
  for (const body of tries) {
    const r = await api(page, "POST", "/api/ShiftAssignment", body);
    console.log("NIGHT", r.status, dump(r));
    if (ok(r)) {
      summary.edges.night = { status: r.status, ok: true, body: Object.keys(body) };
      break;
    }
    summary.edges.night = { status: r.status, ok: false, dump: dump(r) };
  }
  for (const ep of [
    `/api/ShiftAssignment/employee/${ipek}`,
    `/api/ShiftAssignment/all`,
    `/api/ShiftTemplate/${nightId}/assignments`,
  ]) {
    const g = await api(page, "GET", ep);
    console.log("NIGHT_GET", ep, g.status, dump(g).slice(0, 200));
  }

  // Ceren current
  const positions = arr(unwrap(await api(page, "GET", "/api/OrganizationalUnitPosition/filteredByUnitAbilities")));
  const ceren = state.people["8051"].employeeId;
  const cpos = positions.filter((x) => x.employeeId === ceren || /şube/i.test(x.title || ""));
  console.log(
    "CEREN",
    cpos.map((x) => ({ id: x.id, ou: x.organizationalUnitId, emp: x.employeeId, title: x.title }))
  );
  summary.edges["017"] = {
    ...summary.edges["017"],
    cerenOnKenar: !!positions.find((x) => x.employeeId === ceren && x.organizationalUnitId === kenar),
    subePosId: "126f9728-5b10-474b-add9-3f9b9de1632e",
    note: "D1-Tech Şube sicili var. Tek dolu pozisyon kuralı: Ceren Kenar’da; Şube pozisyonu koşumda 11.09.",
  };

  await browser.close();

  // 8066 unpaid as employee (fresh session)
  const b2 = await chromium.launch({ headless: true });
  const c2 = await b2.newContext();
  const p2 = await c2.newPage();
  const feriha = state.people["8066"];
  const logged = await uiLogin(p2, feriha.email, DEMO_PASS);
  console.log("FERIHA", logged);
  if (logged) {
    const lt = state.leaveTypes[feriha.unitId];
    const r = await api(p2, "POST", "/api/EmployeeLeaveRequest", {
      leaveTypeId: lt.unpaid,
      startDate: "2026-09-23T08:00:00",
      endDate: "2026-09-24T17:00:00",
      workingHourTypeId: wh?.id,
      description: "Faz1 8066 unpaid overlap EDGE-024",
    });
    console.log("8066_UNPAID", r.status, dump(r));
    const rec = summary.leaves.find((x) => x.sicil === "8066" && x.kind === "unpaid");
    if (rec) {
      rec.status = r.status;
      rec.ok = ok(r) || r.status === 409;
      rec.err = ok(r) ? undefined : dump(r).slice(0, 240);
      rec.note = r.status === 409 ? "çakışma beklenen EDGE-024" : undefined;
    }
  }
  await b2.close();

  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  const pub = JSON.parse(fs.readFileSync(REPO_OUT, "utf8"));
  pub.checks = summary.checks;
  pub.edges = pub.edges || {};
  pub.edges.night = summary.edges.night;
  pub.edges["017"] = summary.edges["017"];
  pub.leaves = summary.leaves;
  pub.checks.umay8079 = summary.checks.umay8079;
  fs.writeFileSync(REPO_OUT, JSON.stringify(pub, null, 2));
  console.log("WROTE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
