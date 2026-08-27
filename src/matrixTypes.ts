export type MatrixStatus = "pass" | "fail" | "partial" | "known";

export type MatrixData = {
  period: string;
  environment: string;
  sourceOfTruth: string;
  matrixDesign: {
    layers: { id: string; title: string; desc: string }[];
    notFullCombinatorial: string;
  };
  checkedItems: { item: string; result: MatrixStatus; note: string }[];
  correctFindings: string[];
  dhrBugs: { id: string; title: string; severity: string; detail: string }[];
  scenarios: {
    n: number;
    name: string;
    group: string;
    scenario: string;
    profile: string;
    law: string;
    input: string;
    dhr: MatrixStatus;
    luca: MatrixStatus;
    verdict: string;
  }[];
};
