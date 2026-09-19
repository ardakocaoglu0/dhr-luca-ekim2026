/**
 * Read-only: Ana Kadro Eylül 15 — kart + bordro + OKS/BES.
 * Does not calculate or mutate. Needs DHR_PASSWORD.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const ANA = "fe993870-b937-4756-8097-58b358f16a8e";
const ROSTER = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "faz1_roster.json"), "utf8"));
const OUT = path.join(process.env.TEMP, "faz1_ana15_verify.json");

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
  if (x?.results) return x.results;
  return [];
}
const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round((Number(n) + Number.EPSILON) * 100) / 100);
function d10(s) {
  return s ? String(s).slice(0, 10) : null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 120 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  if (page.url().includes("/login")) {
    console.error("LOGIN_FAIL");
    process.exit(1);
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
        return { status: res.status, data };
      },
      { method, urlPath, body }
    );
  }

  const want = ROSTER.people.filter((p) => p.unit === "ana" && p.group === "ana-aktif");
  const periodR = await api("GET", `/api/PayrollPeriod/${ANA}`);
  const period = unwrap(periodR.data);
  const pes = period.periodEmployees || [];

  const empAll = arr(unwrap((await api("GET", "/api/Employee/all")).data));
  const byNum = new Map();
  for (const e of empAll) {
    const n = String(e.employeeNumber || "");
    if (n) byNum.set(n, e);
  }

  const pvAll = arr(unwrap((await api("GET", "/api/PaymentValue/all")).data));

  const people = [];
  for (const p of want) {
    const emp = byNum.get(String(p.sicil));
    const pe = pes.find((x) => x.employee?.employeeNumber === String(p.sicil) || x.employeeId === emp?.id);
    let oks = null;
    if (emp?.id) {
      for (const ep of [
        `/api/EmployeeOksEnrollment/by-employee/${emp.id}`,
        `/api/EmployeeOksEnrollment/employee/${emp.id}`,
      ]) {
        const r = await api("GET", ep);
        if (r.status >= 200 && r.status < 300 && r.data) {
          oks = unwrap(r.data);
          if (Array.isArray(oks)) oks = oks[0] || null;
          if (oks) break;
        }
      }
    }
    let sgk = null;
    if (emp?.id) {
      const sg = await api("GET", `/api/EmployeeSgkProfile/by-employee/${emp.id}`);
      if (sg.status < 300) sgk = unwrap(sg.data);
    }
    const payments = new Map();
    for (const pv of pe?.paymentPeriodValues || []) {
      const name = pv.payment?.name || pv.paymentValue?.payment?.name;
      if (name) payments.set(name, (payments.get(name) || 0) + (pv.value || 0));
    }
    const items = new Map();
    for (const iv of pe?.payrollItemValues || []) {
      if (iv.payrollItem?.name) items.set(iv.payrollItem.name, iv.value || 0);
    }
    const deds = new Map();
    const besDed = [];
    for (const dv of pe?.deductionStructureValues || []) {
      const name = dv.deductionStructure?.name;
      if (!name) continue;
      deds.set(name, dv.value || 0);
      if (/BES/i.test(name)) {
        besDed.push({
          name,
          value: dv.value,
          baseAmount: dv.baseAmount,
          rate: dv.rate ?? dv.percentage ?? dv.contributionRate,
          raw: {
            keys: Object.keys(dv).filter((k) => !["deductionStructure"].includes(k)),
            rate: dv.rate,
            percentage: dv.percentage,
            baseAmount: dv.baseAmount,
            value: dv.value,
          },
        });
      }
    }
    const pvs = pvAll.filter((v) => v.employeeId === emp?.id || v.employee?.employeeNumber === String(p.sicil));
    const rate = oks?.contributionRateOverride;
    people.push({
      sicil: p.sicil,
      rosterName: p.name,
      roster: {
        hire: p.hire,
        exit: p.exit,
        maas: p.maas,
        yemek: p.yemek,
        yol: p.yol,
        saglik: p.saglik,
        besEmployer: p.besEmployer,
        besEmployeePct: p.besEmployeePct,
        prim: p.prim,
        masraf: p.masraf,
        kesinti: p.kesinti,
        avans: p.avans,
        law: p.law,
        profile: p.profile,
        fmGross: p.overtimeGrossHours,
        fmNet: p.overtimeNetHours,
        partTime: p.seedFlags?.partTime || false,
        disability: p.seedFlags?.disability || null,
        emekli: !!p.seedFlags?.emekli,
        stajyer: !!p.seedFlags?.stajyer,
      },
      emp: emp
        ? {
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`,
            hire: d10(emp.companyStartDate || emp.startDate),
            exit: d10(emp.terminationDate || emp.exitDate || emp.leaveDate),
            disabilityDegree: emp.disabilityDegree,
            law: emp.defaultPayrollLawVariant?.code || emp.defaultPayrollLawVariantId,
            status: emp.status,
          }
        : null,
      oks: oks
        ? {
            oksStatus: oks.oksStatus,
            contributionRateOverride: oks.contributionRateOverride,
            enrollmentDate: d10(oks.enrollmentDate),
            withdrawalDate: d10(oks.withdrawalDate),
            pensionCompany: oks.pensionCompany,
            asPercentIfFraction: rate != null && rate <= 1 ? r2(rate * 100) : null,
            asPercentIfWhole: rate != null && rate > 1 ? r2(rate) : null,
            impliedOnPek63200: rate != null ? r2(63200 * rate) : null,
          }
        : null,
      sgk: sgk
        ? {
            meslekKodu: sgk.meslekKodu,
            sigortaliTuru: sgk.sigortaliTuru,
            kismiSureliCalisiyor: sgk.kismiSureliCalisiyor,
            belgeTuru: sgk.belgeTuru,
          }
        : null,
      slip: pe
        ? {
            calcStatus: pe.calculationStatus,
            attSaved: !!pe.isPayrollAttendanceSaved,
            sgkDays: pe.workedDays,
            missingDays: pe.totalMissingDays,
            salary: r2(payments.get("Temel Maaş")),
            meal: r2(payments.get("Yemek Yardımı")),
            transport: r2(payments.get("Yol Yardımı")),
            saglik: r2(payments.get("Sağlık Sigortası") || payments.get("Özel Sağlık")),
            besEmployer: r2(payments.get("İşveren BES Katkısı") || payments.get("BES İşveren")),
            overtime: r2((payments.get("Fazla Mesai") || 0) + (payments.get("Net Fazla Mesai") || 0)),
            prim: r2(payments.get("Prim")),
            masraf: r2(payments.get("Masraf")),
            kesinti: r2((payments.get("Genel Kesinti") || 0) + (payments.get("İcra") || 0)),
            net: r2(items.get("Net Maaş")),
            gross: r2(items.get("Toplam Kazanç")),
            sgk: r2(deds.get("SGK Primi İşçi Payı")),
            unemployment: r2(deds.get("İşsizlik Sigortası Primi İşçi Payı")),
            gv: r2(deds.get("Gelir Vergisi")),
            damga: r2(deds.get("Damga Vergisi")),
            bes: r2(deds.get("Bireysel Emeklilik (BES) Kesintisi")),
            advance: r2((pe.advancePeriodDeductions || []).reduce((a, d) => a + (d.amount ?? d.value ?? 0), 0)),
            besDed,
            paymentNames: [...payments.entries()].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`),
          }
        : null,
      openPaymentValues: pvs.map((v) => ({
        name: v.payment?.name,
        value: v.value,
        status: v.status,
        netGross: v.netGross ?? v.isNet,
      })),
    });
  }

  const bundleHint = await page.evaluate(async () => {
    const html = await (await fetch("/")).text();
    const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    return m ? m[1] : null;
  });
  let uiSnippets = [];
  if (bundleHint) {
    const js = await page.evaluate(async (u) => (await fetch(u)).text(), bundleHint);
    const idx = [];
    const re = /contributionRateOverride/g;
    let mm;
    while ((mm = re.exec(js))) idx.push(mm.index);
    uiSnippets = idx.slice(0, 8).map((i) => js.slice(Math.max(0, i - 180), i + 220).replace(/\s+/g, " "));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    login: page.url(),
    period: {
      http: periodR.status,
      name: period.name,
      year: period.year,
      month: period.month,
      payrollStatus: period.payrollStatus,
      count: pes.length,
    },
    rosterBesFieldNote: {
      hakanRoster: 0.03,
      izoleBora: 0.03,
      seedSends: "contributionRateOverride: oksFraction(p.besEmployeePct)",
    },
    people,
    uiSnippets,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
