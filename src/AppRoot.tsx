import { useState } from "react";
import AppView from "./App";
import OcakView from "./OcakView";
import raw from "./data/comparison.json";
import matrix from "./data/matrix.json";
import ocakRaw from "./data/ocak_comparison.json";
import type { ComparisonData } from "./types";
import type { MatrixData } from "./matrixTypes";
import type { OcakData } from "./ocakTypes";

type Tab = "ekim" | "ocak";

export default function App() {
  const [tab, setTab] = useState<Tab>("ocak");

  return (
    <div className="page">
      <nav className="tab-bar">
        <button className={tab === "ekim" ? "active" : ""} onClick={() => setTab("ekim")}>
          Ekim 2026 — DHR vs Luca
        </button>
        <button className={tab === "ocak" ? "active" : ""} onClick={() => setTab("ocak")}>
          Ocak 2026 — DHR UI Bordro &amp; Bug Raporu
        </button>
      </nav>
      {tab === "ekim" ? (
        <AppView data={raw as ComparisonData} matrix={matrix as MatrixData} />
      ) : (
        <OcakView data={ocakRaw as OcakData} />
      )}
    </div>
  );
}
