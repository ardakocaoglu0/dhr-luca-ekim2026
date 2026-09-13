/**
 * Faz 1 Bordro Laboratuvarı seed — dhrtest.
 * Never PUT/DELETE existing D1-Tech kanun/PEK/GV/Payment.
 * Never touch IK 6101–6132, BT, Sude.
 * Employee creates via in-page fetch after UI login.
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
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "src", "data", "faz1_roster.json"), "utf8"));
const STATE_PATH = path.join(process.env.TEMP, "faz1_seed_state.json");
const LOG_PATH = path.join(process.env.TEMP, "faz1_seed.log");

const ROOT = "d93d6660-892d-4dcf-8fc2-36bed171017a";
const IK = "6e473120-9b10-48d1-81df-08b4f798e4dd";
const BT = "c358d645-00b6-4a78-b0e1-e1aad87e4df2";
const EXISTING_OP = "a0670870-911b-468c-8ab9-63b85e40e1cf";
const PROTECTED_OU = new Set([IK, BT, EXISTING_OP]);

const LAW = {
  "05510_2": "5ca750a5-ec83-4a19-a9c9-c6320f989af7",
  "05510_5": "72542ce6-edf0-4a46-a770-cccf0f79246d",
  "5746_05746": "9ccf41e0-027e-4cae-8621-8629de05a749",
  "5746_15746": "67cf8ebb-6394-429a-968f-e2d8d495df28",
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
    return {
      units: {},
      roles: {},
      payments: {},
      profiles: {},
      people: {},
      leaveTypes: {},
      periods: {},
      notes: [],
      failed: [],
    };
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
function assertNotProtected(unitId, label) {
  if (PROTECTED_OU.has(unitId)) throw new Error("protected unit write blocked: " + label + " " + unitId);
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

  async function ensureUnit(key, name, parentId, allowRoot) {
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
    if (parentId) assertNotProtected(parentId, "ensureUnit-parent " + name);
    const bodies = parentId
      ? [
          { name, parentId, location },
          { name, parentId },
        ]
      : allowRoot
        ? [{ name, location }, { name, parentId: null, location }]
        : [];
    for (const b of bodies) {
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

  // --- 1) Units ---
  log("PHASE units");
  const lab = await ensureUnit("lab", "Bordro Laboratuvarı", ROOT);
  let ana = await ensureUnit("ana", "Ana Kadro", lab.id);
  let op;
  try {
    op = await ensureUnit("operasyon", "Operasyon", lab.id);
    if (op.id === EXISTING_OP) throw new Error("hit existing Operasyon");
  } catch (e) {
    log("OP_NAME_FALLBACK", String(e.message || e));
    op = await ensureUnit("operasyon", "Bordro Operasyon", lab.id);
  }
  const kenar = await ensureUnit("kenar", "Kenar Durumlar", ROOT);
  const yuv = await ensureUnit("yuvarlama", "Yuvarlama", ROOT);
  const takvim = await ensureUnit("takvim", "Takvim", ROOT);
  const blokaj = await ensureUnit("blokaj", "Blokaj", ROOT);
  let sirketB;
  try {
    sirketB = await ensureUnit("sirket-b", "Faz1 Bordro A.Ş.", null, true);
  } catch (e) {
    log("COMPANY_B_ROOT_FAIL", String(e.message || e));
    sirketB = await ensureUnit("sirket-b", "Faz1 Bordro A.Ş.", ROOT);
    state.notes.push("Şirket B D1 çocuğu olarak kuruldu (root create reddedildi)");
  }
  let sube;
  try {
    sube = await ensureUnit("sube", "D1-Tech Şube", ROOT);
  } catch (e) {
    log("SUBE_FAIL", String(e.message || e));
    state.notes.push("D1-Tech Şube oluşturulamadı: " + String(e.message || e));
  }
  const unitByKey = {
    lab,
    ana,
    operasyon: op,
    kenar,
    yuvarlama: yuv,
    takvim,
    blokaj,
    "sirket-b": sirketB,
  };
  log("UNITS", Object.fromEntries(Object.entries(unitByKey).map(([k, u]) => [k, u?.id])));

  const faz1UnitIds = new Set(Object.values(unitByKey).map((u) => u?.id).filter(Boolean));
  if (sube?.id) faz1UnitIds.add(sube.id);

  // --- 2) Payments (create missing only) ---
  log("PHASE payments");
  let payments = arr(unwrap(await api("GET", "/api/Payment/filteredByUnitAbilities")));
  const rootPays = payments.filter((p) => p.organizationalUnitId === ROOT);
  function payId(name, ouId) {
    const pool = payments.filter((p) => !ouId || p.organizationalUnitId === ouId || p.organizationalUnitId === ROOT);
    const hit = pool.find((p) => eqName(p.name, name));
    return hit?.id;
  }
  async function ensurePayment(name, templateName, extra, ouId) {
    const existing = payments.find((p) => eqName(p.name, name) && (!ouId || p.organizationalUnitId === ouId || p.organizationalUnitId === ROOT));
    if (existing) {
      state.payments[name] = existing.id;
      return existing;
    }
    const src = rootPays.find((p) => eqName(p.name, templateName)) || rootPays.find((p) => /prim/i.test(p.name)) || rootPays[0];
    if (!src) throw new Error("no payment template for " + name);
    const owner = ouId || ROOT;
    if (owner !== ROOT) assertNotProtected(owner, "payment " + name);
    const body = {
      name,
      organizationalUnitId: owner,
      isEmployeeExpenseAllowed: extra.isEmployeeExpenseAllowed ?? !!src.isEmployeeExpenseAllowed,
      isDocumentRequired: extra.isDocumentRequired ?? !!src.isDocumentRequired,
      isFixed: extra.isFixed ?? !!src.isFixed,
      paymentCategory: extra.paymentCategory ?? src.paymentCategory,
      prorationBasis: src.prorationBasis,
      isExemptFromMissingDays: extra.isExemptFromMissingDays ?? !!src.isExemptFromMissingDays,
      displayOrder: src.displayOrder,
      prorationMethodOverride: src.prorationMethodOverride ?? null,
      paymentMethod: src.paymentMethod,
      allowCashExemption: !!src.allowCashExemption,
      isNet: extra.isNet ?? !!src.isNet,
      sgkEarningKind: extra.sgkEarningKind ?? src.sgkEarningKind ?? 0,
    };
    const r = await api("POST", "/api/Payment", body);
    log("PAY_CREATE", name, r.status, ok(r) ? unwrap(r)?.id : errText(r));
    if (ok(r) && unwrap(r)?.id) {
      payments.push(unwrap(r));
      state.payments[name] = unwrap(r).id;
      return unwrap(r);
    }
    state.failed.push({ step: "payment", name, err: errText(r) });
    return null;
  }
  for (const n of ["Temel Maaş", "Yemek Yardımı", "Yol Yardımı", "Özel Sağlık Sigortası (İşveren)", "BES İşveren Katkısı", "Prim", "İkramiye", "Genel Kesinti", "Masraf", "Fazla Mesai"]) {
    const id = payId(n, ROOT);
    if (id) state.payments[n] = id;
  }
  await ensurePayment("İcra", "Genel Kesinti", { paymentCategory: "Deduction", isFixed: false, isNet: false }, ROOT);
  await ensurePayment("Net Fazla Mesai", "Fazla Mesai", { isNet: true, isFixed: false, paymentCategory: "Earning" }, ROOT);
  await ensurePayment("Yuvarlama Farkı", "Prim", { isFixed: false, isNet: false, isExemptFromMissingDays: true, sgkEarningKind: 0 }, ROOT);
  saveState(state);

  async function clonePaysTo(ou) {
    if (!ou?.id || ou.id === ROOT) return;
    assertNotProtected(ou.id, "clonePays");
    payments = arr(unwrap(await api("GET", "/api/Payment/filteredByUnitAbilities")));
    const local = payments.filter((p) => p.organizationalUnitId === ou.id);
    for (const src of rootPays) {
      if (local.find((p) => eqName(p.name, src.name))) continue;
      const body = {
        name: src.name,
        organizationalUnitId: ou.id,
        isEmployeeExpenseAllowed: !!src.isEmployeeExpenseAllowed,
        isDocumentRequired: !!src.isDocumentRequired,
        isFixed: !!src.isFixed,
        paymentCategory: src.paymentCategory,
        prorationBasis: src.prorationBasis,
        isExemptFromMissingDays: !!src.isExemptFromMissingDays,
        displayOrder: src.displayOrder,
        prorationMethodOverride: src.prorationMethodOverride ?? null,
        paymentMethod: src.paymentMethod,
        allowCashExemption: !!src.allowCashExemption,
        isNet: !!src.isNet,
        sgkEarningKind: src.sgkEarningKind ?? 0,
      };
      const r = await api("POST", "/api/Payment", body);
      log("PAY_CLONE", ou.name, src.name, r.status, ok(r) ? "ok" : errText(r));
      await sleep(40);
    }
  }
  if (sirketB?.id && sirketB.id !== ROOT) await clonePaysTo(sirketB);

  // --- 3) Profiles (assign ROOT; clone to Company B if needed) ---
  async function profilesFor(ouId) {
    return arr(unwrap(await api("GET", `/api/PayrollProfile/ownerOrganizationalUnit/${ouId}`))).filter((p) => p.status !== 3);
  }
  let rootProfiles = await profilesFor(ROOT);
  state.profiles = Object.fromEntries(rootProfiles.map((p) => [p.name, p.id]));
  async function cloneProfilesTo(ou) {
    if (!ou?.id || ou.id === ROOT) return;
    let local = await profilesFor(ou.id);
    for (const src of rootProfiles) {
      if (local.find((p) => eqName(p.name, src.name))) continue;
      const body = { name: src.name, description: src.description || "", organizationalUnitId: ou.id };
      if (src.disabilityDegree != null) body.disabilityDegree = src.disabilityDegree;
      const r = await api("POST", "/api/PayrollProfile", body);
      log("PROFILE_CLONE", ou.name, src.name, r.status, ok(r) ? "ok" : errText(r));
      await sleep(40);
    }
  }
  if (sirketB?.id && sirketB.id !== ROOT) await cloneProfilesTo(sirketB);

  // --- 4) Roles ---
  log("PHASE roles");
  const rootRoles = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${ROOT}/roles`)));
  const tplIk = rootRoles.find((r) => r.name === "İK");
  const tplCal = rootRoles.find((r) => r.name === "Çalışan");
  const tplMgr = rootRoles.find((r) => /yönetici|yonetici/i.test(r.name || ""));
  const ikAbs = (tplIk?.roleAbilities || []).map((a) => a.abilityId).filter(Boolean);
  const calAbs = (tplCal?.roleAbilities || []).map((a) => a.abilityId).filter(Boolean);
  const richAbs = ikAbs.length ? ikAbs : calAbs;

  async function ensureRoles(ou) {
    if (!ou?.id) return {};
    assertNotProtected(ou.id, "roles");
    let roles = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${ou.id}/roles`)));
    for (const name of ["İK", "Çalışan", "Yönetici"]) {
      if (!roles.find((r) => eqName(r.name, name))) {
        const r = await api("POST", "/api/Role", { name, organizationalUnitId: ou.id });
        log("ROLE", ou.name, name, r.status, ok(r) ? "ok" : errText(r));
      }
    }
    roles = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${ou.id}/roles`)));
    const roleIk = roles.find((r) => r.name === "İK");
    const roleCal = roles.find((r) => r.name === "Çalışan");
    const roleMgr = roles.find((r) => /yönetici|yonetici/i.test(r.name || "")) || roleIk;
    if (roleIk && ikAbs.length) await api("POST", "/api/RoleAbility/bulk-update", { roleId: roleIk.id, abilityIds: ikAbs });
    if (roleMgr && ikAbs.length) await api("POST", "/api/RoleAbility/bulk-update", { roleId: roleMgr.id, abilityIds: ikAbs });
    if (roleCal && richAbs.length) await api("POST", "/api/RoleAbility/bulk-update", { roleId: roleCal.id, abilityIds: richAbs });
    const out = { ik: roleIk?.id, calisan: roleCal?.id, yonetici: roleMgr?.id, thinCalisanAbs: calAbs };
    state.roles[ou.id] = out;
    return out;
  }
  for (const u of Object.values(unitByKey)) await ensureRoles(u);
  saveState(state);

  // Lara: restore thin Çalışan after bulk rich copy — we'll assign thin abilities only on her user later via a dedicated role if possible.
  // Create "Çalışan (sınırlı)" on Kenar.
  {
    let roles = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${kenar.id}/roles`)));
    if (!roles.find((r) => eqName(r.name, "Çalışan (sınırlı)"))) {
      await api("POST", "/api/Role", { name: "Çalışan (sınırlı)", organizationalUnitId: kenar.id });
      roles = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${kenar.id}/roles`)));
    }
    const thin = roles.find((r) => eqName(r.name, "Çalışan (sınırlı)"));
    if (thin && calAbs.length) await api("POST", "/api/RoleAbility/bulk-update", { roleId: thin.id, abilityIds: calAbs });
    state.roles[kenar.id].limited = thin?.id;
  }

  // --- 5) Hours / leave / holidays / night / advance / payroll setting ---
  log("PHASE settings");
  const hours = arr(unwrap(await api("GET", "/api/WorkingHourType/all")));
  function pickHour(ouId, part) {
    const local = hours.filter((h) => h.organizationalUnitId === ouId);
    const pool = local.length ? local : hours.filter((h) => h.organizationalUnitId === ROOT);
    const list = pool.length ? pool : hours;
    if (part) return list.find((h) => /yar[ıi]m|k[ıi]smi|part/i.test(h.name || "")) || list[0];
    return (
      list.find((h) => /tam g[uü]n 09/i.test(h.name || "")) ||
      list.find((h) => /tam g[uü]n|full/i.test(h.name || "")) ||
      list[0]
    );
  }
  const whFull = pickHour(ROOT, false);
  const whPart = pickHour(ROOT, true);
  log("WH", whFull?.name, whFull?.id, "PART", whPart?.name);

  async function copyPayrollSetting(ou) {
    if (!ou?.id) return;
    assertNotProtected(ou.id, "payrollSetting");
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
    log("PayrollSetting", ou.name, ps.status, ok(ps));
  }
  for (const u of Object.values(unitByKey)) await copyPayrollSetting(u);

  async function ensureAdvance(ou) {
    if (!ou?.id) return;
    assertNotProtected(ou.id, "advance");
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
    if (!ok(r)) r = await api("PUT", "/api/AdvanceSetting", body);
    log("AdvanceSetting", ou.name, r.status, ok(r));
  }
  for (const u of Object.values(unitByKey)) await ensureAdvance(u);

  const allLeave = arr(unwrap(await api("GET", "/api/LeaveType/all"))).concat(
    arr(unwrap(await api("GET", "/api/LeaveType/filteredByUnitAbilities")))
  );
  const tplPaid = allLeave.find((t) => t.isPaidLeave && /yıllık|yillik/i.test(t.name || "")) || allLeave.find((t) => t.isPaidLeave);
  const tplUnpaid = allLeave.find((t) => /ücretsiz|ucretsiz/i.test(t.name || ""));
  const tplReport = allLeave.find((t) => /rapor|hastalık|hastalik|sick/i.test(t.name || ""));

  async function ensureLeaveTypes(ou) {
    assertNotProtected(ou.id, "leave");
    let list = arr(unwrap(await api("GET", `/api/OrganizationalUnit/${ou.id}/leave-types`)));
    if (!list.length) list = allLeave.filter((t) => t.organizationalUnitId === ou.id);
    async function one(name, paid, equivalence, tpl) {
      let hit = list.find((t) => eqName(t.name, name)) || list.find((t) => new RegExp(name.split(" ")[0], "i").test(t.name || ""));
      if (hit) return hit;
      const body = {
        name,
        description: "Faz1 " + name,
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
      };
      const r = await api("POST", "/api/LeaveType", body);
      log("LEAVE_TYPE", ou.name, name, r.status, ok(r) ? unwrap(r)?.id : errText(r));
      return unwrap(r);
    }
    const annual = await one("Yıllık İzin", true, "ANNUAL", tplPaid);
    const unpaid = await one("Ücretsiz İzin", false, "UNPAID", tplUnpaid);
    const report = await one("Rapor", true, "SICK", tplReport || tplPaid);
    state.leaveTypes[ou.id] = { annual: annual?.id, unpaid: unpaid?.id, report: report?.id };
    return state.leaveTypes[ou.id];
  }
  for (const u of [ana, op, kenar, yuv, takvim, blokaj, lab, sirketB]) if (u?.id) await ensureLeaveTypes(u);

  async function ensureHolidays(ou, extra) {
    assertNotProtected(ou.id, "holiday");
    const existing = arr(unwrap(await api("GET", `/api/PublicHoliday/ownerOrganizationalUnit/${ou.id}`)));
    const profiles = arr(unwrap(await api("GET", `/api/OrganizationalUnitProfile/organizationalUnit/${ou.id}`)));
    const holidayProfiles = profiles.filter((p) => p.isPublicHolidayEnabled && p.status !== 3);
    const profileIds = holidayProfiles.map((p) => p.id);
    const want = extra ? HOLIDAYS_2026.concat(extra) : HOLIDAYS_2026;
    for (const h of want) {
      const dup = existing.find((x) => eqName(x.name, h.name) && String(x.startDate || "").slice(0, 10) === h.start.slice(0, 10));
      if (dup) continue;
      const r = await api("POST", "/api/PublicHoliday", {
        name: h.name,
        description: h.description || "2026 resmi tatil",
        startDate: h.start,
        endDate: h.end,
        ownerOrganizationalUnitId: ou.id,
        profileIds,
      });
      if (!ok(r)) log("HOLIDAY_FAIL", ou.name, h.name, errText(r));
      else existing.push({ name: h.name, startDate: h.start });
      await sleep(20);
    }
    const after = arr(unwrap(await api("GET", `/api/PublicHoliday/ownerOrganizationalUnit/${ou.id}`)));
    const ids = after.map((h) => h.id).filter(Boolean);
    for (const p of holidayProfiles) {
      await api("PUT", `/api/OrganizationalUnitProfile/${p.id}/public-holidays`, ids);
    }
    log("HOLIDAYS", ou.name, after.length);
  }
  for (const u of [ana, kenar, yuv, takvim, blokaj, lab, sirketB]) if (u?.id) await ensureHolidays(u);
  await ensureHolidays(op, [
    {
      name: "Operasyon Faz1 07.09",
      start: "2026-09-07T00:00:00",
      end: "2026-09-07T23:59:00",
      description: "EDGE-025 / PAY-PNT-006 yalnız Operasyon",
    },
  ]);

  const shifts = arr(unwrap(await api("GET", "/api/ShiftTemplate/all")));
  let night = shifts.find((t) => /23:00/.test(t.name || "") && /07:00/.test(t.name || ""));
  if (!night) {
    const r = await api("POST", "/api/ShiftTemplate", {
      name: "Gece 23:00–07:00",
      code: "FAZ1-GECE",
      description: "EDGE-026 gece vardiyası 31.08 23:00–01.09 07:00",
      ownerOrganizationalUnitId: kenar.id,
      paidBreakMinutes: 0,
      unpaidBreakMinutes: 0,
      startLocalTime: "23:00:00",
      endLocalTime: "07:00:00",
      color: "#2f54eb",
      isNightShift: true,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
    });
    log("NIGHT_SHIFT", r.status, ok(r) ? unwrap(r)?.id : errText(r));
    night = unwrap(r);
  }
  state.nightShiftId = night?.id;

  // SGK copy to new units / sube / company B — do not PUT D1 existing sicil
  const sgkRoot = unwrap(await api("GET", `/api/OrganizationalUnitSgkSetting/effective/${ROOT}`));
  async function copySgk(ou, sicilOverride) {
    if (!ou?.id) return;
    const own = unwrap(await api("GET", `/api/OrganizationalUnitSgkSetting/by-unit/${ou.id}`));
    if (own?.id && !sicilOverride) return;
    if (!sgkRoot) return;
    const blank = { ...sgkRoot };
    delete blank.id;
    delete blank.createdBy;
    delete blank.createdDate;
    delete blank.modifiedDate;
    delete blank.status;
    delete blank.organizationalUnit;
    blank.organizationalUnitId = ou.id;
    if (sicilOverride) {
      blank.isyeriSicil = sicilOverride;
      blank.isyeriUnvan = (blank.isyeriUnvan || "D1-Tech") + " Şube";
      blank.subeNo = blank.subeNo || "002";
    }
    let up = await api("POST", "/api/OrganizationalUnitSgkSetting/upsert", blank);
    if (!ok(up)) up = await api("POST", "/api/OrganizationalUnitSgkSetting", blank);
    log("SGK", ou.name, up.status, ok(up), sicilOverride || "");
  }
  for (const u of [lab, ana, op, kenar, yuv, takvim, blokaj]) await copySgk(u);
  if (sube?.id) {
    const baseSicil = String(sgkRoot?.isyeriSicil || "123456789");
    const next = baseSicil.replace(/\d$/, (d) => String((Number(d) + 1) % 10));
    await copySgk(sube, next === baseSicil ? baseSicil + "2" : next);
  }
  if (sirketB?.id && sirketB.id !== ROOT) await copySgk(sirketB, "987654321");

  // Ar-Ge center probe
  const argePaths = [
    "/api/RdCenter",
    "/api/ArgeCenter",
    "/api/ResearchAndDevelopmentCenter",
    "/api/PayrollRdCenter",
    "/api/IncentiveCenter",
    "/api/ArgeProject",
    "/api/RdProject",
    "/api/PayrollIncentiveProject",
  ];
  for (const p of argePaths) {
    const g = await api("GET", p + "/all");
    const g2 = g.status === 404 ? await api("GET", p) : g;
    if (ok(g2)) {
      log("ARGE_HIT", p, g2.status, arr(unwrap(g2)).length);
      state.argeEndpoint = p;
      const rows = arr(unwrap(g2));
      if (!rows.length) {
        const cr = await api("POST", p, {
          name: "Faz1 Ar-Ge Merkezi",
          code: "FAZ1-ARGE",
          organizationalUnitId: kenar.id,
          quota: 1,
          destekKota: 1,
        });
        log("ARGE_CREATE", cr.status, ok(cr) ? unwrap(cr)?.id : errText(cr));
      }
      break;
    }
  }

  saveState(state);

  // --- 6) People ---
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

  function profileIdFor(name, ouId) {
    if (ouId && ouId === sirketB?.id && sirketB.id !== ROOT) {
      // resolved later if cloned
    }
    return state.profiles[name] || state.profiles["Standart"];
  }
  function rolesFor(ou) {
    return state.roles[ou.id] || {};
  }
  function mgrPosFor(ou) {
    return state.berkPositions?.[ou.id] || state.berkPositions?.[lab.id] || null;
  }

  async function setPosFlows(posId, approverPosId) {
    if (!posId || !approverPosId) return;
    for (const kind of POS_FLOWS) {
      const body = { step: 1, approvalUnitPositionId: approverPosId, ownerUnitPositionId: posId };
      const r = await api("POST", `/api/${kind}`, body);
      if (!ok(r) && r.status !== 409) log("POS_FLOW", kind, r.status, errText(r));
    }
  }

  async function createOrReusePerson(p) {
    if (state.people[p.sicil]?.employeeId) return state.people[p.sicil];
    const existing = emps.find((e) => String(e.employeeNumber) === String(p.sicil)) || emps.find((e) => String(e.email || "").toLowerCase() === p.email);
    const ou = unitByKey[p.unit];
    if (!ou) throw new Error("no unit for " + p.sicil);
    assertNotProtected(ou.id, "person " + p.sicil);
    const n = parseInt(p.sicil, 10);
    if ((n >= 6101 && n <= 6132) || (n >= 7001 && n <= 7016)) throw new Error("protected sicil " + p.sicil);
    const rs = rolesFor(ou);
    const isMgr = !!(p.seedFlags && (p.seedFlags.isManager || p.seedFlags.companyBManager));
    const limited = !!(p.seedFlags && p.seedFlags.limitedEmployeeRole);
    const roleId = limited ? rs.limited || rs.calisan : isMgr ? rs.yonetici || rs.ik : rs.calisan;
    const part = !!(p.seedFlags && p.seedFlags.partTime);
    const wh = part ? whPart : whFull;
    let empId = existing?.id;
    let posId = existing ? positions.find((x) => x.employeeId === empId && x.organizationalUnitId === ou.id)?.id : null;
    if (!empId) {
      if (usedEmails.has(p.email.toLowerCase())) {
        const reuse = emps.find((e) => String(e.email || "").toLowerCase() === p.email.toLowerCase());
        if (reuse) empId = reuse.id;
      }
    }
    if (!empId) {
      const createEmp = await api("POST", "/api/Employee", {
        employeeNumber: String(p.sicil),
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        gender: p.gender,
        phoneNumber: `+90539${String(8000000 + n).slice(-7)}`,
        birthDate: `${1978 + (n % 20)}-${String((n % 12) + 1).padStart(2, "0")}-${String(5 + (n % 20)).padStart(2, "0")}T00:00:00`,
      });
      empId = unwrap(createEmp)?.id;
      if (!ok(createEmp) || !empId) throw new Error("emp " + p.sicil + " " + errText(createEmp));
      usedEmails.add(p.email.toLowerCase());
      emps.push({ id: empId, email: p.email, employeeNumber: String(p.sicil), firstName: p.firstName, lastName: p.lastName });
    }
    if (!posId) {
      const start = p.companyBHire && p.unit === "sirket-b" ? p.companyBHire : p.hire;
      const end = p.unit === "sirket-b" ? null : p.exit;
      const dm = p.seedFlags?.isManager ? null : mgrPosFor(ou);
      let createPos = await api("POST", "/api/OrganizationalUnitPosition", {
        title: p.title,
        organizationalUnitId: ou.id,
        employeeId: empId,
        roleId,
        workingHourTypeId: wh?.id ? JSON.stringify([wh.id]) : undefined,
        employmentType: part ? "Part-time" : "Full-time",
        hrManagerPositionId: dm,
        directManagerPositionId: dm,
        startDate: start,
        endDate: end,
        reminderEnabled: false,
        isTerminated: !!(p.seedFlags && p.seedFlags.terminated) || (!!end && p.unit !== "sirket-b" && p.sicil !== "8052" && p.sicil !== "8061"),
      });
      if (!ok(createPos)) {
        createPos = await api("POST", "/api/OrganizationalUnitPosition", {
          title: p.title,
          organizationalUnitId: ou.id,
          employeeId: empId,
          roleId,
          workingHourTypeId: wh?.id,
          employmentType: part ? "Part-time" : "Full-time",
          hrManagerPositionId: dm,
          directManagerPositionId: dm,
          startDate: start,
          endDate: end,
          reminderEnabled: false,
          isTerminated: !!(p.seedFlags && p.seedFlags.terminated),
        });
      }
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
    const PAY_SAGLIK = state.payments["Özel Sağlık Sigortası (İşveren)"];
    const PAY_BES = state.payments["BES İşveren Katkısı"];
    const PAY_ROUND = state.payments["Yuvarlama Farkı"];
    const vfYear = parseInt(String(p.hire || "2026").slice(0, 4), 10) || 2026;
    const vfMonth = parseInt(String(p.hire || "2026-01").slice(5, 7), 10) || 1;
    const fps = [];
    if (PAY_MAAS) fps.push({ paymentId: PAY_MAAS, value: p.maas, wageValue: p.maas, validFromYear: vfYear, validFromMonth: vfMonth });
    if (p.yemek && PAY_YEMEK) {
      const yolEnd = p.seedFlags?.yolEnd;
      fps.push({ paymentId: PAY_YEMEK, value: p.yemek, wageValue: p.yemek, validFromYear: vfYear, validFromMonth: vfMonth });
    }
    if (p.yol && PAY_YOL) {
      const item = { paymentId: PAY_YOL, value: p.yol, wageValue: p.yol, validFromYear: vfYear, validFromMonth: vfMonth };
      if (p.seedFlags?.yolEnd) {
        item.validToYear = 2026;
        item.validToMonth = 8;
      }
      fps.push(item);
    }
    if (p.saglik && PAY_SAGLIK) fps.push({ paymentId: PAY_SAGLIK, value: p.saglik, wageValue: p.saglik, validFromYear: vfYear, validFromMonth: vfMonth });
    if (p.besEmployer && PAY_BES) fps.push({ paymentId: PAY_BES, value: p.besEmployer, wageValue: p.besEmployer, validFromYear: vfYear, validFromMonth: vfMonth });
    if (p.roundingAddon && PAY_ROUND) fps.push({ paymentId: PAY_ROUND, value: p.roundingAddon, wageValue: p.roundingAddon, validFromYear: 2026, validFromMonth: 9 });
    if (p.seedFlags?.raisePct && PAY_MAAS) {
      const raised = Math.round(p.maas * (1 + p.seedFlags.raisePct / 100) * 100) / 100;
      fps.push({ paymentId: PAY_MAAS, value: raised, wageValue: raised, validFromYear: 2026, validFromMonth: 9 });
    }
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
    const profId = profileIdFor(profName, ou.id);
    if (profId && !(p.seedFlags && p.seedFlags.singleProfileAtSeed === false)) {
      const pr = await api("PUT", `/api/Employee/${empId}/payrollProfiles`, [profId]);
      if (!ok(pr)) log("WARN profile", p.sicil, errText(pr));
    }
    const lawId = p.law ? LAW[p.law] : null;
    const full = unwrap(await api("GET", `/api/Employee/${empId}`)) || {};
    const empPut = await api("PUT", `/api/Employee/${empId}`, {
      firstName: full.firstName || p.firstName,
      lastName: full.lastName || p.lastName,
      employeeNumber: full.employeeNumber || String(p.sicil),
      email: full.email || p.email,
      gender: full.gender || p.gender,
      phoneNumber: full.phoneNumber,
      birthDate: full.birthDate ? String(full.birthDate).slice(0, 10) : undefined,
      defaultPayrollLawVariantId: lawId,
      defaultPayrollLawFieldsJson: null,
      defaultTaxExemptionVariantId: p.tax || null,
    });
    if (!ok(empPut)) log("WARN empPut", p.sicil, errText(empPut));

    if (p.besEmployeePct) {
      await api("POST", "/api/EmployeeOksEnrollment/upsert", {
        employeeId: empId,
        oksStatus: 1,
        contributionRateOverride: p.besEmployeePct,
        enrollmentDate: "2026-01-06",
        withdrawalDate: p.besExit || null,
        pauseStartDate: null,
        pauseEndDate: null,
        pensionCompany: "Anadolu Hayat Emeklilik",
        certificateNumber: `AH-F1-${p.sicil}`,
      });
    } else if (p.seedFlags?.emekli) {
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
    if (p.seedFlags?.priorTaxFilled) {
      await api("PUT", `/api/Employee/${empId}/initialCumulativeTaxBase`, { value: 185000, year: 2026 });
    }
    if (p.seedFlags?.cumTaxBandMinus != null) {
      await api("PUT", `/api/Employee/${empId}/initialCumulativeTaxBase`, { value: 110000, year: 2026 });
    }
    if (tcField) {
      const tc = makeTckn(800000 + n);
      const fv = (full.employeeFieldValues || []).find((v) => v.employeeFieldId === tcField.id);
      if (fv?.id) {
        await api("PUT", `/api/EmployeeFieldValue/${fv.id}`, { id: fv.id, value: tc, employeeFieldId: tcField.id, employeeId: empId });
      } else {
        await api("POST", "/api/EmployeeFieldValue", { value: tc, employeeFieldId: tcField.id, employeeId: empId });
      }
    }
    if (!(p.skipSgk || p.seedFlags?.noSgkProfile)) {
      await api("POST", "/api/EmployeeSgkProfile/upsert", {
        employeeId: empId,
        meslekKodu: p.seedFlags?.stajyer ? "9999.01" : isMgr ? "1211.01" : "2421.03",
        csgbIskolu: "07",
        gorevKodu: isMgr ? "01" : "02",
        sigortaliTuru: p.seedFlags?.emekli ? "2" : p.seedFlags?.stajyer ? "7" : p.seedFlags?.foreign ? "4" : "0",
        belgeTuru: p.seedFlags?.stajyer ? "02" : null,
        eskiHukumlu: false,
        kismiSureliCalisiyor: part,
        ogrenimKodu: /Doktora/.test(profName) ? "7" : /Yüksek/.test(profName) ? "6" : p.seedFlags?.stajyer ? "3" : "5",
        mezuniyetBolumu: p.seedFlags?.arge ? "Bilgisayar Mühendisliği" : "İşletme",
        mezuniyetYili: 2010 + (n % 12),
      });
    }
    const approver = mgrPosFor(ou);
    if (approver && posId !== approver) await setPosFlows(posId, approver);
    const row = { sicil: p.sicil, email: p.email, employeeId: empId, positionId: posId, unitId: ou.id };
    state.people[p.sicil] = row;
    return row;
  }

  // Managers first
  const bySicil = Object.fromEntries(ROSTER.people.map((p) => [p.sicil, p]));
  await createOrReusePerson(bySicil["8001"]);
  state.berkPositions = state.berkPositions || {};
  state.berkPositions[lab.id] = state.people["8001"].positionId;

  async function cloneBerkTo(ou) {
    if (!ou?.id || state.berkPositions[ou.id]) return;
    const berk = state.people["8001"];
    const rs = rolesFor(ou);
    const existing = positions.find((x) => x.employeeId === berk.employeeId && x.organizationalUnitId === ou.id);
    if (existing) {
      state.berkPositions[ou.id] = existing.id;
      return;
    }
    const r = await api("POST", "/api/OrganizationalUnitPosition", {
      title: "Bordro Müdürü",
      organizationalUnitId: ou.id,
      employeeId: berk.employeeId,
      roleId: rs.yonetici || rs.ik,
      workingHourTypeId: whFull?.id ? JSON.stringify([whFull.id]) : undefined,
      employmentType: "Full-time",
      hrManagerPositionId: null,
      directManagerPositionId: null,
      startDate: "2026-01-06",
      endDate: null,
      reminderEnabled: false,
      isTerminated: false,
    });
    const id = unwrap(r)?.id;
    log("BERK_POS", ou.name, r.status, id || errText(r));
    if (id) {
      state.berkPositions[ou.id] = id;
      positions.push({ id, employeeId: berk.employeeId, organizationalUnitId: ou.id });
    }
  }
  for (const u of [ana, op, kenar, yuv, takvim, blokaj]) await cloneBerkTo(u);
  saveState(state);

  await createOrReusePerson(bySicil["8002"]);
  await createOrReusePerson(bySicil["8062"]);
  if (sirketB?.id) {
    state.berkPositions = state.berkPositions || {};
    // Company B manager is Eda, not Berk
  }

  // Empty Kenar approver position
  if (!state.emptyKenarPos) {
    const rs = rolesFor(kenar);
    const r = await api("POST", "/api/OrganizationalUnitPosition", {
      title: "Onay Yedek",
      organizationalUnitId: kenar.id,
      employeeId: null,
      roleId: rs.yonetici || rs.ik,
      workingHourTypeId: whFull?.id ? JSON.stringify([whFull.id]) : undefined,
      employmentType: "Full-time",
      startDate: "2026-01-06",
      endDate: null,
      reminderEnabled: false,
      isTerminated: false,
    });
    log("EMPTY_POS", r.status, unwrap(r)?.id || errText(r));
    state.emptyKenarPos = unwrap(r)?.id || null;
  }

  const ordered = ROSTER.people.filter((p) => !["8001", "8002", "8062"].includes(p.sicil));
  // Ozan Kenar first then B
  ordered.sort((a, b) => Number(a.sicil) - Number(b.sicil));
  for (const p of ordered) {
    try {
      if (p.sicil === "8061") {
        const kenarCopy = { ...p, unit: "kenar", group: "kenar-tesvik", companyBHire: null, exit: "2026-09-10" };
        const krow = await createOrReusePerson(kenarCopy);
        log("OK", p.sicil, "kenar", krow.employeeId);
        const rsB = rolesFor(sirketB);
        const extra = await api("POST", "/api/OrganizationalUnitPosition", {
          title: p.title,
          organizationalUnitId: sirketB.id,
          employeeId: krow.employeeId,
          roleId: rsB.calisan,
          workingHourTypeId: whFull?.id ? JSON.stringify([whFull.id]) : undefined,
          employmentType: "Full-time",
          hrManagerPositionId: state.people["8062"]?.positionId || null,
          directManagerPositionId: state.people["8062"]?.positionId || null,
          startDate: "2026-09-11",
          endDate: null,
          reminderEnabled: false,
          isTerminated: false,
        });
        log("OK", p.sicil, "sirket-b", extra.status, unwrap(extra)?.id || errText(extra));
        if (unwrap(extra)?.id) state.people["8061"].companyBPositionId = unwrap(extra).id;
      } else {
        const row = await createOrReusePerson(p);
        log("OK", p.sicil, p.email, row.employeeId);
        if (p.sicil === "8052" && p.rehire) {
          const extra = await api("POST", "/api/OrganizationalUnitPosition", {
            title: p.title,
            organizationalUnitId: kenar.id,
            employeeId: row.employeeId,
            roleId: rolesFor(kenar).calisan,
            workingHourTypeId: whFull?.id ? JSON.stringify([whFull.id]) : undefined,
            employmentType: "Full-time",
            hrManagerPositionId: mgrPosFor(kenar),
            directManagerPositionId: mgrPosFor(kenar),
            startDate: p.rehire,
            endDate: null,
            reminderEnabled: false,
            isTerminated: false,
          });
          log("REHIRE", p.sicil, extra.status, unwrap(extra)?.id || errText(extra));
        }
      }
    } catch (e) {
      state.failed.push({ sicil: p.sicil, err: String(e.message || e) });
      log("FAIL", p.sicil, String(e.message || e));
    }
    await sleep(80);
    if (Number(p.sicil) % 10 === 0) saveState(state);
  }
  saveState(state);
  log("PEOPLE_DONE", Object.keys(state.people).length, "failed", state.failed.length);

  // --- 7) Unit flows (do not touch D1-Tech / IK / BT) ---
  log("PHASE flows");
  async function resetUnitFlow(ou, pathName, extra, steps) {
    assertNotProtected(ou.id, "flow " + pathName);
    let list = arr(unwrap(await api("GET", `/api/${pathName}/ownerOrganizationalUnit/${ou.id}`)));
    if (!list.length) list = arr(unwrap(await api("GET", `/api/${pathName}/by-unit/${ou.id}`)));
    for (const st of list) if (st.id) await api("DELETE", `/api/${pathName}/${st.id}`);
    const created = [];
    for (const s of steps) {
      const body = { ...extra, ...s, ownerOrganizationalUnitId: ou.id };
      const r = await api("POST", `/api/${pathName}`, body);
      created.push({ ok: ok(r), status: r.status, err: ok(r) ? undefined : errText(r) });
    }
    return created;
  }
  const berkAna = state.berkPositions[ana.id] || state.people["8001"]?.positionId;
  const berkKenar = state.berkPositions[kenar.id] || berkAna;
  const nilayPos = state.people["8002"]?.positionId;
  const edaPos = state.people["8062"]?.positionId;
  for (const [key, ou] of Object.entries(unitByKey)) {
    if (!ou?.id) continue;
    const approver = key === "sirket-b" ? edaPos : state.berkPositions[ou.id] || berkAna;
    if (!approver) continue;
    const kinds = [
      ["UnitLeaveFlowStep", { step: 1, approvalUnitPositionId: approver }],
      ["UnitOvertimeFlowStep", { step: 1, approvalUnitPositionId: approver }],
      ["UnitAdvanceFlowStep", { step: 1, approvalUnitPositionId: approver }],
      ["UnitPaymentFlowStep", { step: 1, approvalUnitPositionId: approver }],
      ["UnitDocumentFlowStep", { approvalUnitPositionId: approver }],
    ];
    for (const [kind, body] of kinds) {
      const res = await resetUnitFlow(ou, kind, {}, [body]);
      log("FLOW", ou.name, kind, JSON.stringify(res));
    }
  }
  // Ana payroll 1-step Berk; Kenar 2-step Berk then Nilay; others Berk
  async function payrollFlow(ou, steps) {
    assertNotProtected(ou.id, "UnitPayrollFlowStep");
    let list = arr(unwrap(await api("GET", `/api/UnitPayrollFlowStep/ownerOrganizationalUnit/${ou.id}`)));
    if (!list.length) list = arr(unwrap(await api("GET", `/api/UnitPayrollFlowStep/by-unit/${ou.id}`)));
    for (const st of list) if (st.id) await api("DELETE", `/api/UnitPayrollFlowStep/${st.id}`);
    for (const s of steps) {
      const r = await api("POST", "/api/UnitPayrollFlowStep", { ...s, ownerOrganizationalUnitId: ou.id });
      log("PAYROLL_FLOW", ou.name, s.step, r.status, ok(r) ? "ok" : errText(r));
    }
  }
  await payrollFlow(ana, [{ step: 1, approvalUnitPositionId: berkAna }]);
  await payrollFlow(op, [{ step: 1, approvalUnitPositionId: state.berkPositions[op.id] || berkAna }]);
  await payrollFlow(lab, [{ step: 1, approvalUnitPositionId: state.people["8001"].positionId }]);
  await payrollFlow(kenar, [
    { step: 1, approvalUnitPositionId: berkKenar },
    { step: 2, approvalUnitPositionId: nilayPos },
  ]);
  for (const ou of [yuv, takvim, blokaj]) {
    await payrollFlow(ou, [{ step: 1, approvalUnitPositionId: state.berkPositions[ou.id] || berkAna }]);
  }
  if (edaPos) await payrollFlow(sirketB, [{ step: 1, approvalUnitPositionId: edaPos }]);

  // --- 8) Accrual + leaves + OT + payment values ---
  log("PHASE extras");
  const overtimeTypes = arr(unwrap(await api("GET", "/api/OvertimeType/all")));
  const otGross =
    overtimeTypes.find((t) => /hafta i[cç]i/i.test(t.name || "") && t.organizationalUnitId === ROOT) || overtimeTypes[0];
  const otNet =
    overtimeTypes.find((t) => /net/i.test(t.name || "")) || otGross;

  async function grantAccrual(empId, typeId, days) {
    if (!empId || !typeId) return;
    const bodies = [
      { employeeId: empId, leaveTypeId: typeId, entryType: "Yıllık izin hakkı", days, assignedDate: "2026-01-06" },
      { employeeId: empId, leaveTypeId: typeId, days, assignedDate: "2026-01-06T00:00:00" },
    ];
    for (const body of bodies) {
      const r = await api("POST", "/api/EmployeeLeaveAccrual", body);
      if (ok(r)) return r;
    }
  }
  for (const p of ROSTER.people) {
    const row = state.people[p.sicil];
    const lt = state.leaveTypes[row?.unitId] || state.leaveTypes[unitByKey[p.unit]?.id];
    if (row && lt?.annual) await grantAccrual(row.employeeId, lt.annual, 14);
  }

  async function assignLeave(p, leave) {
    const row = state.people[p.sicil];
    const ou = unitByKey[p.unit];
    const lt = state.leaveTypes[ou.id];
    const typeId = leave.type === "unpaid" ? lt?.unpaid : leave.type === "report" ? lt?.report : lt?.annual;
    if (!row || !typeId) return;
    const body = {
      leaveTypeId: typeId,
      startDate: `${leave.start}T08:00:00`,
      endDate: `${leave.end}T17:00:00`,
      workingHourTypeId: whFull?.id,
      description: `Faz1 ${leave.type} ${p.sicil}`,
      targetEmployeeId: row.employeeId,
    };
    let r = await api("POST", "/api/EmployeeLeaveRequest/assign", body);
    if (!ok(r)) r = await api("POST", "/api/EmployeeLeaveRequest", { ...body, employeeId: row.employeeId });
    log("LEAVE", p.sicil, leave.type, leave.start, r.status, ok(r) ? unwrap(r)?.id : errText(r));
    return unwrap(r);
  }
  for (const p of ROSTER.people) {
    for (const leave of p.leaves || []) await assignLeave(p, leave);
  }

  async function assignOt(sicil, start, end, hoursNote, net) {
    const row = state.people[sicil];
    if (!row) return;
    const r = await api("POST", "/api/EmployeeOvertimeRequest/assign", {
      title: `Faz1 mesai ${sicil}`,
      description: hoursNote,
      startDate: start,
      endDate: end,
      targetEmployeeId: row.employeeId,
      overtimeTypeId: (net ? otNet : otGross)?.id,
      compensationMode: 0,
    });
    log("OT", sicil, hoursNote, r.status, ok(r) ? unwrap(r)?.id : errText(r));
    return r;
  }
  // TV-06 8008: 10h gross + 5h net on a September weekday
  await assignOt("8008", "2026-09-11T08:00:00", "2026-09-11T18:00:00", "TV-06 brüt 10 saat", false);
  await assignOt("8008", "2026-09-14T18:00:00", "2026-09-14T23:00:00", "TV-06 net 5 saat", true);
  await assignOt("8007", "2026-09-17T18:00:00", "2026-09-17T21:00:00", "PAY-PNT-020 3s aynı gün", false);
  // PNT-010/011 expected reject — still try
  await assignOt("8004", "2026-09-18T18:00:00", "2026-09-18T20:00:00", "PAY-PNT-010 18.09 mesai (red beklenir)", false);
  await assignOt("8005", "2026-09-16T18:00:00", "2026-09-16T20:00:00", "PAY-PNT-011 16.09 mesai (red beklenir)", false);

  async function addPv(sicil, payName, value, date, desc) {
    const row = state.people[sicil];
    const paymentId = state.payments[payName];
    if (!row || !paymentId || !value) return;
    const r = await api("POST", "/api/PaymentValue", {
      paymentId,
      employeeId: row.employeeId,
      value,
      date,
      description: desc,
    });
    log("PV", sicil, payName, value, r.status, ok(r) ? unwrap(r)?.id : errText(r));
  }
  await addPv("8009", "Prim", 7500, "2026-09-15", "TV-07 prim");
  await addPv("8009", "Masraf", 4368, "2026-09-15", "TV-08 masraf");
  await addPv("8009", "Genel Kesinti", 1500, "2026-09-15", "TV-08 kesinti");
  await addPv("8030", "Net Fazla Mesai", 5000, "2026-09-15", "HSP-008 5000 TL net mesai kalemi");
  await addPv("8036", "Prim", 40000, "2026-09-15", "EDGE-031 tavan üstü prim");
  await addPv("8037", "Prim", 8000, "2026-09-15", "EDGE-035 brüt prim");
  await addPv("8037", "Net Fazla Mesai", 1500, "2026-09-15", "EDGE-035 net mesai");
  await addPv("8038", "İcra", 1800, "2026-09-15", "EDGE-045 icra");
  await addPv("8038", "Genel Kesinti", 1200, "2026-09-15", "EDGE-045 kesinti");
  await addPv("8060", "Genel Kesinti", 750, "2026-09-15", "EDGE-040 kesinti");
  await addPv("8071", "Prim", 25000, "2026-09-15", "EDGE-034 yüksek prim");

  async function addAdvance(sicil, amount, desc, extra) {
    const row = state.people[sicil];
    if (!row || !amount) return;
    const r = await api("POST", "/api/AdvanceRequest/assign", {
      targetEmployeeId: row.employeeId,
      employeeId: row.employeeId,
      advanceType: 1,
      requestedAmount: amount,
      numberOfInstallments: extra?.installments || 1,
      expectedRepaymentStartDate: extra?.start || "2026-09-01",
      purpose: desc,
    });
    log("ADV", sicil, amount, r.status, ok(r) ? unwrap(r)?.id : errText(r));
    if (!ok(r)) {
      const r2 = await api("POST", "/api/AdvanceRequest", {
        advanceType: 1,
        requestedAmount: amount,
        numberOfInstallments: extra?.installments || 1,
        expectedRepaymentStartDate: extra?.start || "2026-09-01",
        purpose: desc,
        employeeId: row.employeeId,
      });
      log("ADV2", sicil, r2.status, ok(r2) ? unwrap(r2)?.id : errText(r2));
    }
  }
  await addAdvance("8009", 2000, "TV-08 avans");
  await addAdvance("8038", 2500, "EDGE-045 avans");
  await addAdvance("8058", 55000, "EDGE-041 avans neti aşıyor");
  await addAdvance("8060", 2000, "EDGE-040 eski taksit", { start: "2026-08-01" });
  await addAdvance("8060", 1500, "EDGE-040 yeni avans");

  // 8057 night shift assignment if API exists
  if (state.nightShiftId && state.people["8057"]) {
    const r = await api("POST", "/api/ShiftAssignment", {
      employeeId: state.people["8057"].employeeId,
      shiftTemplateId: state.nightShiftId,
      startDate: "2026-08-31",
      endDate: "2026-09-01",
    });
    log("NIGHT_ASSIGN", r.status, ok(r) ? unwrap(r)?.id : errText(r));
    await assignOt("8057", "2026-09-01T07:00:00", "2026-09-01T09:00:00", "EDGE-026 +2s FM", false);
  }

  saveState(state);

  // --- 9) Periods ---
  log("PHASE periods");
  async function employeesOf(ou) {
    positions = arr(unwrap(await api("GET", "/api/OrganizationalUnitPosition/filteredByUnitAbilities")));
    return [
      ...new Set(
        positions.filter((p) => p.organizationalUnitId === ou.id && p.employeeId && !p.isTerminated).map((p) => p.employeeId)
      ),
    ];
  }
  async function ensurePeriod(ou, year, month, empIds, tag) {
    assertNotProtected(ou.id, "period");
    let periods = arr(unwrap(await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")));
    let period = periods.find(
      (p) => p.year === year && p.month === month && (p.organizationalUnitId === ou.id || p.organizationalUnit?.id === ou.id)
    );
    if (!period?.id) {
      const c = await api("POST", "/api/PayrollPeriod/create-async", {
        month,
        year,
        organizationalUnitId: ou.id,
        hasSgkDebt: false,
        employeeIds: empIds,
      });
      const d = unwrap(c);
      log("PERIOD_CREATE", tag, c.status, JSON.stringify(d).slice(0, 200), errText(c));
      if (d?.jobId) await waitJob(d.jobId, 180000);
      const periodId = d?.periodId || d?.id;
      if (periodId) period = unwrap(await api("GET", `/api/PayrollPeriod/${periodId}`)) || { id: periodId };
      else {
        periods = arr(unwrap(await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")));
        period = periods.find(
          (p) => p.year === year && p.month === month && (p.organizationalUnitId === ou.id || p.organizationalUnit?.id === ou.id)
        );
      }
    }
    if (period?.id && empIds.length) {
      const add = await api("POST", `/api/PayrollPeriod/${period.id}/employees`, { employeeIds: empIds });
      log("PERIOD_ADD", tag, empIds.length, add.status, ok(add) ? "ok" : errText(add));
    }
    if (period?.id) state.periods[tag] = { id: period.id, year, month, ou: ou.id, count: empIds.length };
    return period;
  }

  const anaAktif = ["8003","8004","8005","8006","8007","8008","8009","8010","8011","8012","8013","8014","8015","8016","8017"]
    .map((s) => state.people[s]?.employeeId).filter(Boolean);
  const anaAug = ["8003","8005","8006","8007","8008","8009","8010","8011","8012","8013","8014","8015","8016","8017","8018","8019"]
    .map((s) => state.people[s]?.employeeId).filter(Boolean);
  const opEmp = ["8020","8021","8022"].map((s) => state.people[s]?.employeeId).filter(Boolean);
  const kenarEmp = ROSTER.people.filter((p) => p.unit === "kenar").map((p) => state.people[p.sicil]?.employeeId).filter(Boolean);
  const yuvEmp = ROSTER.people.filter((p) => p.unit === "yuvarlama").map((p) => state.people[p.sicil]?.employeeId).filter(Boolean);
  const labEmp = ["8001","8002"].map((s) => state.people[s]?.employeeId).filter(Boolean);
  const takEmp = [state.people["8063"]?.employeeId].filter(Boolean);
  const blokEmp = [state.people["8078"]?.employeeId].filter(Boolean);
  const bEmp = ["8061","8062"].map((s) => state.people[s]?.employeeId).filter(Boolean);

  await ensurePeriod(ana, 2026, 8, anaAug, "ana-2026-08");
  await ensurePeriod(ana, 2026, 9, anaAktif, "ana-2026-09");
  await ensurePeriod(op, 2026, 9, opEmp, "op-2026-09");
  await ensurePeriod(kenar, 2026, 8, kenarEmp, "kenar-2026-08");
  await ensurePeriod(kenar, 2026, 9, kenarEmp, "kenar-2026-09");
  await ensurePeriod(yuv, 2026, 9, yuvEmp, "yuv-2026-09");
  await ensurePeriod(takvim, 2027, 2, takEmp, "tak-2027-02");
  await ensurePeriod(takvim, 2028, 2, takEmp, "tak-2028-02");
  await ensurePeriod(blokaj, 2026, 9, blokEmp, "blok-2026-09");
  await ensurePeriod(sirketB, 2026, 9, bEmp, "b-2026-09");
  await ensurePeriod(lab, 2026, 9, labEmp, "lab-2026-09");
  saveState(state);

  // Verify Ana Eylül count via period employees
  const anaSep = state.periods["ana-2026-09"];
  let anaCount = { ids: [], n: 0 };
  if (anaSep?.id) {
    const paths = [
      `/api/PayrollPeriod/${anaSep.id}/employees`,
      `/api/PayrollPeriodEmployee/by-period/${anaSep.id}`,
      `/api/PayrollPeriod/${anaSep.id}/period-employees`,
    ];
    for (const pth of paths) {
      const r = await api("GET", pth);
      const a = arr(unwrap(r));
      if (a.length) {
        anaCount = { path: pth, n: a.length, ids: a.map((x) => x.employeeId || x.id).slice(0, 30) };
        break;
      }
    }
  }
  state.verify = { anaEylul: anaCount, people: Object.keys(state.people).length, failed: state.failed };
  saveState(state);
  log("VERIFY_ANA", JSON.stringify(anaCount));
  log("DONE", "people", Object.keys(state.people).length, "failed", state.failed.length);
  await browser.close();
})().catch((e) => {
  console.error(e);
  try {
    fs.appendFileSync(LOG_PATH, "FATAL " + e.stack + "\n");
  } catch {}
  process.exit(1);
});
