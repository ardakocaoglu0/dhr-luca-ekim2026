/**
 * Faz1 follow-up: Berk flows, Ana/Kenar Eylül periods, leave/OT, login smoke, EDGE probes.
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
const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));

function unwrap(r) {
  let x = r?.data ?? r;
  for (let i = 0; i < 6; i++) {
    if (x && typeof x === "object" && !Array.isArray(x) && "data" in x) x = x.data;
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
function errText(r) {
  const e = r?.data?.error || r?.data?.title;
  const msg =
    e?.message ||
    (Array.isArray(e?.errors) ? e.errors[0] : null) ||
    (typeof e === "string" ? e : null) ||
    r?.text;
  return String(msg || r?.status || "").slice(0, 280);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const summary = { flows: {}, periods: {}, leaves: [], ot: [], logins: [], edges: {}, notes: [] };
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
        return { status: res.status, data, text: String(text).slice(0, 500) };
      },
      { method, urlPath, body }
    );
    if ((res.status === 429 || res.status === 401 || /csrf/i.test(res.text || "")) && api._a !== 6) {
      api._a = (api._a || 0) + 1;
      await sleep(2000 * api._a);
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

  const berkEmp = state.people["8001"]?.employeeId;
  const nilayPos = state.people["8002"]?.positionId;
  const edaPos = state.people["8062"]?.positionId;
  const units = state.units;
  const positions = arr(unwrap(await api(page, "GET", "/api/OrganizationalUnitPosition/filteredByUnitAbilities")));
  const berkPosAll = positions.filter((x) => x.employeeId === berkEmp);
  const berkFilled = berkPosAll.filter((x) => x.employeeId);
  console.log(
    "BERK_POS",
    berkFilled.map((x) => ({ id: x.id, ou: x.organizationalUnitId, title: x.title, emp: x.employeeId }))
  );
  summary.berkPositions = berkFilled.map((x) => ({ id: x.id, ou: x.organizationalUnitId, title: x.title }));

  // Re-attach Berk to empty Bordro Müdürü clones
  const emptyMgr = positions.filter(
    (x) => /bordro müdür/i.test(x.title || "") && !x.employeeId && Object.values(units).some((u) => u.id === x.organizationalUnitId)
  );
  for (const pos of emptyMgr) {
    const full = unwrap(await api(page, "GET", `/api/OrganizationalUnitPosition/${pos.id}`)) || pos;
    const put = await api(page, "PUT", `/api/OrganizationalUnitPosition/${pos.id}`, {
      ...full,
      id: pos.id,
      employeeId: berkEmp,
      title: full.title || "Bordro Müdürü",
      organizationalUnitId: full.organizationalUnitId || pos.organizationalUnitId,
    });
    console.log("BERK_REATTACH", pos.organizationalUnitId, put.status, ok(put), errText(put));
    summary.notes.push("berk reattach " + pos.organizationalUnitId + " " + put.status);
  }

  const positions2 = arr(unwrap(await api(page, "GET", "/api/OrganizationalUnitPosition/filteredByUnitAbilities")));
  function berkOn(ouId) {
    return (
      positions2.find((x) => x.employeeId === berkEmp && x.organizationalUnitId === ouId)?.id ||
      berkFilled.find((x) => x.organizationalUnitId === ouId)?.id ||
      berkFilled[0]?.id ||
      state.people["8001"]?.positionId
    );
  }

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

  for (const [key, ou] of Object.entries(units)) {
    if (!ou?.id) continue;
    const approver = key === "sirket-b" ? edaPos : berkOn(ou.id);
    if (!approver) continue;
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
    if (key === "kenar" && nilayPos) {
      summary.flows["kenar.UnitPayrollFlowStep"] = await resetFlow(ou.id, "UnitPayrollFlowStep", [
        { step: 1, approvalUnitPositionId: approver },
        { step: 2, approvalUnitPositionId: nilayPos },
      ]);
    } else if (key === "sirket-b") {
      summary.flows["sirket-b.UnitPayrollFlowStep"] = await resetFlow(ou.id, "UnitPayrollFlowStep", [
        { step: 1, approvalUnitPositionId: edaPos },
      ]);
    } else {
      summary.flows[`${key}.UnitPayrollFlowStep`] = await resetFlow(ou.id, "UnitPayrollFlowStep", [
        { step: 1, approvalUnitPositionId: approver },
      ]);
    }
    console.log("FLOWS", key, JSON.stringify(summary.flows[`${key}.UnitPayrollFlowStep`]));
  }

  async function disablePrevPeriodLock(ouId) {
    const cur = unwrap(await api(page, "GET", `/api/PayrollSetting/${ouId}`)) || {};
    const body = { ...cur, organizationalUnitId: ouId, requirePeriodCompletionBeforeNew: false };
    delete body.organizationalUnit;
    let r = await api(page, "PUT", `/api/PayrollSetting/${ouId}`, body);
    if (!ok(r)) r = await api(page, "PUT", "/api/PayrollSetting", body);
    console.log("PS_UNLOCK", ouId, r.status, ok(r), errText(r));
    return ok(r);
  }
  for (const key of ["ana", "kenar", "lab", "operasyon", "yuvarlama", "takvim", "blokaj", "sirket-b"]) {
    if (units[key]?.id) await disablePrevPeriodLock(units[key].id);
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
      await api(page, "POST", `/api/PayrollPeriod/${period.id}/employees`, { employeeIds: empIds });
    }
    let count = 0;
    let ids = [];
    if (period?.id) {
      for (const pth of [
        `/api/PayrollPeriod/${period.id}/employees`,
        `/api/PayrollPeriodEmployee/by-period/${period.id}`,
        `/api/PayrollPeriod/${period.id}`,
      ]) {
        const r = await api(page, "GET", pth);
        const a = arr(unwrap(r));
        const nested = arr(unwrap(r)?.employees || unwrap(r)?.periodEmployees);
        const rows = a.length ? a : nested;
        if (rows.length) {
          count = rows.length;
          ids = rows.map((x) => x.employeeNumber || x.employeeId || x.id);
          break;
        }
      }
    }
    summary.periods[tag] = { id: period?.id || null, year, month, count, ids: ids.slice(0, 40) };
    console.log("PERIOD_OK", tag, summary.periods[tag].id, "count", count);
    return period;
  }

  const anaAktif = ["8003","8004","8005","8006","8007","8008","8009","8010","8011","8012","8013","8014","8015","8016","8017"]
    .map((s) => state.people[s]?.employeeId).filter(Boolean);
  const anaPasif = ["8018", "8019"].map((s) => state.people[s]?.employeeId).filter(Boolean);
  const kenarEmp = Object.entries(state.people)
    .filter(([sicil]) => {
      const n = Number(sicil);
      return (n >= 8023 && n <= 8060) || (n >= 8064 && n <= 8077) || n === 8079 || n === 8061;
    })
    .map(([, p]) => p.employeeId);
  const yuvEmp = Object.entries(state.people)
    .filter(([sicil]) => Number(sicil) >= 8101 && Number(sicil) <= 8200)
    .map(([, p]) => p.employeeId);
  const opEmp = ["8020", "8021", "8022"].map((s) => state.people[s]?.employeeId).filter(Boolean);
  const labEmp = ["8001", "8002"].map((s) => state.people[s]?.employeeId).filter(Boolean);

  await ensurePeriod("ana-2026-09", units.ana.id, 2026, 9, anaAktif);
  await ensurePeriod("kenar-2026-09", units.kenar.id, 2026, 9, kenarEmp);
  await ensurePeriod("tak-2027-02", units.takvim.id, 2027, 2, [state.people["8063"]?.employeeId].filter(Boolean));
  await ensurePeriod("tak-2028-02", units.takvim.id, 2028, 2, [state.people["8063"]?.employeeId].filter(Boolean));
  await ensurePeriod("blok-2026-09", units.blokaj.id, 2026, 9, [state.people["8078"]?.employeeId].filter(Boolean));
  await ensurePeriod("b-2026-09", units["sirket-b"].id, 2026, 9, ["8061", "8062"].map((s) => state.people[s]?.employeeId).filter(Boolean));
  await ensurePeriod("lab-2026-09", units.lab.id, 2026, 9, labEmp);
  if (!state.periods["op-2026-09"]?.id) await ensurePeriod("op-2026-09", units.operasyon.id, 2026, 9, opEmp);
  if (!state.periods["yuv-2026-09"]?.id) await ensurePeriod("yuv-2026-09", units.yuvarlama.id, 2026, 9, yuvEmp);

  const anaSep = summary.periods["ana-2026-09"];
  const pasifInAna = (anaSep?.ids || []).filter((id) => anaPasif.includes(id) || ["8018", "8019"].includes(String(id)));
  summary.counter15 = {
    anaEylulCount: anaSep?.count || 0,
    expectedAktif: 15,
    pasifShouldBeZero: pasifInAna.length,
    labOpen: summary.periods["lab-2026-09"]?.count,
    op: summary.periods["op-2026-09"]?.count || state.periods["op-2026-09"]?.count,
    kenarSep: summary.periods["kenar-2026-09"]?.count,
    yuvarlama: summary.periods["yuv-2026-09"]?.count || state.periods["yuv-2026-09"]?.count,
  };
  console.log("COUNTER", JSON.stringify(summary.counter15));

  // Accrual + retry leaves
  const hours = arr(unwrap(await api(page, "GET", "/api/WorkingHourType/all")));
  const wh = hours.find((h) => /tam g[uü]n 09/i.test(h.name || "")) || hours[0];
  async function grant(empId, typeId, days) {
    const bodies = [
      { employeeId: empId, leaveTypeId: typeId, days, assignedDate: "2026-01-06T00:00:00", entryType: 0 },
      { employeeId: empId, leaveTypeId: typeId, days, assignedDate: "2026-01-06", entryType: "Yıllık izin hakkı" },
      { employeeId: empId, leaveTypeId: typeId, amount: days, year: 2026 },
    ];
    for (const b of bodies) {
      const r = await api(page, "POST", "/api/EmployeeLeaveAccrual", b);
      if (ok(r)) return r;
    }
    return null;
  }
  const leaveNeed = [
    ["8006", "annual", "2026-09-15", "2026-09-16"],
    ["8006", "report", "2026-09-08", "2026-09-10"],
    ["8007", "annual", "2026-09-17", "2026-09-17"],
    ["8020", "unpaid", "2026-09-08", "2026-09-10"],
    ["8021", "report", "2026-09-14", "2026-09-18"],
    ["8022", "annual", "2026-09-04", "2026-09-08"],
    ["8053", "unpaid", "2026-08-29", "2026-09-30"],
    ["8066", "report", "2026-09-22", "2026-09-24"],
  ];
  for (const [sicil, kind, start, end] of leaveNeed) {
    const row = state.people[sicil];
    const ouId = row?.unitId;
    const lt = state.leaveTypes[ouId];
    const typeId = kind === "unpaid" ? lt?.unpaid : kind === "report" ? lt?.report : lt?.annual;
    if (typeId) await grant(row.employeeId, typeId, 20);
    const body = {
      leaveTypeId: typeId,
      startDate: `${start}T08:00:00`,
      endDate: `${end}T17:00:00`,
      workingHourTypeId: wh?.id,
      description: `Faz1 retry ${sicil} ${kind}`,
      targetEmployeeId: row.employeeId,
    };
    let r = await api(page, "POST", "/api/EmployeeLeaveRequest/assign", body);
    summary.leaves.push({ sicil, kind, status: r.status, ok: ok(r), err: ok(r) ? undefined : errText(r) });
    console.log("LEAVE_RETRY", sicil, kind, r.status, ok(r) ? "ok" : errText(r));
  }

  // OT limit + TV-06 split days
  const otTypes = arr(unwrap(await api(page, "GET", "/api/OvertimeType/all")));
  const otGross = otTypes.find((t) => /hafta i[cç]i/i.test(t.name || "")) || otTypes[0];
  for (const ep of ["/api/CompanyOvertimeLimit/all", "/api/OvertimeLimit/all", `/api/OvertimeSetting/effective/${units.ana.id}`]) {
    const g = await api(page, "GET", ep);
    console.log("OT_LIMIT_GET", ep, g.status, errText(g).slice(0, 80));
    if (ok(g)) {
      const cur = unwrap(g);
      const body = Array.isArray(cur)
        ? null
        : { ...cur, organizationalUnitId: units.ana.id, dailyLimitHours: 12, maxDailyHours: 12 };
      if (body) {
        const put = await api(page, "POST", ep.replace(/\/all$/, "").replace(/\/effective\/.*/, ""), body);
        console.log("OT_LIMIT_PUT", put.status, ok(put), errText(put));
      }
    }
  }
  const otDays = [
    ["2026-09-09T08:00:00", "2026-09-09T11:00:00"],
    ["2026-09-10T08:00:00", "2026-09-10T11:00:00"],
    ["2026-09-11T08:00:00", "2026-09-11T11:00:00"],
    ["2026-09-14T08:00:00", "2026-09-14T09:00:00"],
  ];
  for (const [start, end] of otDays) {
    const r = await api(page, "POST", "/api/EmployeeOvertimeRequest/assign", {
      title: "TV-06 brüt parça",
      description: "TV-06 10s brüt (günlük limit 3s, parçalı)",
      startDate: start,
      endDate: end,
      targetEmployeeId: state.people["8008"].employeeId,
      overtimeTypeId: otGross?.id,
      compensationMode: 0,
    });
    summary.ot.push({ start, status: r.status, ok: ok(r), err: ok(r) ? undefined : errText(r) });
    console.log("OT8008", start.slice(0, 10), r.status, ok(r) ? "ok" : errText(r));
  }
  await api(page, "POST", "/api/PaymentValue", {
    paymentId: state.payments["Fazla Mesai"],
    employeeId: state.people["8008"].employeeId,
    value: 10,
    date: "2026-09-15",
    description: "HSP-007 brüt 10 saat kalemi",
  });

  // EDGE-017 Ceren workplace: copy SGK history if API exists
  const ceren = state.people["8051"];
  for (const ep of [
    "/api/EmployeeSgkWorkplace",
    "/api/EmployeeWorkplace",
    `/api/Employee/${ceren.employeeId}/sgk-workplaces`,
  ]) {
    const r = await api(page, "POST", ep, {
      employeeId: ceren.employeeId,
      organizationalUnitId: units.sube?.id || units["sirket-b"].id,
      startDate: "2026-09-11",
      endDate: "2026-09-30",
    });
    summary.edges["017"] = { ep, status: r.status, ok: ok(r), err: errText(r) };
    console.log("EDGE017", ep, r.status, errText(r));
    if (ok(r) || r.status !== 404) break;
  }
  summary.edges["018"] = {
    ozanKenarExit: "2026-09-10",
    ozanBHire: "2026-09-11",
    companyBPositionId: state.people["8061"]?.companyBPositionId || null,
    note: "İki işveren kadrosu seed’de; kümülatif matrah API yoksa log",
  };
  summary.edges["019"] = {
    feb2027: summary.periods["tak-2027-02"],
    feb2028: summary.periods["tak-2028-02"],
  };
  summary.edges["037"] = {
    yuvarlamaCount: yuvEmp.length,
    period: summary.periods["yuv-2026-09"] || state.periods["yuv-2026-09"],
  };

  // Login smoke
  const samples = [
    { label: "ik", email: "serrabindal@demo.com" },
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
    if (okLogin) {
      const r = await api(p2, "GET", "/api/Employee/my");
      me = unwrap(r);
    }
    summary.logins.push({
      label: s.label,
      email: s.email,
      ok: okLogin,
      number: me?.employeeNumber,
      name: me ? `${me.firstName} ${me.lastName}` : null,
    });
    console.log("LOGIN", s.email, okLogin, me?.employeeNumber);
    await c2.close();
  }

  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  const repoOut = path.join(__dirname, "..", "scripts", "faz1_verify_summary.json");
  const publicSummary = {
    counter15: summary.counter15,
    periods: Object.fromEntries(
      Object.entries(summary.periods).map(([k, v]) => [k, { id: v.id, count: v.count, year: v.year, month: v.month }])
    ),
    logins: summary.logins,
    edges: {
      "017": { status: summary.edges["017"]?.status, err: summary.edges["017"]?.err },
      "018": summary.edges["018"],
      "019": {
        feb2027: summary.edges["019"]?.feb2027?.count,
        feb2028: summary.edges["019"]?.feb2028?.count,
        ids: { feb2027: summary.edges["019"]?.feb2027?.id, feb2028: summary.edges["019"]?.feb2028?.id },
      },
      "037": { yuvarlamaCount: summary.edges["037"]?.yuvarlamaCount, periodCount: summary.edges["037"]?.period?.count },
    },
    leaveRetries: summary.leaves,
    ot8008: summary.ot,
  };
  fs.writeFileSync(repoOut, JSON.stringify(publicSummary, null, 2));
  console.log("WROTE", OUT, repoOut);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
