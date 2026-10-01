export type YillikPay = {
  salary: number;
  meal: number;
  transport: number;
  overtime: number;
  overtimeNet: number;
  prim: number;
  ikramiye: number;
  masraf: number;
  kesinti: number;
  health: number;
  besEmployer: number;
  childAid: number;
  spouseAid: number;
  leaveAllowance: number;
  nafaka: number;
  icra: number;
  kidem: number;
  ihbar: number;
  rounding: number;
  gross: number;
  net: number;
  gv: number;
  damga: number;
  bes: number;
  sgk: number;
  unemployment: number;
  advance: number;
  sgkDays: number;
  missingDays: number;
  sgkBase: number;
  gvMatrah: number;
  gvExempt: number;
  gvCum: number;
  damgaExempt: number;
  employerCost: number;
  employerSgk: number;
  employerUnemp: number;
  disability: number;
  deductionTotal: number;
};

export type YillikMonthMeta = {
  month: number;
  label: string;
  short: string;
  periodId: string;
  lastCalculatedAt: string | null;
  people: number;
  status: number | null;
  stale: number | null;
};

export type YillikPerson = {
  n: number;
  sicil: string;
  name: string;
  tc: string;
  note: string;
  profile: string;
  year: YillikPay;
};

export type YillikData = {
  generatedAt: string;
  environment: string;
  unit: string;
  year: number;
  source: string;
  months: YillikMonthMeta[];
  people: YillikPerson[];
  totals: { months: YillikPay[]; year: YillikPay };
};

export type YillikMonthFile = {
  month: number;
  label: string;
  short: string;
  periodId: string;
  people: { sicil: string; pay: YillikPay }[];
};
