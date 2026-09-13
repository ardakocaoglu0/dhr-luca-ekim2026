/**
 * Unblock Tek Değişken Ocak puantaj: 4691 satırlarına teknopark projesi,
 * Isik eksik-gün nedeni, sonra calculate.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const PERIOD = "a1013469-c82e-4c5d-8dac-4dbfe10d6fdd";
const OU = "eb55bafc-2549-47b4-be28-682f7128d11c";
const ROOT = "d93d6660-892d-4dcf-8fc2-36bed171017a";
const IK = "6e473120-9b10-48d1-81df-08b4f798e4dd";
const REASON_07 = "93aea4ba-7fc8-4570-8d28-aee49bee7b6e";
const TAX_4691 = "0f6e047b-9735-4f5a-940b-239ee4037098";
const STATE_PATH = path.join(process.env.TEMP, "izole_seed_state.json");
const DUMP_PATH = path.join(process.env.TEMP, "izole_ocak_period.json");
const SUM_PATH = path.join(process.env.TEMP, "izole_ocak_summary.json");
if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}

function unwrap(x) {
  let v = x?.data ?? x;
  for (let i = 0; i < 8; i++) {
    if (v && typeof v === "object" && !Array.isArray(v) && "data" in v) v = v.data;
    else break;
  }
  return v;
}
function arr(x) {
  if (Array.isArray(x)) return x;
  if (x?.items) return x.items;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && r.data?.isSuccess !== false;
}
function errText(r) {
  return String(r?.text || JSON.stringify(r?.data || "")).replace(/\s+/g, " ").slice(0, 280);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 120 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  console.log("LOGIN", page.url());

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
        return { status: res.status, data, text: String(text).slice(0, 1800) };
      },
      { method, urlPath, body }
    );
  }

  const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  const hakan = state.people["6208"];
  const isik = state.people["6209"];

  console.log("PHASE profiles");
  const rootProfiles = arr(unwrap(await api("GET", `/api/PayrollProfile/ownerOrganizationalUnit/${ROOT}`))).filter((p) => p.status !== 3);
  const arge = rootProfiles.find((p) => /^Ar-Ge Personeli$/i.test(p.name));
  const destek = rootProfiles.find((p) => /Destek Personeli/i.test(p.name));
  console.log("PROFILES", arge?.name, arge?.id, destek?.name, destek?.id);
  if (hakan && arge) {
    const r = await api("PUT", `/api/Employee/${hakan.employeeId}/payrollProfiles`, [arge.id]);
    console.log("PROF 6208", r.status, ok(r), errText(r));
  }
  if (isik && destek) {
    const r = await api("PUT", `/api/Employee/${isik.employeeId}/payrollProfiles`, [destek.id]);
    console.log("PROF 6209", r.status, ok(r), errText(r));
  }

  console.log("PHASE technopark");
  let project = null;
  for (const unitId of [OU, ROOT, IK]) {
    const g = await api("GET", `/api/TechnoparkProject/by-unit?unitId=${unitId}`);
    const list = arr(unwrap(g));
    console.log("TECHNO_GET", unitId.slice(0, 8), g.status, list.length, list.map((x) => x.name).join(" | ").slice(0, 120));
    if (list.length && !project) project = list[0];
  }
  if (!project) {
    const up = await api("POST", "/api/TechnoparkProject/upsert", {
      organizationalUnitId: OU,
      name: "Tek Değişken Ar-Ge / Teknopark",
      projeKodu: "IZOLE-ARGE",
      bolgeAdi: "Pendik",
    });
    console.log("TECHNO_UPSERT", up.status, errText(up));
    project = unwrap(up) || arr(unwrap(await api("GET", `/api/TechnoparkProject/by-unit?unitId=${OU}`)))[0];
  }
  console.log("PROJECT", project?.id, project?.name);

  async function assignTechno(row, kind) {
    if (!row || !project?.id) return;
    const r = await api("POST", "/api/TechnoparkProject/assign", {
      employeeId: row.employeeId,
      technoparkProjectId: project.id,
      startDate: "2026-01-02T00:00:00",
      isciTuru: kind,
      destekOncelik: kind === "Destek" ? 1 : null,
      acikAtamayiKapat: false,
    });
    console.log("TECHNO_ASSIGN", kind, row.sicil || "", r.status, ok(r), errText(r));
  }
  await assignTechno(hakan, "Ar-Ge");
  await assignTechno(isik, "Destek");

  const att = arr(unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}/payroll-attendance`)));
  const isikRow = att.find((x) => x.employeeNumber === "6209");
  const hakanRow = att.find((x) => x.employeeNumber === "6208");
  console.log(
    "ATT_FLAGS",
    "hakan saved",
    hakanRow?.isPayrollAttendanceSaved,
    "missingProject",
    hakanRow?.isMissingTechnoparkProject,
    "isik saved",
    isikRow?.isPayrollAttendanceSaved,
    "missingProject",
    isikRow?.isMissingTechnoparkProject,
    "missingReason",
    isikRow?.missingDayReasonId
  );

  function payloadFrom(row) {
    return {
      periodEmployeeId: row.periodEmployeeId,
      data: {
        sgkDays: row.sgkDays ?? 30,
        normalDays: row.normalDays ?? 31,
        businessDays: row.businessDays ?? 22,
        workedBusinessDays: row.workedBusinessDays ?? null,
        businessHours: row.businessHours ?? 165,
        dailyWorkHours: row.dailyWorkHours ?? 7.5,
        missingDayCount: Math.max(row.totalMissingDays || 0, row.defaultMissingDays || 0, 1),
        missingDayReasonId: row.missingDayReasonId || row.defaultMissingDayReasonId || REASON_07,
        payrollAttendanceNotes: row.payrollAttendanceNotes || null,
        payrollLawVariantId: row.payrollLawVariantId || null,
        payrollLawFieldsJson: row.payrollLawFieldsJson || null,
        taxExemptionVariantId: row.taxExemptionVariantId || TAX_4691,
        remoteWorkDays: row.remoteWorkDays ?? null,
        overtimes: [],
        paymentNetSettings: (row.payments || []).map((p) => ({ paymentId: p.paymentId, isNet: !!p.isNet })),
      },
    };
  }

  const items = [];
  if (isikRow) items.push(payloadFrom(isikRow));
  if (hakanRow) items.push(payloadFrom(hakanRow));
  const bulk = await api("PUT", "/api/PeriodEmployee/payroll-attendance/bulk", { payrollPeriodId: PERIOD, items });
  console.log("BULK_PUT", bulk.status, errText(bulk));
  const auto = await api("POST", `/api/PayrollPeriod/${PERIOD}/attendance/bulk-save-auto`, {
    filter: null,
    search: null,
    onlyFullyDerived: false,
  });
  console.log("BULK_AUTO", auto.status, JSON.stringify(unwrap(auto) || auto.data).slice(0, 400));

  for (const ep of [
    `/api/PayrollPeriod/${PERIOD}/attendance/complete`,
    `/api/PayrollPeriod/${PERIOD}/complete-attendance`,
    `/api/PayrollPeriod/${PERIOD}/lock-attendance`,
    `/api/PayrollPeriod/${PERIOD}/confirm-attendance`,
  ]) {
    const r = await api("POST", ep, {});
    if (r.status !== 404) console.log("TRY", ep, r.status, errText(r));
  }

  let p = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}`));
  const att2 = arr(unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}/payroll-attendance`)));
  const unsaved = att2.filter((x) => !x.isPayrollAttendanceSaved).map((x) => x.employeeNumber);
  const blocked = att2.filter((x) => x.isMissingTechnoparkProject).map((x) => x.employeeNumber);
  console.log("STATUS", p?.payrollStatus, "unsaved", unsaved.join(","), "missingProject", blocked.join(","));

  const calc = await api("POST", `/api/PayrollPeriod/${PERIOD}/calculate`, { onlyStaleEmployees: false });
  const jobId = unwrap(calc.data)?.jobId;
  console.log("CALC", calc.status, jobId, errText(calc));
  for (let i = 0; i < 48; i++) {
    await sleep(5000);
    const job = jobId ? unwrap(await api("GET", `/api/background-jobs/${jobId}`)) : null;
    p = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}`));
    const pes = p?.periodEmployees || [];
    const withItems = pes.filter((e) => (e.payrollItemValues || []).length).length;
    console.log(
      `POLL ${i} job=${job?.jobStatus} pct=${job?.progressPercent} result=${String(job?.resultPayloadJson || "").slice(0, 200)} periodStatus=${p?.payrollStatus} items=${withItems}/${pes.length}`
    );
    if (job && job.jobStatus !== 0 && job.jobStatus !== 1 && i >= 1) break;
  }
  p = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}`));
  fs.writeFileSync(DUMP_PATH, JSON.stringify(p, null, 1));
  const summary = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}/employee-summary`));
  fs.writeFileSync(SUM_PATH, JSON.stringify(summary, null, 1));
  const pes = p?.periodEmployees || [];
  console.log("DUMP withItems", pes.filter((e) => (e.payrollItemValues || []).length).length, "/", pes.length);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
