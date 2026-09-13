/**
 * Dump period payloads, re-add Ana 15 if empty, admin net OT, confirm tax/hire dates.
 */
const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");
const BASE = "https://dhrtest.d1-tech.com.tr";
const ADMIN_PASS = process.env.DHR_PASSWORD;
const state = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "faz1_seed_state.json"), "utf8"));
const REPO_OUT = path.join(__dirname, "faz1_verify_summary.json");

function unwrap(r) {
  let x = r?.data ?? r;
  for (let i = 0; i < 10; i++) {
    if (x && typeof x === "object" && !Array.isArray(x) && "data" in x) x = x.data;
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
  if (x?.value && Array.isArray(x.value)) return x.value;
  return [];
}
function ok(r) {
  return r && r.status >= 200 && r.status < 300 && !(r.data?.statusCode >= 400) && !r.data?.error;
}
function errText(r) {
  const e = r?.data?.error || r?.data?.title;
  return String(e?.message || (e?.errors && JSON.stringify(e.errors)) || r?.text || r?.status).slice(0, 280);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  async function uiLogin() {
    await page.goto(BASE + "/login", { waitUntil: "commit", timeout: 60000 });
    await page.waitForSelector("#login_email");
    await page.fill("#login_email", "arda.kocaoglu@d1-tech.com");
    await page.fill("#login_password", ADMIN_PASS);
    await page.getByRole("button", { name: /Giri/i }).click();
    for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);
    return !page.url().includes("/login");
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
        return { status: res.status, data, text: String(text).slice(0, 1200), keys: data && typeof data === "object" ? Object.keys(data) : [] };
      },
      { method, urlPath, body }
    );
  }
  if (!(await uiLogin())) throw new Error("login fail");
  console.log("ADMIN OK");

  const anaSep = "fe993870-b937-4756-8097-58b358f16a8e";
  const kenarSep = "12f9269c-a37b-4cb8-a18a-5f65c9cd1ada";
  const bSep = "0fbc3cbc-687a-4640-b386-514fa3d9555c";
  const paths = (id) => [
    `/api/PayrollPeriod/${id}/employees`,
    `/api/PayrollPeriodEmployee/by-period/${id}`,
    `/api/PayrollPeriod/${id}`,
    `/api/PayrollPeriodEmployee/period/${id}`,
    `/api/PayrollPeriod/${id}/period-employees`,
  ];
  async function dumpPeriod(tag, id) {
    const out = {};
    for (const pth of paths(id)) {
      const r = await api("GET", pth);
      const u = unwrap(r);
      const rows = arr(u);
      const nested = arr(u?.employees || u?.periodEmployees);
      console.log(tag, pth, r.status, "keys", r.keys, "rows", rows.length, "nested", nested.length, "text", (r.text || "").slice(0, 180));
      out[pth] = { status: r.status, rows: rows.length || nested.length, keys: r.keys, sample: (r.text || "").slice(0, 220) };
      if (rows.length || nested.length) out.best = rows.length ? rows : nested;
    }
    return out;
  }

  const anaDump = await dumpPeriod("ANA", anaSep);
  const kenarDump = await dumpPeriod("KENAR", kenarSep);
  const bDump = await dumpPeriod("B", bSep);

  const anaAktif = ["8003","8004","8005","8006","8007","8008","8009","8010","8011","8012","8013","8014","8015","8016","8017"]
    .map((s) => state.people[s].employeeId);
  let anaCount = (anaDump.best || []).length;
  if (!anaCount) {
    const add = await api("POST", `/api/PayrollPeriod/${anaSep}/employees`, { employeeIds: anaAktif });
    console.log("ANA_READD", add.status, errText(add), (add.text || "").slice(0, 200));
    const again = await dumpPeriod("ANA2", anaSep);
    anaCount = (again.best || []).length;
    anaDump.best = again.best;
  }

  // Ozan row from kenar dump
  const ozanId = state.people["8061"].employeeId;
  const kenarRows = kenarDump.best || [];
  const ozanRow = kenarRows.find((x) => (x.employeeId || x.employee?.id || x.id) === ozanId || String(x.employeeNumber) === "8061");
  console.log("OZAN_FOUND", !!ozanRow, ozanRow ? JSON.stringify(ozanRow).slice(0, 400) : "no");
  if (ozanRow?.id) {
    for (const [m, u, b] of [
      ["DELETE", `/api/PayrollPeriodEmployee/${ozanRow.id}`],
      ["POST", `/api/PayrollPeriodEmployee/${ozanRow.id}/remove`],
      ["PUT", `/api/PayrollPeriodEmployee/${ozanRow.id}/exclude`],
      ["DELETE", `/api/PayrollPeriod/${kenarSep}/period-employees/${ozanRow.id}`],
    ]) {
      const r = await api(m, u, b);
      console.log("OZAN_RM2", m, u, r.status, errText(r));
      if (ok(r) || r.status === 204) break;
    }
  }
  const addB = await api("POST", `/api/PayrollPeriod/${bSep}/employees`, { employeeIds: [ozanId, state.people["8062"].employeeId] });
  console.log("ADD_B", addB.status, errText(addB));

  // Confirm cumulative tax
  const ozan = unwrap(await api("GET", `/api/Employee/${ozanId}`));
  console.log("OZAN_TAX", ozan?.initialCumulativeTaxBase, ozan?.initialCumulativeTaxBaseYear, ozan?.organizationalUnitPosition?.id);

  // Hire/exit raw
  for (const sicil of ["8004", "8005", "8052"]) {
    const pos = await api("GET", `/api/OrganizationalUnitPosition/${state.people[sicil].positionId}`);
    const d = unwrap(pos);
    console.log("POS", sicil, pos.status, d?.startDate, d?.endDate, d?.isTerminated, d?.title);
  }
  const rehire = await api("GET", `/api/OrganizationalUnitPosition/56869aaa-ede0-4ceb-9418-e3a6bb1693f8`);
  const rh = unwrap(rehire);
  console.log("REHIRE8052", rehire.status, rh?.startDate, rh?.endDate, rh?.employeeId);

  // Overtime types isNet
  const ot = arr(unwrap(await api("GET", "/api/OvertimeType/all")));
  console.log(
    "OTDETAIL",
    ot.map((t) => ({ n: t.name, net: t.isNet, id: t.id, ou: t.organizationalUnitId })).slice(0, 12)
  );
  const otGross = ot.find((t) => /hafta i[cç]i/i.test(t.name || "") && t.organizationalUnitId === "d93d6660-892d-4dcf-8fc2-36bed171017a") || ot[0];
  const otNet = ot.find((t) => t.isNet) || ot.find((t) => /net/i.test(t.name || ""));

  // Admin assign net OT split
  const netChunks = [
    ["2026-09-21T18:00:00", "2026-09-21T21:00:00", "TV-06 net 3s"],
    ["2026-09-22T18:00:00", "2026-09-22T20:00:00", "TV-06 net 2s"],
  ];
  const netOut = [];
  for (const [start, end, title] of netChunks) {
    const r = await api("POST", "/api/EmployeeOvertimeRequest/assign", {
      title,
      description: title,
      startDate: start,
      endDate: end,
      overtimeTypeId: (otNet || otGross)?.id,
      compensationMode: 1,
      targetEmployeeId: state.people["8008"].employeeId,
    });
    netOut.push({ start, status: r.status, ok: ok(r), err: errText(r) });
    console.log("NET_ADMIN", start.slice(0, 10), r.status, ok(r) ? "ok" : errText(r));
  }

  // Berk approve pending OT if any
  // skip — assign may auto-approve

  const pub = JSON.parse(fs.readFileSync(REPO_OUT, "utf8"));
  pub.retries = pub.retries || {};
  pub.retries.anaDump = { count: (anaDump.best || []).length, sampleKeys: anaDump.best?.[0] ? Object.keys(anaDump.best[0]) : [] };
  pub.retries.netOtAdmin = netOut;
  pub.retries.ozanTax = { initialCumulativeTaxBase: ozan?.initialCumulativeTaxBase, year: ozan?.initialCumulativeTaxBaseYear };
  pub.retries.addB = { status: addB.status, err: errText(addB) };
  pub.counter15 = pub.counter15 || {};
  pub.counter15.anaEylulCount = (anaDump.best || []).length || anaCount;
  fs.writeFileSync(REPO_OUT, JSON.stringify(pub, null, 2));
  fs.writeFileSync(path.join(process.env.TEMP, "faz1_period_dump.json"), JSON.stringify({ anaDump, kenarDump, bDump, netOut }, null, 2).slice(0, 50000));
  console.log("WROTE dump ana", (anaDump.best || []).length, "kenar", kenarRows.length);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
