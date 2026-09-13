const { chromium } = require(require("path").join(process.env.TEMP, "node_modules", "playwright"));
const fs = require("fs");
const path = require("path");
const state = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "faz1_seed_state.json"), "utf8"));
const ADMIN_PASS = process.env.DHR_PASSWORD;
const REPO = path.join(__dirname, "faz1_verify_summary.json");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto("https://dhrtest.d1-tech.com.tr/login", { waitUntil: "commit", timeout: 60000 });
  await page.waitForSelector("#login_email");
  await page.fill("#login_email", "arda.kocaoglu@d1-tech.com");
  await page.fill("#login_password", ADMIN_PASS);
  await page.getByRole("button", { name: /Giri/i }).click();
  for (let i = 0; i < 90 && page.url().includes("/login"); i++) await page.waitForTimeout(400);

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
        return { status: res.status, data, text: String(text).slice(0, 800) };
      },
      { method, urlPath, body }
    );
  }

  function deepEmployees(x) {
    const seen = new Set();
    const walk = (n, d) => {
      if (!n || d > 6 || seen.has(n)) return [];
      if (typeof n === "object") seen.add(n);
      if (Array.isArray(n) && n[0]?.employeeNumber) return n;
      if (Array.isArray(n) && n[0]?.employee?.employeeNumber) return n;
      if (n.employees) return walk(n.employees, d + 1);
      if (n.data) return walk(n.data, d + 1);
      return [];
    };
    return walk(x, 0);
  }

  const ana = await api("GET", "/api/PayrollPeriod/fe993870-b937-4756-8097-58b358f16a8e");
  const rows = deepEmployees(ana.data);
  const nums = rows.map((e) => e.employee?.employeeNumber || e.employeeNumber).sort();
  console.log("ANA", nums.length, nums.join(","));

  const kenar = await api("GET", "/api/PayrollPeriod/12f9269c-a37b-4cb8-a18a-5f65c9cd1ada");
  const krows = deepEmployees(kenar.data);
  console.log("KENAR", krows.length, "ozan", krows.some((e) => (e.employee?.employeeNumber || e.employeeNumber) === "8061"));

  const b = await api("GET", "/api/PayrollPeriod/0fbc3cbc-687a-4640-b386-514fa3d9555c");
  const brows = deepEmployees(b.data);
  console.log("B", brows.length, brows.map((e) => e.employee?.employeeNumber || e.employeeNumber).join(","));

  const lab = await api("GET", "/api/PayrollPeriod/f3a13bd6-739f-4c9d-a883-e2fdf720e787");
  const lrows = deepEmployees(lab.data);
  console.log("LAB", lrows.length, lrows.map((e) => e.employee?.employeeNumber || e.employeeNumber).join(","));

  const op = await api("GET", "/api/PayrollPeriod/70cb2aae-0203-422f-a86b-c027ec49837a");
  console.log("OP", deepEmployees(op.data).length);
  const yuv = await api("GET", "/api/PayrollPeriod/bf03dcf0-a61b-4c94-8d25-87bb5614bdf1");
  console.log("YUV", deepEmployees(yuv.data).length);

  // hire/exit on employee
  for (const sicil of ["8004", "8005", "8018", "8019", "8052"]) {
    const r = await api("GET", `/api/Employee/${state.people[sicil].employeeId}`);
    const e = r.data?.data || r.data;
    const keys = e && typeof e === "object" ? Object.keys(e).filter((k) => /date|hire|term|exit|start|end|leave/i.test(k)) : [];
    console.log("EMP", sicil, keys.join(",") || "no-date-keys", e?.startDate, e?.hireDate, e?.terminationDate, e?.endDate, e?.leaveDate);
  }

  // PUT hire/exit onto employee if fields exist
  const baran = (await api("GET", `/api/Employee/${state.people["8004"].employeeId}`)).data;
  const bEmp = baran?.data || baran;
  if (bEmp?.id) {
    const put = await api("PUT", `/api/Employee/${bEmp.id}`, {
      firstName: bEmp.firstName,
      lastName: bEmp.lastName,
      employeeNumber: bEmp.employeeNumber,
      email: bEmp.email,
      gender: bEmp.gender,
      phoneNumber: bEmp.phoneNumber,
      birthDate: bEmp.birthDate,
      hireDate: "2026-09-19",
      startDate: "2026-09-19",
    });
    console.log("BARAN_HIRE_PUT", put.status, put.text.slice(0, 120));
  }
  const cansu = (await api("GET", `/api/Employee/${state.people["8005"].employeeId}`)).data;
  const cEmp = cansu?.data || cansu;
  if (cEmp?.id) {
    const put = await api("PUT", `/api/Employee/${cEmp.id}`, {
      firstName: cEmp.firstName,
      lastName: cEmp.lastName,
      employeeNumber: cEmp.employeeNumber,
      email: cEmp.email,
      gender: cEmp.gender,
      phoneNumber: cEmp.phoneNumber,
      birthDate: cEmp.birthDate,
      terminationDate: "2026-09-14",
      endDate: "2026-09-14",
      leaveDate: "2026-09-14",
    });
    console.log("CANSU_EXIT_PUT", put.status, put.text.slice(0, 120));
  }

  // JS search for remove
  const js = await page.evaluate(async () => {
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src).filter((s) => /index-.*\.js/.test(s));
    const src = scripts[0];
    if (!src) return { src: null };
    const t = await (await fetch(src, { credentials: "include" })).text();
    const idx = t.search(/PayrollPeriodEmployee/i);
    const slice = idx >= 0 ? t.slice(Math.max(0, idx - 200), idx + 400) : "";
    const removeIdx = t.search(/remove.*[Ee]mployee|exclude.*[Pp]eriod/i);
    const slice2 = removeIdx >= 0 ? t.slice(Math.max(0, removeIdx - 80), removeIdx + 200) : "";
    return { src, idx, slice: slice.slice(0, 500), removeIdx, slice2: slice2.slice(0, 300) };
  });
  console.log("JS", JSON.stringify(js).slice(0, 1200));

  // PUT position with startDate anyway
  const pos4 = await api("GET", `/api/OrganizationalUnitPosition/${state.people["8004"].positionId}`);
  const p4 = pos4.data?.data || pos4.data;
  const put4 = await api("PUT", `/api/OrganizationalUnitPosition/${p4.id}`, { ...p4, startDate: "2026-09-19", organizationalUnit: undefined, employee: undefined, role: undefined });
  console.log("POS4_PUT", put4.status, put4.text.slice(0, 150));

  const pos5 = await api("GET", `/api/OrganizationalUnitPosition/${state.people["8005"].positionId}`);
  const p5 = pos5.data?.data || pos5.data;
  const put5 = await api("PUT", `/api/OrganizationalUnitPosition/${p5.id}`, {
    ...p5,
    endDate: "2026-09-14",
    isTerminated: true,
    organizationalUnit: undefined,
    employee: undefined,
    role: undefined,
  });
  console.log("POS5_PUT", put5.status, put5.text.slice(0, 150));

  const pub = JSON.parse(fs.readFileSync(REPO, "utf8"));
  pub.retries = pub.retries || {};
  pub.retries.anaNumbers = nums;
  pub.retries.anaHasPasif = nums.includes("8018") || nums.includes("8019");
  pub.counter15.anaEylulCount = nums.length;
  pub.counter15.kenarSep = krows.length;
  pub.counter15.sirketB = brows.length;
  pub.counter15.labOpen = lrows.length;
  pub.counter15.op = deepEmployees(op.data).length;
  pub.counter15.yuvarlama = deepEmployees(yuv.data).length;
  fs.writeFileSync(REPO, JSON.stringify(pub, null, 2));
  console.log("WROTE summary counts");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
