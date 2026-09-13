/**
 * Finish remaining Jan-script periods after CSRF/401, verify EDGE-018,
 * clean EmployeePosition dates, probe TechnoparkProject (destek kota).
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const ADMIN_PASS = process.env.DHR_PASSWORD;
if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}
const STATE_PATH = path.join(process.env.TEMP, "faz1_seed_state.json");
const OUT = path.join(process.env.TEMP, "faz1_jan_finish.json");
const REPO_OUT = path.join(__dirname, "faz1_verify_summary.json");
const ROSTER = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "faz1_roster.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));

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
  if (x?.value && Array.isArray(x.value)) return x.value;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && !r.data?.error;
}
function errText(r) {
  const e = r?.data?.error || r?.data?.title;
  return String(e?.message || (Array.isArray(e?.errors) ? e.errors[0] : JSON.stringify(e?.errors || r?.text || r?.status) || "")).slice(0, 280);
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
function inMonth(p, y, m) {
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay(y, m)).padStart(2, "0")}`;
  return overlaps(p.hire || "2026-01-06", p.exit, from, to) || (p.rehire && overlaps(p.rehire, null, from, to));
}
function saveState() {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

(async () => {
  const report = { remaining: {}, verify: {}, positions: {}, techno: {} };
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  async function uiLogin() {
    await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
    await page.waitForSelector("#login_email", { timeout: 30000 });
    await page.fill("#login_email", "arda.kocaoglu@d1-tech.com");
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

  if (!(await uiLogin())) throw new Error("login fail");
  console.log("ADMIN OK");

  const units = state.units;
  function empIds(unitKey, y, m) {
    const ids = ROSTER.people
      .filter((p) => p.unit === unitKey)
      .filter((p) => inMonth(p, y, m))
      .map((p) => state.people[p.sicil]?.employeeId)
      .filter(Boolean);
    if (unitKey === "kenar") {
      const oz = ROSTER.people.find((p) => p.sicil === "8061");
      if (oz && inMonth(oz, y, m) && state.people["8061"]?.employeeId && !ids.includes(state.people["8061"].employeeId)) ids.push(state.people["8061"].employeeId);
    }
    if (unitKey === "sirket-b") return [state.people["8062"]?.employeeId].filter(Boolean);
    return ids;
  }
  async function listPeriods() {
    return arr(unwrap(await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")));
  }
  async function ensurePeriod(tag, ouId, year, month, empIdsList) {
    if (state.periods[tag]?.id) {
      console.log("SKIP", tag);
      report.remaining[tag] = { skipped: true, id: state.periods[tag].id };
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
        employeeIds: empIdsList,
      });
      const d = unwrap(c);
      console.log("CREATE", tag, empIdsList.length, c.status, errText(c).slice(0, 80));
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
    if (period?.id && empIdsList.length) {
      await api("POST", `/api/PayrollPeriod/${period.id}/employees`, { payrollPeriodId: period.id, employeeIds: empIdsList });
    }
    if (period?.id) {
      state.periods[tag] = { id: period.id, year, month, ou: ouId, count: empIdsList.length };
      report.remaining[tag] = { id: period.id, year, month, count: empIdsList.length };
      saveState();
    } else {
      report.remaining[tag] = { error: "no period", status: "fail" };
      console.log("FAIL", tag);
    }
    return period;
  }

  const rest = [
    ["lab-2026-08", units.lab.id, 2026, 8, empIds("lab", 2026, 8)],
    ["blok-2026-08", units.blokaj.id, 2026, 8, empIds("blokaj", 2026, 8)],
    ["b-2026-08", units["sirket-b"].id, 2026, 8, empIds("sirket-b", 2026, 8)],
    ["yuv-2026-08", units.yuvarlama.id, 2026, 8, empIds("yuvarlama", 2026, 8)],
  ];
  for (let m = 8; m <= 12; m++) rest.push([`tak-2026-${String(m).padStart(2, "0")}`, units.takvim.id, 2026, m, empIds("takvim", 2026, m)]);
  rest.push(["tak-2027-01", units.takvim.id, 2027, 1, empIds("takvim", 2027, 1)]);
  rest.push(["tak-2028-01", units.takvim.id, 2028, 1, empIds("takvim", 2028, 1)]);
  for (const row of rest) await ensurePeriod(...row);

  async function countPeriod(id) {
    const g = await api("GET", `/api/PayrollPeriod/${id}`);
    const rows = deepEmployees(g.data);
    return { status: g.status, n: rows.length, nums: rows.map((e) => e.employee?.employeeNumber || e.employeeNumber).filter(Boolean).sort() };
  }

  const kenarSepId = state.periods["kenar-2026-09"]?.id;
  const bSepId = state.periods["b-2026-09"]?.id;
  const kenar = await countPeriod(kenarSepId);
  const b = await countPeriod(bSepId);
  report.verify.kenarSep = { n: kenar.n, ozan: kenar.nums.includes("8061") };
  report.verify.bSep = { n: b.n, nums: b.nums };
  console.log("KENAR_SEP", report.verify.kenarSep, "B_SEP", report.verify.bSep);

  const anaJan = await countPeriod(state.periods["ana-2026-01"]?.id);
  report.verify.anaJan = { n: anaJan.n, has8004: anaJan.nums.includes("8004"), has8018: anaJan.nums.includes("8018") };
  console.log("ANA_JAN", report.verify.anaJan);

  const ozan = state.people["8061"];
  const ceren = state.people["8051"];
  const subePosId = "126f9728-5b10-474b-add9-3f9b9de1632e";

  async function listEp(empId) {
    return arr(unwrap(await api("GET", `/api/EmployeePosition/employee/${empId}`)));
  }
  async function cleanEp(empId, keepers) {
    const rows = await listEp(empId);
    for (const row of rows) {
      const keep = keepers.find((k) => k.pos === row.organizationalUnitPositionId && String(row.startDate || "").slice(0, 10) === k.start);
      if (!keep) {
        const d = await api("DELETE", `/api/EmployeePosition/${row.id}`);
        console.log("EP_DEL", empId.slice(0, 8), row.id, row.startDate, d.status, errText(d).slice(0, 80));
      }
    }
    const after = await listEp(empId);
    for (const k of keepers) {
      const row = after.find((x) => x.organizationalUnitPositionId === k.pos);
      if (row) {
        const put = await api("PUT", `/api/EmployeePosition/${row.id}`, {
          employeeId: empId,
          organizationalUnitPositionId: k.pos,
          startDate: k.start + "T00:00:00",
          endDate: k.end ? k.end + "T17:00:00" : null,
        });
        console.log("EP_PUT", k.pos.slice(0, 8), k.start, k.end, put.status, errText(put).slice(0, 80));
      } else {
        const cr = await api("POST", "/api/EmployeePosition", {
          employeeId: empId,
          organizationalUnitPositionId: k.pos,
          startDate: k.start + "T08:00:00",
          endDate: k.end ? k.end + "T17:00:00" : null,
        });
        console.log("EP_POST", k.pos.slice(0, 8), cr.status, errText(cr).slice(0, 80));
      }
    }
    return (await listEp(empId)).map((x) => ({ id: x.id, pos: x.organizationalUnitPositionId, start: x.startDate, end: x.endDate }));
  }

  report.positions.ozan = await cleanEp(ozan.employeeId, [
    { pos: ozan.positionId, start: "2026-01-06", end: "2026-09-10" },
    { pos: ozan.companyBPositionId, start: "2026-09-11", end: null },
  ]);
  report.positions.ceren = await cleanEp(ceren.employeeId, [
    { pos: ceren.positionId, start: "2026-01-06", end: "2026-09-10" },
    { pos: subePosId, start: "2026-09-11", end: "2026-09-30" },
  ]);
  console.log("POS_OZAN", JSON.stringify(report.positions.ozan));
  console.log("POS_CEREN", JSON.stringify(report.positions.ceren));

  const technoGet = await api("GET", `/api/TechnoparkProject/by-unit?unitId=${units.kenar.id}`);
  console.log("TECHNO_GET", technoGet.status, errText(technoGet).slice(0, 120), JSON.stringify(unwrap(technoGet)).slice(0, 200));
  report.techno.get = { status: technoGet.status, n: arr(unwrap(technoGet)).length, err: errText(technoGet) };
  let project = arr(unwrap(technoGet)).find((x) => /Faz1|Kenar/i.test(x.name || ""));
  if (!project) {
    const up = await api("POST", "/api/TechnoparkProject/upsert", {
      organizationalUnitId: units.kenar.id,
      name: "Faz1 Kenar Ar-Ge / Teknopark",
      projeKodu: "FAZ1-ARGE",
      bolgeAdi: "Pendik",
    });
    console.log("TECHNO_UPSERT", up.status, errText(up));
    report.techno.upsert = { status: up.status, ok: ok(up), err: errText(up) };
    const again = await api("GET", `/api/TechnoparkProject/by-unit?unitId=${units.kenar.id}`);
    project = arr(unwrap(again))[0];
  }
  if (project?.id) {
    state.technoparkProjectId = project.id;
    const p8025 = state.people["8025"];
    const p8026 = state.people["8026"];
    if (p8025) {
      const a1 = await api("POST", "/api/TechnoparkProject/assign", {
        employeeId: p8025.employeeId,
        technoparkProjectId: project.id,
        startDate: "2026-01-06T00:00:00",
        isciTuru: "Destek",
        destekOncelik: 1,
        acikAtamayiKapat: false,
      });
      console.log("TECHNO_8025", a1.status, errText(a1));
      report.techno.a8025 = { status: a1.status, ok: ok(a1), err: errText(a1) };
    }
    if (p8026) {
      const a2 = await api("POST", "/api/TechnoparkProject/assign", {
        employeeId: p8026.employeeId,
        technoparkProjectId: project.id,
        startDate: "2026-01-06T00:00:00",
        isciTuru: "Destek",
        destekOncelik: 2,
        acikAtamayiKapat: false,
      });
      console.log("TECHNO_8026", a2.status, ok(a2), errText(a2));
      report.techno.a8026 = { status: a2.status, ok: ok(a2), err: errText(a2) };
    }
  }

  saveState();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  try {
    const pub = JSON.parse(fs.readFileSync(REPO_OUT, "utf8"));
    pub.retries = pub.retries || {};
    pub.retries.kenarSepAfter = report.verify.kenarSep;
    pub.retries.bSepAfter = report.verify.bSep;
    pub.retries.anaJan = report.verify.anaJan;
    pub.retries.ozanPositions = report.positions.ozan;
    pub.retries.cerenPositions = report.positions.ceren;
    pub.retries.technopark = report.techno;
    pub.periods = { ...(pub.periods || {}), ...state.periods };
    pub.edges = pub.edges || {};
    pub.edges["018"] = {
      ...(pub.edges["018"] || {}),
      kenarSep: report.verify.kenarSep,
      companyBPeriod: { id: bSepId, count: report.verify.bSep.n, numbers: report.verify.bSep.nums },
      note: report.verify.bSep.nums?.includes("8061")
        ? "Ozan Kenar Eylül’den silindi (DELETE PayrollPeriod/{id}/employees/{peId} 204), Şirket B Eylül’e eklendi."
        : "Ozan B’ye eklenemedi",
    };
    pub.edges["017"] = {
      ...(pub.edges["017"] || {}),
      positions: report.positions.ceren,
      note: "İşyeri geçmişi API yok. Şube SGK sicili Kenar’dan farklı. EmployeePosition: Kenar 1–10.09 / Şube 11–30.09.",
    };
    fs.writeFileSync(REPO_OUT, JSON.stringify(pub, null, 2));
  } catch (e) {
    console.log("summary skip", e.message);
  }
  console.log("DONE", Object.keys(state.periods).length);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
