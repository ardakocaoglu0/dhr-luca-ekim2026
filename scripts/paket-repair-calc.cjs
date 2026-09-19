/**
 * Paket birimindeki yerel Payment kayıtları kök Temel Maaş/Yemek/Yol’u
 * dönem PPV’sinden düşürüyordu. Sil, ROOT kalemlerle extras yaz, Ocak hesapla.
 * Şubat için requirePeriodCompletionBeforeNew geçici false.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest2.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}

const ROOT = "d93d6660-892d-4dcf-8fc2-36bed171017a";
const PAKET = "5b82b05e-69c5-428b-b4d5-20f67586025d";
const PERIOD = "b38418d0-5b60-442a-8b3a-13868ca81789";
const MART = "4d61843a-c79e-4a94-a7a5-ff514a50ad63";
const STATE_PATH = path.join(process.env.TEMP, "paket_seed_state.json");
const DUMP = path.join(process.env.TEMP, "paket_ocak_period.json");
const LOG = path.join(process.env.TEMP, "paket_repair.log");

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXTRAS = [
  { sicil: "6327", name: "Prim", value: 80000 },
  { sicil: "6319", name: "Prim", value: 2500 },
  { sicil: "6316", name: "Özel Sağlık Sigortası (İşveren)", value: 1500 },
  { sicil: "6317", name: "Özel Sağlık Sigortası (İşveren)", value: 1500 },
  { sicil: "6322", name: "İcra", value: 20000 },
  { sicil: "6323", name: "İcra", value: 15000 },
  { sicil: "6321", name: "Nafaka", value: 8000 },
  { sicil: "6323", name: "Nafaka", value: 6000 },
  { sicil: "6324", name: "Sendika Aidatı", value: 450 },
  { sicil: "6325", name: "İşveren Alacağı", value: 25000 },
  { sicil: "6330", name: "Ücret Kesme Cezası", value: 3366.67 },
  { sicil: "6314", name: "Çocuk Yardımı", value: 1500 },
  { sicil: "6315", name: "Eş Yardımı", value: 1000 },
  { sicil: "6317", name: "Yan Hak Vergi Farkı", value: 1 },
  { sicil: "6320", name: "İzin Harçlığı", value: 2500 },
  { sicil: "6328", name: "Kıdem Tazminatı (Muaf)", value: 1 },
  { sicil: "6328", name: "İhbar Tazminatı", value: 1 },
];

(async () => {
  fs.writeFileSync(LOG, "BOOT " + new Date().toISOString() + "\n");
  const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  if (page.url().includes("/login")) throw new Error("login fail");
  log("LOGIN OK");

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
        return { status: res.status, data, text: String(text).slice(0, 700) };
      },
      { method, urlPath, body }
    );
  }

  const localPays = arr((await api("GET", `/api/Payment/ownerOrganizationalUnit/${PAKET}`)).data);
  log("LOCAL PAYS", localPays.map((p) => p.name + " " + p.id).join(" | "));

  const pvs = arr((await api("GET", "/api/PaymentValue/all")).data);
  const localIds = new Set(localPays.map((p) => p.id));
  const hitPv = pvs.filter((v) => localIds.has(v.paymentId));
  log("PV local", hitPv.length, "all", pvs.length);
  for (const v of hitPv) {
    const r = await api("DELETE", `/api/PaymentValue/${v.id}`);
    if (!ok(r)) log("DEL PV", v.id, r.status, errText(r));
  }
  for (const p of localPays) {
    const r = await api("DELETE", `/api/Payment/${p.id}`);
    log("DEL PAY", p.name, r.status, ok(r) ? "ok" : errText(r));
  }

  const rootPays = arr((await api("GET", `/api/Payment/ownerOrganizationalUnit/${ROOT}`)).data);
  const payByName = Object.fromEntries(rootPays.map((p) => [p.name, p]));
  const prim = payByName["Prim"];
  const genel = payByName["Genel Kesinti"];
  if (!prim || !genel) throw new Error("root Prim/Genel Kesinti missing");

  const items = arr((await api("GET", `/api/PayrollItem/ownerOrganizationalUnit/${ROOT}`)).data);
  function linksOf(paymentId) {
    const out = [];
    for (const it of items) {
      for (const l of it.payrollItemPayments || []) {
        if (l.paymentId === paymentId) out.push({ payrollItemId: it.id, effectType: l.effectType, item: it.name });
      }
    }
    return out;
  }
  const primLinks = linksOf(prim.id);
  const genelLinks = linksOf(genel.id);
  log("PRIM LINKS", primLinks.length, primLinks.map((x) => x.item + ":" + x.effectType).join(","));
  log("GENEL LINKS", genelLinks.length, genelLinks.map((x) => x.item + ":" + x.effectType).join(","));

  async function ensureRootPay(name, template, kind) {
    if (payByName[name]) return payByName[name];
    const body = {
      name,
      organizationalUnitId: ROOT,
      paymentKind: template.paymentKind ?? 0,
      paymentCategory: kind || template.paymentCategory,
      isDeduction: (kind || template.paymentCategory) === "Deduction",
      includeInSgk: template.includeInSgk ?? true,
      includeInIncomeTax: template.includeInIncomeTax ?? true,
      includeInStampTax: template.includeInStampTax ?? true,
      isFixed: false,
      isOptional: true,
      isNet: false,
      deductionClass: template.deductionClass ?? 0,
      sgkEarningKind: template.sgkEarningKind ?? 0,
      prorationBasis: template.prorationBasis ?? 0,
      paymentMethod: template.paymentMethod ?? 0,
      allowCashExemption: template.allowCashExemption ?? true,
    };
    const r = await api("POST", "/api/Payment", body);
    log("PAY_ROOT", name, r.status, ok(r) ? unwrap(r)?.id : errText(r));
    const created = unwrap(r);
    if (ok(r) && created?.id) {
      payByName[name] = created;
      rootPays.push(created);
      return created;
    }
    return null;
  }

  async function linkLike(pay, templateLinks) {
    if (!pay?.id) return;
    for (const l of templateLinks) {
      const bodies = [
        { payrollItemId: l.payrollItemId, paymentId: pay.id, effectType: l.effectType },
        { payrollItemId: l.payrollItemId, paymentId: pay.id, effectType: l.effectType, paymentCategory: pay.paymentCategory },
      ];
      let done = false;
      for (const b of bodies) {
        const r = await api("POST", "/api/PayrollItemPayment", b);
        log("LINK", pay.name, l.item, r.status, ok(r) ? "ok" : errText(r));
        if (ok(r) || r.status === 409) {
          done = true;
          break;
        }
      }
      if (!done) {
        const r2 = await api("POST", `/api/PayrollItem/${l.payrollItemId}/payments`, {
          paymentId: pay.id,
          effectType: l.effectType,
        });
        log("LINK2", pay.name, l.item, r2.status, ok(r2) ? "ok" : errText(r2));
      }
    }
  }

  const earnNames = ["Çocuk Yardımı", "Eş Yardımı", "Yan Hak Vergi Farkı", "İzin Harçlığı"];
  const dedNames = ["Nafaka", "Sendika Aidatı", "İşveren Alacağı", "Ücret Kesme Cezası"];
  for (const n of earnNames) {
    const p = await ensureRootPay(n, prim, "Earning");
    await linkLike(p, primLinks);
  }
  for (const n of dedNames) {
    const p = await ensureRootPay(n, genel, "Deduction");
    await linkLike(p, genelLinks);
  }

  for (const p of Object.values(state.payments || {})) {
    /* keep */
  }
  state.payments = Object.fromEntries(rootPays.concat(Object.values(payByName)).filter((p) => p?.id && p?.name).map((p) => [p.name, p.id]));
  for (const [n, p] of Object.entries(payByName)) state.payments[n] = p.id;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

  async function addPv(sicil, payName, value) {
    const row = state.people[sicil];
    const paymentId = state.payments[payName] || payByName[payName]?.id;
    if (!row || !paymentId || !value) {
      log("PV skip", sicil, payName, !!row, paymentId, value);
      return;
    }
    const r = await api("POST", "/api/PaymentValue", {
      paymentId,
      employeeId: row.employeeId,
      value,
      date: "2026-01-15",
      description: "Bordro Paket " + payName,
    });
    log("PV", sicil, payName, value, r.status, ok(r) ? unwrap(r)?.id : errText(r));
  }
  for (const x of EXTRAS) await addPv(x.sicil, x.name, x.value);

  const parent = unwrap((await api("GET", `/api/PayrollSetting/${PAKET}`)).data) || {};
  const psBody = { ...parent, requirePeriodCompletionBeforeNew: false };
  delete psBody.organizationalUnit;
  const ps = await api("PUT", `/api/PayrollSetting/${PAKET}`, psBody);
  log("PS requirePrev false", ps.status, ok(ps));

  async function calc(periodId, label) {
    const auto = await api("POST", `/api/PayrollPeriod/${periodId}/attendance/bulk-save-auto`, {
      filter: null,
      search: null,
      onlyFullyDerived: false,
    });
    log("ATT", label, auto.status, JSON.stringify(unwrap(auto.data) || auto.data).slice(0, 220));
    const calcR = await api("POST", `/api/PayrollPeriod/${periodId}/calculate`, { onlyStaleEmployees: false });
    const jobId = unwrap(calcR.data)?.jobId;
    log("CALC", label, calcR.status, jobId, errText(calcR));
    let full = null;
    for (let i = 0; i < 48; i++) {
      await sleep(5000);
      const job = jobId ? unwrap((await api("GET", `/api/background-jobs/${jobId}`)).data) : null;
      full = unwrap((await api("GET", `/api/PayrollPeriod/${periodId}`)).data);
      const pes = full?.periodEmployees || [];
      const withItems = pes.filter((e) => (e.payrollItemValues || []).length).length;
      const sample = pes.find((e) => String(e.employee?.employeeNumber) === "6301") || pes[0];
      const maas = (sample?.paymentPeriodValues || []).find((x) => x.payment?.name === "Temel Maaş");
      log(`POLL ${label} ${i} job=${job?.jobStatus} pct=${job?.progressPercent} items=${withItems}/${pes.length} maas=${maas?.value} ppv=${(sample?.paymentPeriodValues || []).length}`);
      if (job && job.jobStatus !== 0 && job.jobStatus !== 1 && i >= 1) break;
    }
    return full;
  }

  const ocak = await calc(PERIOD, "ocak");
  if (ocak) {
    fs.writeFileSync(DUMP, JSON.stringify(ocak));
    const pes = ocak.periodEmployees || [];
    log("DUMP ocak", pes.length, "withItems", pes.filter((e) => (e.payrollItemValues || []).length).length);
  }

  const delMart = await api("DELETE", `/api/PayrollPeriod/${MART}`);
  log("DEL MART", delMart.status, ok(delMart) ? "ok" : errText(delMart));

  const carryIds = ["6325", "6327"].map((s) => state.people[s]?.employeeId).filter(Boolean);
  async function ensureMonth(month, ids, key) {
    let periods = arr((await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")).data);
    let period = periods.find((p) => p.year === 2026 && p.month === month && p.organizationalUnitId === PAKET);
    if (!period?.id) {
      const c = await api("POST", "/api/PayrollPeriod/create-async", {
        month,
        year: 2026,
        organizationalUnitId: PAKET,
        hasSgkDebt: false,
        employeeIds: ids,
      });
      const d = unwrap(c.data);
      log("PERIOD_CREATE", month, c.status, JSON.stringify(d).slice(0, 220), errText(c));
      if (d?.jobId) {
        for (let i = 0; i < 24; i++) {
          await sleep(3000);
          const job = unwrap((await api("GET", `/api/background-jobs/${d.jobId}`)).data);
          if (job && job.jobStatus !== 0 && job.jobStatus !== 1) break;
        }
      }
      const periodId = d?.periodId || d?.id;
      if (periodId) period = unwrap((await api("GET", `/api/PayrollPeriod/${periodId}`)).data) || { id: periodId };
      else {
        periods = arr((await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")).data);
        period = periods.find((p) => p.year === 2026 && p.month === month && p.organizationalUnitId === PAKET);
      }
    }
    if (period?.id && ids.length) {
      const add = await api("POST", `/api/PayrollPeriod/${period.id}/employees`, { employeeIds: ids });
      log("PERIOD_ADD", month, add.status, ok(add) ? "ok" : errText(add));
    }
    if (period?.id) {
      state.periods[key] = { id: period.id, year: 2026, month, ou: PAKET, count: ids.length };
      fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    }
    return period;
  }

  if (carryIds.length) {
    const sub = await ensureMonth(2, carryIds, "subat");
    if (sub?.id) {
      const dump = await calc(sub.id, "subat");
      if (dump) fs.writeFileSync(path.join(process.env.TEMP, "paket_subat_period.json"), JSON.stringify(dump));
    }
    const mar = await ensureMonth(3, carryIds, "mart");
    if (mar?.id) {
      const dump = await calc(mar.id, "mart");
      if (dump) fs.writeFileSync(path.join(process.env.TEMP, "paket_mart_period.json"), JSON.stringify(dump));
    }
  }

  if (ocak?.id) {
    const ekTries = [
      ["POST", `/api/PayrollPeriod/${PERIOD}/create-supplement`, { kind: "ek", description: "Paket ek bordro 6301" }],
      ["POST", `/api/PayrollPeriod/${PERIOD}/supplementary`, { employeeIds: [state.people["6301"]?.employeeId].filter(Boolean) }],
      [
        "POST",
        "/api/PayrollPeriod/create-async",
        {
          month: 1,
          year: 2026,
          organizationalUnitId: PAKET,
          hasSgkDebt: false,
          employeeIds: [state.people["6301"]?.employeeId].filter(Boolean),
          runKind: 1,
          periodKind: 1,
        },
      ],
    ];
    for (const [m, u, b] of ekTries) {
      const r = await api(m, u, b);
      log("EK", m, u, r.status, ok(r) ? JSON.stringify(unwrap(r.data)).slice(0, 180) : errText(r));
      if (ok(r)) break;
    }
  }

  log("DONE");
  await browser.close();
})().catch((e) => {
  console.error(e);
  try {
    fs.appendFileSync(LOG, "FATAL " + e.stack + "\n");
  } catch {}
  process.exit(1);
});
