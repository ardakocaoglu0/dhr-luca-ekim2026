export type LineItem = {
  key: string;
  label: string;
  group: "kazanc" | "kesinti" | "ozet" | string;
  dhr: number | null;
  luca: number | null;
  ai?: number | null;
  delta: number | null;
  deltaDhrAi?: number | null;
  deltaLucaAi?: number | null;
  match: boolean;
  matchAi?: boolean;
};

export type KalemAgg = {
  key: string;
  label: string;
  group: string;
  dhrSum: number;
  lucaSum: number;
  aiSum?: number | null;
  deltaSum: number | null;
  deltaDhrAi?: number | null;
  deltaLucaAi?: number | null;
  peopleWithValue: number;
  matchCount: number;
  compared: number;
  matchAi?: number;
  comparedAi?: number;
  matchLucaAi?: number;
  comparedLucaAi?: number;
};

export type CompareRow = {
  n?: number;
  name: string;
  tc: string;
  sicil?: string;
  note: string;
  profile: string;
  input?: string;
  lucaKanunExpected?: string;
  luca: {
    kanun?: string;
    ucret?: number;
    topKaz?: number;
    digKaz?: number;
    gv: number | null;
    damga: number | null;
    net: number | null;
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
    saglik?: number | null;
    besEmployer?: number | null;
    sgkDays?: number | null;
    sgkBase?: number | null;
    gvMatrah?: number | null;
    gvExemptApplied?: number | null;
    damgaExemptApplied?: number | null;
    employerCost?: number | null;
  } | null;
  ai?: {
    salary?: number;
    meal?: number;
    transport?: number;
    overtime?: number;
    prim?: number;
    ikramiye?: number;
    masraf?: number;
    gross: number;
    sgk: number;
    unemployment: number;
    gv: number;
    damga: number;
    bes: number;
    advance?: number;
    kesinti?: number;
    net: number;
    gvMatrah?: number;
    gvExemptApplied?: number;
    notes?: string[];
  };
  lucaPending?: boolean;
  dhrPending?: boolean;
  delta: {
    net: number | null;
    gv: number | null;
    damga: number | null;
    gross?: number;
    meal?: number;
    transport?: number;
    overtime?: number;
    bes?: number;
    netAi?: number;
    gvAi?: number;
    netLucaAi?: number | null;
  } | null;
  lineItems?: LineItem[];
};

export type MismatchCause = {
  id: string;
  short?: string;
  title: string;
  detail: string;
  whichCorrect?: string;
  legalBasis?: string;
  expected?: boolean;
};

export type MismatchItem = {
  key: string;
  label: string;
  group: string;
  dhr: number | null;
  luca: number | null;
  delta: number | null;
  derived: boolean;
};

export type MismatchRow = {
  n?: number;
  name: string;
  note: string;
  netDelta: number | null;
  severity: "high" | "medium" | "low" | string;
  inputMismatchCount: number;
  items: MismatchItem[];
  causes: MismatchCause[];
};

export type MismatchSummary = {
  totalCompared: number;
  mismatchCount: number;
  fullMatchCount: number;
  netWithin100: number;
  netPass001?: number;
  passTolerance?: number;
  causeTally: (MismatchCause & { count: number })[];
  normalizations: string[];
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

export type AiFinding = {
  id: string;
  vs: string;
  result: string;
  detail: string;
};

export type ComparisonData = {
  generatedAt: string;
  period: string;
  unit: string;
  lucaPdfVersion?: string | null;
  pending?: { luca?: boolean; dhr?: boolean };
  ui?: ComparisonUi;
  sources: { lucaPdf: string; dhrExcel: string; aiMevzuat?: string };
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
    aiCount?: number;
    avgAbsNetDeltaAi?: number | null;
    netWithin100Ai?: number;
  };
  lineDefs?: { key: string; label: string; group: string }[];
  kalemler?: KalemAgg[];
  mismatches?: MismatchRow[];
  mismatchSummary?: MismatchSummary;
  rows: CompareRow[];
  legal: {
    gvMonthly2026: { month: string; exempt: number; rate: number }[];
    dhrObserved: { exemptApplied: number; paramFormulaValue: number; allMonthsSame: boolean };
    lucaObserved: { exemptApplied: number; octoberLegal: number };
  };
  aiReport?: {
    month: number;
    engine: string;
    disclaimer: string;
    findings: AiFinding[];
  };
};

export function tr(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function tr0(n: number | null | undefined): string {
  return tr(n, 0);
}
