/**
 * Faz A: dhrtest2 İK + Tek Değişken Ocak yeniden hesap ve paket düzeltmeleri.
 * İK 6101–6132 / BT / Sude PUT yok. Tek Değişken 6220 avansı maaş avansına çekilebilir.
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

const OUT = path.join(process.env.TEMP, "paket_faz_a");
fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { key: "ocak", year: 2026, month: 1, unitNeedles: ["insan kaynak", "ik"], dumpName: "ik_ocak.json" },
  { key: "izole", year: 2026, month: 1, unitNeedles: ["tek degisken", "tek değişken"], dumpName: "izole_ocak.json" },
  { key: "ekim", year: 2026, month: 10, unitNeedles: ["insan kaynak", "ik"], dumpName: "ik_ekim.json" },
];

const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  if (v?.items && Array.isArray(v.items)) return v.items;
  if (v?.results && Array.isArray(v.results)) return v.results;
  return [];
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
function unitBlob(p) {
  return fold(
    [p.organizationalUnitName, p.organizationalUnit?.name, p.unitName, p.name, p.periodName, p.description]
      .filter(Boolean)
      .join(" ")
  );
}

function extractPe(pe) {
  const emp = pe.employee || {};
  const payments = {};
  for (const pv of pe.paymentPeriodValues || []) {
    const name = pv.payment?.name || pv.paymentValue?.payment?.name;
    if (name) payments[name] = r2((payments[name] || 0) + (pv.value || 0));
  }
  const items = {};
  for (const iv of pe.payrollItemValues || []) if (iv.payrollItem?.name) items[iv.payrollItem.name] = r2(iv.value || 0);
  const deds = {};
  for (const dv of pe.deductionStructureValues || []) {
    if (dv.deductionStructure?.name) {
      deds[dv.deductionStructure.name] = {
        value: r2(dv.value || 0),
        exemptionAmount: r2(dv.exemptionAmount || 0),
        baseAmount: r2(dv.baseAmount || 0),
      };
    }
  }
  const findItem = (...needles) => {
    const keys = Object.keys(items);
    for (const n of needles) {
      const hit = keys.find((k) => fold(k).includes(fold(n)));
      if (hit) return items[hit];
    }
    return null;
  };
  const findDed = (...needles) => {
    const keys = Object.keys(deds);
    for (const n of needles) {
      const hit = keys.find((k) => fold(k) === fold(n) || fold(k).includes(fold(n)));
      if (hit) return deds[hit];
    }
    return null;
  };
  return {
    sicil: String(emp.employeeNumber || ""),
    name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
    sgkDays: pe.workedDays,
    missingDays: pe.totalMissingDays,
    attendanceDays: pe.attendanceDays ?? pe.workedBusinessDays ?? pe.businessDays ?? null,
    calculationStatus: pe.calculationStatus,
    lastCalculatedAt: pe.lastCalculatedAt,
    isPayrollAttendanceSaved: pe.isPayrollAttendanceSaved,
    payments,
    items,
    deds,
    salary: payments["Temel Maaş"] || 0,
    meal: payments["Yemek Yardımı"] || 0,
    transport: payments["Yol Yardımı"] || 0,
    overtime: (payments["Fazla Mesai"] || 0) + (payments["Net Fazla Mesai"] || 0),
    prim: payments["Prim"] || 0,
    ikramiye: payments["İkramiye"] || 0,
    masraf: payments["Masraf"] || 0,
    kesinti: (payments["Genel Kesinti"] || 0) + (payments["İcra"] || 0),
    gross: items["Toplam Kazanç"] ?? null,
    net: items["Net Maaş"] ?? null,
    gvMatrah: items["Gelir Vergisine Tabi Kazanç"] ?? null,
    sgkBase: items["Prime Esas Kazanç"] ?? null,
    employerCost: findItem("Toplam İşveren Maliyeti", "İşveren Maliyeti") ?? items["Toplam Maliyet"] ?? null,
    sgkEmployer: findItem("SGK Primi İşveren", "SGK İşveren"),
    issEmployer: findItem("İşsizlik Sigortası Primi İşveren", "İşsizlik İşveren"),
    sgk: findDed("SGK Primi İşçi Payı")?.value ?? null,
    unemployment: findDed("İşsizlik Sigortası Primi İşçi Payı")?.value ?? null,
    gv: findDed("Gelir Vergisi")?.value ?? null,
    gvExempt: findDed("Gelir Vergisi")?.exemptionAmount ?? null,
    damga: findDed("Damga Vergisi")?.value ?? null,
    damgaExempt: findDed("Damga Vergisi")?.exemptionAmount ?? null,
    bes: findDed("Bireysel Emeklilik")?.value ?? findDed("BES")?.value ?? null,
    advance: r2((pe.advancePeriodDeductions || []).reduce((a, d) => a + (d.amount ?? d.value ?? 0), 0)),
  };
}

function verdict(id, okFlag, detail, expected, actual) {
  return { id, result: okFlag ? "pass" : "fail", expected, actual, detail };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email", { timeout: 30000 });
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 120 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  console.log("LOGIN", page.url(), BASE);
  if (page.url().includes("/login")) throw new Error("login failed");

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
        return { status: res.status, data, text: String(text).slice(0, 800) };
      },
      { method, urlPath, body }
    );
    if ((res.status === 429 || /çok fazla|csrf/i.test(res.text || "")) && api._attempt !== 6) {
      api._attempt = (api._attempt || 0) + 1;
      await sleep(3000 * api._attempt);
      const out = await api(method, urlPath, body);
      api._attempt = 0;
      return out;
    }
    api._attempt = 0;
    return res;
  }

  const html = await page.content();
  const jsHits = [...html.matchAll(/\/assets\/[^"']+\.js/g)].map((m) => m[0]);
  const catalog = { endpoints: [], js: jsHits.slice(0, 20) };
  for (const href of jsHits.slice(0, 8)) {
    try {
      const js = await page.evaluate(async (h) => (await fetch(h)).text(), href);
      const found = js.match(/\/api\/[A-Za-z0-9_./{}?-]+/g) || [];
      for (const e of found) if (!catalog.endpoints.includes(e)) catalog.endpoints.push(e);
    } catch {}
  }
  catalog.endpoints.sort();
  const interesting = catalog.endpoints.filter((e) =>
    /Family|Child|Spouse|Aile|Icra|Deduction|CostCenter|Masraf|Recurring|Health|Severance|Kidem|ExtraPayroll|Difference|Muhasebe|BankPayment|Oks|Advance|PayrollRule|PaymentRule|Alimony|Nafaka|Union|Sendika/i.test(
      e
    )
  );
  fs.writeFileSync(path.join(OUT, "api_catalog.json"), JSON.stringify({ interesting, allCount: catalog.endpoints.length, all: catalog.endpoints }, null, 1));
  console.log("API interesting", interesting.length, "all", catalog.endpoints.length);

  let periods = arr((await api("GET", "/api/PayrollPeriod/list?page=1&pageSize=400")).data);
  if (!periods.length) periods = arr((await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities")).data);
  const slim = periods.map((p) => ({
    id: p.id,
    year: p.year,
    month: p.month,
    status: p.payrollStatus,
    name: p.name,
    unit: p.organizationalUnitName || p.organizationalUnit?.name,
    people: (p.periodEmployees || []).length || p.employeeCount,
  }));
  fs.writeFileSync(path.join(OUT, "period_list.json"), JSON.stringify(slim, null, 1));

  const dumps = {};
  for (const t of TARGETS) {
    const hits = periods.filter((p) => p.year === t.year && p.month === t.month && t.unitNeedles.some((n) => unitBlob(p).includes(fold(n))));
    const hit = hits.sort((a, b) => (b.periodEmployees?.length || b.employeeCount || 0) - (a.periodEmployees?.length || a.employeeCount || 0))[0];
    if (!hit) {
      console.log("MISSING", t.key);
      continue;
    }
    console.log("CALC", t.key, hit.id, hit.organizationalUnitName || hit.name);
    const calc = await api("POST", `/api/PayrollPeriod/${hit.id}/calculate`, { onlyStaleEmployees: false });
    const jobId = unwrap(calc.data)?.jobId;
    console.log(" JOB", calc.status, jobId);
    let job = null;
    for (let i = 0; i < 72; i++) {
      await sleep(5000);
      job = jobId ? unwrap((await api("GET", `/api/background-jobs/${jobId}`)).data) : null;
      console.log(" POLL", t.key, i, job?.jobStatus, job?.progressPercent, job?.failedCount);
      if (job && job.jobStatus > 1) break;
    }
    const full = unwrap((await api("GET", `/api/PayrollPeriod/${hit.id}`)).data);
    fs.writeFileSync(path.join(OUT, t.dumpName), JSON.stringify(full));
    const rows = {};
    for (const pe of full?.periodEmployees || []) {
      const row = extractPe(pe);
      if (row.sicil) rows[row.sicil] = row;
    }
    dumps[t.key] = { id: hit.id, jobStatus: job?.jobStatus, failedCount: job?.failedCount, rows };
    fs.writeFileSync(path.join(OUT, t.key + "_rows.json"), JSON.stringify(rows, null, 1));
    console.log(" people", Object.keys(rows).length);
  }

  const emps = arr(unwrap((await api("GET", "/api/Employee/filteredByUnitAbilities")).data));
  async function empBySicil(sicil) {
    const hit = emps.find((e) => String(e.employeeNumber) === String(sicil));
    if (!hit?.id) return null;
    return unwrap((await api("GET", `/api/Employee/${hit.id}`)).data);
  }

  const cardChecks = {};
  for (const sicil of ["6211", "6212", "6213", "6220", "6227", "6101", "6210", "6215"]) {
    const full = await empBySicil(sicil);
    if (!full) {
      cardChecks[sicil] = { missing: true };
      continue;
    }
    cardChecks[sicil] = {
      id: full.id,
      name: `${full.firstName} ${full.lastName}`,
      disabilityDegree: full.disabilityDegree,
      defaultPayrollLawVariantId: full.defaultPayrollLawVariantId,
      defaultTaxExemptionVariantId: full.defaultTaxExemptionVariantId,
      defaultPayrollLawFieldsJson: full.defaultPayrollLawFieldsJson,
    };
    const oks = await api("GET", `/api/EmployeeOksEnrollment/by-employee/${full.id}`);
    cardChecks[sicil].oks = unwrap(oks.data);
    const adv = await api("GET", `/api/AdvanceRequest/by-employee/${full.id}`);
    cardChecks[sicil].advances = arr(adv.data).slice(0, 8).map((a) => ({
      id: a.id,
      type: a.advanceType,
      amount: a.requestedAmount,
      status: a.status ?? a.advanceStatus,
      paid: a.isPaid,
    }));
    if (!cardChecks[sicil].advances.length) {
      const adv2 = await api("GET", `/api/AdvanceRequest/filteredByUnitAbilities?page=1&pageSize=50`);
      const mine = arr(adv2.data).filter((a) => a.employeeId === full.id || a.targetEmployeeId === full.id);
      cardChecks[sicil].advances = mine.slice(0, 8);
    }
  }

  // Umay: maaş avansı (plan). İK kartına dokunma.
  const umay = cardChecks["6220"];
  const umayFixes = [];
  if (umay?.id) {
    for (const a of umay.advances || []) {
      if (a.type !== 0 && a.type !== 1 && a.id) {
        umayFixes.push({ id: a.id, fromType: a.type, note: "unknown type, inspect" });
      }
    }
    const list = arr(unwrap((await api("GET", `/api/AdvanceRequest/by-employee/${umay.id}`)).data));
    for (const a of list) {
      if (a.advanceType === 0 || String(a.advanceType).toLowerCase() === "business") {
        const body = { ...a, advanceType: 1 };
        const up = await api("PUT", `/api/AdvanceRequest/${a.id}`, body);
        umayFixes.push({ id: a.id, from: a.advanceType, to: 1, status: up.status, text: String(up.text).slice(0, 180) });
      }
    }
  }

  const ocak = dumps.ocak?.rows || {};
  const izole = dumps.izole?.rows || {};
  const ekim = dumps.ekim?.rows || {};
  const pick = (map, sicil, name) => map[sicil] || Object.values(map).find((r) => fold(r.name) === fold(name));

  const serra = pick(ocak, "6101", "Serra Bindal");
  const ada = pick(izole, "6201", "Ada Korkmaz");
  const nazli = pick(izole, "6214", "Nazli Er");
  const bora = pick(izole, "6225", "Bora Elci");
  const pelin = pick(ocak, "6133", "Pelin Zengin") || Object.values(ocak).find((r) => /pelin/i.test(r.name));
  const oya = pick(izole, "6215", "Oya Polat");
  const ilker = Object.values(ocak).find((r) => /ilker|pamuk/i.test(r.name));
  const jale = pick(izole, "6210", "Jale Kaya");
  const umayRow = pick(izole, "6220", "Umay Gunes");
  const volkan = pick(izole, "6221", "Volkan Ates");
  const kaan = pick(izole, "6211", "Kaan Oz");
  const derya = pick(izole, "6227", "Derya Unal");
  const serraEkim = pick(ekim, "6101", "Serra Bindal");
  const yagiz = Object.values(ocak).find((r) => /yagiz|yağız|findik|fındık/i.test(r.name));

  const near = (a, b, tol = 0.01) => a != null && b != null && Math.abs(Number(a) - Number(b)) <= tol;
  const checks = [];
  checks.push(verdict("LUCA-DAMGA-SERRA", near(serra?.damga, 156.88), "İK Serra Ocak damga 156,88", 156.88, serra?.damga));
  checks.push(verdict("LUCA-DAMGA-ADA", near(ada?.damga, 156.88), "Tek Değişken Ada damga 156,88", 156.88, ada?.damga));
  checks.push(verdict("BES-ADA-0", near(ada?.bes || 0, 0), "Ada BES kayıtsız 0", 0, ada?.bes || 0));
  checks.push(
    verdict(
      "OKS-KURUS",
      bora?.bes != null && Math.abs(bora.bes % 1) < 0.001,
      "Bora OKS kuruş tabanı (tam TL)",
      "kuruşsuz",
      bora?.bes
    )
  );
  if (pelin?.bes != null) {
    checks.push(verdict("OKS-PELIN", Math.abs(pelin.bes % 1) < 0.001, "Pelin OKS kuruş tabanı", "kuruşsuz", pelin.bes));
  }
  checks.push(
    verdict(
      "NAZLI-GUN",
      nazli?.sgkDays != null && nazli.sgkDays >= 20 && nazli.sgkDays !== 18,
      "Nazlı ay içi giriş 18 gün olmamalı",
      ">=20, not 18",
      nazli?.sgkDays
    )
  );
  const stajEmp0 =
    (oya?.sgkEmployer == null || near(oya.sgkEmployer, 0)) && (oya?.issEmployer == null || near(oya.issEmployer, 0));
  checks.push(verdict("STAJ-OYA-ISVEREN", stajEmp0 && near(oya?.damga || 0, 0), "Oya stajyer işveren SGK/işsizlik 0, damga 0", 0, {
    sgkEmp: oya?.sgkEmployer,
    issEmp: oya?.issEmployer,
    damga: oya?.damga,
    net: oya?.net,
    employerCost: oya?.employerCost,
  }));
  if (ilker) {
    const ilker0 = (ilker.sgkEmployer == null || near(ilker.sgkEmployer, 0)) && (ilker.issEmployer == null || near(ilker.issEmployer, 0));
    checks.push(verdict("STAJ-ILKER-ISVEREN", ilker0 && near(ilker.damga || 0, 0), "İlker stajyer işveren 0", 0, {
      sgkEmp: ilker.sgkEmployer,
      issEmp: ilker.issEmployer,
      damga: ilker.damga,
      net: ilker.net,
    }));
  }
  const emekliIss0 = near(jale?.unemployment || 0, 0);
  checks.push(verdict("SGDP-ISCI-ISSIZLIK", emekliIss0, "Jale işçi işsizlik 0", 0, jale?.unemployment));
  if (jale?.sgkEmployer != null && jale.sgkBase) {
    const want = r2(jale.sgkBase * 0.2475);
    checks.push(verdict("SGDP-ISVEREN-2475", near(jale.sgkEmployer, want, 1), "Jale işveren %24,75", want, jale.sgkEmployer));
  } else {
    checks.push(verdict("SGDP-ISVEREN-2475", false, "Jale işveren SGK kalemi okunamadı", "%24,75", jale?.items || null));
  }
  checks.push(verdict("PPV-VOLKAN-PRIM", (volkan?.prim || 0) > 1, "Volkan prim bordroda (PPV-DROP kapanmış mı)", 5000, volkan?.prim));
  checks.push(verdict("IZ-AVANS", (umayRow?.advance || 0) > 1, "Umay avans mahsubu", 7200, umayRow?.advance));
  checks.push(
    verdict(
      "IZ-ENGEL",
      cardChecks["6211"]?.disabilityDegree === 1 || (kaan && ada && !near(kaan.net, ada.net, 1)),
      "Kaan engellilik derecesi veya net sapması",
      "degree 1 or net≠Ada",
      { degree: cardChecks["6211"]?.disabilityDegree, net: kaan?.net, ada: ada?.net }
    )
  );
  const yemekSgkOk = serra && serraEkim && Math.abs((serra.sgkBase || 0) - (serraEkim.sgkBase || 0)) < 50;
  checks.push(
    verdict(
      "YEMEK-SGK-DONEM",
      !yemekSgkOk ? false : true,
      "Ocak vs Ekim Serra PEK yakın olmalı (yemek istisnası tutarlı)",
      serra?.sgkBase,
      { ocak: serra?.sgkBase, ekim: serraEkim?.sgkBase }
    )
  );
  const terkin = near(derya?.gv || 0, 0) && near(derya?.damga || 0, 0);
  checks.push(verdict("5746-TERKIN-DERYA", terkin, "Derya 5746 GV/damga terkin", 0, { gv: derya?.gv, damga: derya?.damga }));
  if (yagiz) checks.push(verdict("5746-TERKIN-YAGIZ", near(yagiz.damga || 0, 0), "Yağız 5746 damga 0?", 0, yagiz.damga));

  const report = {
    runAt: new Date().toISOString(),
    base: BASE,
    jobs: Object.fromEntries(Object.entries(dumps).map(([k, v]) => [k, { id: v.id, jobStatus: v.jobStatus, failedCount: v.failedCount, people: Object.keys(v.rows).length }])),
    checks,
    cardChecks,
    umayFixes,
    snapshots: {
      serra,
      ada,
      nazli,
      bora,
      pelin,
      oya,
      ilker,
      jale,
      umayRow,
      volkan,
      kaan,
      derya,
      serraEkim,
      yagiz,
    },
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  console.log("\n=== FAZ A CHECKS ===");
  for (const c of checks) console.log(c.result.toUpperCase(), c.id, JSON.stringify(c.actual));
  console.log("DONE", OUT, "pass", checks.filter((c) => c.result === "pass").length, "/", checks.length);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
