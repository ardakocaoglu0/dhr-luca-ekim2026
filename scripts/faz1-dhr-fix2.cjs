/**
 * Faz1 closer: Berk on Lab only + cross-unit flows, Şirket B period,
 * leaves via EmployeeLeaveRequest (not /assign), EDGE-017 şube pos,
 * night shift, 8003/8078 checks, login smoke.
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
  const e = r?.data?.error || r?.data?.title;
  const msg =
    e?.message ||
    (Array.isArray(e?.errors) ? e.errors[0] : null) ||
    (typeof e === "string" ? e : null) ||
    r?.text;
  return String(msg || r?.status || "").slice(0, 320);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function personName(me) {
  if (!me || typeof me !== "object") return null;
  const e = me.employee || me;
  const fn = e.firstName || e.name || me.fullName;
  const ln = e.lastName || "";
  const s = `${fn || ""} ${ln}`.trim();
  return s && s !== "undefined undefined" ? s : me.email || me.userName || null;
}

(async () => {
  const summary = {
    flows: {},
    periods: {},
    leaves: [],
    logins: [],
    edges: {},
    notes: [],
    checks: {},
    swaggerHits: [],
  };
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
    const res = await p.evaluate(
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
        return { status: res.status, data, text: String(text).slice(0, 600) };
      },
      { method, urlPath, body }
    );
    if ((res.status === 429 || res.status === 401 || /csrf/i.test(res.text || "")) && api._a !== 5) {
      api._a = (api._a || 0) + 1;
      await sleep(1500 * api._a);
      const out = await api(p, method, urlPath, body);
      api._a = 0;
      return out;
    }
    api._a = 0;
    return res;
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

  const units = state.units;
  const berkEmp = state.people["8001"].employeeId;
  const labBerkPos = state.people["8001"].positionId;
  const nilayPos = state.people["8002"].positionId;
  const edaPos = state.people["8062"].positionId;
  const faz1Ou = new Set(Object.values(units).map((u) => u.id));

  // Swagger path probe (leave/shift/workplace/period/overtime/arge)
  let swaggerPaths = [];
  for (const u of ["/swagger/v1/swagger.json", "/swagger/v1/swagger.yaml"]) {
    const r = await api(page, "GET", u);
    if (ok(r) && r.data?.paths) {
      swaggerPaths = Object.keys(r.data.paths);
      break;
    }
  }
  const interesting = /leave|shift|workplace|sgk|overtime|accrual|payrollperiod|rdcenter|arge|research|cumulative|incentive/i;
  summary.swaggerHits = swaggerPaths.filter((p) => interesting.test(p)).slice(0, 120);
  console.log("SWAGGER_HITS", summary.swaggerHits.length);

  let positions = arr(unwrap(await api(page, "GET", "/api/OrganizationalUnitPosition/filteredByUnitAbilities")));

  async function putPos(pos, patch) {
    const full = unwrap(await api(page, "GET", `/api/OrganizationalUnitPosition/${pos.id}`)) || pos;
    const body = { ...full, ...patch, id: pos.id };
    delete body.organizationalUnit;
    delete body.employee;
    delete body.hrManagerPosition;
    delete body.directManagerPosition;
    return api(page, "PUT", `/api/OrganizationalUnitPosition/${pos.id}`, body);
  }

  // Pin Berk to Lab; clear clones (one employee = one filled position)
  const clones = positions.filter(
    (x) =>
      /bordro müdür/i.test(x.title || "") &&
      faz1Ou.has(x.organizationalUnitId) &&
      x.id !== labBerkPos
  );
  for (const pos of clones) {
    if (pos.employeeId) {
      const r = await putPos(pos, { employeeId: null });
      console.log("BERK_CLEAR", pos.organizationalUnitId, r.status, ok(r), errText(r));
      summary.notes.push("clear clone " + pos.id + " " + r.status);
    }
  }
  const labPos = positions.find((x) => x.id === labBerkPos) || { id: labBerkPos, organizationalUnitId: units.lab.id };
  const pin = await putPos(labPos, { employeeId: berkEmp, isTerminated: false, endDate: null });
  console.log("BERK_PIN_LAB", pin.status, ok(pin), errText(pin));
  summary.notes.push("pin lab " + pin.status);

  positions = arr(unwrap(await api(page, "GET", "/api/OrganizationalUnitPosition/filteredByUnitAbilities")));
  const berkNow = positions.filter((x) => x.employeeId === berkEmp);
  console.log(
    "BERK_NOW",
    berkNow.map((x) => ({ id: x.id, ou: x.organizationalUnitId, title: x.title }))
  );
  summary.berkPositions = berkNow.map((x) => ({ id: x.id, ou: x.organizationalUnitId, title: x.title }));
  const berkFilledId = berkNow[0]?.id || labBerkPos;

  async function resetFlow(ouId, pathName, bodies) {
    let list = arr(unwrap(await api(page, "GET", `/api/${pathName}/ownerOrganizationalUnit/${ouId}`)));
    if (!list.length) list = arr(unwrap(await api(page, "GET", `/api/${pathName}/by-unit/${ouId}`)));
    for (const st of list) if (st.id) await api(page, "DELETE", `/api/${pathName}/${st.id}`);
    const out = [];
    for (const b of bodies) {
      const r = await api(page, "POST", `/api/${pathName}`, { ...b, ownerOrganizationalUnitId: ouId });
      out.push({ ok: ok(r), status: r.status, err: ok(r) ? undefined : errText(r) });
    }
    return out;
  }

  const flowUnits = ["lab", "ana", "operasyon", "kenar", "yuvarlama", "takvim", "blokaj"];
  for (const key of flowUnits) {
    const ou = units[key];
    if (!ou?.id) continue;
    const approver = berkFilledId;
    const kinds = [
      ["UnitLeaveFlowStep", [{ step: 1, approvalUnitPositionId: approver }]],
      ["UnitOvertimeFlowStep", [{ step: 1, approvalUnitPositionId: approver }]],
      ["UnitAdvanceFlowStep", [{ step: 1, approvalUnitPositionId: approver }]],
      ["UnitPaymentFlowStep", [{ step: 1, approvalUnitPositionId: approver }]],
      ["UnitDocumentFlowStep", [{ approvalUnitPositionId: approver }]],
    ];
    for (const [kind, bodies] of kinds) {
      summary.flows[`${key}.${kind}`] = await resetFlow(ou.id, kind, bodies);
    }
    if (key === "kenar") {
      summary.flows["kenar.UnitPayrollFlowStep"] = await resetFlow(ou.id, "UnitPayrollFlowStep", [
        { step: 1, approvalUnitPositionId: approver },
        { step: 2, approvalUnitPositionId: nilayPos },
      ]);
    } else {
      summary.flows[`${key}.UnitPayrollFlowStep`] = await resetFlow(ou.id, "UnitPayrollFlowStep", [
        { step: 1, approvalUnitPositionId: approver },
      ]);
    }
    console.log("FLOWS", key, JSON.stringify(summary.flows[`${key}.UnitPayrollFlowStep`]));
  }
  if (units["sirket-b"]?.id && edaPos) {
    for (const [kind, bodies] of [
      ["UnitLeaveFlowStep", [{ step: 1, approvalUnitPositionId: edaPos }]],
      ["UnitOvertimeFlowStep", [{ step: 1, approvalUnitPositionId: edaPos }]],
      ["UnitAdvanceFlowStep", [{ step: 1, approvalUnitPositionId: edaPos }]],
      ["UnitPaymentFlowStep", [{ step: 1, approvalUnitPositionId: edaPos }]],
      ["UnitDocumentFlowStep", [{ approvalUnitPositionId: edaPos }]],
      ["UnitPayrollFlowStep", [{ step: 1, approvalUnitPositionId: edaPos }]],
    ]) {
      summary.flows[`sirket-b.${kind}`] = await resetFlow(units["sirket-b"].id, kind, bodies);
    }
    console.log("FLOWS sirket-b", JSON.stringify(summary.flows["sirket-b.UnitPayrollFlowStep"]));
  }

  async function periodEmployees(periodId) {
    if (!periodId) return [];
    for (const pth of [
      `/api/PayrollPeriod/${periodId}/employees`,
      `/api/PayrollPeriodEmployee/by-period/${periodId}`,
      `/api/PayrollPeriod/${periodId}`,
    ]) {
      const r = await api(page, "GET", pth);
      const nested = unwrap(r);
      const rows = arr(nested).length ? arr(nested) : arr(nested?.employees || nested?.periodEmployees);
      if (rows.length) return rows;
    }
    return [];
  }

  async function countPeriod(periodId) {
    return (await periodEmployees(periodId)).length;
  }

  // EDGE-018: Ozan out of Kenar Sep → Şirket B Sep
  const ozan = state.people["8061"];
  const kenarSepId = "12f9269c-a37b-4cb8-a18a-5f65c9cd1ada";
  const kenarPos = positions.find((x) => x.id === ozan.positionId);
  if (kenarPos) {
    const t = await putPos(kenarPos, {
      endDate: "2026-09-10",
      isTerminated: true,
      employeeId: ozan.employeeId,
    });
    console.log("OZAN_KENAR_EXIT", t.status, ok(t), errText(t));
    summary.notes.push("ozan kenar exit " + t.status);
  }
  const bPosId = ozan.companyBPositionId;
  if (bPosId) {
    const bp = positions.find((x) => x.id === bPosId) || { id: bPosId };
    const t = await putPos(bp, {
      startDate: "2026-09-11",
      endDate: null,
      isTerminated: false,
      employeeId: ozan.employeeId,
    });
    console.log("OZAN_B_HIRE", t.status, ok(t), errText(t));
    summary.notes.push("ozan B hire " + t.status);
  }

  const kenarRows = await periodEmployees(kenarSepId);
  const ozanRow = kenarRows.find(
    (x) => x.employeeId === ozan.employeeId || x.id === ozan.employeeId || x.employeeNumber === "8061"
  );
  const ozanPeriodEmpId = ozanRow?.id || ozanRow?.payrollPeriodEmployeeId;
  const removeTries = [
    ["DELETE", `/api/PayrollPeriod/${kenarSepId}/employees/${ozan.employeeId}`, undefined],
    ["POST", `/api/PayrollPeriod/${kenarSepId}/remove-employees`, { employeeIds: [ozan.employeeId] }],
    ["POST", `/api/PayrollPeriod/${kenarSepId}/employees/remove`, { employeeIds: [ozan.employeeId] }],
    ozanPeriodEmpId ? ["DELETE", `/api/PayrollPeriodEmployee/${ozanPeriodEmpId}`, undefined] : null,
  ].filter(Boolean);
  for (const [m, u, b] of removeTries) {
    const r = await api(page, m, u, b);
    console.log("OZAN_REMOVE", m, u, r.status, errText(r));
    summary.notes.push(`ozan remove ${m} ${r.status}`);
    if (ok(r) || r.status === 204) break;
  }

  async function ensurePeriod(tag, ouId, year, month, empIds) {
    let periods = arr(unwrap(await api(page, "GET", "/api/PayrollPeriod/filteredByUnitAbilities")));
    let period = periods.find(
      (p) => p.year === year && p.month === month && (p.organizationalUnitId === ouId || p.organizationalUnit?.id === ouId)
    );
    if (!period?.id) {
      const c = await api(page, "POST", "/api/PayrollPeriod/create-async", {
        month,
        year,
        organizationalUnitId: ouId,
        hasSgkDebt: false,
        employeeIds: empIds,
      });
      const d = unwrap(c);
      console.log("PERIOD", tag, c.status, JSON.stringify(d).slice(0, 180), errText(c));
      if (d?.jobId) await waitJob(page, d.jobId);
      const periodId = d?.periodId || d?.id;
      if (periodId) period = unwrap(await api(page, "GET", `/api/PayrollPeriod/${periodId}`)) || { id: periodId };
      else {
        periods = arr(unwrap(await api(page, "GET", "/api/PayrollPeriod/filteredByUnitAbilities")));
        period = periods.find(
          (p) => p.year === year && p.month === month && (p.organizationalUnitId === ouId || p.organizationalUnit?.id === ouId)
        );
      }
    }
    if (period?.id && empIds.length) {
      const add = await api(page, "POST", `/api/PayrollPeriod/${period.id}/employees`, { employeeIds: empIds });
      console.log("PERIOD_ADD", tag, add.status, ok(add) ? "ok" : errText(add));
    }
    const rows = period?.id ? await periodEmployees(period.id) : [];
    summary.periods[tag] = {
      id: period?.id || null,
      year,
      month,
      count: rows.length,
      ids: rows.map((x) => x.employeeNumber || x.employeeId || x.id).slice(0, 40),
    };
    console.log("PERIOD_OK", tag, summary.periods[tag].id, "count", summary.periods[tag].count);
    return period;
  }

  const bEmp = ["8062", "8061"].map((s) => state.people[s]?.employeeId).filter(Boolean);
  await ensurePeriod("b-2026-09", units["sirket-b"].id, 2026, 9, bEmp);

  // Refresh known period counts
  const known = {
    "ana-2026-09": { id: "fe993870-b937-4756-8097-58b358f16a8e", year: 2026, month: 9 },
    "kenar-2026-09": { id: kenarSepId, year: 2026, month: 9 },
    "tak-2027-02": { id: "44cbd9c8-a0a5-4649-b1a1-80cafe08ef8b", year: 2027, month: 2 },
    "tak-2028-02": { id: "100ab975-d4ee-4184-a950-8cb342136194", year: 2028, month: 2 },
    "blok-2026-09": { id: "dfdb61b0-766b-4664-870b-8dcf74d2e35c", year: 2026, month: 9 },
    "lab-2026-09": { id: "f3a13bd6-739f-4c9d-a883-e2fdf720e787", year: 2026, month: 9 },
    "op-2026-09": { id: state.periods["op-2026-09"]?.id, year: 2026, month: 9 },
    "yuv-2026-09": { id: state.periods["yuv-2026-09"]?.id, year: 2026, month: 9 },
    "ana-2026-08": { id: state.periods["ana-2026-08"]?.id, year: 2026, month: 8 },
  };
  for (const [tag, meta] of Object.entries(known)) {
    if (!meta.id) continue;
    if (summary.periods[tag]?.id) continue;
    const rows = await periodEmployees(meta.id);
    summary.periods[tag] = {
      id: meta.id,
      year: meta.year,
      month: meta.month,
      count: rows.length,
      ids: rows.map((x) => x.employeeNumber || x.employeeId || x.id).slice(0, 40),
    };
  }

  const anaSep = summary.periods["ana-2026-09"];
  const anaPasif = ["8018", "8019"].map((s) => state.people[s]?.employeeId);
  const pasifInAna = (anaSep?.ids || []).filter((id) => anaPasif.includes(id) || ["8018", "8019"].includes(String(id)));
  summary.counter15 = {
    anaEylulCount: anaSep?.count || 0,
    expectedAktif: 15,
    pasifShouldBeZero: pasifInAna.length,
    labOpen: summary.periods["lab-2026-09"]?.count,
    op: summary.periods["op-2026-09"]?.count,
    kenarSep: summary.periods["kenar-2026-09"]?.count,
    yuvarlama: summary.periods["yuv-2026-09"]?.count,
    sirketB: summary.periods["b-2026-09"]?.count,
  };
  console.log("COUNTER", JSON.stringify(summary.counter15));

  // Leaves: cancel blocking Babalık if on target; grant accrual; POST EmployeeLeaveRequest
  const hours = arr(unwrap(await api(page, "GET", "/api/WorkingHourType/all")));
  const wh = hours.find((h) => /tam g[uü]n 09/i.test(h.name || "")) || hours[0];

  async function listLeaves(empId) {
    const paths = [
      `/api/EmployeeLeaveRequest/employee/${empId}/paged?status=all&page=1&pageSize=50`,
      `/api/EmployeeLeaveRequest/by-employee/${empId}`,
      `/api/Employee/${empId}/leave-requests`,
      `/api/EmployeeLeaveRequest/employee/${empId}`,
    ];
    for (const pth of paths) {
      const r = await api(page, "GET", pth);
      const rows = arr(unwrap(r));
      if (rows.length || (ok(r) && r.status !== 404)) return { path: pth, rows, status: r.status };
    }
    return { path: null, rows: [], status: 404 };
  }

  async function cancelLeave(id) {
    for (const [m, u, b] of [
      ["DELETE", `/api/EmployeeLeaveRequest/${id}`, undefined],
      ["PUT", `/api/EmployeeLeaveRequest/${id}/cancel`, {}],
      ["POST", `/api/EmployeeLeaveRequest/${id}/cancel`, {}],
    ]) {
      const r = await api(page, m, u, b);
      if (ok(r) || r.status === 204) return r;
    }
    return null;
  }

  async function grant(empId, typeId, days) {
    const bodies = [
      { employeeId: empId, leaveTypeId: typeId, days, year: 2026 },
      { employeeId: empId, leaveTypeId: typeId, days, assignedDate: "2026-01-06T00:00:00", year: 2026 },
      { employeeId: empId, leaveTypeId: typeId, days, assignedDate: "2026-01-06", entryType: 0 },
    ];
    for (const b of bodies) {
      const r = await api(page, "POST", "/api/EmployeeLeaveAccrual", b);
      if (ok(r)) return r;
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

  for (const [sicil, kind, start, end] of leaveNeed) {
    const row = state.people[sicil];
    const ouId = row?.unitId;
    const lt = state.leaveTypes[ouId];
    const typeId = kind === "unpaid" ? lt?.unpaid : kind === "report" ? lt?.report : lt?.annual;
    const listed = await listLeaves(row.employeeId);
    for (const lv of listed.rows) {
      const name = String(lv.leaveTypeName || lv.leaveType?.name || "");
      if (/babalık/i.test(name)) {
        const c = await cancelLeave(lv.id);
        console.log("CANCEL_BABALIK", sicil, lv.id, c?.status);
      }
    }
    if (typeId) await grant(row.employeeId, typeId, 20);
    const body = {
      leaveTypeId: typeId,
      startDate: `${start}T08:00:00`,
      endDate: `${end}T17:00:00`,
      workingHourTypeId: wh?.id,
      description: `Faz1 ${sicil} ${kind}`,
      employeeId: row.employeeId,
      targetEmployeeId: row.employeeId,
    };
    let r = await api(page, "POST", "/api/EmployeeLeaveRequest", body);
    if (!ok(r)) r = await api(page, "POST", "/api/EmployeeLeaveRequest/for-employee", body);
    if (!ok(r)) r = await api(page, "POST", "/api/EmployeeLeaveRequest/assign", body);
    const rec = { sicil, kind, status: r.status, ok: ok(r), err: ok(r) ? undefined : errText(r) };
    summary.leaves.push(rec);
    console.log("LEAVE", sicil, kind, r.status, rec.ok ? "ok" : rec.err);
  }

  // Night shift 8057
  const nightId = state.nightShiftId;
  const ipek = state.people["8057"];
  if (nightId && ipek) {
    const payloads = [
      ["/api/ShiftAssignment", { employeeId: ipek.employeeId, shiftTemplateId: nightId, startDate: "2026-08-31", endDate: "2026-09-01" }],
      ["/api/EmployeeShiftAssignment", { employeeId: ipek.employeeId, shiftTemplateId: nightId, date: "2026-08-31" }],
      [
        "/api/EmployeeShift",
        {
          employeeId: ipek.employeeId,
          shiftTemplateId: nightId,
          startDate: "2026-08-31T23:00:00",
          endDate: "2026-09-01T07:00:00",
        },
      ],
    ];
    for (const [ep, body] of payloads) {
      const r = await api(page, "POST", ep, body);
      console.log("NIGHT", ep, r.status, errText(r));
      summary.edges.night = { ep, status: r.status, ok: ok(r), err: errText(r) };
      if (ok(r) || r.status !== 404) break;
    }
  }

  // EDGE-017: Ceren extra position on D1-Tech Şube 11–30
  const ceren = state.people["8051"];
  const subeId = units.sube?.id;
  if (ceren && subeId) {
    const already = positions.find(
      (x) => x.employeeId === ceren.employeeId && x.organizationalUnitId === subeId
    );
    if (!already) {
      const rs = state.roles[subeId] || state.roles[units.kenar.id] || {};
      const cr = await api(page, "POST", "/api/OrganizationalUnitPosition", {
        title: "Kenar Uzmanı (Şube)",
        organizationalUnitId: subeId,
        employeeId: ceren.employeeId,
        roleId: rs.calisan || rs.yonetici,
        workingHourTypeId: wh?.id ? JSON.stringify([wh.id]) : undefined,
        employmentType: "Full-time",
        startDate: "2026-09-11",
        endDate: "2026-09-30",
        reminderEnabled: false,
        isTerminated: false,
      });
      console.log("CEREN_SUBE", cr.status, ok(cr) ? unwrap(cr)?.id : errText(cr));
      summary.edges["017"] = { status: cr.status, ok: ok(cr), id: unwrap(cr)?.id, err: ok(cr) ? undefined : errText(cr), note: "Şube pozisyon 11–30.09" };
    } else {
      summary.edges["017"] = { status: 200, ok: true, id: already.id, note: "Şube pozisyon mevcut" };
    }
  }

  // Cumulative tax probe EDGE-018
  for (const ep of [
    "/api/EmployeeCumulativeTaxBase",
    "/api/CumulativeTaxBase",
    `/api/Employee/${ozan.employeeId}/cumulative-tax-base`,
  ]) {
    const r = await api(page, "POST", ep, {
      employeeId: ozan.employeeId,
      year: 2026,
      month: 9,
      value: 1,
      amount: 1,
    });
    summary.edges.cumulativeTax = { ep, status: r.status, err: errText(r) };
    console.log("CUMTAX", ep, r.status, errText(r));
    if (ok(r) || r.status !== 404) break;
  }

  // 8003 no zam/ikramiye/BES; 8078 no SGK
  const ekin = state.people["8003"];
  const fps = unwrap(await api(page, "GET", `/api/Employee/${ekin.employeeId}/fixedPayments`)) || [];
  const fpArr = arr(fps).length ? arr(fps) : arr(fps?.fixedPayments || fps);
  const payById = Object.fromEntries(Object.entries(state.payments).map(([k, v]) => [v, k]));
  const ekinPays = fpArr.map((x) => ({
    name: payById[x.paymentId] || x.paymentName || x.paymentId,
    value: x.value || x.wageValue,
    from: `${x.validFromYear}-${x.validFromMonth}`,
  }));
  summary.checks.ekin8003 = {
    payments: ekinPays,
    hasIkramiye: ekinPays.some((p) => /ikramiye/i.test(p.name || "")),
    hasBes: ekinPays.some((p) => /bes/i.test(p.name || "")),
    maasValues: ekinPays.filter((p) => /temel|maaş|maas/i.test(p.name || "")).map((p) => p.value),
  };
  const tanerSgk = await api(page, "GET", `/api/EmployeeSgkProfile/${state.people["8078"].employeeId}`);
  const tanerSgk2 = tanerSgk.status === 404 ? await api(page, "GET", `/api/EmployeeSgkProfile/by-employee/${state.people["8078"].employeeId}`) : tanerSgk;
  summary.checks.taner8078sgk = { status: tanerSgk2.status, ok: ok(tanerSgk2), err: errText(tanerSgk2) };
  console.log("CHECK_8003", JSON.stringify(summary.checks.ekin8003));
  console.log("CHECK_8078", JSON.stringify(summary.checks.taner8078sgk));

  summary.edges["018"] = {
    ozanKenarExit: "2026-09-10",
    ozanBHire: "2026-09-11",
    companyBPeriod: summary.periods["b-2026-09"],
    kenarSep: summary.periods["kenar-2026-09"]?.count,
    cumulativeTax: summary.edges.cumulativeTax,
    note: "İki işveren: Kenar çıkış 10.09, B giriş 11.09. Aynı ay iki dönem 409 ise log.",
  };
  summary.edges["019"] = {
    feb2027: summary.periods["tak-2027-02"],
    feb2028: summary.periods["tak-2028-02"],
  };
  summary.edges["037"] = {
    yuvarlamaCount: 100,
    period: summary.periods["yuv-2026-09"] || state.periods["yuv-2026-09"],
  };

  // Logins
  const samples = [
    { label: "ik", email: "serrabindal@demo.com" },
    { label: "lab-berk", email: "berkyuce@demo.com" },
    { label: "ana", email: "ekinsari@demo.com" },
    { label: "yuv", email: "yuvarlama01@demo.com" },
    { label: "sirket-b", email: "edamert@demo.com" },
    { label: "kenar", email: "vildanferhat@demo.com" },
  ];
  for (const s of samples) {
    const c2 = await browser.newContext();
    const p2 = await c2.newPage();
    const okLogin = await uiLogin(p2, s.email, DEMO_PASS);
    let me = null;
    let number = null;
    if (okLogin) {
      const r = await api(p2, "GET", "/api/Employee/my");
      me = unwrap(r);
      number = me?.employeeNumber || me?.employee?.employeeNumber;
      if (!number) {
        const r2 = await api(p2, "GET", "/api/Auth/me");
        me = unwrap(r2) || me;
        number = me?.employeeNumber || me?.employee?.employeeNumber;
      }
    }
    summary.logins.push({
      label: s.label,
      email: s.email,
      ok: okLogin,
      number,
      name: personName(me),
    });
    console.log("LOGIN", s.email, okLogin, number, personName(me));
    await c2.close();
  }

  // Persist period ids into seed state
  state.periods = { ...state.periods };
  for (const [k, v] of Object.entries(summary.periods)) {
    if (v?.id) state.periods[k] = { id: v.id, year: v.year, month: v.month, count: v.count };
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  const publicSummary = {
    counter15: summary.counter15,
    periods: Object.fromEntries(
      Object.entries(summary.periods).map(([k, v]) => [k, { id: v.id, count: v.count, year: v.year, month: v.month }])
    ),
    logins: summary.logins,
    flowsPayroll: Object.fromEntries(
      Object.entries(summary.flows)
        .filter(([k]) => /PayrollFlowStep$/.test(k))
        .map(([k, v]) => [k, v])
    ),
    edges: {
      "017": summary.edges["017"],
      "018": {
        ozanKenarExit: summary.edges["018"]?.ozanKenarExit,
        ozanBHire: summary.edges["018"]?.ozanBHire,
        companyBCount: summary.edges["018"]?.companyBPeriod?.count,
        kenarSep: summary.edges["018"]?.kenarSep,
        cumulativeTaxStatus: summary.edges["018"]?.cumulativeTax?.status,
        note: summary.edges["018"]?.note,
      },
      "019": {
        feb2027: summary.edges["019"]?.feb2027?.count,
        feb2028: summary.edges["019"]?.feb2028?.count,
        ids: { feb2027: summary.edges["019"]?.feb2027?.id, feb2028: summary.edges["019"]?.feb2028?.id },
      },
      "037": { yuvarlamaCount: 100, periodCount: summary.edges["037"]?.period?.count },
      night: summary.edges.night,
    },
    leaves: summary.leaves,
    checks: summary.checks,
    berkPositions: summary.berkPositions,
  };
  fs.writeFileSync(REPO_OUT, JSON.stringify(publicSummary, null, 2));
  console.log("WROTE", OUT, REPO_OUT);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
