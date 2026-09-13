/**
 * Ocak 2026: yeni Luca PDF + DHR recalc JSON → comparison.json
 */
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const LUCA_PDF = process.argv[2] || "C:/Users/ardak/Downloads/bordro_d1_tech (25).pdf";
const DHR_JSON = path.join(process.env.TEMP, "dhr_ocak_full_data_v2.json");
const SEED = JSON.parse(fs.readFileSync(path.join(__dirname, "dhr_ik_seed_32.json"), "utf8"));
const COMP = path.join(__dirname, "..", "src", "data", "comparison.json");
const PUBLIC_PDF = path.join(__dirname, "..", "public", "downloads", "bordro_d1_tech.pdf");
const PASS = 0.01;

const LINE_DEFS = [
  { key: "salary", label: "Temel maas / ucret", group: "kazanc" },
  { key: "meal", label: "Yemek yardimi", group: "kazanc" },
  { key: "transport", label: "Yol yardimi", group: "kazanc" },
  { key: "overtime", label: "Fazla mesai", group: "kazanc" },
  { key: "prim", label: "Prim", group: "kazanc" },
  { key: "ikramiye", label: "Ikramiye", group: "kazanc" },
  { key: "masraf", label: "Masraf", group: "kazanc" },
  { key: "gross", label: "Toplam kazanc", group: "ozet" },
  { key: "sgk", label: "SGK isci", group: "kesinti" },
  { key: "unemployment", label: "Issizlik isci", group: "kesinti" },
  { key: "gv", label: "Gelir vergisi", group: "kesinti" },
  { key: "damga", label: "Damga vergisi", group: "kesinti" },
  { key: "bes", label: "BES kesintisi", group: "kesinti" },
  { key: "advance", label: "Avans", group: "kesinti" },
  { key: "kesinti", label: "Diger kesinti (icra vb.)", group: "kesinti" },
  { key: "net", label: "Net odenen", group: "ozet" },
];

const parseTR = (s) => (s == null || s === "" ? null : Number(String(s).replace(/\./g, "").replace(",", ".")));
const round2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const normName = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z]/g, "");

function pickLabeled(slice, patterns) {
  for (const re of patterns) {
    const m = slice.match(re);
    if (m) return parseTR(m[1]);
  }
  return 0;
}

function parseLucaExtras(slice) {
  const digM = slice.match(/Di[gğ]er Kazan[cç]lar:\s*([^\n]*)/i);
  const ozM = slice.match(/[OÖ]zel Kesintiler:\s*([^\n]*)/i);
  let digText = digM ? digM[1].trim() : "";
  let ozText = ozM ? ozM[1].trim() : "";
  if (/^--\s*\d/.test(digText)) digText = "";
  if (/Normal Kazan/i.test(ozText) && !/(Avans|icra|BES)/i.test(ozText)) ozText = "";
  const blob = `${digText}\n${ozText}`;
  return {
    digText,
    ozText,
    meal: pickLabeled(blob, [/Yemek[^:\n]*:\s*([\d.]+,\d{2})/i]),
    transport: pickLabeled(blob, [/Yol[^:\n]*:\s*([\d.]+,\d{2})/i]),
    overtime: pickLabeled(blob, [/Fazla Mesai[^:\n]*:\s*([\d.]+,\d{2})/i]),
    prim: pickLabeled(blob, [/\bPrim[^:\n]*:\s*([\d.]+,\d{2})/i]),
    ikramiye: pickLabeled(blob, [/[Iİ]kramiye[^:\n]*:\s*([\d.]+,\d{2})/i]),
    advance: pickLabeled(blob, [/Avans[^:\n]*:\s*([\d.]+,\d{2})/i]),
    kesinti: pickLabeled(blob, [/\bicra[^:\n]*:\s*([\d.]+,\d{2})/i]),
    bes: pickLabeled(blob, [/Oto\.?\s*Kat\.?\s*BES[^:\n]*:\s*([\d.]+,\d{2})/i, /\bBES[^:\n]*:\s*([\d.]+,\d{2})/i]),
    masraf: pickLabeled(blob, [/Masraf[^:\n]*:\s*([\d.]+,\d{2})/i]),
  };
}

function rowFromMatch(m, text) {
  const extras = parseLucaExtras(text.slice(m.index, m.index + 1400));
  const ozKes = parseTR(m[22]) || 0;
  const labelledOz = (extras.advance || 0) + (extras.kesinti || 0) + (extras.bes || 0);
  const ghost = round2(Math.max(0, ozKes - labelledOz));
  return {
    name: m[2].trim(),
    tc: m[3],
    kanun: m[5],
    ucret: parseTR(m[6]),
    gs: m[7],
    tgun: +m[8],
    norKaz: parseTR(m[10]),
    topKaz: parseTR(m[12]),
    digKaz: parseTR(m[13]),
    sskMat: parseTR(m[14]),
    sskIsci: parseTR(m[16]),
    gv: parseTR(m[19]),
    damga: parseTR(m[21]),
    ozKes,
    net: parseTR(m[23]),
    ...extras,
    kesinti: round2((extras.kesinti || 0) + ghost),
    ghostKesinti: ghost,
    unemployment: null,
    salary: parseTR(m[6]),
    gross: parseTR(m[12]),
    sgk: parseTR(m[16]),
    masraf: extras.masraf || 0,
  };
}

async function extractLuca(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();
  const rows = [];
  const re =
    /(\d+)\s+([A-Za-z\u00C7\u00E7\u011E\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC ]+?)\s+(43\d{9})(?:\s+\d+\s+G[uü]n(?:\s+\d+\s+[^\n\d]{0,40})?)?\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+([\d.]+,\d{2})([GN])\s+(\d+)\s+(\d+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*\r?\n\s*([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;
  let m;
  while ((m = re.exec(text))) rows.push(rowFromMatch(m, text));

  const aktolga = /ALPER AKTOLGA\s+(\d{11})/.test(text);
  const fmSummary = text.match(/Fazla Mesai Saat[\s\S]{0,40}?(\d+)/);
  return { rows, fmHoursTotal: fmSummary ? +fmSummary[1] : null, textLen: text.length, aktolga };
}

function dhrFromJson(emp) {
  return {
    salary: emp.salary || 0,
    meal: emp.meal || 0,
    transport: emp.transport || 0,
    overtime: emp.overtime || 0,
    prim: emp.prim || 0,
    ikramiye: emp.ikramiye || 0,
    masraf: emp.masraf || 0,
    kesinti: 0,
    advance: emp.advance || 0,
    gross: emp.gross,
    net: emp.net,
    gv: emp.gv || 0,
    sgk: emp.sgk || 0,
    unemployment: emp.unemployment || 0,
    damga: emp.damga || 0,
    bes: emp.bes || 0,
    sgkDays: emp.sgkDays,
    workedDays: emp.workedDays,
    missingDays: emp.missingDays,
    gvExemption: emp.gvExemption,
    gvTechnopark: emp.gvTechnopark,
    gvCumBase: emp.gvCumBase,
  };
}

function buildLineItems(D, L) {
  return LINE_DEFS.map((def) => {
    const dhr = D ? (D[def.key] == null ? null : round2(D[def.key])) : null;
    const luca = L ? (L[def.key] == null ? null : round2(L[def.key])) : null;
    const bothNull = dhr == null && luca == null;
    const d = dhr == null ? 0 : dhr;
    const l = luca == null ? 0 : luca;
    const delta = bothNull ? null : round2(d - l);
    const match =
      bothNull ||
      (dhr != null && luca != null && Math.abs(dhr - luca) <= PASS) ||
      (dhr == null && luca === 0) ||
      (luca == null && dhr === 0);
    return { key: def.key, label: def.label, group: def.group, dhr, luca, delta, match: !!match };
  });
}

function aggregateKalemler(rows) {
  const matched = rows.filter((r) => r.dhr && r.delta);
  return LINE_DEFS.map((def) => {
    let dhrSum = 0,
      lucaSum = 0,
      bothPresent = 0,
      matchCount = 0,
      nonzeroEither = 0;
    for (const r of matched) {
      const item = r.lineItems.find((i) => i.key === def.key);
      if (!item) continue;
      const d = item.dhr == null ? 0 : item.dhr;
      const l = item.luca == null ? 0 : item.luca;
      dhrSum += d;
      lucaSum += l;
      if (item.dhr != null && item.luca != null) {
        bothPresent++;
        if (item.match) matchCount++;
      }
      if (Math.abs(d) > PASS || Math.abs(l) > PASS) nonzeroEither++;
    }
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      dhrSum: round2(dhrSum),
      lucaSum: round2(lucaSum),
      deltaSum: round2(dhrSum - lucaSum),
      peopleWithValue: nonzeroEither,
      matchCount,
      compared: bothPresent,
    };
  });
}

(async () => {
  const prev = JSON.parse(fs.readFileSync(COMP, "utf8").replace(/^\uFEFF/, ""));
  const dhrRaw = JSON.parse(fs.readFileSync(DHR_JSON, "utf8"));
  const luca = await extractLuca(LUCA_PDF);
  const seedByTc = Object.fromEntries(SEED.created.map((c) => [c.tc, c]));
  const prevByTc = Object.fromEntries((prev.rows || []).map((r) => [r.tc, r]));
  const dhrByName = Object.fromEntries(dhrRaw.employees.map((e) => [normName(e.name), e]));
  const lucaByTc = Object.fromEntries(luca.rows.map((r) => [r.tc, r]));

  const rows = SEED.created
    .map((S) => {
      const L = lucaByTc[S.tc];
      const emp = dhrByName[normName(S.name)];
      const old = prevByTc[S.tc];
      const D = emp ? dhrFromJson(emp) : old?.dhr || null;
      const lucaSlim = L
        ? {
            salary: L.salary,
            meal: L.meal,
            transport: L.transport,
            overtime: L.overtime,
            prim: L.prim,
            ikramiye: L.ikramiye,
            masraf: L.masraf,
            kesinti: L.kesinti,
            advance: L.advance,
            gross: L.gross,
            net: L.net,
            gv: L.gv,
            sgk: L.sgk,
            unemployment: L.unemployment,
            damga: L.damga,
            bes: L.bes,
            kanun: L.kanun,
            ucret: L.ucret,
            topKaz: L.topKaz,
            digKaz: L.digKaz,
            tgun: L.tgun,
            sskMat: L.sskMat,
            digText: L.digText,
            ozText: L.ozText,
            gs: L.gs,
            ozKes: L.ozKes,
            ghostKesinti: L.ghostKesinti,
          }
        : old?.luca;
      const lineItems = buildLineItems(D, lucaSlim);
      return {
        n: S.n,
        name: L?.name || S.name,
        tc: S.tc,
        note: old?.note || S.note || "",
        profile: S.profile || old?.profile || "",
        input: S.input || old?.input || "",
        lucaKanunExpected: S.lucaKanun,
        luca: lucaSlim,
        dhr: D,
        delta: D && lucaSlim
          ? {
              net: round2(D.net - lucaSlim.net),
              gv: round2((D.gv || 0) - (lucaSlim.gv || 0)),
              damga: round2((D.damga || 0) - (lucaSlim.damga || 0)),
              gross: round2(D.gross - (lucaSlim.topKaz ?? lucaSlim.gross)),
              meal: round2((D.meal || 0) - (L.meal || 0)),
              transport: round2((D.transport || 0) - (L.transport || 0)),
              overtime: round2((D.overtime || 0) - (L.overtime || 0)),
              bes: round2((D.bes || 0) - (L.bes || 0)),
            }
          : null,
        lineItems,
      };
    })
    .sort((a, b) => (a.n || 0) - (b.n || 0));

  const matched = rows.filter((r) => r.dhr?.net != null && r.luca?.net != null);
  const avgAbs = matched.length
    ? round2(matched.reduce((s, r) => s + Math.abs(r.delta.net), 0) / matched.length)
    : null;
  const netWithin100 = matched.filter((r) => Math.abs(r.delta.net) <= 100).length;
  const netPass = matched.filter((r) => Math.abs(r.delta.net) <= PASS).length;

  fs.copyFileSync(LUCA_PDF, PUBLIC_PDF);

  const payload = {
    generatedAt: new Date().toISOString(),
    period: "Ocak 2026 (DHR UI × Luca PDF)",
    unit: "Insan Kaynaklari — dhrtest UI vs Luca Ocak",
    lucaPdfVersion: path.basename(LUCA_PDF),
    sources: {
      lucaPdf: "downloads/bordro_d1_tech.pdf",
      dhrExcel: "downloads/Payroll_Ocak_2026.xlsx",
    },
    summary: {
      lucaCount: luca.rows.length,
      dhrCount: dhrRaw.employees.length,
      matched: matched.length,
      netWithin100,
      netPass001: netPass,
      avgAbsNetDelta: avgAbs,
      fmHoursTotalLuca: luca.fmHoursTotal,
      mealOnLuca: matched.filter((r) => (r.luca.meal || 0) > 0).length,
      overtimeOnLuca: matched.filter((r) => (r.luca.overtime || 0) > 0).length,
      besOnLuca: matched.filter((r) => (r.luca.bes || 0) > 0).length,
      lucaHasAktolga: luca.aktolga,
      ghostKesintiPeople: matched.filter((r) => (r.luca.ghostKesinti || 0) > 0.05).length,
    },
    lineDefs: LINE_DEFS,
    kalemler: aggregateKalemler(rows),
    rows,
    legal: {
      gvMonthly2026: prev.legal.gvMonthly2026,
      dhrObserved: { exemptApplied: 4211.33, paramFormulaValue: 4211.33, allMonthsSame: false },
      lucaObserved: { exemptApplied: 4211.33, octoberLegal: 5615.1 },
    },
    ui: {
      title: "DHR × Luca — Ocak 2026 Bordro Karşılaştırması",
      lead: `32 kişilik test matrisi. DHR Ocak yeniden hesap + Luca ${path.basename(LUCA_PDF)}. Geçme kriteri ±0,01 TL.`,
      verdict: "placeholder",
      deltaChartCaption: "Pozitif = DHR net daha yüksek · Kaynak: Ocak 2026 DHR UI × yeni Luca PDF",
      gvCompareTitle: "Ocak 2026 — istisna karşılaştırması",
      footer: "D1-Tech · dhrtest İK birimi · Ocak 2026 dönem ID 67d5ddbc-5000-48b3-abac-b89e429cf5c2",
      personCaption: "Çalışan seç → her kalemde DHR Ocak (recalc) ve Luca PDF yan yana. Eşleşme ±0,01 TL.",
      gvBullets: [
        "DHR Ocak: asgari ücret GV istisnası 4.211,33 TL uygulandı (yasal Ocak bandı).",
        "Luca SGK yemek 158 TL/gün × 22 iş günü uygulandı — Serra SGK 7.801,36 birebir.",
        "Yemek GV büyük ölçüde düştü (Serra 3.336,67 → 2.635,42) ama DHR 2.589,88; sistematik +45,54 TL.",
        "Luca yemeği damga matrahından da düşüyor (Serra 156,88); DHR 198,63 — nakit yemek damgada kalır.",
      ],
      drivers: [],
    },
  };

  fs.writeFileSync(COMP, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        lucaParsed: luca.rows.length,
        matched: matched.length,
        missing: SEED.created.filter((c) => !lucaByTc[c.tc]).map((c) => c.name),
        aktolga: luca.aktolga,
        avgAbsNetDelta: avgAbs,
        netWithin100,
        netPass001: netPass,
        serra: matched.find((r) => r.n === 1)?.delta,
        ilker: matched.find((r) => r.n === 15)?.delta,
        dilek: matched.find((r) => r.n === 10)?.delta,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
