/**
 * Faz 1 next koşum: dump Ana Eylül 15 (verify), then save+calculate
 * Operasyon Eylül 3 and Blokaj Eylül 1. Does not touch İK/BT/Sude/Yuvarlama/Kenar.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "arda.kocaoglu@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
if (!ADMIN_PASS) {
  console.error("DHR_PASSWORD required");
  process.exit(1);
}

const PERIODS = {
  ana: { id: "fe993870-b937-4756-8097-58b358f16a8e", label: "Ana Kadro", expectCount: 15, month: "EYLÜL 2026" },
  op: { id: "70cb2aae-0203-422f-a86b-c027ec49837a", label: "Operasyon", expectCount: 3, month: "EYLÜL 2026" },
  blok: { id: "dfdb61b0-766b-4664-870b-8dcf74d2e35c", label: "Blokaj", expectCount: 1, month: "EYLÜL 2026" },
};

const ANA_EXPECT = {
  8003: { days: 30, note: "altın referans" },
  8004: { days: 12, note: "giriş 19.09" },
  8005: { days: 18, note: "çıkış 14.09" },
  8008: { fm: true, note: "FM 10 saat → 10 TL bug" },
  8009: { avans: 2000, note: "avans 2000 kesilmeli" },
  8010: { bes: true, note: "BES %3 (API 0,03)" },
  8012: { sgdp: true, note: "emekli SGDP" },
  8014: { stajyer: true, note: "stajyer kesinti 0" },
};

const OP_LEAVES = {
  8020: { type: "unpaid", start: "2026-09-08", end: "2026-09-10", note: "3 gün ücretsiz" },
  8021: { type: "report", start: "2026-09-14", end: "2026-09-18", note: "5 gün rapor" },
  8022: { type: "annual", start: "2026-09-04", end: "2026-09-08", note: "yıllık + 07.09 Op tatili" },
};

const SHOT = path.join(process.env.TEMP, "faz1_shots");
const OUT = path.join(process.env.TEMP, "faz1_op_blokaj_ana.json");
fs.mkdirSync(SHOT, { recursive: true });

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
  if (x?.periodEmployees) return x.periodEmployees;
  return [];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round((n + Number.EPSILON) * 100) / 100);
function d10(s) {
  return String(s || "").slice(0, 10);
}

(async () => {
  const report = { generatedAt: new Date().toISOString(), units: {}, holidays: {}, leaves: {}, checks: [] };
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();

  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 120 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  if (page.url().includes("/login")) {
    console.error("LOGIN_FAIL", page.url());
    process.exit(1);
  }
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
        return { status: res.status, data, text: String(text).slice(0, 1400) };
      },
      { method, urlPath, body }
    );
  }

  function payMap(pe) {
    const payments = new Map();
    for (const pv of pe.paymentPeriodValues || []) {
      const name = pv.payment?.name || pv.paymentValue?.payment?.name;
      if (name) payments.set(name, (payments.get(name) || 0) + (pv.value || 0));
    }
    const items = new Map();
    for (const iv of pe.payrollItemValues || []) {
      if (iv.payrollItem?.name) items.set(iv.payrollItem.name, iv.value || 0);
    }
    const deds = new Map();
    for (const dv of pe.deductionStructureValues || []) {
      if (dv.deductionStructure?.name) deds.set(dv.deductionStructure.name, dv.value || 0);
    }
    const att = pe.payrollAttendances || pe.attendances || [];
    const dayTypes = {};
    for (const a of att) {
      const day = d10(a.date || a.day || a.attendanceDate);
      const t = a.dayType ?? a.attendanceType ?? a.status ?? a.type ?? a.code;
      if (day) dayTypes[day] = t;
    }
    return {
      sicil: pe.employee?.employeeNumber,
      name: `${pe.employee?.firstName || ""} ${pe.employee?.lastName || ""}`.trim(),
      attSaved: !!pe.isPayrollAttendanceSaved,
      calcStatus: pe.calculationStatus,
      sgkDays: pe.workedDays,
      missingDays: pe.totalMissingDays,
      salary: r2(payments.get("Temel Maaş")),
      meal: r2(payments.get("Yemek Yardımı")),
      transport: r2(payments.get("Yol Yardımı")),
      overtime: r2((payments.get("Fazla Mesai") || 0) + (payments.get("Net Fazla Mesai") || 0)),
      prim: r2(payments.get("Prim")),
      ikramiye: r2(payments.get("İkramiye")),
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
      itemCount: (pe.payrollItemValues || []).length,
      daySep07: dayTypes["2026-09-07"],
      dayTypes,
    };
  }

  async function snapshot(key) {
    const meta = PERIODS[key];
    const r = await api("GET", `/api/PayrollPeriod/${meta.id}`);
    const p = unwrap(r.data);
    const pes = p?.periodEmployees || [];
    const people = pes.map(payMap);
    const row = {
      http: r.status,
      id: p?.id || meta.id,
      name: p?.name,
      unitId: p?.organizationalUnitId || p?.organizationalUnit?.id,
      unitName: p?.organizationalUnit?.name,
      year: p?.year,
      month: p?.month,
      payrollStatus: p?.payrollStatus,
      count: pes.length,
      attSaved: people.filter((x) => x.attSaved).length,
      withItems: people.filter((x) => x.itemCount > 0).length,
      people,
    };
    report.units[key] = row;
    console.log(
      `SNAP ${key} status=${row.payrollStatus} n=${row.count} att=${row.attSaved}/${row.count} items=${row.withItems}/${row.count}`
    );
    for (const x of people) {
      console.log(
        `  ${x.sicil} ${x.name} days=${x.sgkDays} miss=${x.missingDays} net=${x.net} sal=${x.salary} gv=${x.gv} sgk=${x.sgk} adv=${x.advance} ot=${x.overtime} bes=${x.bes} d07=${x.daySep07}`
      );
    }
    return { p, row };
  }

  async function holidaysFor(ouId, tag) {
    if (!ouId) return [];
    const r = await api("GET", `/api/PublicHoliday/ownerOrganizationalUnit/${ouId}`);
    const list = arr(unwrap(r.data)).map((h) => ({
      name: h.name,
      start: d10(h.startDate),
      end: d10(h.endDate),
    }));
    report.holidays[tag] = list;
    const sep7 = list.filter((h) => h.start <= "2026-09-07" && h.end >= "2026-09-07");
    console.log(`HOLIDAY ${tag} n=${list.length} sep7=${sep7.map((h) => h.name).join(" | ") || "YOK"}`);
    return list;
  }

  async function leavesFor(sicil, empId) {
    const urls = [
      `/api/EmployeeLeaveRequest/employee/${empId}/paged?status=all&page=1&pageSize=50`,
      `/api/EmployeeLeaveRequest/employee/${empId}/leaves`,
      `/api/EmployeeLeaveRequest/employee/${empId}`,
    ];
    let rows = [];
    for (const u of urls) {
      const r = await api("GET", u);
      const a = arr(unwrap(r.data));
      if (a.length) {
        rows = a;
        break;
      }
    }
    const slim = rows.map((x) => ({
      type: x.leaveType?.name || x.leaveTypeName || x.type,
      status: x.leaveRequestStatus || x.status || x.approvalStatus,
      start: d10(x.startDate || x.start),
      end: d10(x.endDate || x.end),
    }));
    report.leaves[sicil] = slim;
    console.log(`LEAVE ${sicil} ${slim.map((l) => `${l.type} ${l.start}..${l.end} [${l.status}]`).join(" ; ") || "YOK"}`);
    return slim;
  }

  async function savePuantaj(unitLabel, countRe) {
    await page.goto(BASE + "/payroll-management", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.getByText(/^Dönemler$/).first().click();
    await page.waitForTimeout(4500);
    const card = await page.evaluate(
      ({ unitLabel, countRe, monthWant }) => {
        const re = new RegExp(countRe);
        const leaves = [...document.querySelectorAll("span, div")].filter(
          (el) => el.children.length === 0 && (el.textContent || "").trim() === unitLabel
        );
        for (const leaf of leaves) {
          let c = leaf;
          for (let i = 0; i < 8 && c; i++) {
            c = c.parentElement;
            if (!c) break;
            const t = (c.innerText || "").replace(/\s+/g, " ").trim();
            if (c.querySelector("input[type=checkbox]") && t.length < 180) {
              let month = "?";
              let g = c;
              while (g && month === "?") {
                const m = (g.innerText || "").replace(/\s+/g, " ").match(/(OCAK|ŞUBAT|MART|NISAN|MAYIS|HAZIRAN|TEMMUZ|AĞUSTOS|EYLÜL|EKIM|KASIM|ARALIK) \d{4}/);
                if (m) month = m[0];
                g = g.parentElement;
              }
              if (month === monthWant && re.test(t)) {
                leaf.click();
                return t;
              }
              break;
            }
          }
        }
        return null;
      },
      { unitLabel, countRe, monthWant: "EYLÜL 2026" }
    );
    console.log("CARD", unitLabel, JSON.stringify(card));
    if (!card) return { ok: false, reason: "card-not-found" };
    await page.waitForTimeout(3500);
    const go = page.locator("button", { hasText: /Puantaja git/ }).first();
    if (!(await go.count())) return { ok: false, reason: "no-puantaj-button", card };
    await go.click();
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SHOT, `puantaj-${unitLabel}.png`) });
    const saveBtn = page.locator("button", { hasText: /^Kaydet \(\d+\)$/ }).first();
    const n = await saveBtn.count();
    const txt = n ? (await saveBtn.innerText()).trim() : "";
    console.log("SAVE_BTN", unitLabel, n, txt);
    if (!n) return { ok: false, reason: "no-save", card };
    await saveBtn.click();
    await page.waitForTimeout(2500);
    const confirm = page.locator("button", { hasText: /^(Kaydet|Onayla|Evet|Tamam|Devam)$/ }).last();
    if (await confirm.count()) await confirm.click().catch(() => {});
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SHOT, `saved-${unitLabel}.png`) });
    return { ok: true, card, save: txt };
  }

  async function calculate(id, tag) {
    const calc = await api("POST", `/api/PayrollPeriod/${id}/calculate`, { onlyStaleEmployees: false });
    const jobId = unwrap(calc.data)?.jobId;
    console.log("CALC", tag, calc.status, "job", jobId, String(calc.text).slice(0, 220));
    let last = { calcStatus: calc.status, skipped: unwrap(calc.data)?.skipped, reason: unwrap(calc.data)?.reason, jobId };
    if (unwrap(calc.data)?.skipped) {
      console.log("CALC_SKIPPED", tag, last.reason);
      return last;
    }
    for (let i = 0; i < 48; i++) {
      await sleep(5000);
      const job = jobId ? unwrap((await api("GET", `/api/background-jobs/${jobId}`)).data) : null;
      const p = unwrap((await api("GET", `/api/PayrollPeriod/${id}`)).data);
      const pes = p?.periodEmployees || [];
      const withItems = pes.filter((e) => (e.payrollItemValues || []).length).length;
      console.log(
        `POLL ${tag} ${i} job=${job?.jobStatus} pct=${job?.progressPercent} period=${p?.payrollStatus} items=${withItems}/${pes.length} result=${String(job?.resultPayloadJson || "").slice(0, 160)}`
      );
      last.jobStatus = job?.jobStatus;
      last.periodStatus = p?.payrollStatus;
      last.withItems = withItems;
      last.result = job?.resultPayloadJson;
      if (job && job.jobStatus !== 0 && job.jobStatus !== 1 && i >= 1) break;
    }
    return last;
  }

  // ---- Ana verify (no recalc) -------------------------------------------
  const ana = await snapshot("ana");
  await holidaysFor(ana.row.unitId, "ana");
  const anaNums = ana.row.people.map((p) => p.sicil).sort();
  const unexpectedPasif = anaNums.filter((s) => s === "8018" || s === "8019");
  const missingAna = ["8003", "8004", "8005", "8006", "8007", "8008", "8009", "8010", "8011", "8012", "8013", "8014", "8015", "8016", "8017"].filter(
    (s) => !anaNums.includes(s)
  );
  report.checks.push({
    id: "ANA-COUNT",
    ok: ana.row.count === 15 && unexpectedPasif.length === 0 && missingAna.length === 0,
    detail: `n=${ana.row.count} pasif=${unexpectedPasif.join(",") || "yok"} eksik=${missingAna.join(",") || "yok"} status=${ana.row.payrollStatus}`,
  });
  for (const [sicil, exp] of Object.entries(ANA_EXPECT)) {
    const p = ana.row.people.find((x) => x.sicil === sicil);
    if (!p) {
      report.checks.push({ id: `ANA-${sicil}`, ok: false, detail: "dönemde yok" });
      continue;
    }
    const bits = [];
    if (exp.days != null) bits.push(`days ${p.sgkDays} (beklenen ${exp.days})`);
    if (exp.avans) bits.push(`avans ${p.advance} (beklenen ${exp.avans})`);
    if (exp.fm) bits.push(`FM ${p.overtime}`);
    if (exp.bes) bits.push(`BES ${p.bes} net ${p.net}`);
    if (exp.sgdp) bits.push(`SGK ${p.sgk} issizlik ${p.unemployment}`);
    if (exp.stajyer) bits.push(`SGK ${p.sgk} net ${p.net}`);
    bits.push(`net ${p.net}`);
    const dayOk = exp.days == null || p.sgkDays === exp.days;
    const avansOk = !exp.avans || p.advance === exp.avans;
    report.checks.push({
      id: `ANA-${sicil}`,
      ok: dayOk && (exp.avans ? avansOk : true),
      detail: `${exp.note} · ${bits.join(" · ")}`,
    });
  }

  // ---- Operasyon --------------------------------------------------------
  let op = await snapshot("op");
  await holidaysFor(op.row.unitId, "op");
  const statePath = path.join(process.env.TEMP, "faz1_seed_state.json");
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { people: {} };
  for (const sicil of ["8020", "8021", "8022"]) {
    const empId = state.people?.[sicil]?.employeeId || op.row.people.find((p) => p.sicil === sicil);
    const id = typeof empId === "string" ? empId : op.p?.periodEmployees?.find((e) => e.employee?.employeeNumber === sicil)?.employee?.id;
    if (id) await leavesFor(sicil, id);
  }

  report.checks.push({
    id: "OP-COUNT",
    ok: op.row.count === 3 && ["8020", "8021", "8022"].every((s) => op.row.people.some((p) => p.sicil === s)),
    detail: `n=${op.row.count} ${op.row.people.map((p) => p.sicil).join(",")}`,
  });
  const opSep7 = (report.holidays.op || []).some((h) => h.start <= "2026-09-07" && h.end >= "2026-09-07");
  const anaSep7Extra = (report.holidays.ana || []).some((h) => /07\.09|07.09|Faz1 07/.test(h.name || "") && h.start === "2026-09-07");
  report.checks.push({
    id: "OP-HOLIDAY-07",
    ok: opSep7 && !anaSep7Extra,
    detail: `Op 07.09 tatil=${opSep7} Ana ekstra 07.09=${anaSep7Extra}`,
  });

  if (op.row.attSaved < op.row.count || op.row.withItems < op.row.count) {
    const saved = await savePuantaj("Operasyon", /Operasyon 3\b/);
    report.checks.push({ id: "OP-PUANTAJ-SAVE", ok: !!saved.ok, detail: JSON.stringify(saved) });
    const calc = await calculate(PERIODS.op.id, "op");
    report.checks.push({
      id: "OP-CALC",
      ok: !calc.skipped && calc.withItems === 3,
      detail: JSON.stringify(calc).slice(0, 400),
    });
    op = await snapshot("op");
  } else {
    report.checks.push({ id: "OP-CALC", ok: true, detail: "zaten hesaplı" });
  }

  for (const [sicil, exp] of Object.entries(OP_LEAVES)) {
    const p = op.row.people.find((x) => x.sicil === sicil);
    const lv = report.leaves[sicil] || [];
    const hit = lv.some((l) => l.start === exp.start && l.end === exp.end);
    report.checks.push({
      id: `OP-${sicil}`,
      ok: !!p && hit,
      detail: p
        ? `${exp.note} leaveHit=${hit} days=${p.sgkDays} miss=${p.missingDays} sal=${p.salary} net=${p.net} d07=${p.daySep07}`
        : "dönemde yok",
    });
  }

  // ---- Blokaj -----------------------------------------------------------
  let blok = await snapshot("blok");
  report.checks.push({
    id: "BLOK-COUNT",
    ok: blok.row.count === 1 && blok.row.people.some((p) => p.sicil === "8078"),
    detail: `n=${blok.row.count} ${blok.row.people.map((p) => `${p.sicil}`).join(",")}`,
  });
  if (blok.row.attSaved < blok.row.count || blok.row.withItems < 1) {
    const saved = await savePuantaj("Blokaj", /Blokaj 1\b/);
    report.checks.push({ id: "BLOK-PUANTAJ-SAVE", ok: !!saved.ok, detail: JSON.stringify(saved) });
    const calc = await calculate(PERIODS.blok.id, "blok");
    report.checks.push({
      id: "BLOK-CALC",
      ok: true,
      detail: `skipped=${!!calc.skipped} reason=${calc.reason || ""} job=${calc.jobStatus} items=${calc.withItems} result=${String(calc.result || "").slice(0, 240)}`,
    });
    blok = await snapshot("blok");
  } else {
    report.checks.push({ id: "BLOK-CALC", ok: true, detail: "zaten hesaplı" });
  }
  const t = blok.row.people.find((p) => p.sicil === "8078");
  report.checks.push({
    id: "BLOK-8078",
    ok: !!t,
    detail: t
      ? `HSP-023 SGK profil yok. days=${t.sgkDays} net=${t.net} sgk=${t.sgk} items=${t.itemCount} calc=${t.calcStatus}`
      : "8078 yok",
  });

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("\n==== CHECKS ====");
  for (const c of report.checks) console.log(`${c.ok ? "OK  " : "FAIL"} ${c.id}  ${c.detail}`);
  console.log("WROTE", OUT);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
