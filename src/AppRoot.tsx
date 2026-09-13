import { useState } from "react";
import AppView from "./App";
import Faz1View from "./Faz1View";
import LoginsView from "./LoginsView";
import ocak from "./data/comparison.json";
import ocakMatrix from "./data/matrix.json";
import ekim from "./data/ekim_comparison.json";
import ekimMatrix from "./data/ekim_matrix.json";
import faz1 from "./data/faz1_comparison.json";
import faz1Matrix from "./data/faz1_matrix.json";
import faz1Roster from "./data/faz1_roster.json";
import logins from "./data/logins.json";
import type { ComparisonData } from "./types";
import type { MatrixData } from "./matrixTypes";
import type { Faz1Roster, LoginsData } from "./faz1Types";

type Tab = "ekim" | "ocak" | "faz1" | "girisler";

export default function App() {
  const [tab, setTab] = useState<Tab>("faz1");

  return (
    <>
      <div className="app-shell">
        <div className="app-shell-inner">
          <p className="brand">
            <strong>dhrtest</strong> Bordro karşılaştırma
          </p>
          <nav className="tab-bar" aria-label="Dönem">
            <button className={tab === "ekim" ? "active" : ""} onClick={() => setTab("ekim")}>
              Ekim 2026
            </button>
            <button className={tab === "ocak" ? "active" : ""} onClick={() => setTab("ocak")}>
              Ocak 2026
            </button>
            <button className={tab === "faz1" ? "active" : ""} onClick={() => setTab("faz1")}>
              Eylül 2026 — Faz 1
            </button>
            <button className={tab === "girisler" ? "active" : ""} onClick={() => setTab("girisler")}>
              Girişler
            </button>
          </nav>
          <p className="source-key" aria-label="Kaynak renk anahtarı">
            <span className="key-dhr">
              <i /> DHR
            </span>
            <span className="key-luca">
              <i /> Luca
            </span>
            <span className="key-yz">
              <i /> YZ — 2026 TR mevzuatı
            </span>
          </p>
        </div>
      </div>
      {tab === "ekim" ? (
        <AppView data={ekim as ComparisonData} matrix={ekimMatrix as MatrixData} />
      ) : tab === "ocak" ? (
        <AppView data={ocak as ComparisonData} matrix={ocakMatrix as MatrixData} />
      ) : tab === "faz1" ? (
        <Faz1View
          roster={faz1Roster as Faz1Roster}
          comparison={faz1 as ComparisonData}
          matrix={faz1Matrix as MatrixData}
        />
      ) : (
        <LoginsView data={logins as LoginsData} />
      )}
    </>
  );
}
