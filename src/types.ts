export type CompareRow = {
  n?: number;
  name: string;
  tc: string;
  note: string;
  profile: string;
  lucaKanunExpected?: string;
  luca: {
    kanun: string;
    ucret: number;
    topKaz: number;
    digKaz: number;
    gv: number;
    damga: number;
    net: number;
    tgun: number;
    digText: string;
    ozText: string;
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
  } | null;
  delta: { net: number; gv: number; damga: number } | null;
};

export type ComparisonData = {
  generatedAt: string;
  period: string;
  unit: string;
  sources: { lucaPdf: string; dhrExcel: string };
  summary: {
    lucaCount: number;
    dhrCount: number;
    matched: number;
    netWithin100: number;
    avgAbsNetDelta: number | null;
    fmHoursTotalLuca: number | null;
  };
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
