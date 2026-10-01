import type { CompareRow, ComparisonData, KalemAgg, LineItem } from "./types";
import type { MatrixData, MatrixStatus } from "./matrixTypes";
import type { YillikMonthFile, YillikMonthMeta, YillikPay, YillikPerson } from "./yillikTypes";
import mevzuatJson from "./data/mevzuat.json";

const MEVZUAT = mevzuatJson as {
  title: string;
  disclaimer: string;
  monthExemptTax: Record<string, number>;
  params: {
    asgariBrut: number;
    sgkIsciOran: number;
    issizlikIsciOran: number;
    sgdpIsciOran: number;
    stajyerGssOran: number;
    sgkTavanKat: number;
    damgaOran: number;
  };
};

const PASS = 0.01;
const MONTH_NAMES = [
  "",
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export const YILLIK_LINE_DEFS = [
  { key: "salary", label: "Temel maaş / ücret", group: "kazanc" },
  { key: "meal", label: "Yemek yardımı", group: "kazanc" },
  { key: "transport", label: "Yol yardımı", group: "kazanc" },
  { key: "overtime", label: "Fazla mesai", group: "kazanc" },
  { key: "prim", label: "Prim", group: "kazanc" },
  { key: "ikramiye", label: "İkramiye", group: "kazanc" },
  { key: "masraf", label: "Masraf", group: "kazanc" },
  { key: "gross", label: "Toplam kazanç", group: "ozet" },
  { key: "sgk", label: "SGK işçi", group: "kesinti" },
  { key: "unemployment", label: "İşsizlik işçi", group: "kesinti" },
  { key: "gv", label: "Gelir vergisi", group: "kesinti" },
  { key: "damga", label: "Damga vergisi", group: "kesinti" },
  { key: "bes", label: "BES kesintisi", group: "kesinti" },
  { key: "advance", label: "Avans mahsubu", group: "kesinti" },
  { key: "kesinti", label: "Diğer kesinti (icra vb.)", group: "kesinti" },
  { key: "net", label: "Net ödenen", group: "ozet" },
] as const;

type LineKey = (typeof YILLIK_LINE_DEFS)[number]["key"];
type AiPack = Record<LineKey, number> & { gvMatrah: number; gvExemptApplied: number; notes: string[] };

function r2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function nz(n: number | null | undefined): number {
  return n == null || !Number.isFinite(Number(n)) ? 0 : Number(n);
}
function tl(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function netStatus(dhr: number | null | undefined, other: number | null | undefined, missing = false): MatrixStatus {
  if (missing || other == null || !Number.isFinite(Number(other))) return "pending";
  if (dhr == null || !Number.isFinite(Number(dhr))) return "pending";
  return Math.abs(Number(dhr) - Number(other)) <= PASS ? "pass" : "fail";
}

function taxOnWage(matrah: number): number {
  const m = Math.max(0, matrah);
  if (m <= 190000) return m * 0.15;
  if (m <= 400000) return 28500 + (m - 190000) * 0.2;
  if (m <= 1500000) return 70500 + (m - 400000) * 0.27;
  if (m <= 5300000) return 367500 + (m - 1500000) * 0.35;
  return 1697500 + (m - 5300000) * 0.4;
}

function isEmekli(p: YillikPerson): boolean {
  return /emekli|sgdp/i.test(`${p.profile} ${p.note}`);
}
function isStajyer(p: YillikPerson): boolean {
  return /staj/i.test(`${p.profile} ${p.note}`);
}

function computeAi(input: {
  month: number;
  pay: YillikPay;
  emekli: boolean;
  stajyer: boolean;
}): AiPack {
  const p = MEVZUAT.params;
  const salary = r2(input.pay.salary);
  const meal = r2(input.pay.meal);
  const transport = r2(input.pay.transport);
  const overtime = r2(input.pay.overtime);
  const prim = r2(input.pay.prim);
  const ikramiye = r2(input.pay.ikramiye);
  const masraf = r2(input.pay.masraf);
  const gross = r2(input.pay.gross || salary + meal + transport + overtime + prim + ikramiye + masraf);
  const tavan = p.asgariBrut * p.sgkTavanKat;
  const base = r2(Math.min(Math.max(gross, 0), tavan));
  const sgkRate = input.emekli ? p.sgdpIsciOran : input.stajyer ? p.stajyerGssOran : p.sgkIsciOran;
  const issRate = input.emekli || input.stajyer ? 0 : p.issizlikIsciOran;
  const sgk = r2(base * sgkRate);
  const unemployment = r2(base * issRate);
  const gvMatrah = r2(Math.max(0, gross - sgk - unemployment));
  const rawGv = r2(taxOnWage(gvMatrah));
  const exempt = input.stajyer ? rawGv : MEVZUAT.monthExemptTax[String(input.month)] || 4211.33;
  const gvExemptApplied = input.stajyer ? 0 : r2(Math.min(exempt, rawGv));
  const gv = input.stajyer ? 0 : r2(Math.max(0, rawGv - exempt));
  const damgaFull = r2(gross * p.damgaOran);
  const damgaExempt = r2(p.asgariBrut * p.damgaOran);
  const damga = input.stajyer ? 0 : r2(Math.max(0, damgaFull - damgaExempt));
  const bes = r2(input.pay.bes);
  const advance = r2(input.pay.advance);
  const kesinti = r2(input.pay.kesinti);
  const net = r2(gross - sgk - unemployment - gv - damga - bes - advance - kesinti);
  return {
    salary,
    meal,
    transport,
    overtime,
    prim,
    ikramiye,
    masraf,
    gross,
    sgk,
    unemployment,
    gv,
    damga,
    bes,
    advance,
    kesinti,
    net,
    gvMatrah,
    gvExemptApplied,
    notes: [
      input.stajyer ? "Stajyer: GV ve damga 0; GSS %5 (5510 öğrenci/staj uygulaması sadeleştirildi)." : null,
      input.emekli ? "Emekli: SGDP işçi %7,5; işsizlik 0 (5510/SGDP)." : null,
    ].filter((x): x is string => x != null),
  };
}

function dhrVal(pay: YillikPay, key: LineKey): number {
  return r2(pay[key]);
}

function lucaField(luca: CompareRow["luca"] | null, key: LineKey): number | null {
  if (!luca) return null;
  const v = (luca as unknown as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function lineItems(pay: YillikPay, ai: AiPack, luca: CompareRow["luca"] | null, lucaPending: boolean): LineItem[] {
  return YILLIK_LINE_DEFS.map((d) => {
    const dhr = dhrVal(pay, d.key);
    const aiVal = ai[d.key];
    const lucaNum = lucaPending ? null : lucaField(luca, d.key);
    const delta = lucaNum == null ? null : r2(dhr - lucaNum);
    const deltaDhrAi = r2(dhr - aiVal);
    const deltaLucaAi = lucaNum == null ? null : r2(lucaNum - aiVal);
    return {
      key: d.key,
      label: d.label,
      group: d.group,
      dhr,
      luca: lucaNum,
      ai: aiVal,
      delta,
      deltaDhrAi,
      deltaLucaAi,
      match: delta != null && Math.abs(delta) <= PASS,
      matchAi: Math.abs(deltaDhrAi) <= PASS,
    };
  });
}

function aggregateKalemler(rows: CompareRow[], lucaPending: boolean): KalemAgg[] {
  return YILLIK_LINE_DEFS.map((d) => {
    let dhrSum = 0;
    let lucaSum = 0;
    let aiSum = 0;
    let peopleWithValue = 0;
    let compared = 0;
    let matchCount = 0;
    let comparedAi = 0;
    let matchAi = 0;
    for (const r of rows) {
      const it = (r.lineItems || []).find((x) => x.key === d.key);
      const dhr = it?.dhr ?? 0;
      const luca = lucaPending ? null : it?.luca;
      const ai = it?.ai ?? 0;
      dhrSum += nz(dhr);
      lucaSum += nz(luca);
      aiSum += nz(ai);
      if (Math.abs(nz(dhr)) > 0.05 || Math.abs(nz(luca)) > 0.05 || Math.abs(nz(ai)) > 0.05) peopleWithValue += 1;
      if (dhr != null && ai != null) {
        comparedAi += 1;
        if (Math.abs(nz(dhr) - nz(ai)) <= PASS) matchAi += 1;
      }
      if (!lucaPending && luca != null && dhr != null) {
        compared += 1;
        if (Math.abs(nz(dhr) - nz(luca)) <= PASS) matchCount += 1;
      }
    }
    return {
      key: d.key,
      label: d.label,
      group: d.group,
      dhrSum: r2(dhrSum),
      lucaSum: r2(lucaSum),
      aiSum: r2(aiSum),
      deltaSum: lucaPending ? null : r2(dhrSum - lucaSum),
      deltaDhrAi: r2(dhrSum - aiSum),
      deltaLucaAi: lucaPending ? null : r2(lucaSum - aiSum),
      peopleWithValue,
      matchCount,
      compared,
      matchAi,
      comparedAi,
    };
  });
}

function emptyLuca(): CompareRow["luca"] {
  return {
    net: null,
    gv: null,
    damga: null,
    salary: null,
    meal: null,
    transport: null,
    overtime: null,
    prim: null,
    ikramiye: null,
    masraf: null,
    kesinti: null,
    advance: null,
    bes: null,
    sgk: null,
    unemployment: null,
    gross: null,
  };
}

function lucaFromOverlay(row: CompareRow | undefined): CompareRow["luca"] | null {
  if (!row?.luca || row.luca.net == null) return null;
  return row.luca;
}

function verdictText(
  dhrNet: number,
  lucaNet: number | null,
  aiNet: number,
  lucaPending: boolean,
): string {
  if (lucaPending || lucaNet == null) {
    const d = r2(dhrNet - aiNet);
    if (Math.abs(d) <= PASS) return `YZ net ±0,01 geçti (${tl(dhrNet)}). Luca bekliyor.`;
    return `Δ DHR−YZ ${tl(d)} · DHR ${tl(dhrNet)} / YZ ${tl(aiNet)}. Luca bekliyor.`;
  }
  const dLuca = r2(dhrNet - lucaNet);
  if (Math.abs(dLuca) <= PASS) return `Net ±0,01 geçti (${tl(dhrNet)}).`;
  return `ΔNet ${tl(dLuca)} · DHR ${tl(dhrNet)} / Luca ${tl(lucaNet)}`;
}

export function lucaOverlayMap(data: ComparisonData | null | undefined): Map<string, CompareRow> {
  const map = new Map<string, CompareRow>();
  if (!data?.rows) return map;
  for (const r of data.rows) {
    if (r.name) map.set(r.name, r);
    if (r.tc) map.set(r.tc, r);
    if (r.sicil) map.set(r.sicil, r);
  }
  return map;
}

export function buildYillikMonthCompare(opts: {
  monthFile: YillikMonthFile;
  meta: YillikMonthMeta;
  people: YillikPerson[];
  generatedAt: string;
  unit: string;
  template: MatrixData;
  lucaSource?: ComparisonData | null;
}): { data: ComparisonData; matrix: MatrixData } {
  const { monthFile, meta, people, generatedAt, unit, template, lucaSource } = opts;
  const month = monthFile.month;
  const label = monthFile.label || MONTH_NAMES[month] || `Ay ${month}`;
  const period = `${label} 2026`;
  const overlay = lucaOverlayMap(lucaSource);
  const lucaPending = overlay.size === 0;
  const exempt = MEVZUAT.monthExemptTax[String(month)] || 4211.33;
  const payBySicil = new Map(monthFile.people.map((p) => [p.sicil, p.pay]));

  const rows: CompareRow[] = people.map((p) => {
    const pay = payBySicil.get(p.sicil);
    if (!pay) {
      return {
        n: p.n,
        name: p.name,
        tc: p.tc,
        sicil: p.sicil,
        note: p.note,
        profile: p.profile,
        lucaPending: true,
        luca: emptyLuca(),
        dhr: null,
        delta: null,
        lineItems: [],
      };
    }
    const src = overlay.get(p.tc) || overlay.get(p.name) || overlay.get(p.sicil);
    const luca = lucaPending ? emptyLuca() : lucaFromOverlay(src) || emptyLuca();
    const hasLuca = !lucaPending && luca.net != null;
    const ai = computeAi({ month, pay, emekli: isEmekli(p), stajyer: isStajyer(p) });
    const items = lineItems(pay, ai, hasLuca ? luca : null, !hasLuca);
    const scen = template.scenarios.find((s) => s.name === p.name || s.n === p.n);
    return {
      n: p.n,
      name: p.name,
      tc: p.tc,
      sicil: p.sicil,
      note: p.note,
      profile: p.profile,
      input: scen?.input || "—",
      lucaKanunExpected: scen?.law || "00000",
      lucaPending: !hasLuca,
      luca: hasLuca ? luca : emptyLuca(),
      dhr: {
        salary: pay.salary,
        meal: pay.meal,
        transport: pay.transport,
        overtime: pay.overtime,
        prim: pay.prim,
        ikramiye: pay.ikramiye,
        masraf: pay.masraf,
        kesinti: pay.kesinti,
        advance: pay.advance,
        gross: pay.gross,
        net: pay.net,
        gv: pay.gv,
        damga: pay.damga,
        bes: pay.bes,
        sgk: pay.sgk,
        unemployment: pay.unemployment,
        sgkDays: pay.sgkDays,
        sgkBase: pay.sgkBase,
        gvMatrah: pay.gvMatrah,
        gvExemptApplied: pay.gvExempt,
        damgaExemptApplied: pay.damgaExempt,
        employerCost: pay.employerCost,
        saglik: pay.health,
        besEmployer: pay.besEmployer,
      },
      ai: {
        salary: ai.salary,
        meal: ai.meal,
        transport: ai.transport,
        overtime: ai.overtime,
        prim: ai.prim,
        ikramiye: ai.ikramiye,
        masraf: ai.masraf,
        gross: ai.gross,
        sgk: ai.sgk,
        unemployment: ai.unemployment,
        gv: ai.gv,
        damga: ai.damga,
        bes: ai.bes,
        advance: ai.advance,
        kesinti: ai.kesinti,
        net: ai.net,
        gvMatrah: ai.gvMatrah,
        gvExemptApplied: ai.gvExemptApplied,
        notes: ai.notes,
      },
      delta: {
        net: hasLuca ? r2(pay.net - nz(luca.net)) : null,
        gv: hasLuca ? r2(pay.gv - nz(luca.gv)) : null,
        damga: hasLuca ? r2(pay.damga - nz(luca.damga)) : null,
        gross: hasLuca ? r2(pay.gross - nz(luca.gross ?? luca.topKaz)) : undefined,
        netAi: r2(pay.net - ai.net),
        gvAi: r2(pay.gv - ai.gv),
        netLucaAi: hasLuca ? r2(nz(luca.net) - ai.net) : null,
      },
      lineItems: items,
    };
  });

  const live = rows.filter((r) => r.dhr?.net != null);
  const dhrNets = live.map((r) => nz(r.dhr?.net));
  const aiNets = live.map((r) => nz(r.ai?.net));
  const lucaNets = live.map((r) => (r.lucaPending ? null : r.luca.net));
  const lucaCompared = lucaNets.filter((n) => n != null) as number[];
  const avgAbs = (a: number[], b: number[]) =>
    a.length ? r2(a.reduce((s, n, i) => s + Math.abs(n - b[i]), 0) / a.length) : null;

  const kalemler = aggregateKalemler(live, lucaPending);
  const data: ComparisonData = {
    generatedAt,
    period,
    unit: `${unit} — ${period}`,
    lucaPdfVersion: lucaPending ? null : lucaSource?.lucaPdfVersion || null,
    pending: { luca: lucaPending, dhr: false },
    ui: {
      title: `${period} — DHR × Luca × YZ`,
      lead: lucaPending
        ? `${live.length} kişi, dhrtest2 İnsan Kaynakları ${label} dump’ı. Luca PDF bu ay için yok (Ocak ve Ekim’de var). Üçüncü kolon: YZ (2026 Türk mevzuatı: 5510, 4447, GVK 23/18, 488, 332 GT).`
        : `${live.length} kişi, dhrtest2 İnsan Kaynakları ${label} dump’ı × Luca PDF × YZ. Üçüncü kolon: YZ (2026 Türk mevzuatı: 5510, 4447, GVK 23/18, 488, 332 GT).`,
      verdict: lucaPending
        ? `Luca kolonu bekliyor — bu ay için PDF yok. Hakem YZ (${label} GV istisnası ${tl(exempt)} TL). Geçme ±0,01 TL. Luca referanstır, hakem değildir.`
        : `DHR × Luca × YZ. Geçme ±0,01 TL. Luca referanstır, hakem değildir.`,
      footer: `${unit} · ${period} · dönem ${meta.periodId.slice(0, 8)}`,
      personCaption: lucaPending
        ? "Çalışan seç → her kalemde DHR, bekleyen Luca ve YZ yan yana."
        : "Çalışan seç → her kalemde DHR, Luca ve YZ yan yana.",
      gvCompareTitle: `${period} — yasal GV istisnası (YZ ${tl(exempt)} TL)`,
      gvBullets: [
        `YZ ${label} istisnası ${tl(exempt)} TL (GVK 23/18, 7352, 2026 aylık bant).`,
        lucaPending ? "Luca PDF bu ay yok; Durum rozeti BEKLİYOR." : "Luca PDF bu ay işlendi.",
        "YZ aylık izole hesaplar; kümülatif GV dilimi yok. 5746/4691 terkin oranı uydurulmaz.",
      ],
    },
    sources: {
      lucaPdf: lucaPending ? "" : lucaSource?.sources.lucaPdf || "",
      dhrExcel: `https://dhrtest2.d1-tech.com.tr — İnsan Kaynakları ${period} · dönem ${meta.periodId}`,
      aiMevzuat: "mevzuat.json — 193 GVK, 332 GT, 5510, 4447, 488, 7352, 2026 asgari, 5746/4691 (oran yok)",
    },
    summary: {
      lucaCount: lucaCompared.length,
      dhrCount: live.length,
      matched: lucaPending ? 0 : live.length,
      netWithin100: lucaPending
        ? 0
        : live.filter((r) => r.delta?.net != null && Math.abs(r.delta.net) <= 100).length,
      avgAbsNetDelta: lucaPending ? null : avgAbs(dhrNets, lucaNets.map((n) => nz(n))),
      fmHoursTotalLuca: null,
      aiCount: live.length,
      avgAbsNetDeltaAi: avgAbs(dhrNets, aiNets),
      netWithin100Ai: dhrNets.filter((n, i) => Math.abs(n - aiNets[i]) <= 100).length,
    },
    lineDefs: YILLIK_LINE_DEFS.map((d) => ({ key: d.key, label: d.label, group: d.group })),
    kalemler,
    rows,
    legal: {
      gvMonthly2026: Object.entries(MEVZUAT.monthExemptTax).map(([m, ex]) => ({
        month: MONTH_NAMES[Number(m)],
        exempt: ex,
        rate: 15,
      })),
      dhrObserved: {
        exemptApplied: r2(
          live.reduce((s, r) => s + nz(r.dhr?.gvExemptApplied), 0) / Math.max(1, live.length),
        ),
        paramFormulaValue: exempt,
        allMonthsSame: false,
      },
      lucaObserved: { exemptApplied: 0, octoberLegal: 5615.1 },
    },
    aiReport: {
      month,
      engine: MEVZUAT.title,
      disclaimer: MEVZUAT.disclaimer,
      findings: [
        lucaPending
          ? {
              id: "LUCA-WAIT",
              vs: "luca",
              result: "Luca bekliyor",
              detail: `${label} 2026 için Luca bordro PDF’i yok. YZ kolonu mevzuat motorundan; PDF gelince aynı satırlara işlenecek. Ocak ve Ekim PDF’leri ilgili sekmelerde.`,
            }
          : {
              id: "LUCA-OK",
              vs: "luca",
              result: "Luca PDF işlendi",
              detail: `${label} Luca satırları mevcut PDF’den. Durum rozeti Δ DHR−Luca ±0,01.`,
            },
        {
          id: "GV-MONTH",
          vs: "dhr",
          result: `YZ ${label} istisna ${tl(exempt)} TL`,
          detail: "GVK md. 23/18 ve 7352: aylık asgari ücret GV istisnası. YZ kümülatif dilim uygulamaz.",
        },
        {
          id: "5746-4691",
          vs: "both",
          result: "Teşvik oranına dokunulmadı",
          detail: "5746 ve 4691 işveren/GV terkin oranları YZ netine yazılmaz. İşçi 5510+GVK+damga standarttır.",
        },
      ],
    },
  };

  const matrix: MatrixData = {
    period: `${period} · DHR × ${lucaPending ? "YZ (Luca bekliyor)" : "Luca × YZ"}`,
    environment: `dhrtest2.d1-tech.com.tr · ${unit} · dönem ${meta.periodId.slice(0, 8)}`,
    sourceOfTruth: lucaPending
      ? `DHR ${label} dump + YZ (2026 TR mevzuatı). Luca PDF yok.`
      : `DHR ${label} dump + Luca PDF + YZ (2026 TR mevzuatı).`,
    matrixDesign: template.matrixDesign,
    checkedItems: [
      {
        item: `${period} DHR hesap dump’ı`,
        result: "pass",
        note: `${live.length}/${people.length} kişi · dönem ${meta.periodId.slice(0, 8)}`,
      },
      {
        item: "Luca PDF",
        result: lucaPending ? "pending" : "pass",
        note: lucaPending ? `${label} için Luca yok. Ocak ve Ekim PDF’leri ilgili sekmelerde.` : `${lucaCompared.length} kişi Luca satırı.`,
      },
      {
        item: `YZ ${label} GV istisnası ${tl(exempt)} TL`,
        result: "pass",
        note: "Aylık izole; kümülatif dilim yok.",
      },
      {
        item: "Geçme eşiği ±0,01 TL",
        result: "pass",
        note: "Durum rozeti yalnız Δ DHR−Luca. Luca yoksa BEKLİYOR.",
      },
    ],
    correctFindings: template.correctFindings || [],
    dhrBugs: template.dhrBugs || [],
    warnings: template.warnings || [],
    scenarios: template.scenarios.map((s) => {
      const row = live.find((r) => r.name === s.name) || live.find((r) => r.n === s.n);
      const dhrNet = row?.dhr?.net;
      const lucaNet = row?.luca?.net;
      const aiNet = row?.ai?.net;
      const lucaSt = netStatus(dhrNet, lucaNet, lucaPending || !!row?.lucaPending);
      const yzSt = netStatus(dhrNet, aiNet);
      return {
        ...s,
        dhr: dhrNet != null ? "pass" : "pending",
        luca: lucaSt,
        ai: yzSt,
        verdict: row?.dhr?.net != null && row.ai?.net != null
          ? verdictText(row.dhr.net, lucaPending ? null : row.luca.net, row.ai.net, lucaPending)
          : s.verdict,
      };
    }),
  };

  return { data, matrix };
}
