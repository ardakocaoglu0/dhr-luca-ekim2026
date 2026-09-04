import { useState } from "react";
import AppView from "./App";
import ocak from "./data/comparison.json";
import ocakMatrix from "./data/matrix.json";
import ekim from "./data/ekim_comparison.json";
import ekimMatrix from "./data/ekim_matrix.json";
import type { ComparisonData } from "./types";
import type { MatrixData } from "./matrixTypes";

type Tab = "ekim" | "ocak";

export default function App() {
  const [tab, setTab] = useState<Tab>("ocak");

  return (
    <>
      <nav className="tab-bar">
        <button className={tab === "ekim" ? "active" : ""} onClick={() => setTab("ekim")}>
          Ekim 2026 — DHR vs Luca
        </button>
        <button className={tab === "ocak" ? "active" : ""} onClick={() => setTab("ocak")}>
          Ocak 2026 — DHR vs Luca
        </button>
      </nav>
      {tab === "ekim" ? (
        <AppView data={ekim as ComparisonData} matrix={ekimMatrix as MatrixData} />
      ) : (
        <AppView data={ocak as ComparisonData} matrix={ocakMatrix as MatrixData} />
      )}
    </>
  );
}
