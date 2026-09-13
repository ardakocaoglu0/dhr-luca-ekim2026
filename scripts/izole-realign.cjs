/**
 * Re-align Tek Değişken kadro: tam ay giriş, profil/kanun/engellilik,
 * puantaj sıfırla + kanun id yaz, yeniden hesapla.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const PERIOD = "a1013469-c82e-4c5d-8dac-4dbfe10d6fdd";
const ROOT = "d93d6660-892d-4dcf-8fc2-36bed171017a";
const REASON_07 = "93aea4ba-7fc8-4570-8d28-aee49bee7b6e";
const TAX_4691 = "0f6e047b-9735-4f5a-940b-239ee4037098";
const LAW = {
  "05510_2": "5ca750a5-ec83-4a19-a9c9-c6320f989af7",
  "05510_5": "72542ce6-edf0-4a46-a770-cccf0f79246d",
  "5746_05746": "9ccf41e0-027e-4cae-8621-8629de05a749",
  "5746_15746": "67cf8ebb-6394-429a-968f-e2d8d495df28",
  "5746_GV": "9ccf41e0-027e-4cae-8621-8629de05a749",
};
const STATE_PATH = path.join(process.env.TEMP, "izole_seed_state.json");
const DUMP_PATH = path.join(process.env.TEMP, "izole_ocak_period.json");
const SUM_PATH = path.join(process.env.TEMP, "izole_ocak_summary.json");
const ROSTER = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "izole_roster.json"), "utf8"));
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
  return String(r?.text || JSON.stringify(r?.data || "")).replace(/\s+/g, " ").slice(0, 220);
}
function eqName(a, b) {
  return String(a || "").trim().toLocaleLowerCase("tr") === String(b || "").trim().toLocaleLowerCase("tr");
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
        return { status: res.status, data, text: String(text).slice(0, 1200) };
      },
      { method, urlPath, body }
    );
  }

  const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  const rootProfiles = arr(unwrap(await api("GET", `/api/PayrollProfile/ownerOrganizationalUnit/${ROOT}`))).filter((p) => p.status !== 3);
  function profileIdFor(name) {
    const hit = rootProfiles.find((p) => eqName(p.name, name));
    if (hit) return hit.id;
    if (/Ar-Ge/i.test(name)) return rootProfiles.find((p) => /ar-ge personeli/i.test(p.name || ""))?.id;
    if (/Destek/i.test(name)) return rootProfiles.find((p) => /destek personeli/i.test(p.name || ""))?.id;
    return rootProfiles.find((p) => /^Standart$/i.test(p.name))?.id;
  }

  console.log("PHASE people");
  for (const p of ROSTER.people) {
    const row = state.people[p.sicil];
    if (!row?.employeeId) {
      console.log("SKIP missing", p.sicil);
      continue;
    }
    const hire = p.hire || ROSTER.baseline.hire;
    const flags = p.seedFlags || {};
    const lawId = p.law ? LAW[p.law] : null;
    const taxId = p.tax === "4691" ? TAX_4691 : null;
    const profId = profileIdFor(p.profile);
    if (profId) {
      const pr = await api("PUT", `/api/Employee/${row.employeeId}/payrollProfiles`, [profId]);
      if (!ok(pr)) console.log("PROF", p.sicil, errText(pr));
    }
    await api("PUT", `/api/Employee/${row.employeeId}/salaryType/${p.salaryType ?? 0}`, {});
    const full = unwrap(await api("GET", `/api/Employee/${row.employeeId}`)) || {};
    const empPut = await api("PUT", `/api/Employee/${row.employeeId}`, {
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
    if (!ok(empPut)) console.log("EMP_PUT", p.sicil, errText(empPut));

    const posId = row.positionId;
    if (posId) {
      const pos = unwrap(await api("GET", `/api/OrganizationalUnitPosition/${posId}`)) || {};
      const posPut = await api("PUT", `/api/OrganizationalUnitPosition/${posId}`, {
        ...pos,
        id: posId,
        startDate: hire,
        employeeId: row.employeeId,
        organizationalUnitId: pos.organizationalUnitId,
        title: pos.title || p.title,
      });
      if (!ok(posPut) && posPut.status !== 204) console.log("POS_PUT", p.sicil, posPut.status, errText(posPut));
    }
    const eps = arr(unwrap(await api("GET", `/api/EmployeePosition/employee/${row.employeeId}`)));
    for (const ep of eps) {
      const epPut = await api("PUT", `/api/EmployeePosition/${ep.id}`, {
        employeeId: row.employeeId,
        organizationalUnitPositionId: ep.organizationalUnitPositionId || posId,
        startDate: hire + "T00:00:00",
        endDate: null,
      });
      if (!ok(epPut) && epPut.status !== 204) console.log("EP_PUT", p.sicil, epPut.status, errText(epPut));
    }
    if (p.sicil === "6201" || p.sicil === "6202" || p.sicil === "6211" || p.sicil === "6214") {
      const chk = unwrap(await api("GET", `/api/Employee/${row.employeeId}`));
      console.log(
        "CHK",
        p.sicil,
        "law",
        chk?.defaultPayrollLawVariantId,
        "tax",
        chk?.defaultTaxExemptionVariantId,
        "dis",
        chk?.disabilityDegree,
        "start",
        chk?.companyStartDate,
        "profiles",
        (chk?.payrollProfileIds || []).length
      );
    }
  }

  console.log("PHASE attendance reset");
  for (const ep of [
    `/api/PayrollPeriod/${PERIOD}/attendance/reset-all`,
    `/api/PayrollPeriod/${PERIOD}/attendance/reset`,
    `/api/PayrollPeriod/${PERIOD}/reset-attendance`,
  ]) {
    const r = await api("POST", ep, {});
    if (r.status !== 404) console.log("RESET", ep, r.status, errText(r));
  }

  const att = arr(unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}/payroll-attendance`)));
  const bySicil = Object.fromEntries(ROSTER.people.map((p) => [p.sicil, p]));
  const items = att.map((row) => {
    const p = bySicil[row.employeeNumber];
    const lawId = p?.law ? LAW[p.law] : null;
    const taxId = p?.tax === "4691" ? TAX_4691 : row.taxExemptionVariantId || null;
    const missing = p?.sicil === "6214" ? Math.max(row.totalMissingDays || 0, row.defaultMissingDays || 0, 1) : 0;
    return {
      periodEmployeeId: row.periodEmployeeId,
      data: {
        sgkDays: missing ? row.sgkDays ?? 26 : 30,
        normalDays: 31,
        businessDays: 22,
        workedBusinessDays: missing ? null : 22,
        businessHours: missing ? row.businessHours ?? 165 : 165,
        dailyWorkHours: 7.5,
        missingDayCount: missing,
        missingDayReasonId: missing ? row.missingDayReasonId || row.defaultMissingDayReasonId || REASON_07 : null,
        payrollAttendanceNotes: null,
        payrollLawVariantId: lawId,
        payrollLawFieldsJson: null,
        taxExemptionVariantId: taxId,
        remoteWorkDays: null,
        overtimes: row.overtimes || [],
        paymentNetSettings: (row.payments || []).map((pay) => ({ paymentId: pay.paymentId, isNet: !!pay.isNet })),
      },
    };
  });
  const bulk = await api("PUT", "/api/PeriodEmployee/payroll-attendance/bulk", { payrollPeriodId: PERIOD, items });
  console.log("BULK", bulk.status, errText(bulk));
  const auto = await api("POST", `/api/PayrollPeriod/${PERIOD}/attendance/bulk-save-auto`, {
    filter: null,
    search: null,
    onlyFullyDerived: false,
  });
  console.log("AUTO", auto.status, JSON.stringify(unwrap(auto) || auto.data).slice(0, 400));

  await page.goto(BASE + "/payroll-management", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.getByText(/^Dönemler$/).first().click().catch(() => {});
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const leaves = [...document.querySelectorAll("span, div")].filter(
      (el) => el.children.length === 0 && /Tek De[gğ]i[sş]ken/i.test((el.textContent || "").trim())
    );
    for (const leaf of leaves) {
      let c = leaf;
      for (let i = 0; i < 10 && c; i++) {
        c = c.parentElement;
        if (!c) break;
        if (c.querySelector("input[type=checkbox]") && (c.innerText || "").length < 180) {
          leaf.click();
          return;
        }
      }
    }
  });
  await page.waitForTimeout(2000);
  const go = page.locator("button", { hasText: /Puantaja git/ }).first();
  if (await go.count()) {
    await go.click();
    await page.waitForTimeout(5000);
    const saveBtn = page.locator("button", { hasText: /^Kaydet \(\d+\)$/ }).first();
    console.log("SAVE_BTN", await saveBtn.count(), (await saveBtn.innerText().catch(() => "")).trim());
    if (await saveBtn.count()) {
      await saveBtn.click();
      await page.waitForTimeout(2500);
      const confirm = page.locator("button", { hasText: /^(Kaydet|Onayla|Evet|Tamam|Devam)$/ }).last();
      if (await confirm.count()) await confirm.click().catch(() => {});
      await page.waitForTimeout(12000);
    }
  }

  let p = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}`));
  console.log(
    "PRE_CALC status",
    p?.payrollStatus,
    "saved",
    (p?.periodEmployees || []).filter((e) => e.isPayrollAttendanceSaved).length
  );

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
      `POLL ${i} job=${job?.jobStatus} pct=${job?.progressPercent} result=${String(job?.resultPayloadJson || "").slice(0, 160)} status=${p?.payrollStatus} items=${withItems}/${pes.length}`
    );
    if (job && job.jobStatus !== 0 && job.jobStatus !== 1 && i >= 1) break;
  }
  p = unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}`));
  fs.writeFileSync(DUMP_PATH, JSON.stringify(p, null, 1));
  fs.writeFileSync(SUM_PATH, JSON.stringify(unwrap(await api("GET", `/api/PayrollPeriod/${PERIOD}/employee-summary`)), null, 1));
  const sample = (p?.periodEmployees || []).filter((e) => ["6201", "6202", "6204", "6211", "6214", "6218", "6221"].includes(e.employee?.employeeNumber));
  for (const e of sample) {
    const net = (e.payrollItemValues || []).find((x) => x.payrollItem?.name === "Net Maaş")?.value;
    const law = e.payrollLawVariantId;
    console.log("ROW", e.employee.employeeNumber, e.employee.firstName, "net", net, "miss", e.totalMissingDays, "law", law, "meal", (e.paymentPeriodValues || []).find((x) => x.payment?.name === "Yemek Yardımı")?.value);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
