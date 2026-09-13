/**
 * Swagger-backed retries (EDGE-017/018/024, kümülatif GV, Ar-Ge yok)
 * + 2026-01 … missing months payroll periods.
 * Source of truth: Desktop/swager.json
 *
 * Never PUT/DELETE existing D1-Tech kanun/PEK/GV.
 * Never touch IK 6101–6132, BT, Sude.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const DEMO_PASS = "Bordro123!";
if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}

const STATE_PATH = path.join(process.env.TEMP, "faz1_seed_state.json");
const OUT = path.join(process.env.TEMP, "faz1_jan_gaps.json");
const REPO_OUT = path.join(__dirname, "faz1_verify_summary.json");
const ROSTER = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "faz1_roster.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));

const IK = "6e473120-9b10-48d1-81df-08b4f798e4dd";
const BT = "c358d645-00b6-4a78-b0e1-e1aad87e4df2";
const EXISTING_OP = "a0670870-911b-468c-8ab9-63b85e40e1cf";
const PROTECTED = new Set([IK, BT, EXISTING_OP]);

function unwrap(r) {
  let x = r?.data ?? r;
  for (let i = 0; i < 12; i++) {
    if (x && typeof x === "object" && !Array.isArray(x) && "data" in x && !Array.isArray(x.employees)) x = x.data;
    else break;
  }
  return x;
}
function arr(x) {
  if (Array.isArray(x)) return x;
  if (x?.items) return x.items;
  if (x?.results) return x.results;
  if (x?.employees) return x.employees;
  if (x?.periodEmployees) return x.periodEmployees;
  if (x?.value && Array.isArray(x.value)) return x.value;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && !r.data?.error;
}
function errText(r) {
  const e = r?.data?.error || r?.data?.title;
  return String(e?.message || (Array.isArray(e?.errors) ? e.errors[0] : JSON.stringify(e?.errors || r?.text || r?.status) || "")).slice(0, 320);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function lastDay(y, m) {
  return new Date(y, m, 0).getDate();
}
function overlaps(start, end, from, to) {
  if (start && start > to) return false;
  if (end && end < from) return false;
  return true;
}
function inKenarMonth(p, y, m) {
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay(y, m)).padStart(2, "0")}`;
  const first = overlaps(p.hire || "2026-01-06", p.exit, from, to);
  const second = p.rehire ? overlaps(p.rehire, null, from, to) : false;
  return first || second;
}
function saveState() {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

(async () => {
  const report = { swagger: {}, periods: {}, retries: {}, notes: [] };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  async function uiLogin(p, email, password) {
    await p.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
    await p.waitForSelector("#login_email", { timeout: 30000 });
    await p.fill("#login_email", email);
    await p.fill("#login_password", password);
    await p.getByRole("button", { name: /Giri/i }).click();
    for (let i = 0; i < 90 && p.url().includes("/login"); i++) await p.waitForTimeout(400);
    return !p.url().includes("/login");
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
        return { status: res.status, data, text: String(text).slice(0, 1200) };
      },
      { method, urlPath, body }
    );
  }
  async function waitJob(jobId, maxMs = 300000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const r = await api("GET", `/api/background-jobs/${jobId}`);
      const last = unwrap(r);
      if ([2, 3, 4, 5].includes(last?.jobStatus)) return last;
      await sleep(2500);
    }
    return null;
  }
  function deepEmployees(x) {
    const seen = new Set();
    const walk = (n, d) => {
      if (!n || d > 8) return [];
      if (typeof n === "object") {
        if (seen.has(n)) return [];
        seen.add(n);
      }
      if (Array.isArray(n) && n[0] && (n[0].employeeNumber || n[0].employee?.employeeNumber || n[0].employeeId || n[0].periodEmployeeId)) return n;
      if (n.employees) return walk(n.employees, d + 1);
      if (n.periodEmployees) return walk(n.periodEmployees, d + 1);
      if (n.items) return walk(n.items, d + 1);
      if (n.data) return walk(n.data, d + 1);
      return [];
    };
    return walk(x, 0);
  }
  function findPersonRow(rows, employeeId, sicil) {
    return (rows || []).find((x) => {
      const num = x.employee?.employeeNumber || x.employeeNumber;
      const eid = x.employeeId || x.employee?.id || x.employee?.employeeId;
      return eid === employeeId || String(num) === sicil;
    });
  }
  function periodEmployeeId(row) {
    if (!row) return null;
    return row.periodEmployeeId || row.payrollPeriodEmployeeId || row.periodEmployee?.id || row.id;
  }

  if (!(await uiLogin(page, "arda.kocaoglu@d1-tech.com", ADMIN_PASS))) throw new Error("admin login fail");
  console.log("ADMIN OK");

  const units = state.units;
  const ozan = state.people["8061"];
  const ceren = state.people["8051"];
  const feriha = state.people["8066"];
  const kenarSepId = state.periods["kenar-2026-09"]?.id || "12f9269c-a37b-4cb8-a18a-5f65c9cd1ada";
  const bSepId = state.periods["b-2026-09"]?.id || "0fbc3cbc-687a-4640-b386-514fa3d9555c";

  // ---------- EDGE-018: swagger DELETE ----------
  console.log("PHASE EDGE-018");
  const kenarGet = await api("GET", `/api/PayrollPeriod/${kenarSepId}`);
  const kenarRows = deepEmployees(kenarGet.data);
  const ozanNested = findPersonRow(kenarRows, ozan.employeeId, "8061");
  console.log("KENAR_ROWS", kenarRows.length, "ozanNested", ozanNested ? Object.keys(ozanNested).join(",") : "none", "id", ozanNested?.id);

  const summary = await api("GET", `/api/PayrollPeriod/${kenarSepId}/employee-summary`);
  const sumRows = deepEmployees(summary.data);
  const ozanSum = findPersonRow(sumRows, ozan.employeeId, "8061");
  console.log("SUMMARY", summary.status, sumRows.length, ozanSum ? Object.keys(ozanSum).join(",") : "none", errText(summary).slice(0, 80));

  const att = await api("GET", `/api/PayrollPeriod/${kenarSepId}/attendance-page?Page=1&PageSize=100&Search=8061`);
  const attRows = deepEmployees(att.data);
  const ozanAtt = findPersonRow(attRows, ozan.employeeId, "8061");
  console.log("ATT", att.status, attRows.length, ozanAtt ? JSON.stringify(ozanAtt).slice(0, 400) : errText(att).slice(0, 80));

  const att2 = await api("GET", `/api/PayrollPeriod/${kenarSepId}/payroll-attendance`);
  const att2Rows = deepEmployees(att2.data);
  const ozanAtt2 = findPersonRow(att2Rows, ozan.employeeId, "8061");
  console.log("PATT", att2.status, att2Rows.length, ozanAtt2 ? Object.keys(ozanAtt2).join(",") : "none");

  const payslip = await api("GET", `/api/PeriodPayslip/by-period/${kenarSepId}`);
  const slipRows = deepEmployees(payslip.data);
  const ozanSlip = findPersonRow(slipRows, ozan.employeeId, "8061");
  console.log("SLIP", payslip.status, slipRows.length, ozanSlip ? Object.keys(ozanSlip).join(",") : "none");

  const peId = periodEmployeeId(ozanAtt) || periodEmployeeId(ozanAtt2) || periodEmployeeId(ozanSum) || periodEmployeeId(ozanSlip) || periodEmployeeId(ozanNested);
  report.retries.ozanIds = {
    peId,
    nestedKeys: ozanNested ? Object.keys(ozanNested) : [],
    attKeys: ozanAtt ? Object.keys(ozanAtt) : [],
    sumKeys: ozanSum ? Object.keys(ozanSum) : [],
  };
  console.log("OZAN_PE_ID", peId);

  report.retries.ozanRemove = [];
  const deleteUrls = [];
  if (peId) {
    deleteUrls.push(["DELETE", `/api/PayrollPeriod/${kenarSepId}/employees/${peId}`]);
    deleteUrls.push(["DELETE", `/api/PeriodEmployee/${peId}`]);
  }
  if (ozanNested?.id && ozanNested.id !== peId) {
    deleteUrls.push(["DELETE", `/api/PayrollPeriod/${kenarSepId}/employees/${ozanNested.id}`]);
    deleteUrls.push(["DELETE", `/api/PeriodEmployee/${ozanNested.id}`]);
  }
  for (const [m, u] of deleteUrls) {
    const r = await api(m, u);
    report.retries.ozanRemove.push({ m, u, status: r.status, ok: ok(r) || r.status === 204, err: errText(r) });
    console.log("OZAN_RM", m, u, r.status, errText(r).slice(0, 120));
    if (ok(r) || r.status === 204) break;
  }

  const addB = await api("POST", `/api/PayrollPeriod/${bSepId}/employees`, {
    payrollPeriodId: bSepId,
    employeeIds: [ozan.employeeId],
  });
  report.retries.ozanAddB = { status: addB.status, ok: ok(addB), err: errText(addB) };
  console.log("OZAN_B", addB.status, errText(addB));

  const tax = await api("PUT", `/api/Employee/${ozan.employeeId}/initialCumulativeTaxBase`, { value: 1000, year: 2026 });
  const taxGet = await api("GET", `/api/Employee/${ozan.employeeId}`);
  const taxEmp = unwrap(taxGet);
  report.retries.cumTax = {
    put: tax.status,
    ok: ok(tax),
    err: errText(tax),
    getValue: taxEmp?.initialCumulativeTaxBase,
    getYear: taxEmp?.initialCumulativeTaxBaseYear,
  };
  console.log("CUMTAX", tax.status, errText(tax), "GET", taxEmp?.initialCumulativeTaxBase, taxEmp?.initialCumulativeTaxBaseYear);

  const ozanPos = await api("GET", `/api/EmployeePosition/employee/${ozan.employeeId}`);
  const ozanPosRows = arr(unwrap(ozanPos));
  report.retries.ozanPositions = ozanPosRows.map((x) => ({
    id: x.id,
    pos: x.organizationalUnitPositionId,
    start: x.startDate,
    end: x.endDate,
  }));
  console.log("OZAN_EP", ozanPos.status, JSON.stringify(report.retries.ozanPositions));
  for (const row of ozanPosRows) {
    const isKenar = row.organizationalUnitPositionId === ozan.positionId;
    const isB = row.organizationalUnitPositionId === ozan.companyBPositionId;
    if (isKenar && (!row.endDate || String(row.endDate).slice(0, 10) > "2026-09-10")) {
      const put = await api("PUT", `/api/EmployeePosition/${row.id}`, {
        employeeId: ozan.employeeId,
        organizationalUnitPositionId: row.organizationalUnitPositionId,
        startDate: row.startDate || "2026-01-06T00:00:00",
        endDate: "2026-09-10T17:00:00",
      });
      console.log("OZAN_EP_KENAR_END", put.status, errText(put));
      report.retries.ozanKenarEnd = { status: put.status, ok: ok(put), err: errText(put) };
    }
    if (isB) {
      const put = await api("PUT", `/api/EmployeePosition/${row.id}`, {
        employeeId: ozan.employeeId,
        organizationalUnitPositionId: row.organizationalUnitPositionId,
        startDate: "2026-09-11T08:00:00",
        endDate: row.endDate || null,
      });
      console.log("OZAN_EP_B_START", put.status, errText(put));
      report.retries.ozanBStart = { status: put.status, ok: ok(put), err: errText(put) };
    }
  }
  if (!ozanPosRows.some((x) => x.organizationalUnitPositionId === ozan.companyBPositionId) && ozan.companyBPositionId) {
    const cr = await api("POST", "/api/EmployeePosition", {
      employeeId: ozan.employeeId,
      organizationalUnitPositionId: ozan.companyBPositionId,
      startDate: "2026-09-11T08:00:00",
    });
    console.log("OZAN_EP_B_POST", cr.status, errText(cr));
    report.retries.ozanBPosCreate = { status: cr.status, ok: ok(cr), err: errText(cr) };
  }

  // ---------- EDGE-017: EmployeePosition + Şube SGK sicil (no workplace-history API) ----------
  console.log("PHASE EDGE-017");
  const kenarSgk = await api("GET", `/api/OrganizationalUnitSgkSetting/by-unit/${units.kenar.id}`);
  const subeSgk = await api("GET", `/api/OrganizationalUnitSgkSetting/by-unit/${units.sube.id}`);
  const kenarSicil = unwrap(kenarSgk)?.isyeriSicil;
  const subeSicil = unwrap(subeSgk)?.isyeriSicil;
  report.retries.sgkSicil = { kenar: kenarSicil, sube: subeSicil, different: kenarSicil && subeSicil && kenarSicil !== subeSicil };
  console.log("SGK_SICIL kenar", kenarSicil, "sube", subeSicil);

  if (unwrap(subeSgk) && kenarSicil && subeSicil === kenarSicil) {
    const blank = { ...unwrap(subeSgk) };
    delete blank.id;
    delete blank.createdBy;
    delete blank.createdDate;
    delete blank.modifiedDate;
    delete blank.status;
    delete blank.organizationalUnit;
    blank.organizationalUnitId = units.sube.id;
    blank.isyeriSicil = String(kenarSicil).replace(/\d$/, (d) => String((Number(d) + 1) % 10));
    if (blank.isyeriSicil === kenarSicil) blank.isyeriSicil = kenarSicil + "2";
    blank.isyeriUnvan = (blank.isyeriUnvan || "D1-Tech") + " Şube";
    const up = await api("POST", "/api/OrganizationalUnitSgkSetting/upsert", blank);
    console.log("SUBE_SGK_DIFF", up.status, errText(up), blank.isyeriSicil);
    report.retries.subeSgkUpsert = { status: up.status, ok: ok(up), sicil: blank.isyeriSicil };
  }

  const cerenPos = await api("GET", `/api/EmployeePosition/employee/${ceren.employeeId}`);
  const cerenPosRows = arr(unwrap(cerenPos));
  report.retries.cerenPositionsBefore = cerenPosRows.map((x) => ({
    id: x.id,
    pos: x.organizationalUnitPositionId,
    start: x.startDate,
    end: x.endDate,
  }));
  console.log("CEREN_EP", cerenPos.status, JSON.stringify(report.retries.cerenPositionsBefore));
  const subePosId = "126f9728-5b10-474b-add9-3f9b9de1632e";
  for (const row of cerenPosRows) {
    if (row.organizationalUnitPositionId === ceren.positionId) {
      const put = await api("PUT", `/api/EmployeePosition/${row.id}`, {
        employeeId: ceren.employeeId,
        organizationalUnitPositionId: row.organizationalUnitPositionId,
        startDate: row.startDate || "2026-01-06T00:00:00",
        endDate: "2026-09-10T17:00:00",
      });
      console.log("CEREN_KENAR_EP_END", put.status, errText(put));
      report.retries.cerenKenarEpEnd = { status: put.status, ok: ok(put), err: errText(put) };
    }
  }
  const hasSubeEp = cerenPosRows.some((x) => x.organizationalUnitPositionId === subePosId);
  if (!hasSubeEp) {
    const cr = await api("POST", "/api/EmployeePosition", {
      employeeId: ceren.employeeId,
      organizationalUnitPositionId: subePosId,
      startDate: "2026-09-11T08:00:00",
      endDate: "2026-09-30T17:00:00",
    });
    console.log("CEREN_SUBE_EP", cr.status, errText(cr));
    report.retries.cerenSubeEp = { status: cr.status, ok: ok(cr), err: errText(cr) };
  }

  // ---------- Ar-Ge: swagger has zero center/quota paths ----------
  report.swagger.arge = "swager.json içinde RdCenter/ArgeCenter/Quota/Kota path yok; mevcut 5746/4691 kanunlara dokunulmadı";
  const sampleArge = state.people["8011"];
  if (sampleArge?.employeeId) {
    const prof = await api("GET", `/api/Employee/${sampleArge.employeeId}/payrollProfiles`);
    report.retries.argeProfiles8011 = { status: prof.status, data: unwrap(prof) };
    console.log("ARGE_PROFILES_8011", prof.status, JSON.stringify(unwrap(prof)).slice(0, 200));
  }

  // ---------- EDGE-024 8066 ----------
  console.log("PHASE EDGE-024");
  const hours = arr(unwrap(await api("GET", "/api/WorkingHourType/all")));
  const wh = hours.find((h) => /tam g[uü]n 09/i.test(h.name || "")) || hours[0];
  const lt = state.leaveTypes[feriha.unitId];
  const leaves = await api("GET", `/api/EmployeeLeaveRequest/employee/${feriha.employeeId}/leaves`);
  const leaveRows = arr(unwrap(leaves));
  report.retries.ferihaLeaves = {
    status: leaves.status,
    n: leaveRows.length,
    rows: leaveRows.map((x) => ({
      id: x.id,
      type: x.leaveTypeId || x.leaveType?.name,
      start: x.startDate,
      end: x.endDate,
      status: x.leaveRequestStatus,
    })),
  };
  console.log("FERIHA_LEAVES", leaves.status, JSON.stringify(report.retries.ferihaLeaves.rows));

  const unpaidMgmt = await api("POST", "/api/EmployeeLeaveRequest/created-by-management", {
    employeeIds: [feriha.employeeId],
    leaveTypeId: lt?.unpaid,
    startDate: "2026-09-23T08:00:00",
    endDate: "2026-09-24T17:00:00",
    workingHourTypeId: wh?.id,
    description: "EDGE-024 ücretsiz örtüşme 23-24.09 (yönetim)",
  });
  report.retries.leave8066mgmt = { status: unpaidMgmt.status, ok: ok(unpaidMgmt), err: errText(unpaidMgmt) };
  console.log("8066_MGMT_UNPAID", unpaidMgmt.status, errText(unpaidMgmt));

  // ---------- January+ periods ----------
  console.log("PHASE periods jan+");
  function empIdsFor(unitKey, y, m) {
    const ids = ROSTER.people
      .filter((p) => p.unit === unitKey)
      .filter((p) => inKenarMonth(p, y, m))
      .map((p) => state.people[p.sicil]?.employeeId)
      .filter(Boolean);
    if (unitKey === "kenar" && inKenarMonth(ROSTER.people.find((p) => p.sicil === "8061"), y, m)) {
      const oz = state.people["8061"]?.employeeId;
      if (oz && !ids.includes(oz)) ids.push(oz);
    }
    if (unitKey === "sirket-b") {
      const eda = state.people["8062"]?.employeeId;
      const onlyEda = [eda].filter(Boolean);
      if (y === 2026 && m < 9) return onlyEda;
      if (y === 2026 && m === 9) {
        const oz = state.people["8061"]?.employeeId;
        return [...onlyEda, oz].filter(Boolean);
      }
      return onlyEda;
    }
    return ids;
  }

  async function listPeriods() {
    return arr(unwrap(await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")));
  }
  async function ensurePeriod(tag, ouId, year, month, empIds) {
    if (PROTECTED.has(ouId)) throw new Error("protected ou " + ouId);
    if (state.periods[tag]?.id) {
      report.periods[tag] = { ...state.periods[tag], skipped: "exists" };
      console.log("SKIP", tag, state.periods[tag].id);
      return state.periods[tag];
    }
    let periods = await listPeriods();
    let period = periods.find((p) => p.year === year && p.month === month && (p.organizationalUnitId === ouId || p.organizationalUnit?.id === ouId));
    if (!period?.id) {
      const c = await api("POST", "/api/PayrollPeriod/create-async", {
        month,
        year,
        organizationalUnitId: ouId,
        hasSgkDebt: false,
        employeeIds: empIds,
      });
      const d = unwrap(c);
      console.log("CREATE", tag, empIds.length, c.status, errText(c), JSON.stringify(d).slice(0, 160));
      if (d?.jobId) {
        const job = await waitJob(d.jobId, tag.startsWith("yuv") ? 300000 : 180000);
        console.log("JOB", tag, job?.jobStatus);
      }
      const periodId = d?.periodId || d?.id;
      if (periodId) period = { id: periodId, year, month };
      else {
        periods = await listPeriods();
        period = periods.find((p) => p.year === year && p.month === month && (p.organizationalUnitId === ouId || p.organizationalUnit?.id === ouId));
      }
    }
    if (period?.id && empIds.length) {
      const add = await api("POST", `/api/PayrollPeriod/${period.id}/employees`, {
        payrollPeriodId: period.id,
        employeeIds: empIds,
      });
      if (!ok(add) && add.status !== 405) console.log("ADD", tag, add.status, errText(add).slice(0, 120));
    }
    if (period?.id) {
      state.periods[tag] = { id: period.id, year, month, ou: ouId, count: empIds.length };
      report.periods[tag] = { id: period.id, year, month, count: empIds.length };
      saveState();
    } else {
      report.periods[tag] = { error: "no period", year, month };
      console.log("FAIL_PERIOD", tag);
    }
    return period;
  }

  const plan = [];
  for (let m = 1; m <= 7; m++) {
    const mm = String(m).padStart(2, "0");
    plan.push([`ana-2026-${mm}`, units.ana.id, 2026, m, empIdsFor("ana", 2026, m)]);
    plan.push([`op-2026-${mm}`, units.operasyon.id, 2026, m, empIdsFor("operasyon", 2026, m)]);
    plan.push([`kenar-2026-${mm}`, units.kenar.id, 2026, m, empIdsFor("kenar", 2026, m)]);
    plan.push([`lab-2026-${mm}`, units.lab.id, 2026, m, empIdsFor("lab", 2026, m)]);
    plan.push([`blok-2026-${mm}`, units.blokaj.id, 2026, m, empIdsFor("blokaj", 2026, m)]);
    plan.push([`tak-2026-${mm}`, units.takvim.id, 2026, m, empIdsFor("takvim", 2026, m)]);
    plan.push([`b-2026-${mm}`, units["sirket-b"].id, 2026, m, empIdsFor("sirket-b", 2026, m)]);
    plan.push([`yuv-2026-${mm}`, units.yuvarlama.id, 2026, m, empIdsFor("yuvarlama", 2026, m)]);
  }
  plan.push(["op-2026-08", units.operasyon.id, 2026, 8, empIdsFor("operasyon", 2026, 8)]);
  plan.push(["lab-2026-08", units.lab.id, 2026, 8, empIdsFor("lab", 2026, 8)]);
  plan.push(["blok-2026-08", units.blokaj.id, 2026, 8, empIdsFor("blokaj", 2026, 8)]);
  plan.push(["b-2026-08", units["sirket-b"].id, 2026, 8, empIdsFor("sirket-b", 2026, 8)]);
  plan.push(["yuv-2026-08", units.yuvarlama.id, 2026, 8, empIdsFor("yuvarlama", 2026, 8)]);
  for (let m = 8; m <= 12; m++) {
    plan.push([`tak-2026-${String(m).padStart(2, "0")}`, units.takvim.id, 2026, m, empIdsFor("takvim", 2026, m)]);
  }
  plan.push(["tak-2027-01", units.takvim.id, 2027, 1, empIdsFor("takvim", 2027, 1)]);
  plan.push(["tak-2028-01", units.takvim.id, 2028, 1, empIdsFor("takvim", 2028, 1)]);

  for (const [tag, ou, y, m, ids] of plan) {
    await ensurePeriod(tag, ou, y, m, ids);
  }

  const kenarAfter = deepEmployees((await api("GET", `/api/PayrollPeriod/${kenarSepId}`)).data);
  const bAfter = deepEmployees((await api("GET", `/api/PayrollPeriod/${bSepId}`)).data);
  report.retries.kenarSepAfter = {
    n: kenarAfter.length,
    ozan: !!findPersonRow(kenarAfter, ozan.employeeId, "8061"),
  };
  report.retries.bSepAfter = {
    n: bAfter.length,
    numbers: bAfter.map((e) => e.employee?.employeeNumber || e.employeeNumber),
  };
  console.log("KENAR_AFTER", report.retries.kenarSepAfter, "B_AFTER", report.retries.bSepAfter);

  saveState();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  try {
    const pub = JSON.parse(fs.readFileSync(REPO_OUT, "utf8"));
    pub.retries = { ...(pub.retries || {}), ...report.retries };
    pub.periods = { ...(pub.periods || {}), ...state.periods };
    pub.notes = report.notes.concat(report.swagger.arge || []);
    fs.writeFileSync(REPO_OUT, JSON.stringify(pub, null, 2));
  } catch (e) {
    console.log("summary merge skip", e.message);
  }
  console.log("DONE periods", Object.keys(state.periods).length, "wrote", OUT);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
