export type DashboardPeriod = {
  id: string;
  label: string;
  unit: string;
  people: number;
  state: string;
  compare: string;
};

export type DashboardWork = {
  id: string;
  title: string;
  detail: string;
  periods: string[];
  area: string;
};

export type DashboardBug = {
  id: string;
  title: string;
  severity: "Yüksek" | "Orta" | "Düşük" | string;
  detail: string;
  periods: string[];
  impact: string;
  area: string;
};

export type DashboardDispute = { id: string; title: string; detail: string };

export type DashboardUntested = {
  id: string;
  title: string;
  detail: string;
  blocker: string;
  area: string;
};

export type DashboardData = {
  generatedAt: string;
  environment: string;
  sourceNote: string;
  periods: DashboardPeriod[];
  works: DashboardWork[];
  bugs: DashboardBug[];
  disputes: DashboardDispute[];
  untested: DashboardUntested[];
};
