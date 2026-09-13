/**
 * Recheck Faz1 and retry remaining gaps: Ozan B period, Ceren workplace,
 * Ar-Ge, advances-as-employee, 8008 net OT, position flows, API discovery.
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
const REPO_OUT = path.join(__dirname, "faz1_verify_summary.json");
const OUT = path.join(process.env.TEMP, "faz1_recheck.json");
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
  if (x?.periodEmployees) return x.periodEmployees;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && !r.data?.error;
}
function errText(r) {
  const e = r?.data?.error || r?.data?.title || r?.data;
  const msg =
    e?.message ||
    (e?.errors ? JSON.stringify(e.errors).slice(0, 280) : null) ||
    (typeof e === "string" ? e : null) ||
    r?.text;
  return String(msg || r?.status || "").slice(0, 400);
}
function dump(r) {
  return JSON.stringify(r?.data ?? r).slice(0, 450);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const report = { retries: {}, checks: {}, discovered: [], notes: [] };
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
        return { status: res.status, data, text: String(text).slice(0, 700) };
      },
      { method, urlPath, body }
    );
  }

  if (!(await uiLogin(page, EMAIL, ADMIN_PASS))) throw new Error("admin login fail");
  console.log("ADMIN OK");

  // --- Discover API names from SPA chunks (extract paths only) ---
  const discoveredHits = await page.evaluate(async () => {
    const html = document.documentElement.innerHTML;
    const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]).slice(0, 30);
    const out = [];
    const re = /\/api\/[A-Za-z0-9_./{}-]{3,80}/g;
    const keep = /Period|Shift|Arge|RdCenter|Sgk|Tax|Overtime|Advance|Workplace|Incentive|Kota|Cumulative/i;
    for (const src of scripts) {
      const res = await fetch(src, { credentials: "include" });
      const text = await res.text();
      const hits = [...new Set(text.match(re) || [])].filter((x) => keep.test(x));
      if (hits.length) out.push({ src: src.slice(-50), hits: hits.slice(0, 50) });
    }
    return out;
  });
  report.discovered = discoveredHits;
  for (const d of discoveredHits) console.log("DISC", d.src, d.hits.slice(0, 12).join(" | "));

  const units = state.units;
  const people = state.people;
  const labBerk = people["8001"].positionId;
  const ozan = people["8061"];
  const ceren = people["8051"];
  const kenarSepId = "12f9269c-a37b-4cb8-a18a-5f65c9cd1ada";
  const bSepId = "0fbc3cbc-687a-4640-b386-514fa3d9555c";
  const anaSepId = "fe993870-b937-4756-8097-58b358f16a8e";

  async function periodRows(periodId) {
    for (const pth of [
      `/api/PayrollPeriod/${periodId}/employees`,
      `/api/PayrollPeriodEmployee/by-period/${periodId}`,
    ]) {
      const r = await api(page, "GET", pth);
      const rows = arr(unwrap(r));
      if (rows.length) return { path: pth, rows };
    }
    return { path: null, rows: [] };
  }

  // --- Verify Ana 15 sicils ---
  const anaRows = await periodRows(anaSepId);
  const anaNums = anaRows.rows.map((x) => String(x.employeeNumber || x.employee?.employeeNumber || "")).filter(Boolean);
  const anaIds = anaRows.rows.map((x) => x.employeeId || x.id);
  const wantAktif = ["8003","8004","8005","8006","8007","8008","8009","8010","8011","8012","8013","8014","8015","8016","8017"];
  const pasif = ["8018", "8019"].map((s) => people[s].employeeId);
  report.checks.ana15 = {
    count: anaRows.rows.length,
    numbers: anaNums.sort(),
    missingAktif: wantAktif.filter((s) => !anaNums.includes(s) && !anaIds.includes(people[s].employeeId)),
    pasifIn: pasif.filter((id) => anaIds.includes(id) || anaNums.includes("8018") || anaNums.includes("8019")),
  };
  console.log("ANA15", JSON.stringify(report.checks.ana15));

  // --- Holidays 07.09 only Op ---
  async function holidays(ouId) {
    return arr(unwrap(await api(page, "GET", `/api/PublicHoliday/ownerOrganizationalUnit/${ouId}`)));
  }
  const opH = await holidays(units.operasyon.id);
  const anaH = await holidays(units.ana.id);
  const has0709 = (list) =>
    list.some((h) => String(h.startDate || h.start || h.date || "").startsWith("2026-09-07"));
  report.checks.holiday0709 = { op: has0709(opH), opCount: opH.length, ana: has0709(anaH), anaCount: anaH.length };
  console.log("HOLIDAY0709", JSON.stringify(report.checks.holiday0709));

  // --- Empty Onay Yedek ---
  const positions = arr(unwrap(await api(page, "GET", "/api/OrganizationalUnitPosition/filteredByUnitAbilities")));
  const yedek = positions.find((x) => x.id === state.emptyKenarPos) || positions.find((x) => /onay yedek/i.test(x.title || ""));
  const berkNow = positions.filter((x) => x.employeeId === people["8001"].employeeId);
  report.checks.yedek = { id: yedek?.id, employeeId: yedek?.employeeId || null, empty: !yedek?.employeeId };
  report.checks.berk = berkNow.map((x) => ({ id: x.id, ou: x.organizationalUnitId, title: x.title }));
  console.log("YEDEK", JSON.stringify(report.checks.yedek), "BERK", JSON.stringify(report.checks.berk));

  // --- Retry position flows with Lab Berk ---
  const samplePos = people["8003"].positionId;
  const posFlowKinds = [
    "UnitPositionLeaveFlowStep",
    "UnitPositionOvertimeFlowStep",
    "UnitPositionAdvanceFlowStep",
    "UnitPositionPaymentFlowStep",
  ];
  report.retries.posFlows = [];
  for (const kind of posFlowKinds) {
    const r = await api(page, "POST", `/api/${kind}`, {
      step: 1,
      approvalUnitPositionId: labBerk,
      ownerUnitPositionId: samplePos,
    });
    report.retries.posFlows.push({ kind, status: r.status, ok: ok(r), err: ok(r) ? undefined : errText(r) });
    console.log("POS_FLOW", kind, r.status, ok(r) ? "ok" : errText(r));
  }

  // --- Overtime types + daily limit ---
  const otTypes = arr(unwrap(await api(page, "GET", "/api/OvertimeType/all")));
  report.checks.otTypes = otTypes.map((t) => ({ id: t.id, name: t.name, isNet: t.isNet, ou: t.organizationalUnitId })).slice(0, 20);
  const otGross = otTypes.find((t) => /hafta i[cç]i/i.test(t.name || "") && !/net/i.test(t.name || "")) || otTypes[0];
  const otNet = otTypes.find((t) => /net/i.test(t.name || "") || t.isNet) || otGross;
  console.log("OT_TYPES", report.checks.otTypes.map((t) => t.name).join(", "));

  for (const ep of [
    `/api/OvertimeSetting/effective/${units.ana.id}`,
    `/api/OvertimeSetting/by-ou/${units.ana.id}`,
    `/api/UnitOvertimeSetting/${units.ana.id}`,
    `/api/PayrollSetting/${units.ana.id}`,
  ]) {
    const g = await api(page, "GET", ep);
    console.log("OTSET_GET", ep, g.status, dump(g).slice(0, 180));
    if (ok(g) && unwrap(g) && typeof unwrap(g) === "object") {
      const cur = unwrap(g);
      const body = { ...cur, organizationalUnitId: units.ana.id, dailyLimitHours: 12, maxDailyOvertimeHours: 12, dailyOvertimeLimit: 12 };
      let put = await api(page, "PUT", ep.replace(/\/effective\/.*/, "").replace(/\/by-ou\/.*/, ""), body);
      if (!ok(put)) put = await api(page, "PUT", `/api/PayrollSetting/${units.ana.id}`, { ...cur, organizationalUnitId: units.ana.id, requirePeriodCompletionBeforeNew: false });
      console.log("OTSET_PUT", put.status, errText(put).slice(0, 80));
    }
  }

  // --- EDGE-018: inspect Kenar period employee row, try more remove paths ---
  const kenarPack = await periodRows(kenarSepId);
  const ozanRow = kenarPack.rows.find(
    (x) => x.employeeId === ozan.employeeId || x.employee?.id === ozan.employeeId || String(x.employeeNumber) === "8061"
  );
  console.log("OZAN_ROW", ozanRow ? JSON.stringify(ozanRow).slice(0, 500) : "not in kenar list");
  report.retries.ozanRemove = [];
  if (ozanRow) {
    const ids = [ozanRow.id, ozanRow.payrollPeriodEmployeeId, ozanRow.periodEmployeeId].filter(Boolean);
    const tries = [
      ...ids.map((id) => ["DELETE", `/api/PayrollPeriodEmployee/${id}`]),
      ...ids.map((id) => ["DELETE", `/api/PayrollPeriod/${kenarSepId}/employees/${id}`]),
      ["POST", `/api/PayrollPeriod/${kenarSepId}/employees/delete`, { employeeIds: [ozan.employeeId] }],
      ["POST", `/api/PayrollPeriod/${kenarSepId}/exclude-employees`, { employeeIds: [ozan.employeeId] }],
      ["PUT", `/api/PayrollPeriod/${kenarSepId}/employees`, { employeeIds: kenarPack.rows.filter((x) => (x.employeeId || x.id) !== ozan.employeeId).map((x) => x.employeeId || x.id) }],
      ozanRow.id ? ["PUT", `/api/PayrollPeriodEmployee/${ozanRow.id}`, { ...ozanRow, isExcluded: true, status: 3, isDeleted: true }] : null,
      ["DELETE", `/api/PayrollPeriod/${kenarSepId}/employee/${ozan.employeeId}`],
    ].filter(Boolean);
    for (const [m, u, b] of tries) {
      const r = await api(page, m, u, b);
      report.retries.ozanRemove.push({ m, u, status: r.status, err: errText(r).slice(0, 120) });
      console.log("OZAN_RM", m, u.slice(-50), r.status, errText(r).slice(0, 80));
      if (ok(r) || r.status === 204) break;
    }
  }
  const kenarAfter = await periodRows(kenarSepId);
  const ozanStillKenar = kenarAfter.rows.some(
    (x) => x.employeeId === ozan.employeeId || x.employee?.id === ozan.employeeId || String(x.employeeNumber) === "8061"
  );
  report.checks.kenarSep = { count: kenarAfter.rows.length, ozanIn: ozanStillKenar };

  const addB = await api(page, "POST", `/api/PayrollPeriod/${bSepId}/employees`, { employeeIds: [ozan.employeeId] });
  report.retries.ozanAddB = { status: addB.status, ok: ok(addB), err: errText(addB) };
  console.log("OZAN_ADD_B", addB.status, errText(addB));
  const bRows = await periodRows(bSepId);
  report.checks.sirketB = { count: bRows.rows.length, numbers: bRows.rows.map((x) => x.employeeNumber || x.employeeId) };

  // Cumulative tax: PUT employee fields
  const ozanEmp = unwrap(await api(page, "GET", `/api/Employee/${ozan.employeeId}`)) || {};
  const taxFields = Object.keys(ozanEmp).filter((k) => /cumul|matrah|taxBase|previousTax|gv/i.test(k));
  report.checks.ozanTaxKeys = taxFields;
  console.log("OZAN_TAX_KEYS", taxFields.join(",") || "(none)");
  if (taxFields.length) {
    const put = await api(page, "PUT", `/api/Employee/${ozan.employeeId}`, {
      ...ozanEmp,
      initialCumulativeTaxBase: 1,
      previousCumulativeTaxBase: 1,
      cumulativeTaxBase: 1,
    });
    report.retries.cumTax = { status: put.status, ok: ok(put), err: errText(put) };
    console.log("CUMTAX_PUT", put.status, errText(put));
  }
  const discoveredTax = (report.discovered.flatMap((d) => d.hits) || []).filter((h) => /tax|matrah/i.test(h));
  for (const ep of [...new Set(discoveredTax)].slice(0, 8)) {
    if (ep.includes("{")) continue;
    const r = await api(page, "POST", ep, { employeeId: ozan.employeeId, year: 2026, month: 9, value: 1, amount: 1 });
    console.log("CUMTAX_EP", ep, r.status, errText(r).slice(0, 80));
    if (ok(r)) {
      report.retries.cumTax = { ep, status: r.status, ok: true };
      break;
    }
  }

  // --- EDGE-017 Ceren: discovered workplace APIs + sequential dates ---
  const discWp = (report.discovered.flatMap((d) => d.hits) || []).filter((h) => /sgk|workplace|isyeri/i.test(h));
  report.retries.cerenWp = [];
  for (const ep of [
    ...discWp.filter((h) => !h.includes("{")),
    "/api/EmployeeSgkWorkplaceHistory",
    "/api/SgkWorkplaceAssignment",
    "/api/EmployeeOrganizationalUnitSgkSetting",
    "/api/EmployeeWorkplaceHistory",
    "/api/EmployeeSgkDeclarationWorkplace",
  ].slice(0, 12)) {
    const r = await api(page, "POST", ep, {
      employeeId: ceren.employeeId,
      organizationalUnitId: units.sube.id,
      sgkWorkplaceOrganizationalUnitId: units.sube.id,
      startDate: "2026-09-11",
      endDate: "2026-09-30",
    });
    report.retries.cerenWp.push({ ep, status: r.status, err: errText(r).slice(0, 80) });
    console.log("CEREN_WP", ep, r.status, errText(r).slice(0, 80));
    if (ok(r) || (r.status !== 404 && r.status !== 405)) {
      if (ok(r)) break;
    }
  }
  const cerenKenarPos = positions.find((x) => x.id === ceren.positionId);
  const cerenSubePos = positions.find((x) => x.id === "126f9728-5b10-474b-add9-3f9b9de1632e");
  report.checks.ceren = {
    kenarEmp: cerenKenarPos?.employeeId || null,
    subeEmp: cerenSubePos?.employeeId || null,
  };

  // --- Ar-Ge from discovery ---
  const discArge = (report.discovered.flatMap((d) => d.hits) || []).filter((h) => /arge|rdcenter|incentive|rdproject|kota/i.test(h));
  report.retries.arge = [];
  for (const ep of [
    ...discArge.filter((h) => !h.includes("{")),
    "/api/PayrollArgeCenter",
    "/api/ArgeMerkezi",
    "/api/RdProjectCenter",
    "/api/SupportPersonnelQuota",
    "/api/PayrollSupportQuota",
    "/api/EmployeeRdAssignment",
  ]) {
    const g = await api(page, "GET", ep.endsWith("all") ? ep : ep + "/all");
    const g2 = g.status === 404 ? await api(page, "GET", ep) : g;
    console.log("ARGE", ep, g2.status, errText(g2).slice(0, 60));
    report.retries.arge.push({ ep, status: g2.status, ok: ok(g2) });
    if (ok(g2)) {
      const rows = arr(unwrap(g2));
      if (!rows.length) {
        const cr = await api(page, "POST", ep.replace(/\/all$/, ""), {
          name: "Faz1 Ar-Ge Merkezi",
          code: "FAZ1-ARGE",
          organizationalUnitId: units.kenar.id,
          quota: 1,
          destekKota: 1,
        });
        console.log("ARGE_CREATE", cr.status, errText(cr));
        report.retries.argeCreate = { status: cr.status, ok: ok(cr), err: errText(cr) };
      }
      break;
    }
  }

  // --- 8004/8005 dates, 8078 profile, 8003 payments ---
  const baran = unwrap(await api(page, "GET", `/api/OrganizationalUnitPosition/${people["8004"].positionId}`));
  const cansu = unwrap(await api(page, "GET", `/api/OrganizationalUnitPosition/${people["8005"].positionId}`));
  report.checks.hireExit = {
    baranStart: baran?.startDate,
    cansuEnd: cansu?.endDate,
    cansuTerm: cansu?.isTerminated,
  };
  console.log("HIRE_EXIT", JSON.stringify(report.checks.hireExit));

  // Net OT setting on payroll
  const psAna = unwrap(await api(page, "GET", `/api/PayrollSetting/${units.ana.id}`));
  const psKeys = psAna && typeof psAna === "object" ? Object.keys(psAna).filter((k) => /over|net|mesai|limit/i.test(k)) : [];
  report.checks.payrollOtKeys = psKeys;
  console.log("PS_OT_KEYS", psKeys.join(",") || "(none)");

  // Kenar Aug + Lab not containing kenar
  const kenarAug = await periodRows(state.periods["kenar-2026-08"]?.id);
  const labSep = await periodRows("f3a13bd6-739f-4c9d-a883-e2fdf720e787");
  report.checks.kenarAug = kenarAug.rows.length;
  report.checks.labSep = labSep.rows.length;
  const labHasKenar = labSep.rows.some((x) => {
    const n = Number(x.employeeNumber);
    return n >= 8023 && n <= 8079 && n !== 8063;
  });
  report.checks.labIsolation = { labCount: labSep.rows.length, leakedKenar: labHasKenar };

  await browser.close();

  // --- Employee-side: advances + 8008 net OT ---
  async function asEmployee(email, fn) {
    const b = await chromium.launch({ headless: true });
    const c = await b.newContext();
    const p = await c.newPage();
    const logged = await uiLogin(p, email, DEMO_PASS);
    let out = { logged };
    if (logged) out = { ...out, ...(await fn(p)) };
    await b.close();
    return out;
  }

  report.retries.advances = [];
  for (const [sicil, amount, desc, extra] of [
    ["8009", 2000, "TV-08 avans", null],
    ["8038", 2500, "EDGE-045 avans", null],
    ["8058", 55000, "EDGE-041 avans neti aşıyor", null],
    ["8060", 2000, "EDGE-040 eski taksit", { start: "2026-08-01" }],
    ["8060", 1500, "EDGE-040 yeni avans", null],
  ]) {
    const row = people[sicil];
    const res = await asEmployee(row.email, async (p) => {
      const body = {
        advanceType: 1,
        requestedAmount: amount,
        numberOfInstallments: extra?.installments || 1,
        expectedRepaymentStartDate: extra?.start || "2026-09-01",
        purpose: desc,
      };
      let r = await api(p, "POST", "/api/AdvanceRequest", body);
      if (!ok(r)) r = await api(p, "POST", "/api/AdvanceRequest/assign", { ...body, targetEmployeeId: row.employeeId });
      return { status: r.status, ok: ok(r), err: ok(r) ? undefined : errText(r) };
    });
    report.retries.advances.push({ sicil, amount, ...res });
    console.log("ADV_EMP", sicil, amount, res.logged, res.status, res.ok ? "ok" : res.err);
  }

  const netOt = await asEmployee(people["8008"].email, async (p) => {
    const out = [];
    const chunks = [
      ["2026-09-21T18:00:00", "2026-09-21T21:00:00", "TV-06 net 3s"],
      ["2026-09-22T18:00:00", "2026-09-22T20:00:00", "TV-06 net 2s"],
    ];
    for (const [start, end, title] of chunks) {
      let r = await api(p, "POST", "/api/EmployeeOvertimeRequest", {
        title,
        description: title,
        startDate: start,
        endDate: end,
        overtimeTypeId: otNet?.id,
        compensationMode: 0,
      });
      if (!ok(r)) {
        r = await api(p, "POST", "/api/EmployeeOvertimeRequest/assign", {
          title,
          description: title,
          startDate: start,
          endDate: end,
          overtimeTypeId: otNet?.id,
          compensationMode: 0,
          targetEmployeeId: people["8008"].employeeId,
        });
      }
      out.push({ start, status: r.status, ok: ok(r), err: ok(r) ? undefined : errText(r) });
    }
    return { chunks: out };
  });
  report.retries.netOt8008 = netOt;
  console.log("NETOT", JSON.stringify(netOt));

  const loginMe = await asEmployee("ekinsari@demo.com", async (p) => {
    const paths = ["/api/Employee/my", "/api/Employees/my", "/api/User/me", "/api/Auth/me", "/api/Account/me"];
    const found = [];
    for (const ep of paths) {
      const r = await api(p, "GET", ep);
      const u = unwrap(r);
      found.push({
        ep,
        status: r.status,
        number: u?.employeeNumber || u?.employee?.employeeNumber,
        name: u?.firstName || u?.employee?.firstName || u?.fullName || u?.name,
      });
    }
    return { found };
  });
  report.retries.loginMy = loginMe;
  console.log("LOGIN_MY", JSON.stringify(loginMe.found));

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  const pub = fs.existsSync(REPO_OUT) ? JSON.parse(fs.readFileSync(REPO_OUT, "utf8")) : {};
  pub.recheckAt = new Date().toISOString();
  pub.counter15 = {
    ...pub.counter15,
    anaEylulCount: report.checks.ana15?.count,
    kenarSep: report.checks.kenarSep?.count,
    sirketB: report.checks.sirketB?.count,
    labOpen: report.checks.labSep,
  };
  pub.retries = {
    ozanAddB: report.retries.ozanAddB,
    ozanStillKenar: report.checks.kenarSep?.ozanIn,
    advances: report.retries.advances,
    netOt8008: report.retries.netOt8008,
    posFlows: report.retries.posFlows,
    arge: report.retries.arge,
    cerenWp: report.retries.cerenWp,
    holiday0709: report.checks.holiday0709,
    ana15: report.checks.ana15,
    yedek: report.checks.yedek,
    hireExit: report.checks.hireExit,
    loginMy: loginMe.found,
  };
  fs.writeFileSync(REPO_OUT, JSON.stringify(pub, null, 2));
  console.log("WROTE", OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
