/**
 * Complete DHR test-plan gaps on dhrtest2, then leave periods stale for recalc.
 * Does not touch İK 6101–6132, BT, Sude, or Faz1 Bordro A.Ş.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest2.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const ROOT = "d93d6660-892d-4dcf-8fc2-36bed171017a";
const IK = "6e473120-9b10-48d1-81df-08b4f798e4dd";
const BT = "c358d645-00b6-4a78-b0e1-e1aad87e4df2";
const LOG = path.join(process.env.TEMP, "fill_dhr_gaps.log");
const STATE_OUT = path.join(process.env.TEMP, "fill_dhr_gaps_state.json");

if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}

const DISABILITY = [
  { sicil: "6211", degree: 1, profile: "Engelli 1. Derece" },
  { sicil: "6212", degree: 2, profile: "Engelli 2. Derece" },
  { sicil: "6213", degree: 3, profile: "Engelli 3. Derece" },
  { sicil: "6313", degree: 1, profile: "Engelli 1. Derece" },
  { sicil: "8016", degree: 1, profile: "Engelli 1. Derece" },
  { sicil: "8023", degree: 2, profile: "Engelli 2. Derece" },
  { sicil: "8024", degree: 3, profile: "Engelli 3. Derece" },
  { sicil: "8044", degree: 2, profile: "5746 Lisans / Diğer Personel" },
  { sicil: "8048", degree: 3, profile: "Engelli 3. Derece" },
];

const PVS = [
  { sicil: "8030", name: "Net Fazla Mesai", value: 5000, date: "2026-09-15", desc: "HSP-008 5000 TL net mesai" },
  { sicil: "8037", name: "Net Fazla Mesai", value: 1500, date: "2026-09-15", desc: "EDGE-035 net mesai" },
  { sicil: "6317", name: "Yan Hak Vergi Farkı", value: 1, date: "2026-01-15", desc: "Paket yan hak" },
  { sicil: "6324", name: "Sendika Aidatı", value: 450, date: "2026-01-15", desc: "Paket sendika" },
  { sicil: "6325", name: "İşveren Alacağı", value: 25000, date: "2026-01-15", desc: "Paket işveren alacağı" },
  { sicil: "6330", name: "Ücret Kesme Cezası", value: 3366.67, date: "2026-01-15", desc: "Paket 2 gündelik" },
  { sicil: "6321", name: "Nafaka", value: 8000, date: "2026-01-15", desc: "Paket nafaka" },
  { sicil: "6322", name: "İcra", value: 20000, date: "2026-01-15", desc: "Paket icra" },
  { sicil: "6323", name: "Nafaka", value: 6000, date: "2026-01-15", desc: "Paket nafaka" },
  { sicil: "6323", name: "İcra", value: 15000, date: "2026-01-15", desc: "Paket icra" },
  { sicil: "6314", name: "Çocuk Yardımı", value: 1500, date: "2026-01-15", desc: "Paket çocuk" },
  { sicil: "6315", name: "Eş Yardımı", value: 1000, date: "2026-01-15", desc: "Paket eş" },
  { sicil: "6320", name: "İzin Harçlığı", value: 2500, date: "2026-01-15", desc: "Paket izin harçlığı" },
];

const ADVANCES = [
  { sicil: "8009", amount: 2000, date: "2026-09-01", desc: "TV-08 maaş avansı" },
  { sicil: "6220", amount: 7200, date: "2026-01-01", desc: "Tek değişken maaş avansı" },
  { sicil: "6326", amount: 7200, date: "2026-01-01", desc: "Paket maaş avansı" },
];

function log(...a) {
  const m = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(m);
  fs.appendFileSync(LOG, m + "\n");
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
  const v = unwrap(x);
  if (Array.isArray(v)) return v;
  if (v?.items) return v.items;
  if (v?.results) return v.results;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && r.data?.isSuccess !== false && !r.data?.error;
}
function errText(r) {
  const e = r?.data?.error || r?.data?.title;
  const msg =
    e?.message ||
    (Array.isArray(e?.errors) ? e.errors[0] : null) ||
    (typeof e === "string" ? e : null) ||
    r?.text;
  return String(msg || r?.status || "").replace(/\s+/g, " ").slice(0, 280);
}
function eqName(a, b) {
  return String(a || "")
    .trim()
    .toLocaleLowerCase("tr") === String(b || "").trim().toLocaleLowerCase("tr");
}
function fold(s) {
  return String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}
function near(a, b, tol = 0.02) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= tol;
}
function protectedEmp(e) {
  const n = Number(e?.employeeNumber);
  const email = String(e?.email || "").toLowerCase();
  if (email === "sude.cinay@d1-tech.com") return true;
  if (n >= 6101 && n <= 6132) return true;
  const ou = e?.organizationalUnitId || e?.organizationalUnit?.id;
  if (ou === IK || ou === BT) return true;
  return false;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.writeFileSync(LOG, "BOOT " + new Date().toISOString() + "\n");
  const notes = [];
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email", { timeout: 30000 });
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 120 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  log("LOGIN", page.url());
  if (page.url().includes("/login")) throw new Error("admin login fail");

  async function api(method, urlPath, body) {
    const res = await page.evaluate(
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
        return { status: res.status, data, text: String(text).slice(0, 900) };
      },
      { method, urlPath, body }
    );
    if ((res.status === 429 || /çok fazla|csrf/i.test(res.text || "")) && api._attempt !== 8) {
      api._attempt = (api._attempt || 0) + 1;
      await sleep(4000 * api._attempt);
      const out = await api(method, urlPath, body);
      api._attempt = 0;
      return out;
    }
    api._attempt = 0;
    return res;
  }

  async function listAll(url) {
    const first = await api("GET", url);
    let rows = arr(first);
    if (rows.length) return rows;
    for (let pageNo = 1; pageNo <= 8; pageNo++) {
      const sep = url.includes("?") ? "&" : "?";
      const r = await api("GET", `${url}${sep}page=${pageNo}&pageSize=400`);
      const batch = arr(r);
      log("LIST", url, "p", pageNo, r.status, batch.length);
      if (!batch.length) break;
      rows.push(...batch);
      if (batch.length < 100) break;
    }
    return rows;
  }

  const units = await listAll("/api/OrganizationalUnit/filteredByUnitAbilities");
  const takvimOu = units.find((u) => fold(u.name).includes("takvim") && !fold(u.name).includes("bordro a"));
  log("UNITS", units.length, "takvim", takvimOu?.id, takvimOu?.name);

  let emps = await listAll("/api/Employee/filteredByUnitAbilities");
  if (emps.length < 50) emps = emps.concat(await listAll("/api/Employee/list"));
  const bySicil = {};
  for (const e of emps) {
    const n = String(e.employeeNumber || "");
    if (n) bySicil[n] = e;
  }
  log("EMPS", emps.length, "wanted", [...new Set([...DISABILITY, ...PVS, ...ADVANCES, { sicil: "8063" }])].map((x) => x.sicil + ":" + !!(bySicil[x.sicil])).join(" "));

  const wanted = [...new Set([...DISABILITY.map((x) => x.sicil), ...PVS.map((x) => x.sicil), ...ADVANCES.map((x) => x.sicil), "8063", "6328"])];
  for (const sicil of wanted) {
    if (bySicil[sicil]) continue;
    for (const ep of [`/api/Employee/by-number/${sicil}`, `/api/Employee?employeeNumber=${sicil}`]) {
      const r = await api("GET", ep);
      const hit = unwrap(r);
      const row = Array.isArray(hit) ? hit[0] : hit;
      if (ok(r) && row?.id) {
        bySicil[sicil] = row;
        log("EMP_FIND", sicil, ep, row.id);
        break;
      }
    }
  }

  const payments = await listAll("/api/Payment/filteredByUnitAbilities");
  const payByName = {};
  for (const p of payments) {
    if (p.organizationalUnitId === ROOT || !payByName[p.name]) payByName[p.name] = p;
  }
  log("PAYS", Object.keys(payByName).filter((n) => /Net Fazla|Sağlık|Sendika|Alacağı|Kesme|Nafaka|İcra|Çocuk|Eş|İzin Harç|Yan Hak|Kıdem|İhbar/i.test(n)).join(" | "));

  const rootProfiles = (await listAll(`/api/PayrollProfile/ownerOrganizationalUnit/${ROOT}`)).filter((p) => p.status !== 3);
  log("PROFILES", rootProfiles.map((p) => p.name).join(" | "));
  function profileId(name) {
    return rootProfiles.find((p) => eqName(p.name, name))?.id || null;
  }

  const overtimeTypes = arr(unwrap(await api("GET", "/api/OvertimeType/all")));
  const otNet =
    overtimeTypes.find((t) => t.isNet || /net/i.test(t.name || "")) ||
    overtimeTypes.find((t) => /net fazla/i.test(t.name || ""));
  log("OT_NET", otNet?.id, otNet?.name);

  async function ensurePay(name, templateName, extra) {
    if (payByName[name]?.id) return payByName[name];
    const tpl = payByName[templateName] || payByName["Prim"] || payByName["Genel Kesinti"];
    if (!tpl) {
      log("PAY missing tpl", name);
      return null;
    }
    const body = {
      name,
      organizationalUnitId: ROOT,
      paymentKind: extra?.paymentKind ?? tpl.paymentKind ?? 0,
      paymentCategory: extra?.paymentCategory || tpl.paymentCategory,
      isDeduction: extra?.isDeduction ?? tpl.isDeduction ?? false,
      includeInSgk: extra?.includeInSgk ?? tpl.includeInSgk ?? true,
      includeInIncomeTax: extra?.includeInIncomeTax ?? tpl.includeInIncomeTax ?? true,
      includeInStampTax: extra?.includeInStampTax ?? tpl.includeInStampTax ?? true,
      isFixed: false,
      isOptional: true,
      isNet: extra?.isNet ?? false,
      deductionClass: extra?.deductionClass ?? tpl.deductionClass ?? 0,
      sgkEarningKind: tpl.sgkEarningKind ?? 0,
      prorationBasis: tpl.prorationBasis ?? 0,
      paymentMethod: tpl.paymentMethod ?? 0,
      allowCashExemption: tpl.allowCashExemption ?? true,
    };
    const r = await api("POST", "/api/Payment", body);
    log("PAY_CREATE", name, r.status, ok(r) ? unwrap(r)?.id : errText(r));
    const created = unwrap(r);
    if (ok(r) && created?.id) {
      payByName[name] = created;
      return created;
    }
    return null;
  }
  await ensurePay("Net Fazla Mesai", "Fazla Mesai", { isNet: true, paymentCategory: "Earning" });
  await ensurePay("Özel Sağlık Sigortası (İşveren)", "Prim", { paymentCategory: "Earning" });
  await ensurePay("Yan Hak Vergi Farkı", "Prim", { paymentCategory: "Earning" });
  await ensurePay("Çocuk Yardımı", "Prim", { paymentCategory: "Earning" });
  await ensurePay("Eş Yardımı", "Prim", { paymentCategory: "Earning" });
  await ensurePay("İzin Harçlığı", "Prim", { paymentCategory: "Earning" });
  await ensurePay("Nafaka", "Genel Kesinti", { isDeduction: true, paymentCategory: "Deduction" });
  await ensurePay("Sendika Aidatı", "Genel Kesinti", { isDeduction: true, paymentCategory: "Deduction" });
  await ensurePay("İşveren Alacağı", "Genel Kesinti", { isDeduction: true, paymentCategory: "Deduction" });
  await ensurePay("Ücret Kesme Cezası", "Genel Kesinti", { isDeduction: true, paymentCategory: "Deduction" });
  await ensurePay("İcra", "Genel Kesinti", { isDeduction: true, paymentCategory: "Deduction" });

  log("PHASE disability");
  for (const row of DISABILITY) {
    const emp = bySicil[row.sicil];
    if (!emp?.id) {
      notes.push({ sicil: row.sicil, step: "disability", ok: false, err: "employee not found" });
      log("DIS skip missing", row.sicil);
      continue;
    }
    if (protectedEmp(emp)) {
      notes.push({ sicil: row.sicil, step: "disability", ok: false, err: "protected" });
      continue;
    }
    const full = unwrap(await api("GET", `/api/Employee/${emp.id}`)) || emp;
    const beforeDeg = full.disabilityDegree;
    const pid = profileId(row.profile);
    if (pid) {
      const pr = await api("PUT", `/api/Employee/${emp.id}/payrollProfiles`, [pid]);
      log("PROF", row.sicil, row.profile, pr.status, ok(pr) ? "ok" : errText(pr));
    } else log("PROF missing", row.sicil, row.profile);
    const body = {
      firstName: full.firstName,
      lastName: full.lastName,
      employeeNumber: full.employeeNumber,
      email: full.email,
      gender: full.gender,
      phoneNumber: full.phoneNumber,
      birthDate: full.birthDate ? String(full.birthDate).slice(0, 10) : undefined,
      companyStartDate: full.companyStartDate,
      defaultPayrollLawVariantId: full.defaultPayrollLawVariantId || null,
      defaultPayrollLawFieldsJson: full.defaultPayrollLawFieldsJson || null,
      defaultTaxExemptionVariantId: full.defaultTaxExemptionVariantId || null,
      disabilityDegree: row.degree,
    };
    let put = await api("PUT", `/api/Employee/${emp.id}`, body);
    if (!ok(put)) {
      put = await api("PUT", `/api/Employee/${emp.id}/disabilityDegree/${row.degree}`, {});
    }
    const after = unwrap(await api("GET", `/api/Employee/${emp.id}`));
    const got = after?.disabilityDegree;
    log("DIS", row.sicil, "before", beforeDeg, "want", row.degree, "got", got, "put", put.status, ok(put) ? "ok" : errText(put));
    notes.push({ sicil: row.sicil, step: "disability", want: row.degree, got, ok: Number(got) === row.degree });
  }

  log("PHASE payment values");
  async function pvsOf(empId) {
    const tries = [
      `/api/PaymentValue/employee/${empId}`,
      `/api/PaymentValue/by-employee/${empId}`,
      `/api/Employee/${empId}/paymentValues`,
    ];
    for (const ep of tries) {
      const r = await api("GET", ep);
      const rows = arr(r);
      if (r.status !== 404 && (ok(r) || rows.length)) return rows;
    }
    return [];
  }
  let allPv = await listAll("/api/PaymentValue/all");
  log("PV_ALL", allPv.length);

  for (const x of PVS) {
    const emp = bySicil[x.sicil];
    const pay = payByName[x.name];
    if (!emp?.id || !pay?.id) {
      notes.push({ sicil: x.sicil, step: "pv", name: x.name, ok: false, err: !emp ? "no emp" : "no pay " + x.name });
      log("PV skip", x.sicil, x.name, !!emp, pay?.id);
      continue;
    }
    if (protectedEmp(emp)) continue;
    const mine = (allPv.length ? allPv : await pvsOf(emp.id)).filter((v) => v.employeeId === emp.id && v.paymentId === pay.id);
    const hit = mine.find((v) => near(v.value ?? v.amount, x.value));
    if (hit) {
      log("PV exists", x.sicil, x.name, x.value, hit.id);
      notes.push({ sicil: x.sicil, step: "pv", name: x.name, ok: true, existed: true, id: hit.id });
      continue;
    }
    const r = await api("POST", "/api/PaymentValue", {
      paymentId: pay.id,
      employeeId: emp.id,
      value: x.value,
      date: x.date,
      description: x.desc,
    });
    log("PV add", x.sicil, x.name, x.value, r.status, ok(r) ? unwrap(r)?.id : errText(r));
    notes.push({ sicil: x.sicil, step: "pv", name: x.name, ok: ok(r), err: ok(r) ? undefined : errText(r) });
    const created = unwrap(r);
    if (ok(r) && created) allPv.push({ ...created, employeeId: emp.id, paymentId: pay.id, value: x.value });
  }

  log("PHASE health fixed payments");
  async function putHealth(sicil, payName, value) {
    const emp = bySicil[sicil];
    const pay = payByName[payName];
    if (!emp?.id || !pay?.id) {
      log("HEALTH skip", sicil, payName);
      return;
    }
    const cur = unwrap(await api("GET", `/api/Employee/${emp.id}/fixedPayments`));
    const list = arr(cur).concat(arr(cur?.fixedPayments));
    const next = list
      .filter((x) => x.paymentId !== pay.id)
      .map((x) => ({
        paymentId: x.paymentId,
        value: x.value ?? x.wageValue,
        wageValue: x.wageValue ?? x.value,
        validFromYear: x.validFromYear || 2026,
        validFromMonth: x.validFromMonth || 1,
        validToYear: x.validToYear ?? null,
        validToMonth: x.validToMonth ?? null,
      }));
    next.push({ paymentId: pay.id, value, wageValue: value, validFromYear: 2026, validFromMonth: 1 });
    let r = await api("PUT", `/api/Employee/${emp.id}/fixedPayments`, { fixedPayments: next });
    if (!ok(r)) r = await api("PUT", `/api/Employee/${emp.id}/fixedPayments`, { fixedPayments: next.map((x) => ({ paymentId: x.paymentId, value: x.value })) });
    const after = arr(unwrap(await api("GET", `/api/Employee/${emp.id}/fixedPayments`)));
    const hit = after.find((x) => x.paymentId === pay.id);
    log("HEALTH", sicil, payName, r.status, ok(r) ? "ok" : errText(r), "got", hit?.value ?? hit?.wageValue);
    notes.push({ sicil, step: "health-fp", ok: Number(hit?.value ?? hit?.wageValue) === value, got: hit?.value ?? hit?.wageValue });
  }
  await putHealth("6316", "Özel Sağlık Sigortası (İşveren)", 1500);
  await putHealth("6317", "Özel Sağlık Sigortası (İşveren Üstlenir)", 1500);

  const ruya = bySicil["6328"];
  if (ruya?.id && !protectedEmp(ruya)) {
    const mine = allPv.filter((v) => v.employeeId === ruya.id);
    const dummy = mine.filter((v) => {
      const n = payByName && Object.entries(payByName).find(([, p]) => p.id === v.paymentId)?.[0];
      return /kıdem|ihbar|kidem/i.test(n || "") && Number(v.value || v.amount) <= 1.01;
    });
    for (const v of dummy) {
      const d = await api("DELETE", `/api/PaymentValue/${v.id}`);
      log("RUYA del dummy", v.id, d.status, ok(d) ? "ok" : errText(d));
    }
    const full = unwrap(await api("GET", `/api/Employee/${ruya.id}`)) || {};
    log("RUYA card exit", full.terminationDate || full.exitDate || full.companyEndDate || full.endDate, "start", full.companyStartDate);
    notes.push({ sicil: "6328", step: "ruya-exit", ok: true, dummyDeleted: dummy.length, exit: full.terminationDate || full.exitDate || null });
  }

  log("PHASE overtime 8008 net 5h");
  const fırat = bySicil["8008"];
  if (fırat?.id && otNet?.id && !protectedEmp(fırat)) {
    const chunks = [
      ["2026-09-21T18:00:00", "2026-09-21T21:00:00", "TV-06 net 3s"],
      ["2026-09-22T18:00:00", "2026-09-22T20:00:00", "TV-06 net 2s"],
    ];
    for (const [start, end, title] of chunks) {
      const r = await api("POST", "/api/EmployeeOvertimeRequest/assign", {
        title,
        description: title,
        startDate: start,
        endDate: end,
        targetEmployeeId: fırat.id,
        overtimeTypeId: otNet.id,
        compensationMode: 0,
      });
      log("OT8008", title, r.status, ok(r) ? "ok" : errText(r));
      notes.push({ sicil: "8008", step: "ot-net", title, ok: ok(r) || r.status === 409, err: ok(r) || r.status === 409 ? undefined : errText(r) });
    }
  }

  log("PHASE advances");
  for (const x of ADVANCES) {
    const emp = bySicil[x.sicil];
    if (!emp?.id) {
      notes.push({ sicil: x.sicil, step: "advance", ok: false, err: "no emp" });
      continue;
    }
    if (protectedEmp(emp)) continue;
    const existing = arr(unwrap(await api("GET", `/api/AdvanceRequest/employee/${emp.id}`))).concat(
      arr(unwrap(await api("GET", `/api/Employee/${emp.id}/advances`)))
    );
    const hit = existing.find((a) => near(a.requestedAmount || a.amount || a.value, x.amount));
    if (hit) {
      log("ADV exists", x.sicil, x.amount, hit.id);
      notes.push({ sicil: x.sicil, step: "advance", ok: true, existed: true });
      continue;
    }
    let r = await api("POST", "/api/AdvanceRequest/assign", {
      targetEmployeeId: emp.id,
      employeeId: emp.id,
      advanceType: 1,
      requestedAmount: x.amount,
      numberOfInstallments: 1,
      expectedRepaymentStartDate: x.date,
      purpose: x.desc,
    });
    if (!ok(r)) {
      r = await api("POST", "/api/AdvanceRequest", {
        employeeId: emp.id,
        advanceType: 1,
        requestedAmount: x.amount,
        numberOfInstallments: 1,
        expectedRepaymentStartDate: x.date,
        purpose: x.desc,
      });
    }
    log("ADV", x.sicil, x.amount, r.status, ok(r) ? "ok" : errText(r));
    notes.push({ sicil: x.sicil, step: "advance", ok: ok(r) || r.status === 409, err: ok(r) || r.status === 409 ? undefined : errText(r) });
  }

  log("PHASE takvim Eylül");
  let periods = [];
  for (let pno = 1; pno <= 6; pno++) {
    const list = await api("GET", `/api/PayrollPeriod/list?page=${pno}&pageSize=200`);
    const batch = arr(list);
    log("PERIOD LIST", pno, list.status, batch.length);
    if (!batch.length) break;
    periods.push(...batch);
    if (batch.length < 100) break;
  }
  const takvimPeriod = periods.find((p) => {
    const blob = fold([p.organizationalUnitName, p.organizationalUnit?.name, p.name, p.periodName].filter(Boolean).join(" "));
    return p.year === 2026 && p.month === 9 && blob.includes("takvim") && !blob.includes("bordro a");
  });
  const cemre = bySicil["8063"];
  log("TAKVIM period", takvimPeriod?.id, takvimPeriod?.payrollStatus, "cemre", cemre?.id);
  if (takvimPeriod?.id && cemre?.id) {
    const add = await api("POST", `/api/PayrollPeriod/${takvimPeriod.id}/employees`, { employeeIds: [cemre.id] });
    log("TAKVIM add", add.status, ok(add) ? "ok" : errText(add));
    notes.push({ sicil: "8063", step: "takvim-add", ok: ok(add) || add.status === 409, err: ok(add) || add.status === 409 ? undefined : errText(add) });
  } else if (takvimOu?.id && cemre?.id && !takvimPeriod) {
    const c = await api("POST", "/api/PayrollPeriod/create-async", {
      month: 9,
      year: 2026,
      organizationalUnitId: takvimOu.id,
      hasSgkDebt: false,
      employeeIds: [cemre.id],
    });
    log("TAKVIM create", c.status, JSON.stringify(unwrap(c)).slice(0, 200), errText(c));
    notes.push({ sicil: "8063", step: "takvim-create", ok: ok(c), err: ok(c) ? undefined : errText(c) });
  } else {
    notes.push({ sicil: "8063", step: "takvim", ok: false, err: "period or cemre missing" });
  }

  const state = {
    at: new Date().toISOString(),
    people: Object.fromEntries(
      Object.entries(bySicil)
        .filter(([k]) => wanted.includes(k))
        .map(([k, v]) => [k, { id: v.id, email: v.email, number: v.employeeNumber }])
    ),
    payments: Object.fromEntries(Object.entries(payByName).map(([k, v]) => [k, v.id])),
    takvimPeriodId: takvimPeriod?.id || null,
    notes,
  };
  fs.writeFileSync(STATE_OUT, JSON.stringify(state, null, 2));
  log("DONE notes", notes.filter((n) => !n.ok).length, "fail /", notes.length);
  for (const n of notes) if (!n.ok) log("FAIL", JSON.stringify(n));
  await browser.close();
})().catch((e) => {
  console.error(e);
  fs.appendFileSync(LOG, String(e.stack || e) + "\n");
  process.exit(1);
});
