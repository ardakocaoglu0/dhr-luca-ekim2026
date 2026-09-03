export type LineItem = {
  key: string;
  label: string;
  group: "kazanc" | "kesinti" | "ozet" | string;
  dhr: number | null;
  luca: number | null;
  delta: number | null;
  match: boolean;
};

export type KalemAgg = {
  key: string;
  label: string;
  group: string;
  dhrSum: number;
  lucaSum: number;
  deltaSum: number;
  peopleWithValue: number;
  matchCount: number;
  compared: number;
};

export type CompareRow = {
  n?: number;
  name: string;
  tc: string;
  note: string;
  profile: string;
  input?: string;
  lucaKanunExpected?: string;
  luca: {
    kanun?: string;
    ucret?: number;
    topKaz?: number;
    digKaz?: number;
    gv: number;
    damga: number;
    net: number;
    tgun?: number;
    digText?: string;
    ozText?: string;
    gs?: string;
    salary?: number | null;
    meal?: number | null;
    transport?: number | null;
    overtime?: number | null;
    prim?: number | null;
    ikramiye?: number | null;
    masraf?: number | null;
    kesinti?: number | null;
    advance?: number | null;
    bes?: number | null;
    sgk?: number | null;
    unemployment?: number | null;
    gross?: number | null;
  };
  dhr: {
    gross: number;
    net: number;
    gv: number;
    damga: number;
    bes: number;
    meal: number;
    transport: number;
    overtime?: number;
    prim?: number;
    ikramiye?: number;
    masraf?: number;
    kesinti?: number;
    advance?: number;
    salary?: number | null;
    sgk?: number | null;
    unemployment?: number | null;
  } | null;
  delta: {
    net: number;
    gv: number;
    damga: number;
    gross?: number;
    meal?: number;
    transport?: number;
    overtime?: number;
    bes?: number;
  } | null;
  lineItems?: LineItem[];
};

export type ComparisonUi = {
  title: string;
  lead: string;
  verdict: string;
  deltaChartCaption?: string;
  gvCompareTitle?: string;
  footer?: string;
  personCaption?: string;
  gvBullets?: string[];
  drivers?: { title: string; body: string }[];
};

export type ComparisonData = {
  generatedAt: string;
  period: string;
  unit: string;
  lucaPdfVersion?: string;
  ui?: ComparisonUi;
  sources: { lucaPdf: string; dhrExcel: string };
  summary: {
    lucaCount: number;
    dhrCount: number;
    matched: number;
    netWithin100: number;
    avgAbsNetDelta: number | null;
    fmHoursTotalLuca: number | null;
    mealOnLuca?: number;
    overtimeOnLuca?: number;
    besOnLuca?: number;
  };
  lineDefs?: { key: string; label: string; group: string }[];
  kalemler?: KalemAgg[];
  rows: CompareRow[];
  legal: {
    gvMonthly2026: { month: string; exempt: number; rate: number }[];
    dhrObserved: { exemptApplied: number; paramFormulaValue: number; allMonthsSame: boolean };
    lucaObserved: { exemptApplied: number; octoberLegal: number };
  };
};

export function tr(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function tr0(n: number | null | undefined): string {
  return tr(n, 0);
}
