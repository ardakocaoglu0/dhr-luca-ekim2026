/**
 * dhrtest2: Kenar Durumlar Eylül 2026 — attendance auto, calculate, dump → kenar JSON.
 * İK / Bordro Paket / Tek Değişken / Ana Kadro dönemine dokunmaz.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");

const BASE = process.env.DHR_URL || "https://dhrtest2.d1-tech.com.tr";
const EMAIL = process.env.DHR_EMAIL || "admin@d1-tech.com";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const DATA = path.join(__dirname, "..", "src", "data");
const DUMP = path.join(process.env.TEMP, "kenar_eylul_period.json");
const PASS = 0.01;
const ONLY_STALE = process.env.DHR_FULL_CALC === "1" ? false : true;
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
  const v = unwrap(x);
  if (Array.isArray(v)) return v;
  if (v?.items) return v.items;
  if (v?.results) return v.results;
  return [];
}
const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100) / 100);
const nz = (n) => (n == null || !Number.isFinite(Number(n)) ? 0 : Number(n));
const tr = (n) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dlt = (a, b) => (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) ? null : r2(a - b));
const near = (a, b, tol = PASS) => a != null && b != null && Math.abs(nz(a) - nz(b)) <= tol;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAY = {
  salary: ["Temel Maaş"],
  meal: ["Yemek Yardımı"],
  transport: ["Yol Yardımı"],
  overtime: ["Fazla Mesai", "Net Fazla Mesai"],
  prim: ["Prim", "Yuvarlama Farkı"],
  ikramiye: ["İkramiye"],
  masraf: ["Masraf"],
  kesinti: ["Genel Kesinti", "İcra"],
  saglik: ["Özel Sağlık Sigortası (İşveren)"],
  besEmployer: ["BES İşveren Katkısı"],
};
const DED = {
  sgk: "SGK Primi İşçi Payı",
  unemployment: "İşsizlik Sigortası Primi İşçi Payı",
  gv: "Gelir Vergisi",
  damga: "Damga Vergisi",
  bes: "Bireysel Emeklilik (BES) Kesintisi",
};
const ITEM = {
  gross: "Toplam Kazanç",
  net: "Net Maaş",
  gvMatrah: "Gelir Vergisine Tabi Kazanç",
  sgkBase: "Prime Esas Kazanç",
  employerCost: "İşveren Maliyeti",
};

function extract(period, payById) {
  const out = {};
  for (const pe of period?.periodEmployees || []) {
    const emp = pe.employee || {};
    const sicil = String(emp.employeeNumber || "");
    const payments = new Map();
    for (const pv of pe.paymentPeriodValues || []) {
      const name =
        pv.payment?.name ||
        pv.paymentValue?.payment?.name ||
        (pv.paymentId && payById[pv.paymentId]) ||
        (pv.paymentValue?.paymentId && payById[pv.paymentValue.paymentId]);
      if (name) payments.set(name, (payments.get(name) || 0) + (pv.value || 0));
    }
    const items = new Map();
    for (const iv of pe.payrollItemValues || []) if (iv.payrollItem?.name) items.set(iv.payrollItem.name, iv.value || 0);
    const deds = new Map();
    for (const dv of pe.deductionStructureValues || []) if (dv.deductionStructure?.name) deds.set(dv.deductionStructure.name, dv);
    const row = {
      sicil,
      name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
      sgkDays: pe.workedDays,
      missingDays: pe.totalMissingDays,
      calculationStatus: pe.calculationStatus,
    };
    for (const [k, names] of Object.entries(PAY)) row[k] = r2(names.reduce((a, n) => a + (payments.get(n) || 0), 0));
    for (const [k, name] of Object.entries(ITEM)) row[k] = items.has(name) ? r2(items.get(name)) : null;
    for (const [k, name] of Object.entries(DED)) row[k] = deds.has(name) ? r2(deds.get(name).value || 0) : null;
    row.advance = r2((pe.advancePeriodDeductions || []).reduce((a, d) => a + (d.amount ?? d.value ?? 0), 0));
    row.gvExemptApplied = deds.get(DED.gv) ? r2(deds.get(DED.gv).exemptionAmount || 0) : null;
    row.damgaExemptApplied = deds.get(DED.damga) ? r2(deds.get(DED.damga).exemptionAmount || 0) : null;
    row.payments = Object.fromEntries([...payments].filter(([, v]) => v));
    if (row.sicil) out[row.sicil] = row;
    if (row.name) out[row.name] = row;
  }
  return out;
}

function apply(fresh, before) {
  const cmp = JSON.parse(fs.readFileSync(path.join(DATA, "kenar_comparison.json"), "utf8"));
  const mtx = JSON.parse(fs.readFileSync(path.join(DATA, "kenar_matrix.json"), "utf8"));
  let filled = 0;
  const deltas = [];
  for (const row of cmp.rows) {
    const src = fresh[row.sicil] || fresh[row.tc] || fresh[row.name];
    const prev = before[row.sicil];
    if (!src || src.net == null) {
      row.dhrPending = true;
      row.dhr = null;
      continue;
    }
    filled++;
    row.dhrPending = false;
    row.dhr = {
      salary: src.salary,
      meal: src.meal,
      transport: src.transport,
      overtime: src.overtime,
      prim: src.prim,
      ikramiye: src.ikramiye,
      masraf: src.masraf,
      kesinti: src.kesinti,
      advance: src.advance,
      gross: src.gross,
      net: src.net,
      gv: src.gv,
      sgk: src.sgk,
      unemployment: src.unemployment,
      damga: src.damga,
      bes: src.bes,
      saglik: src.saglik,
      besEmployer: src.besEmployer,
      sgkDays: src.sgkDays,
      sgkBase: src.sgkBase,
      gvMatrah: src.gvMatrah,
      gvExemptApplied: src.gvExemptApplied,
      damgaExemptApplied: src.damgaExemptApplied,
      employerCost: src.employerCost,
    };
    row.delta = row.delta || {};
    row.delta.net = dlt(src.net, row.luca?.net);
    row.delta.gv = dlt(src.gv, row.luca?.gv);
    row.delta.damga = dlt(src.damga, row.luca?.damga);
    row.delta.gross = dlt(src.gross, row.luca?.gross);
    row.delta.meal = dlt(src.meal, row.luca?.meal);
    row.delta.transport = dlt(src.transport, row.luca?.transport);
    row.delta.netAi = dlt(src.net, row.ai?.net);
    row.delta.gvAi = dlt(src.gv, row.ai?.gv);
    row.delta.netLucaAi = dlt(row.luca?.net, row.ai?.net);
    const prevNet = prev?.net;
    row.lineItems = (cmp.lineDefs || []).map((def) => {
      const dhr = src[def.key] ?? null;
      const luca = row.luca ? row.luca[def.key] ?? null : null;
      const delta = dlt(dhr, luca);
      const ai = (row.lineItems || []).find((x) => x.key === def.key)?.ai ?? row.ai?.[def.key] ?? null;
      return {
        key: def.key,
        label: def.label,
        group: def.group,
        dhr,
        luca,
        delta,
        match: delta != null && Math.abs(delta) <= PASS,
        ai,
        deltaDhrAi: dlt(dhr, ai),
        deltaLucaAi: dlt(luca, ai),
        matchAi: dhr != null && ai != null && Math.abs(nz(dhr) - nz(ai)) <= PASS,
      };
    });
    deltas.push({
      sicil: row.sicil,
      name: row.name,
      dhr: src.net,
      prev: prevNet,
      luca: row.luca?.net,
      meal: src.meal,
      yol: src.transport,
      prim: src.prim,
      advance: src.advance,
      days: src.sgkDays,
      dLuca: row.delta.net,
      improved: prevNet != null && row.luca?.net != null && Math.abs(src.net - row.luca.net) < Math.abs(prevNet - row.luca.net) - 0.005,
    });
  }
  const withDhr = cmp.rows.filter((r) => r.dhr?.net != null);
  const netD = withDhr.map((r) => r.delta?.net).filter((v) => v != null);
  cmp.pending.dhr = filled === 0;
  cmp.pending.luca = cmp.rows.every((r) => r.luca?.net == null);
  cmp.summary.dhrCount = filled;
  cmp.summary.matched = withDhr.filter((r) => r.luca?.net != null).length;
  cmp.summary.netWithin100 = netD.filter((v) => Math.abs(v) <= 100).length;
  cmp.summary.avgAbsNetDelta = netD.length ? r2(netD.reduce((a, v) => a + Math.abs(v), 0) / netD.length) : null;
  cmp.summary.netPass001 = netD.filter((v) => Math.abs(v) <= PASS).length;
  cmp.generatedAt = new Date().toISOString();
  cmp.sources.dhrExcel = `${BASE} — Kenar Eylül dump · ${filled}/53`;
  cmp.ui.lead = `Kenar Durumlar 53 kişi. DHR ${filled}/53 · Luca ${cmp.summary.lucaCount}/53 (${cmp.lucaPdfVersion || "PDF"}). Hakem YZ. İK / Ana Kadro karışmaz.`;
  cmp.ui.verdict = `DHR×Luca ±0,01 ${cmp.summary.netPass001 || 0}/${cmp.summary.matched}. Ort. |ΔNet| ${tr(cmp.summary.avgAbsNetDelta)}. Luca referans, YZ hakem.`;

  cmp.kalemler = (cmp.lineDefs || []).map((def) => {
    let dhrSum = 0,
      lucaSum = 0,
      aiSum = 0,
      compared = 0,
      matchCount = 0,
      people = 0;
    for (const r of cmp.rows) {
      const it = (r.lineItems || []).find((x) => x.key === def.key) || {};
      dhrSum += nz(it.dhr);
      lucaSum += nz(it.luca);
      aiSum += nz(it.ai);
      if (it.dhr != null || it.luca != null) people++;
      if (it.dhr != null && it.luca != null) {
        compared++;
        if (it.match) matchCount++;
      }
    }
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      dhrSum: r2(dhrSum),
      lucaSum: r2(lucaSum),
      aiSum: r2(aiSum),
      deltaSum: r2(dhrSum - lucaSum),
      compared,
      matchCount,
      peopleWithValue: people,
    };
  });
  mtx.scenarios = mtx.scenarios.map((s) => {
    const row = cmp.rows.find((r) => r.name === s.name);
    const dhr = row?.dhr;
    const luca = row?.luca;
    if (!dhr || dhr.net == null) {
      return { ...s, dhr: "pending", verdict: `${s.name}: DHR yok. Luca ${tr(luca?.net)}.` };
    }
    return {
      ...s,
      dhr: luca?.net == null ? "pending" : near(dhr.net, luca.net) ? "pass" : "fail",
      luca: luca?.net == null ? "pending" : "pass",
      verdict: `DHR ${tr(dhr.net)} / Luca ${tr(luca?.net)} (Δ ${tr(row.delta?.net)}).`,
      whichCorrect: "YZ hakem; Luca referans.",
      legalBasis: "2026 GVK 23/18, 5510, 4447, 488.",
    };
  });
  mtx.checkedItems = [
    { item: "Geçme eşiği ±0,01 TL", result: "pass", note: "partial/known/kısmen geçti yok." },
    { item: "Luca hakem değil", result: "pass", note: "Luca referans, hakem YZ." },
    { item: "DHR Eylül 2026 hesap", result: filled === 53 ? "pass" : filled ? "fail" : "pending", note: `${BASE} · ${filled}/53` },
    {
      item: "Luca PDF",
      result: (cmp.summary.lucaCount || 0) > 0 ? "pass" : "fail",
      note: `${cmp.lucaPdfVersion || "PDF"}: ${cmp.summary.lucaCount || 0}/53. DHR net ±0,01: ${cmp.summary.netPass001 || 0}/${cmp.summary.matched}.`,
    },
  ];
  mtx.period = "Eylül 2026 · Kenar Durumlar · DHR × Luca × YZ";
  mtx.sourceOfTruth = `YZ hakem. Luca referans (${cmp.lucaPdfVersion || "PDF"}, ${cmp.summary.lucaCount || 0}/53). DHR ${filled}/53. Geçme ±0,01 TL. Durum = DHR−Luca.`;
  const dash = JSON.parse(fs.readFileSync(path.join(DATA, "dashboard.json"), "utf8"));
  const p = dash.periods.find((x) => x.id === "kenar");
  if (p) {
    p.state = `Hesaplandı · DHR ${filled}/53 · Luca ${cmp.summary.lucaCount || 0}/53 · ±0,01 ${cmp.summary.netPass001 || 0}/${cmp.summary.matched}`;
    p.compare = "DHR × Luca × YZ";
  }
  dash.environment = BASE;
  dash.generatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(DATA, "dashboard.json"), JSON.stringify(dash, null, 2) + "\n");

  fs.writeFileSync(path.join(DATA, "kenar_comparison.json"), JSON.stringify(cmp, null, 2) + "\n");
  fs.writeFileSync(path.join(DATA, "kenar_matrix.json"), JSON.stringify(mtx, null, 1));
  return {
    filled,
    pass001: cmp.summary.netPass001 || 0,
    matched: cmp.summary.matched,
    avg: cmp.summary.avgAbsNetDelta,
    mealOn: deltas.filter((x) => nz(x.meal) > 0).length,
    yolOn: deltas.filter((x) => nz(x.yol) > 0).length,
    improved: deltas.filter((x) => x.improved),
    vsLuca: deltas
      .filter((x) => x.luca != null)
      .sort((a, b) => Math.abs(b.dLuca || 0) - Math.abs(a.dLuca || 0))
      .slice(0, 20),
    sample: deltas.slice(0, 8),
  };
}

(async () => {
  const beforeCmp = JSON.parse(fs.readFileSync(path.join(DATA, "kenar_comparison.json"), "utf8"));
  const before = {};
  for (const r of beforeCmp.rows) if (r.dhr?.net != null) before[r.sicil] = { net: r.dhr.net, meal: r.dhr.meal };

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", EMAIL);
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
  if (page.url().includes("/login")) throw new Error("login fail " + page.url());
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
        return { status: res.status, data, text: String(text).slice(0, 900) };
      },
      { method, urlPath, body }
    );
  }

  const periods = arr(await api("GET", "/api/PayrollPeriod/filteredByUnitAbilities"));
  const sep = periods
    .map((p) => ({
      id: p.id,
      name: p.name || "",
      unit: p.organizationalUnit?.name || p.organizationalUnitName || "",
      year: p.year,
      month: p.month,
      status: p.payrollStatus,
      count: (p.periodEmployees || []).length || p.employeeCount,
    }))
    .filter((p) => Number(p.year) === 2026 && Number(p.month) === 9);
  console.log(
    "SEP",
    sep.map((p) => `${p.unit || p.name} ${p.status} n=${p.count} ${p.id}`).join(" | ")
  );
  const hits = sep.filter((p) => /kenar/i.test(`${p.name} ${p.unit}`));
  if (!hits.length) throw new Error("Kenar Eylül 2026 dönem yok");
  const chosen = hits.sort((a, b) => (b.count || 0) - (a.count || 0))[0];
  console.log("CHOSEN", chosen);

  const pays = arr(unwrap((await api("GET", "/api/Payment/filteredByUnitAbilities")).data));
  const payById = Object.fromEntries(pays.map((p) => [p.id, p.name]));

  const auto = await api("POST", `/api/PayrollPeriod/${chosen.id}/attendance/bulk-save-auto`, {
    filter: null,
    search: null,
    onlyFullyDerived: false,
  });
  console.log("ATT_AUTO", auto.status, String(auto.text).slice(0, 240).replace(/\s+/g, " "));

  const calc = await api("POST", `/api/PayrollPeriod/${chosen.id}/calculate`, { onlyStaleEmployees: ONLY_STALE });
  const jobId = unwrap(calc.data)?.jobId;
  console.log("CALC", calc.status, "stale", ONLY_STALE, jobId, String(calc.text).slice(0, 240));

  let full = unwrap((await api("GET", `/api/PayrollPeriod/${chosen.id}`)).data);
  for (let i = 0; i < 50; i++) {
    await sleep(5000);
    const job = jobId ? unwrap((await api("GET", `/api/background-jobs/${jobId}`)).data) : null;
    full = unwrap((await api("GET", `/api/PayrollPeriod/${chosen.id}`)).data);
    const pes = full?.periodEmployees || [];
    const n = pes.filter((e) => (e.payrollItemValues || []).length).length;
    console.log(`POLL ${i} job=${job?.jobStatus} pct=${job?.progressPercent} items=${n}/${pes.length} period=${full?.payrollStatus}`);
    if (n === pes.length && pes.length) break;
    if (job && job.jobStatus !== 0 && job.jobStatus !== 1 && i >= 2) break;
  }

  fs.writeFileSync(DUMP, JSON.stringify({ ...full, _paymentCatalog: pays }, null, 1));
  const fresh = extract(full, payById);
  const applied = apply(fresh, before);
  console.log(JSON.stringify({ periodId: chosen.id, stale: ONLY_STALE, pe: (full?.periodEmployees || []).length, ...applied }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
