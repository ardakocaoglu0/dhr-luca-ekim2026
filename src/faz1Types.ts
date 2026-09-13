export type Faz1Leave = {
  type: string;
  start: string;
  end: string;
  sameDayWork?: boolean;
};

export type Faz1Person = {
  sicil: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  password: string;
  gender: string;
  title: string;
  unit: string;
  group: string;
  profile: string;
  law: string | null;
  tax: string | null;
  salaryType: number;
  hire: string;
  exit: string | null;
  note: string;
  tv: string[];
  pay: string[];
  edge: string[];
  pnt035: string | null;
  leaves: Faz1Leave[];
  maas: number;
  yemek: number;
  yol: number;
  skipSgk?: boolean;
};

export type Faz1Unit = {
  id: string;
  name: string;
  parent: string | null;
  periodRole: string;
};

export type Faz1Roster = {
  period: string;
  environment: string;
  password: string;
  isolation: Record<string, string>;
  units: Faz1Unit[];
  counts: Record<string, number>;
  people: Faz1Person[];
  tvMap: Record<string, string[]>;
  payMap: Record<string, string[]>;
  edgeMap: Record<string, string[]>;
  kosumOrder: string[];
};

export type LoginPerson = {
  sicil: string;
  name: string;
  email: string;
  password: string;
  profile?: string;
  note?: string;
  unit?: string;
  group?: string;
};

export type LoginGroup = {
  id: string;
  title: string;
  people: LoginPerson[];
};

export type LoginsData = {
  environment: string;
  note: string;
  groups: LoginGroup[];
};

export type Faz1LabCard = {
  id: string;
  title: string;
  status: string;
  sicil?: string;
  login?: string;
  where?: string;
  now: string;
  want: string;
  try?: string[];
  success?: string;
  fail?: string;
};

export type Faz1DhrLab = {
  updatedAt: string;
  environment: string;
  adminHint: string;
  ready: Faz1LabCard[];
  manual: Faz1LabCard[];
};
