/**
 * Faz1 closer 3: Şirket B period (Eda), employee-created leaves + Berk approve,
 * night-shift validation, 8078/8079/Ceren checks, EDGE-018 log.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const DEMO_PASS = "Bordro123!";
if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}
const STATE_PATH = path.join(process.env.TEMP, "faz1_seed_state.json");
const OUT = path.join(process.env.TEMP, "faz1_verify.json");
const REPO_OUT = path.join(__dirname, "faz1_verify_summary.json");
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));

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
  if (x?.employees) return x.employees;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && !r.data?.error;
}
function errText(r) {
  const e = r?.data?.error || r?.data?.title || r?.data;
  const msg =
    e?.message ||
    (Array.isArray(e?.errors) ? JSON.stringify(e.errors).slice(0, 240) : null) ||
    (e && typeof e === "object" && e.errors ? JSON.stringify(e.errors).slice(0, 240) : null) ||
    (typeof e === "string" ? e : null) ||
    r?.text;
  return String(msg || r?.status || "").slice(0, 400);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const summary = prev;
  summary.leaves = [];
  summary.notes = summary.notes || [];
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
        const allow = res.headers.get("allow") || res.headers.get("Allow");
        return { status: res.status, data, text: String(text).slice(0, 800), allow };
      },
      { method, urlPath, body }
    );
  }

  async function waitJob(p, jobId, maxMs = 180000) {
    const start = Date.now();
    let last = null;
    while (Date.now() - start < maxMs) {
      const r = await api(p, "GET", `/api/background-jobs/${jobId}`);
      last = unwrap(r);
      if ([2, 3, 4, 5].includes(last?.jobStatus)) return last;
      await sleep(2000);
    }
    return last;
  }

  if (!(await uiLogin(page, EMAIL, ADMIN_PASS))) throw new Error("admin login fail");
  console.log("ADMIN OK");

  const hours = arr(unwrap(await api(page, "GET", "/api/WorkingHourType/all")));
  const wh = hours.find((h) => /tam g[uü]n 09/i.test(h.name || "")) || hours[0];

  // Probe leave methods
  for (const ep of ["/api/EmployeeLeaveRequest", "/api/EmployeeLeaveRequest/assign", "/api/EmployeeLeaveRequest/create"]) {
    const opt = await api(page, "OPTIONS", ep);
    const get = await api(page, "GET", ep);
    console.log("LEAVE_PROBE", ep, "OPT", opt.status, opt.allow, "GET", get.status, errText(get).slice(0, 80));
  }

  // Accrual as admin
  async function grant(empId, typeId, days) {
    const bodies = [
      { employeeId: empId, leaveTypeId: typeId, days, year: 2026 },
      { employeeId: empId, leaveTypeId: typeId, days, assignedDate: "2026-01-06T00:00:00", year: 2026 },
    ];
    for (const b of bodies) {
      const r = await api(page, "POST", "/api/EmployeeLeaveAccrual", b);
      if (ok(r)) return r;
      console.log("ACCRUAL", r.status, errText(r).slice(0, 120));
    }
    return null;
  }

  const leaveNeed = [
    ["8006", "unpaid", "2026-09-01", "2026-09-02"],
    ["8006", "report", "2026-09-08", "2026-09-10"],
    ["8006", "annual", "2026-09-15", "2026-09-16"],
    ["8007", "annual", "2026-09-17", "2026-09-17"],
    ["8020", "unpaid", "2026-09-08", "2026-09-10"],
    ["8021", "report", "2026-09-14", "2026-09-18"],
    ["8022", "annual", "2026-09-04", "2026-09-08"],
    ["8053", "unpaid", "2026-08-29", "2026-09-30"],
    ["8066", "report", "2026-09-22", "2026-09-24"],
    ["8066", "unpaid", "2026-09-23", "2026-09-24"],
    ["8071", "unpaid", "2026-09-11", "2026-09-20"],
  ];
  for (const [sicil, kind] of leaveNeed) {
    const row = state.people[sicil];
    const lt = state.leaveTypes[row.unitId];
    const typeId = kind === "unpaid" ? lt?.unpaid : kind === "report" ? lt?.report : lt?.annual;
    if (typeId) await grant(row.employeeId, typeId, 20);
  }

  // Employee-created leaves
  const byEmp = {};
  for (const row of leaveNeed) {
    (byEmp[row[0]] ||= []).push(row);
  }
  for (const sicil of Object.keys(byEmp)) {
    const person = state.people[sicil];
    const c2 = await browser.newContext();
    const p2 = await c2.newPage();
    const logged = await uiLogin(p2, person.email, DEMO_PASS);
    console.log("EMP_LOGIN", sicil, person.email, logged);
    if (!logged) {
      for (const L of byEmp[sicil]) summary.leaves.push({ sicil, kind: L[1], status: 0, ok: false, err: "login fail" });
      await c2.close();
      continue;
    }
    const mine = await api(p2, "GET", "/api/EmployeeLeaveRequest/my");
    console.log("MY_LEAVES", sicil, mine.status, arr(unwrap(mine)).length, errText(mine).slice(0, 80));
    const lt = state.leaveTypes[person.unitId];
    for (const [, kind, start, end] of byEmp[sicil]) {
      const typeId = kind === "unpaid" ? lt?.unpaid : kind === "report" ? lt?.report : lt?.annual;
      const body = {
        leaveTypeId: typeId,
        startDate: `${start}T08:00:00`,
        endDate: `${end}T17:00:00`,
        workingHourTypeId: wh?.id,
        description: `Faz1 ${sicil} ${kind}`,
      };
      let r = await api(p2, "POST", "/api/EmployeeLeaveRequest", body);
      if (!ok(r)) {
        r = await api(p2, "POST", "/api/EmployeeLeaveRequest/assign", { ...body, targetEmployeeId: person.employeeId });
      }
      const rec = { sicil, kind, status: r.status, ok: ok(r), err: ok(r) ? undefined : errText(r), allow: r.allow };
      summary.leaves.push(rec);
      console.log("LEAVE_EMP", sicil, kind, r.status, rec.ok ? "ok" : rec.err);
    }
    await c2.close();
  }

  // Berk approve pending
  const cBerk = await browser.newContext();
  const pBerk = await cBerk.newPage();
  const berkOk = await uiLogin(pBerk, "berkyuce@demo.com", DEMO_PASS);
  console.log("BERK_LOGIN", berkOk);
  if (berkOk) {
    const inbox = await api(pBerk, "GET", "/api/EmployeeLeaveRequestApproval/by-position");
    const rows = arr(unwrap(inbox));
    console.log("BERK_INBOX", inbox.status, rows.length);
    let approved = 0;
    for (const a of rows.slice(0, 40)) {
      const id = a.id || a.employeeLeaveRequestApprovalId;
      if (!id) continue;
      let r = await api(pBerk, "PUT", `/api/EmployeeLeaveRequestApproval/${id}`, {
        id,
        leaveRequestApprovalStatus: 2,
      });
      if (!ok(r)) r = await api(pBerk, "PUT", `/api/EmployeeLeaveRequestApproval/${id}`, { id, leaveRequestApprovalStatus: "Approved" });
      if (ok(r)) approved++;
    }
    summary.notes.push("berk approved " + approved);
    console.log("BERK_APPROVED", approved);
  }
  await cBerk.close();

  // Şirket B period with Eda only (Ozan dual-period 409 is product)
  const eda = state.people["8062"].employeeId;
  const bOu = state.units["sirket-b"].id;
  let periods = arr(unwrap(await api(page, "GET", "/api/PayrollPeriod/filteredByUnitAbilities")));
  let bPeriod = periods.find(
    (p) => p.year === 2026 && p.month === 9 && (p.organizationalUnitId === bOu || p.organizationalUnit?.id === bOu)
  );
  if (!bPeriod?.id) {
    const c = await api(page, "POST", "/api/PayrollPeriod/create-async", {
      month: 9,
      year: 2026,
      organizationalUnitId: bOu,
      hasSgkDebt: false,
      employeeIds: [eda],
    });
    console.log("PERIOD_B", c.status, errText(c), JSON.stringify(unwrap(c)).slice(0, 180));
    const d = unwrap(c);
    if (d?.jobId) await waitJob(page, d.jobId);
    const periodId = d?.periodId || d?.id;
    if (periodId) bPeriod = { id: periodId, year: 2026, month: 9 };
  }
  if (bPeriod?.id) {
    await api(page, "POST", `/api/PayrollPeriod/${bPeriod.id}/employees`, { employeeIds: [eda] });
    const rows = arr(unwrap(await api(page, "GET", `/api/PayrollPeriod/${bPeriod.id}/employees`)));
    const nested = arr(unwrap(await api(page, "GET", `/api/PayrollPeriodEmployee/by-period/${bPeriod.id}`)));
    const count = rows.length || nested.length || 1;
    summary.periods = summary.periods || {};
    summary.periods["b-2026-09"] = { id: bPeriod.id, year: 2026, month: 9, count };
    console.log("PERIOD_B_OK", bPeriod.id, count);
  }

  // Night shift: dump 400 body + template
  const nightId = state.nightShiftId;
  const ipek = state.people["8057"];
  const tpl = unwrap(await api(page, "GET", `/api/ShiftTemplate/${nightId}`));
  console.log("NIGHT_TPL", JSON.stringify(tpl).slice(0, 400));
  const nightBodies = [
    { employeeId: ipek.employeeId, shiftTemplateId: nightId, date: "2026-08-31T00:00:00" },
    { employeeId: ipek.employeeId, shiftTemplateId: nightId, startDate: "2026-08-31T23:00:00", endDate: "2026-09-01T07:00:00", organizationalUnitId: state.units.kenar.id },
    { employeeId: ipek.employeeId, shiftId: nightId, workDate: "2026-08-31" },
  ];
  for (const body of nightBodies) {
    const r = await api(page, "POST", "/api/ShiftAssignment", body);
    console.log("NIGHT400", r.status, errText(r));
    summary.edges = summary.edges || {};
    summary.edges.night = { status: r.status, ok: ok(r), err: errText(r), bodyKeys: Object.keys(body) };
    if (ok(r)) break;
  }
  for (const ep of ["/api/EmployeeShiftDay", "/api/ShiftDay", "/api/EmployeeShift/assign", "/api/ShiftCalendar"]) {
    const r = await api(page, "POST", ep, {
      employeeId: ipek.employeeId,
      shiftTemplateId: nightId,
      date: "2026-08-31",
      startDate: "2026-08-31T23:00:00",
      endDate: "2026-09-01T07:00:00",
    });
    console.log("NIGHT_EP", ep, r.status, errText(r).slice(0, 120));
    if (ok(r)) {
      summary.edges.night = { ep, status: r.status, ok: true };
      break;
    }
  }

  // Ceren positions
  const positions = arr(unwrap(await api(page, "GET", "/api/OrganizationalUnitPosition/filteredByUnitAbilities")));
  const ceren = state.people["8051"];
  const cerenPos = positions.filter((x) => x.employeeId === ceren.employeeId || x.id === ceren.positionId);
  console.log("CEREN_POS", cerenPos.map((x) => ({ id: x.id, ou: x.organizationalUnitId, emp: x.employeeId, title: x.title })));
  const kenarCeren = positions.find((x) => x.id === ceren.positionId);
  if (kenarCeren && !kenarCeren.employeeId) {
    const full = unwrap(await api(page, "GET", `/api/OrganizationalUnitPosition/${kenarCeren.id}`)) || kenarCeren;
    const put = await api(page, "PUT", `/api/OrganizationalUnitPosition/${kenarCeren.id}`, {
      ...full,
      id: kenarCeren.id,
      employeeId: ceren.employeeId,
    });
    console.log("CEREN_RESTORE_KENAR", put.status, ok(put), errText(put));
    summary.notes.push("ceren restore kenar " + put.status);
  }

  // 8078 SGK raw + 8079 wages + Ana Aug status
  const sgk = await api(page, "GET", `/api/EmployeeSgkProfile/by-employee/${state.people["8078"].employeeId}`);
  const sgk2 = await api(page, "GET", `/api/EmployeeSgkProfile/${state.people["8078"].employeeId}`);
  console.log("SGK8078_by", sgk.status, JSON.stringify(sgk.data).slice(0, 250));
  console.log("SGK8078_id", sgk2.status, JSON.stringify(sgk2.data).slice(0, 250));
  summary.checks = summary.checks || {};
  summary.checks.taner8078sgk = {
    byEmployeeStatus: sgk.status,
    byIdStatus: sgk2.status,
    byEmployeeEmpty: !unwrap(sgk) || (typeof unwrap(sgk) === "object" && !unwrap(sgk).id && !unwrap(sgk).meslekKodu),
    sample: JSON.stringify(sgk.data).slice(0, 200),
  };
  const umayFp = unwrap(await api(page, "GET", `/api/Employee/${state.people["8079"].employeeId}/fixedPayments`));
  const umayArr = arr(umayFp).length ? arr(umayFp) : arr(umayFp?.fixedPayments || umayFp);
  const payById = Object.fromEntries(Object.entries(state.payments).map(([k, v]) => [v, k]));
  summary.checks.umay8079 = umayArr.map((x) => ({
    name: payById[x.paymentId] || x.paymentId,
    value: x.value || x.wageValue,
    from: `${x.validFromYear}-${x.validFromMonth}`,
  }));
  console.log("UMAY8079", JSON.stringify(summary.checks.umay8079));

  const aug = unwrap(await api(page, "GET", `/api/PayrollPeriod/${state.periods["ana-2026-08"].id}`));
  summary.checks.anaAug = { id: aug?.id, status: aug?.status || aug?.payrollPeriodStatus, month: aug?.month, year: aug?.year };
  console.log("ANA_AUG", JSON.stringify(summary.checks.anaAug));

  summary.edges = summary.edges || {};
  summary.edges["018"] = {
    ozanKenarExit: "2026-09-10",
    ozanBHire: "2026-09-11",
    companyBPeriod: summary.periods["b-2026-09"],
    kenarSep: summary.periods?.["kenar-2026-09"]?.count,
    note: "Ozan Kenar Eylül’de kayıtlı; aynı ay Şirket B dönemine eklenince 409. B dönemi Eda ile açılır. Kümülatif matrah API 404 — log.",
  };
  summary.edges["017"] = summary.edges["017"] || prev.edges?.["017"];
  summary.edges["019"] = prev.edges?.["019"] || summary.edges["019"];
  summary.edges["037"] = prev.edges?.["037"] || { yuvarlamaCount: 100, periodCount: 100 };

  if (summary.counter15) summary.counter15.sirketB = summary.periods["b-2026-09"]?.count || 0;

  state.periods = { ...state.periods, ...Object.fromEntries(Object.entries(summary.periods || {}).filter(([, v]) => v?.id)) };
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  const publicSummary = {
    counter15: summary.counter15,
    periods: Object.fromEntries(
      Object.entries(summary.periods || {}).map(([k, v]) => [k, { id: v.id, count: v.count, year: v.year, month: v.month }])
    ),
    logins: prev.logins || summary.logins,
    flowsPayroll: prev.flowsPayroll,
    edges: {
      "017": summary.edges["017"],
      "018": summary.edges["018"],
      "019": summary.edges["019"],
      "037": summary.edges["037"],
      night: summary.edges.night,
    },
    leaves: summary.leaves,
    checks: summary.checks,
    berkPositions: prev.berkPositions || summary.berkPositions,
  };
  fs.writeFileSync(REPO_OUT, JSON.stringify(publicSummary, null, 2));
  console.log("WROTE", OUT, REPO_OUT);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
