export type OcakBug = {
  id: string;
  title: string;
  ekimStatus: string;
  ocakStatus: string;
  ocakDetail: string;
};

export type OcakWarning = {
  id: string;
  severity: "info" | "warn" | "error" | string;
  title: string;
  detail: string;
};

export type OcakRow = {
  sicil: string;
  name: string;
  ocak: {
    salary: number;
    meal: number;
    transport: number;
    overtime: number;
    prim: number;
    ikramiye: number;
    masraf: number;
    gross: number;
    net: number;
    gv: number;
    gvExemption: number;
    gvBrut: number | null;
    damga: number;
    damgaExemption: number;
    sgk: number;
    unemployment: number;
    bes: number;
    sgkIsveren: number;
    issizlikIsveren: number;
    isverenMaliyeti: number;
    incentiveTotal: number;
    advance: number;
    kesintilerToplami: number;
    gvTabiKazanc: number;
    primeEsasKazanc: number;
    damgaBazi: number;
    cumGvBase: number | null;
    cumGvTax: number | null;
    sgkDays?: number | null;
    workedDays?: number | null;
    missingDays?: number | null;
    gvTechnopark?: number | null;
  };
  ekim: {
    net: number;
    gv: number;
    bes: number;
    gross: number;
    salary: number | null;
    damga: number;
    sgk: number | null;
  } | null;
  delta: {
    net: number;
    gv: number;
    bes: number;
  } | null;
};

export type OcakData = {
  generatedAt: string;
  period: string;
  environment: string;
  periodId: string;
  summary: {
    count: number;
    avgNet: number;
    totalNet: number;
    gvExemptionAppliedCount: number;
    besCount: number;
    fmCount: number;
    bugsFixed: number;
    bugsStillBroken: number;
  };
  bugs: OcakBug[];
  warnings?: OcakWarning[];
  rows: OcakRow[];
};
