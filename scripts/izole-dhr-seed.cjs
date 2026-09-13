/**
 * Tek Değişken birimi: Ocak 2026, her kişide tek sapma.
 * İK 6101–6132, Faz 1 80xx, BT, Sude'ye dokunmaz.
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

const ROOT_DIR = path.join(__dirname, "..");
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "src", "data", "izole_roster.json"), "utf8"));
const STATE_PATH = path.join(process.env.TEMP, "izole_seed_state.json");
const LOG_PATH = path.join(process.env.TEMP, "izole_seed.log");
const DUMP_PATH = path.join(process.env.TEMP, "izole_ocak_period.json");

const ROOT = "d93d6660-892d-4dcf-8fc2-36bed171017a";
const IK = "6e473120-9b10-48d1-81df-08b4f798e4dd";
const BT = "c358d645-00b6-4a78-b0e1-e1aad87e4df2";
const PROTECTED_OU = new Set([IK, BT]);

const LAW = {
  "05510_2": "5ca750a5-ec83-4a19-a9c9-c6320f989af7",
  "05510_5": "72542ce6-edf0-4a46-a770-cccf0f79246d",
  "5746_05746": "9ccf41e0-027e-4cae-8621-8629de05a749",
  "5746_15746": "67cf8ebb-6394-429a-968f-e2d8d495df28",
  "5746_GV": "9ccf41e0-027e-4cae-8621-8629de05a749",
};
const TAX_4691 = "0f6e047b-9735-4f5a-940b-239ee4037098";

const HOLIDAYS_2026 = [
  { name: "Yılbaşı", start: "2026-01-01T00:00:00", end: "2026-01-01T23:59:00" },
  { name: "Ramazan Bayramı Arifesi", start: "2026-03-19T13:00:00", end: "2026-03-19T23:59:00" },
  { name: "Ramazan Bayramı 1. Gün", start: "2026-03-20T00:00:00", end: "2026-03-20T23:59:00" },
  { name: "Ramazan Bayramı 2. Gün", start: "2026-03-21T00:00:00", end: "2026-03-21T23:59:00" },
  { name: "Ramazan Bayramı 3. Gün", start: "2026-03-22T00:00:00", end: "2026-03-22T23:59:00" },
  { name: "Ulusal Egemenlik ve Çocuk Bayramı", start: "2026-04-23T00:00:00", end: "2026-04-23T23:59:00" },
  { name: "Emek ve Dayanışma Günü", start: "2026-05-01T00:00:00", end: "2026-05-01T23:59:00" },
  { name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", start: "2026-05-19T00:00:00", end: "2026-05-19T23:59:00" },
  { name: "Kurban Bayramı Arifesi", start: "2026-05-26T13:00:00", end: "2026-05-26T23:59:00" },
  { name: "Kurban Bayramı 1. Gün", start: "2026-05-27T00:00:00", end: "2026-05-27T23:59:00" },
  { name: "Kurban Bayramı 2. Gün", start: "2026-05-28T00:00:00", end: "2026-05-28T23:59:00" },
  { name: "Kurban Bayramı 3. Gün", start: "2026-05-29T00:00:00", end: "2026-05-29T23:59:00" },
  { name: "Kurban Bayramı 4. Gün", start: "2026-05-30T00:00:00", end: "2026-05-30T23:59:00" },
  { name: "Demokrasi ve Millî Birlik Günü", start: "2026-07-15T00:00:00", end: "2026-07-15T23:59:00" },
  { name: "Zafer Bayramı", start: "2026-08-30T00:00:00", end: "2026-08-30T23:59:00" },
  { name: "Cumhuriyet Bayramı Arifesi", start: "2026-10-28T13:00:00", end: "2026-10-28T23:59:00" },
  { name: "Cumhuriyet Bayramı", start: "2026-10-29T00:00:00", end: "2026-10-29T23:59:00" },
];

const POS_FLOWS = [
  "UnitPositionLeaveFlowStep",
  "UnitPositionOvertimeFlowStep",
  "UnitPositionAdvanceFlowStep",
  "UnitPositionPaymentFlowStep",
  "UnitPositionDocumentFlowStep",
  "UnitPositionInventoryFlowStep",
  "UnitPositionTravelFlowStep",
];

function log(...a) {
  const m = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(m);
  fs.appendFileSync(LOG_PATH, m + "\n");
}
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
function eqName(a, b) {
  return String(a || "").toLocaleLowerCase("tr") === String(b || "").toLocaleLowerCase("tr");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { units: {}, roles: {}, payments: {}, profiles: {}, people: {}, leaveTypes: {}, periods: {}, notes: [], failed: [] };
  }
}
function saveState(s) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}
function makeTckn(seed) {
  let n = 100000001 + Math.abs(Number(seed) || 0) * 137 + 246813579;
  n = n % 900000000;
  if (n < 100000000) n += 100000000;
  const d = String(n).padStart(9, "1").split("").map(Number);
  d[0] = Math.max(1, d[0]);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = (d.reduce((a, b) => a + b, 0) + d10) % 10;
  return d.join("") + d10 + d11;
}

(async () => {
  fs.writeFileSync(LOG_PATH, "BOOT " + new Date().toISOString() + "\n");
  const state = loadState();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email", { timeout: 30000 });
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  if (page.url().includes("/login")) throw new Error("admin login fail");
  log("LOGIN OK", page.url());

  async function api(method, p, body) {
    const res = await page.evaluate(
      async ({ method, p, body }) => {
        await fetch("/api/antiforgery/token", { credentials: "include" }).catch(() => {});
        const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
        const token = m ? decodeURIComponent(m[1]) : "";
        const headers = { Accept: "application/json", "X-XSRF-TOKEN": token, "X-CSRF-TOKEN": token };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const res = await fetch(p, {
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
      { method, p, body }
    );
    if ((res.status === 429 || /çok fazla|csrf/i.test(res.text || "")) && api._attempt !== 8) {
      api._attempt = (api._attempt || 0) + 1;
      await sleep(4000 * api._attempt);
      const out = await api(method, p, body);
      api._attempt = 0;
      return out;
    }
    api._attempt = 0;
    return res;
  }

  async function waitJob(jobId, maxMs = 180000) {
    const start = Date.now();
    let last = null;
    while (Date.now() - start < maxMs) {
      const r = await api("GET", `/api/background-jobs/${jobId}`);
      last = unwrap(r);
      const st = last?.jobStatus;
      log("JOB", String(jobId).slice(0, 8), "st", st, "pct", last?.progressPercent);
      if (st === 2 || st === 3 || st === 4 || st === 5) return last;
      await sleep(2500);
    }
    return last;
  }

  const units = arr(unwrap(await api("GET", "/api/OrganizationalUnit/filteredByUnitAbilities")));
  const root = units.find((u) => u.id === ROOT);
  if (!root) throw new Error("D1-Tech missing");
  const location = units.find((u) => u.location)?.location || "İstanbul / Maslak";

  async function ensureUnit(key, name, parentId) {
    if (state.units[key]?.id) {
      const live = units.find((u) => u.id === state.units[key].id);
      if (live) return live;
    }
    const siblings = units.filter((u) => (u.parentId || u.parentOrganizationalUnitId || null) === (parentId || null));
    let hit = siblings.find((u) => eqName(u.name, name));
    if (!hit && parentId) hit = units.find((u) => eqName(u.name, name) && (u.parentId || u.parentOrganizationalUnitId) === parentId);
    if (hit) {
      state.units[key] = { id: hit.id, name: hit.name, parentId: parentId || null };
      saveState(state);
      return hit;
    }
    if (PROTECTED_OU.has(parentId)) throw new Error("protected parent");
    for (const b of [{ name, parentId, location }, { name, parentId }]) {
      const r = await api("POST", "/api/OrganizationalUnit", b);
      log("UNIT_TRY", name, r.status, errText(r));
      if (ok(r) && unwrap(r)?.id) {
        const created = unwrap(r);
        units.push(created);
        state.units[key] = { id: created.id, name: created.name || name, parentId: parentId || null };
        saveState(state);
        return created;
      }
    }
    throw new Error("unit create failed " + name);
  }

  log("PHASE unit");
  const ou = await ensureUnit("izole", "Tek Değişken", ROOT);
  log("UNIT", ou.id, ou.name);

  log("PHASE payments");
  let payments = arr(unwrap(await api("GET", "/api/Payment/filteredByUnitAbilities")));
  for (const n of ["Temel Maaş", "Yemek Yardımı", "Yol Yardımı", "Prim", "İkramiye", "Genel Kesinti", "Masraf", "Fazla Mesai"]) {
    const hit = payments.find((p) => eqName(p.name, n) && (p.organizationalUnitId === ROOT || p.organizationalUnitId === ou.id));
    if (hit) state.payments[n] = hit.id;
  }
  saveState(state);

  log("PHASE profiles");
  const rootProfiles = arr(unwrap(await api("GET", `/api/PayrollProfile/ownerOrganizationalUnit/${ROOT}`))).filter((p) => p.status !== 3);
  state.profiles = Object.fromEntries(rootProfiles.map((p) => [p.name, p.id]));
  log("PROFILES", rootProfiles.map((p) => p.name).join(" | "));
  function profileIdFor(name) {
    if (state.profiles[name]) return state.profiles[name];
    const hit = rootProfiles.find((p) => eqName(p.name, name));
    if (hit) return hit.id;
    if (/^Ar-Ge$/i.test(name)) {
      const arge = rootProfiles.find((p) => /ar-ge|arge|teknopark/i.test(p.name || "") && !/5746|destek/i.test(p.name || ""));
      if (arge) return arge.id;
    }
    if (/Destek/i.test(name)) {
      const d = rootProfiles.find((p) => /destek/i.test(p.name || ""));
      if (d) return d.id;
    }
    return state.profiles["Standart"];
  }

  log("PHASE roles");
  const rootRoles = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${ROOT}/roles`)));
  const tplIk = rootRoles.find((r) => r.name === "İK");
  const tplCal = rootRoles.find((r) => r.name === "Çalışan");
  const ikAbs = (tplIk?.roleAbilities || []).map((a) => a.abilityId).filter(Boolean);
  const calAbs = (tplCal?.roleAbilities || []).map((a) => a.abilityId).filter(Boolean);
  const richAbs = ikAbs.length ? ikAbs : calAbs;
  {
    let roles = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${ou.id}/roles`)));
    for (const name of ["İK", "Çalışan", "Yönetici"]) {
      if (!roles.find((r) => eqName(r.name, name))) {
        const r = await api("POST", "/api/Role", { name, organizationalUnitId: ou.id });
        log("ROLE", name, r.status, ok(r) ? "ok" : errText(r));
      }
    }
    roles = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${ou.id}/roles`)));
    const roleIk = roles.find((r) => r.name === "İK");
    const roleCal = roles.find((r) => r.name === "Çalışan");
    const roleMgr = roles.find((r) => /yönetici|yonetici/i.test(r.name || "")) || roleIk;
    if (roleIk && ikAbs.length) await api("POST", "/api/RoleAbility/bulk-update", { roleId: roleIk.id, abilityIds: ikAbs });
    if (roleMgr && ikAbs.length) await api("POST", "/api/RoleAbility/bulk-update", { roleId: roleMgr.id, abilityIds: ikAbs });
    if (roleCal && richAbs.length) await api("POST", "/api/RoleAbility/bulk-update", { roleId: roleCal.id, abilityIds: richAbs });
    state.roles[ou.id] = { ik: roleIk?.id, calisan: roleCal?.id, yonetici: roleMgr?.id };
  }

  log("PHASE settings");
  const hours = arr(unwrap(await api("GET", "/api/WorkingHourType/all")));
  const whFull =
    hours.find((h) => /tam g[uü]n 09/i.test(h.name || "") && h.organizationalUnitId === ROOT) ||
    hours.find((h) => /tam g[uü]n|full/i.test(h.name || "")) ||
    hours[0];
  const whPart =
    hours.find((h) => /yar[ıi]m|k[ıi]smi|part/i.test(h.name || "")) || whFull;
  log("WH", whFull?.name, "PART", whPart?.name);

  {
    const parent = unwrap(await api("GET", `/api/PayrollSetting/${ROOT}`)) || {};
    const psBody = {
      organizationalUnitId: ou.id,
      requirePeriodCompletionBeforeNew: !!parent.requirePeriodCompletionBeforeNew,
      allowInitialCumulativeTaxBase: true,
      monthlyWorkDays: parent.monthlyWorkDays ?? 30,
      currencyType: parent.currencyType ?? 0,
      allowAbove30DaysInAttendance: !!parent.allowAbove30DaysInAttendance,
      requireMissingDayTracking: parent.requireMissingDayTracking ?? true,
      prorationMethod: parent.prorationMethod ?? 0,
      enableIncentiveLaws: parent.enableIncentiveLaws ?? true,
      netSummaryPayrollItemId: parent.netSummaryPayrollItemId ?? null,
      sgkBaseSummaryItemId: parent.sgkBaseSummaryItemId ?? null,
      defaultSalaryType: parent.defaultSalaryType ?? null,
      includeOvertimeInPayroll: true,
      monthlyWorkHours: parent.monthlyWorkHours ?? 225,
      overtimePaymentId: parent.overtimePaymentId ?? state.payments["Fazla Mesai"] ?? null,
      overtimeHourlyRatePaymentId: parent.overtimeHourlyRatePaymentId ?? null,
      roundingDecimals: parent.roundingDecimals ?? 2,
      midpointRoundingPolicy: parent.midpointRoundingPolicy ?? null,
      anomalyDetectionEnabled: parent.anomalyDetectionEnabled ?? true,
    };
    let ps = await api("PUT", `/api/PayrollSetting/${ou.id}`, psBody);
    if (!ok(ps)) ps = await api("POST", "/api/PayrollSetting", psBody);
    log("PayrollSetting", ps.status, ok(ps));
  }
  {
    const set = unwrap(await api("GET", `/api/AdvanceSetting/effective/${ou.id}`)) || {};
    const body = {
      organizationalUnitId: ou.id,
      maxPercentageOfNetSalary: set.maxPercentageOfNetSalary ?? null,
      maxFixedCeiling: set.maxFixedCeiling ?? 100000,
      allowBusinessAdvance: true,
      allowSalaryAdvance: true,
      defaultMaxInstallments: set.defaultMaxInstallments ?? 12,
      businessAdvanceSettlementDays: set.businessAdvanceSettlementDays ?? 30,
    };
    let r =
      set.id && !set.isInherited && set.organizationalUnitId === ou.id
        ? await api("PUT", `/api/AdvanceSetting/${set.id}`, { ...body, id: set.id })
        : await api("POST", "/api/AdvanceSetting", body);
    log("AdvanceSetting", r.status, ok(r));
  }

  const allLeave = arr(unwrap(await api("GET", "/api/LeaveType/all"))).concat(
    arr(unwrap(await api("GET", "/api/LeaveType/filteredByUnitAbilities")))
  );
  const tplPaid = allLeave.find((t) => t.isPaidLeave && /yıllık|yillik/i.test(t.name || "")) || allLeave.find((t) => t.isPaidLeave);
  {
    let list = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${ou.id}/leave-types`)));
    async function one(name, paid, equivalence, tpl) {
      let hit = list.find((t) => eqName(t.name, name));
      if (hit) return hit;
      const r = await api("POST", "/api/LeaveType", {
        name,
        description: "Tek Değişken " + name,
        isPaidLeave: paid,
        isVisibleInEmployeePage: true,
        isPublicHolidayIncluded: false,
        equivalenceCode: equivalence,
        requestUnitType: tpl?.requestUnitType ?? 0,
        leaveEntryType: 0,
        negativeBalanceType: paid ? 0 : 1,
        accrualType: paid ? 2 : 0,
        accrualPeriod: paid ? 1 : undefined,
        grantDate: paid ? 1 : undefined,
        transferType: paid ? 0 : 1,
        managementType: 2,
        calculationType: 0,
        defaultYearsConfig: paid ? JSON.stringify([{ year: 1, days: 14 }]) : undefined,
        organizationalUnitId: ou.id,
        isFileUploadEnabled: false,
        isFileMandatory: false,
      });
      log("LEAVE_TYPE", name, r.status, ok(r) ? unwrap(r)?.id : errText(r));
      return unwrap(r);
    }
    const annual = await one("Yıllık İzin", true, "ANNUAL", tplPaid);
    state.leaveTypes[ou.id] = { annual: annual?.id };
  }

  {
    const existing = arr(unwrap(await api("GET", `/api/PublicHoliday/ownerOrganizationalUnit/${ou.id}`)));
    const profiles = arr(unwrap(await api("GET", `/api/OrganizationalUnitProfile/organizationalUnit/${ou.id}`)));
    const holidayProfiles = profiles.filter((p) => p.isPublicHolidayEnabled && p.status !== 3);
    const profileIds = holidayProfiles.map((p) => p.id);
    for (const h of HOLIDAYS_2026) {
      const dup = existing.find((x) => eqName(x.name, h.name) && String(x.startDate || "").slice(0, 10) === h.start.slice(0, 10));
      if (dup) continue;
      const r = await api("POST", "/api/PublicHoliday", {
        name: h.name,
        description: "2026 resmi tatil",
        startDate: h.start,
        endDate: h.end,
        ownerOrganizationalUnitId: ou.id,
        profileIds,
      });
      if (!ok(r)) log("HOLIDAY_FAIL", h.name, errText(r));
      else existing.push({ name: h.name, startDate: h.start });
      await sleep(20);
    }
    const after = arr(unwrap(await api("GET", `/api/PublicHoliday/ownerOrganizationalUnit/${ou.id}`)));
    const ids = after.map((h) => h.id).filter(Boolean);
    for (const p of holidayProfiles) await api("PUT", `/api/OrganizationalUnitProfile/${p.id}/public-holidays`, ids);
    log("HOLIDAYS", after.length);
  }

  {
    const sgkRoot = unwrap(await api("GET", `/api/OrganizationalUnitSgkSetting/effective/${ROOT}`));
    const own = unwrap(await api("GET", `/api/OrganizationalUnitSgkSetting/by-unit/${ou.id}`));
    if (!own?.id && sgkRoot) {
      const blank = { ...sgkRoot };
      delete blank.id;
      delete blank.createdBy;
      delete blank.createdDate;
      delete blank.modifiedDate;
      delete blank.status;
      delete blank.organizationalUnit;
      blank.organizationalUnitId = ou.id;
      let up = await api("POST", "/api/OrganizationalUnitSgkSetting/upsert", blank);
      if (!ok(up)) up = await api("POST", "/api/OrganizationalUnitSgkSetting", blank);
      log("SGK", up.status, ok(up));
    }
  }

  log("PHASE people");
  const emps = arr(unwrap(await api("GET", "/api/Employee/filteredByUnitAbilities")));
  const users = arr(unwrap(await api("GET", "/api/User/all")));
  let positions = arr(unwrap(await api("GET", "/api/OrganizationalUnitPosition/filteredByUnitAbilities")));
  const usedEmails = new Set(
    [...emps.map((e) => e.email), ...users.map((u) => u.email)].filter(Boolean).map((x) => String(x).toLowerCase())
  );
  const pack = unwrap(await api("GET", `/api/EmployeeField/all?unitId=${ROOT}`)) || {};
  const fields = pack.employeeFields || [];
  const tcField = fields.find((f) => /kimlik\s*numara/i.test(f.name || "")) || fields.find((f) => /^tc\b/i.test(f.name || "") || /tckn/i.test(f.name || ""));
  const rs = state.roles[ou.id] || {};

  async function setPosFlows(posId, approverPosId) {
    if (!posId || !approverPosId || posId === approverPosId) return;
    for (const kind of POS_FLOWS) {
      const body = { step: 1, approvalUnitPositionId: approverPosId, ownerUnitPositionId: posId };
      const r = await api("POST", `/api/${kind}`, body);
      if (!ok(r) && r.status !== 409) log("POS_FLOW", kind, r.status, errText(r));
    }
  }

  async function createOrReusePerson(p, isMgr) {
    if (state.people[p.sicil]?.employeeId) return state.people[p.sicil];
    const n = parseInt(p.sicil, 10);
    if (n >= 6101 && n <= 6132) throw new Error("protected sicil " + p.sicil);
    if (n >= 8001 && n <= 8200) throw new Error("faz1 sicil " + p.sicil);
    const existing = emps.find((e) => String(e.employeeNumber) === String(p.sicil)) || emps.find((e) => String(e.email || "").toLowerCase() === p.email);
    const roleId = isMgr ? rs.yonetici || rs.ik : rs.calisan;
    const flags = p.seedFlags || {};
    const part = !!flags.partTime;
    const wh = part ? whPart : whFull;
    let empId = existing?.id;
    let posId = existing ? positions.find((x) => x.employeeId === empId && x.organizationalUnitId === ou.id)?.id : null;
    if (!empId && usedEmails.has(p.email.toLowerCase())) {
      const reuse = emps.find((e) => String(e.email || "").toLowerCase() === p.email.toLowerCase());
      if (reuse) empId = reuse.id;
    }
    if (!empId) {
      const createEmp = await api("POST", "/api/Employee", {
        employeeNumber: String(p.sicil),
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        gender: p.gender,
        phoneNumber: `+90539${String(6200000 + n).slice(-7)}`,
        birthDate: `${1978 + (n % 20)}-${String((n % 12) + 1).padStart(2, "0")}-${String(5 + (n % 20)).padStart(2, "0")}T00:00:00`,
      });
      empId = unwrap(createEmp)?.id;
      if (!ok(createEmp) || !empId) throw new Error("emp " + p.sicil + " " + errText(createEmp));
      usedEmails.add(p.email.toLowerCase());
      emps.push({ id: empId, email: p.email, employeeNumber: String(p.sicil), firstName: p.firstName, lastName: p.lastName });
      log("EMP", p.sicil, p.name, empId);
    }
    const hire = p.hire || ROSTER.baseline.hire;
    if (!posId) {
      const dm = isMgr ? null : state.mgrPosId || null;
      let createPos = await api("POST", "/api/OrganizationalUnitPosition", {
        title: p.title,
        organizationalUnitId: ou.id,
        employeeId: empId,
        roleId,
        workingHourTypeId: wh?.id,
        employmentType: part ? "Part-time" : "Full-time",
        hrManagerPositionId: dm,
        directManagerPositionId: dm,
        startDate: hire,
        endDate: null,
        reminderEnabled: false,
        isTerminated: false,
      });
      posId = unwrap(createPos)?.id;
      if (!ok(createPos) || !posId) throw new Error("pos " + p.sicil + " " + errText(createPos));
      positions.push({ id: posId, employeeId: empId, organizationalUnitId: ou.id });
    }
    const user = await api("POST", "/api/User/create-user-with-password", {
      email: p.email,
      employeeId: empId,
      password: DEMO_PASS,
    });
    if (!ok(user) && !/already|mevcut|exist|kayıtlı|kayitli/i.test(user.text || "")) {
      log("WARN user", p.email, user.status, errText(user));
    }

    const PAY_MAAS = state.payments["Temel Maaş"];
    const PAY_YEMEK = state.payments["Yemek Yardımı"];
    const PAY_YOL = state.payments["Yol Yardımı"];
    const vfYear = 2026;
    const vfMonth = 1;
    const fps = [];
    if (PAY_MAAS) fps.push({ paymentId: PAY_MAAS, value: p.maas, wageValue: p.maas, validFromYear: vfYear, validFromMonth: vfMonth });
    if (p.yemek && PAY_YEMEK) fps.push({ paymentId: PAY_YEMEK, value: p.yemek, wageValue: p.yemek, validFromYear: vfYear, validFromMonth: vfMonth });
    if (p.yol && PAY_YOL) fps.push({ paymentId: PAY_YOL, value: p.yol, wageValue: p.yol, validFromYear: vfYear, validFromMonth: vfMonth });
    if (fps.length) {
      let fp = await api("PUT", `/api/Employee/${empId}/fixedPayments`, { fixedPayments: fps });
      if (!ok(fp)) {
        fp = await api("PUT", `/api/Employee/${empId}/fixedPayments`, {
          fixedPayments: fps.map((x) => ({ paymentId: x.paymentId, value: x.value })),
        });
      }
      if (!ok(fp)) log("WARN fp", p.sicil, errText(fp));
    }
    await api("PUT", `/api/Employee/${empId}/salaryType/${p.salaryType ?? 0}`, {});
    const profName = p.profile || "Standart";
    const profId = profileIdFor(profName);
    if (profId) {
      const pr = await api("PUT", `/api/Employee/${empId}/payrollProfiles`, [profId]);
      if (!ok(pr)) log("WARN profile", p.sicil, profName, errText(pr));
    }
    const lawId = p.law ? LAW[p.law] : null;
    const taxId = p.tax === "4691" ? TAX_4691 : null;
    const full = unwrap(await api("GET", `/api/Employee/${empId}`)) || {};
    const empPut = await api("PUT", `/api/Employee/${empId}`, {
      firstName: full.firstName || p.firstName,
      lastName: full.lastName || p.lastName,
      employeeNumber: full.employeeNumber || String(p.sicil),
      email: full.email || p.email,
      gender: full.gender || p.gender,
      phoneNumber: full.phoneNumber,
      birthDate: full.birthDate ? String(full.birthDate).slice(0, 10) : undefined,
      companyStartDate: hire,
      defaultPayrollLawVariantId: lawId,
      defaultPayrollLawFieldsJson: null,
      defaultTaxExemptionVariantId: taxId,
      disabilityDegree: flags.disabilityDegree || null,
    });
    if (!ok(empPut)) log("WARN empPut", p.sicil, errText(empPut));

    if (p.besEmployeePct) {
      await api("POST", "/api/EmployeeOksEnrollment/upsert", {
        employeeId: empId,
        oksStatus: 1,
        contributionRateOverride: p.besEmployeePct,
        enrollmentDate: "2026-01-06",
        withdrawalDate: null,
        pauseStartDate: null,
        pauseEndDate: null,
        pensionCompany: "Anadolu Hayat Emeklilik",
        certificateNumber: `AH-IZ-${p.sicil}`,
      });
    } else if (flags.emekli) {
      await api("POST", "/api/EmployeeOksEnrollment/upsert", {
        employeeId: empId,
        oksStatus: 5,
        contributionRateOverride: null,
        enrollmentDate: null,
        withdrawalDate: null,
        pauseStartDate: null,
        pauseEndDate: null,
        pensionCompany: null,
        certificateNumber: null,
      });
    }
    if (flags.priorTaxFilled) {
      await api("PUT", `/api/Employee/${empId}/initialCumulativeTaxBase`, { value: 185000, year: 2026 });
    }
    if (tcField) {
      const tc = makeTckn(620000 + n);
      const fv = (full.employeeFieldValues || []).find((v) => v.employeeFieldId === tcField.id);
      if (fv?.id) {
        await api("PUT", `/api/EmployeeFieldValue/${fv.id}`, { id: fv.id, value: tc, employeeFieldId: tcField.id, employeeId: empId });
      } else {
        await api("POST", "/api/EmployeeFieldValue", { value: tc, employeeFieldId: tcField.id, employeeId: empId });
      }
    }
    await api("POST", "/api/EmployeeSgkProfile/upsert", {
      employeeId: empId,
      meslekKodu: flags.stajyer ? "9999.01" : isMgr ? "1211.01" : "2421.03",
      csgbIskolu: "07",
      gorevKodu: isMgr ? "01" : "02",
      sigortaliTuru: flags.emekli ? "2" : flags.stajyer ? "7" : flags.foreign ? "4" : "0",
      belgeTuru: flags.stajyer ? "02" : null,
      eskiHukumlu: false,
      kismiSureliCalisiyor: part,
      ogrenimKodu: /Doktora/.test(profName) ? "7" : /Yüksek/.test(profName) ? "6" : flags.stajyer ? "3" : "5",
      mezuniyetBolumu: "İşletme",
      mezuniyetYili: 2010 + (n % 12),
    });
    const row = { sicil: p.sicil, email: p.email, employeeId: empId, positionId: posId, unitId: ou.id };
    state.people[p.sicil] = row;
    saveState(state);
    return row;
  }

  const mgr = await createOrReusePerson(ROSTER.manager, true);
  state.mgrPosId = mgr.positionId;
  saveState(state);

  {
    let list = arr(unwrap(await api("GET", `/api/UnitPayrollFlowStep/ownerOrganizationalUnit/${ou.id}`)));
    if (!list.length) list = arr(unwrap(await api("GET", `/api/UnitPayrollFlowStep/by-unit/${ou.id}`)));
    for (const st of list) if (st.id) await api("DELETE", `/api/UnitPayrollFlowStep/${st.id}`);
    const r = await api("POST", "/api/UnitPayrollFlowStep", {
      step: 1,
      approvalUnitPositionId: mgr.positionId,
      ownerOrganizationalUnitId: ou.id,
    });
    log("PAYROLL_FLOW", r.status, ok(r) ? "ok" : errText(r));
  }

  for (const p of ROSTER.people) {
    try {
      const row = await createOrReusePerson(p, false);
      await setPosFlows(row.positionId, mgr.positionId);
    } catch (e) {
      log("FAIL person", p.sicil, String(e.message || e));
      state.failed.push({ sicil: p.sicil, err: String(e.message || e) });
    }
  }
  saveState(state);
  log("PEOPLE", Object.keys(state.people).length, "failed", state.failed.length);

  log("PHASE extras");
  const overtimeTypes = arr(unwrap(await api("GET", "/api/OvertimeType/all")));
  const otGross =
    overtimeTypes.find((t) => /hafta i[cç]i/i.test(t.name || "") && t.organizationalUnitId === ROOT) || overtimeTypes[0];

  async function addPv(sicil, payName, value, desc) {
    const row = state.people[sicil];
    const paymentId = state.payments[payName];
    if (!row || !paymentId || !value) return;
    const r = await api("POST", "/api/PaymentValue", {
      paymentId,
      employeeId: row.employeeId,
      value,
      date: "2026-01-15",
      description: desc,
    });
    log("PV", sicil, payName, value, r.status, ok(r) ? unwrap(r)?.id : errText(r));
  }
  await addPv("6221", "Prim", 5000, "Tek değişken prim");
  await addPv("6222", "İkramiye", 10000, "Tek değişken ikramiye");
  await addPv("6223", "Genel Kesinti", 1200, "Tek değişken kesinti");
  await addPv("6224", "Masraf", 750, "Tek değişken masraf");

  {
    const row = state.people["6219"];
    if (row) {
      // Günlük FM tavanı 3 saat — 12 saati 4 güne böl.
      const otDays = [
        ["2026-01-08T18:00:00", "2026-01-08T21:00:00"],
        ["2026-01-09T18:00:00", "2026-01-09T21:00:00"],
        ["2026-01-12T18:00:00", "2026-01-12T21:00:00"],
        ["2026-01-13T18:00:00", "2026-01-13T21:00:00"],
      ];
      for (const [startDate, endDate] of otDays) {
        const r = await api("POST", "/api/EmployeeOvertimeRequest/assign", {
          title: "Tek değişken FM 3s",
          description: "12 saat brüt (günlük 3s × 4 gün)",
          startDate,
          endDate,
          targetEmployeeId: row.employeeId,
          overtimeTypeId: otGross?.id,
          compensationMode: 0,
        });
        log("OT 6219", startDate.slice(0, 10), r.status, ok(r) ? unwrap(r)?.id : errText(r));
      }
    }
  }
  {
    const techno = arr(unwrap(await api("GET", `/api/TechnoparkProject/by-unit?unitId=${ROOT}`)))[0];
    async function assignTechno(sicil, isciTuru) {
      const row = state.people[sicil];
      if (!row || !techno?.id) return;
      const r = await api("POST", "/api/TechnoparkProject/assign", {
        employeeId: row.employeeId,
        technoparkProjectId: techno.id,
        startDate: "2026-01-01T00:00:00",
        isciTuru,
        destekOncelik: isciTuru === "2" ? 1 : null,
        acikAtamayiKapat: false,
      });
      log("TECHNO", sicil, isciTuru, r.status, ok(r) ? "ok" : errText(r));
    }
    await assignTechno("6208", "1");
    await assignTechno("6209", "2");
  }
  {
    const row = state.people["6220"];
    if (row) {
      const r = await api("POST", "/api/AdvanceRequest/assign", {
        targetEmployeeId: row.employeeId,
        employeeId: row.employeeId,
        advanceType: 1,
        requestedAmount: 7200,
        numberOfInstallments: 1,
        expectedRepaymentStartDate: "2026-01-01",
        purpose: "Tek değişken avans",
      });
      log("ADV 6220", r.status, ok(r) ? unwrap(r)?.id : errText(r));
      if (!ok(r)) {
        const r2 = await api("POST", "/api/AdvanceRequest", {
          advanceType: 1,
          requestedAmount: 7200,
          numberOfInstallments: 1,
          expectedRepaymentStartDate: "2026-01-01",
          purpose: "Tek değişken avans",
          employeeId: row.employeeId,
        });
        log("ADV2 6220", r2.status, ok(r2) ? unwrap(r2)?.id : errText(r2));
      }
    }
  }

  log("PHASE period");
  const empIds = ROSTER.people.map((p) => state.people[p.sicil]?.employeeId).filter(Boolean);
  let periods = arr(unwrap(await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")));
  let period = periods.find(
    (p) => p.year === 2026 && p.month === 1 && (p.organizationalUnitId === ou.id || p.organizationalUnit?.id === ou.id)
  );
  if (!period?.id) {
    const c = await api("POST", "/api/PayrollPeriod/create-async", {
      month: 1,
      year: 2026,
      organizationalUnitId: ou.id,
      hasSgkDebt: false,
      employeeIds: empIds,
    });
    const d = unwrap(c);
    log("PERIOD_CREATE", c.status, JSON.stringify(d).slice(0, 240), errText(c));
    if (d?.jobId) await waitJob(d.jobId, 180000);
    const periodId = d?.periodId || d?.id;
    if (periodId) period = unwrap(await api("GET", `/api/PayrollPeriod/${periodId}`)) || { id: periodId };
    else {
      periods = arr(unwrap(await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")));
      period = periods.find(
        (p) => p.year === 2026 && p.month === 1 && (p.organizationalUnitId === ou.id || p.organizationalUnit?.id === ou.id)
      );
    }
  }
  if (period?.id && empIds.length) {
    const add = await api("POST", `/api/PayrollPeriod/${period.id}/employees`, { employeeIds: empIds });
    log("PERIOD_ADD", empIds.length, add.status, ok(add) ? "ok" : errText(add));
  }
  if (period?.id) state.periods.ocak = { id: period.id, year: 2026, month: 1, ou: ou.id, count: empIds.length };
  saveState(state);
  log("PERIOD", period?.id, "people", empIds.length);

  if (period?.id) {
    log("PHASE puantaj UI");
    await page.goto(BASE + "/payroll-management", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.getByText(/^Dönemler$/).first().click().catch(() => {});
    await page.waitForTimeout(4000);
    const card = await page.evaluate(() => {
      const leaves = [...document.querySelectorAll("span, div")].filter(
        (el) => el.children.length === 0 && /Tek De[gğ]i[sş]ken/i.test((el.textContent || "").trim())
      );
      for (const leaf of leaves) {
        let c = leaf;
        for (let i = 0; i < 10 && c; i++) {
          c = c.parentElement;
          if (!c) break;
          const t = (c.innerText || "").replace(/\s+/g, " ").trim();
          if (c.querySelector("input[type=checkbox]") && t.length < 180) {
            let month = "?";
            let g = c;
            while (g && month === "?") {
              const m = (g.innerText || "").replace(/\s+/g, " ").match(/(OCAK|ŞUBAT|MART) \d{4}/);
              if (m) month = m[0];
              g = g.parentElement;
            }
            if (/OCAK 2026/i.test(month)) {
              leaf.click();
              return { month, t: t.slice(0, 160) };
            }
            break;
          }
        }
      }
      return null;
    });
    log("CARD", JSON.stringify(card));
    await page.waitForTimeout(2500);
    const goPuantaj = page.locator("button", { hasText: /Puantaja git/ }).first();
    if (await goPuantaj.count()) {
      await goPuantaj.click();
      await page.waitForTimeout(6000);
      const saveBtn = page.locator("button", { hasText: /^Kaydet \(\d+\)$/ }).first();
      log("SAVE_BTN", await saveBtn.count(), (await saveBtn.innerText().catch(() => "")).trim());
      if (await saveBtn.count()) {
        await saveBtn.click();
        await page.waitForTimeout(2500);
        const confirm = page.locator("button", { hasText: /^(Kaydet|Onayla|Evet|Tamam|Devam)$/ }).last();
        if (await confirm.count()) await confirm.click().catch(() => {});
        await page.waitForTimeout(8000);
      }
    }

    let p = unwrap(await api("GET", `/api/PayrollPeriod/${period.id}`));
    const attSaved = (p?.periodEmployees || []).filter((e) => e.isPayrollAttendanceSaved).length;
    log("ATT_SAVED", attSaved, "/", (p?.periodEmployees || []).length, "status", p?.payrollStatus);
    if (attSaved < (p?.periodEmployees || []).length) {
      const auto = await api("POST", `/api/PayrollPeriod/${period.id}/attendance/bulk-save-auto`, {
        filter: null,
        search: null,
        onlyFullyDerived: false,
      });
      log("ATT_AUTO", auto.status, JSON.stringify(unwrap(auto) || auto.data).slice(0, 200));
      p = unwrap(await api("GET", `/api/PayrollPeriod/${period.id}`));
    }

    const calc = await api("POST", `/api/PayrollPeriod/${period.id}/calculate`, { onlyStaleEmployees: false });
    const jobId = unwrap(calc.data)?.jobId;
    log("CALC", calc.status, jobId, errText(calc));
    for (let i = 0; i < 48; i++) {
      await sleep(5000);
      const job = jobId ? unwrap(await api("GET", `/api/background-jobs/${jobId}`)) : null;
      p = unwrap(await api("GET", `/api/PayrollPeriod/${period.id}`));
      const pes = p?.periodEmployees || [];
      const withItems = pes.filter((e) => (e.payrollItemValues || []).length).length;
      log(`POLL ${i} job=${job?.jobStatus} pct=${job?.progressPercent} items=${withItems}/${pes.length}`);
      if (job && job.jobStatus !== 0 && job.jobStatus !== 1 && i >= 1) break;
    }
    p = unwrap(await api("GET", `/api/PayrollPeriod/${period.id}`));
    fs.writeFileSync(DUMP_PATH, JSON.stringify(p, null, 1));
    const pes = p?.periodEmployees || [];
    log("DUMP", DUMP_PATH, "employees", pes.length, "withItems", pes.filter((e) => (e.payrollItemValues || []).length).length);
  }

  log("DONE failed", state.failed.length);
  await browser.close();
})().catch((e) => {
  console.error(e);
  try {
    fs.appendFileSync(LOG_PATH, "FATAL " + e.stack + "\n");
  } catch {}
  process.exit(1);
});
