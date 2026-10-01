import { useEffect, useMemo, useState } from "react";
import AppView from "./App";
import { Money, Section } from "./ui";
import { tr } from "./types";
import type { ComparisonData } from "./types";
import type { MatrixData } from "./matrixTypes";
import type { YillikData, YillikMonthFile, YillikPay } from "./yillikTypes";
import { buildYillikMonthCompare } from "./yillikCompare";
import index from "./data/yillik_ik.json";

type Metric = keyof YillikPay;
type Sub = "ozet" | number;

const data = index as YillikData;

const MONTH_TOTAL_COLS: { key: Metric; label: string }[] = [
  { key: "gross", label: "Brüt" },
  { key: "net", label: "Net" },
  { key: "gv", label: "GV" },
  { key: "damga", label: "Damga" },
  { key: "sgk", label: "SGK işçi" },
  { key: "overtime", label: "FM" },
  { key: "prim", label: "Prim" },
  { key: "ikramiye", label: "İkramiye" },
  { key: "advance", label: "Avans" },
  { key: "kesinti", label: "Kesinti" },
  { key: "employerCost", label: "İşveren maliyeti" },
];

function loadMonth(month: number): Promise<{ default: YillikMonthFile }> {
  switch (month) {
    case 1:
      return import("./data/yillik/m01.json");
    case 2:
      return import("./data/yillik/m02.json");
    case 3:
      return import("./data/yillik/m03.json");
    case 4:
      return import("./data/yillik/m04.json");
    case 5:
      return import("./data/yillik/m05.json");
    case 6:
      return import("./data/yillik/m06.json");
    case 7:
      return import("./data/yillik/m07.json");
    case 8:
      return import("./data/yillik/m08.json");
    case 9:
      return import("./data/yillik/m09.json");
    case 10:
      return import("./data/yillik/m10.json");
    case 11:
      return import("./data/yillik/m11.json");
    case 12:
      return import("./data/yillik/m12.json");
    default:
      return Promise.reject(new Error(`Ay yok: ${month}`));
  }
}

type Props = {
  ocak: ComparisonData;
  ocakMatrix: MatrixData;
  ekim: ComparisonData;
  ekimMatrix: MatrixData;
};

type MonthBundle = { data: ComparisonData; matrix: MatrixData };

export default function YillikView({ ocak, ocakMatrix, ekim, ekimMatrix }: Props) {
  const [sub, setSub] = useState<Sub>("ozet");
  const [bundle, setBundle] = useState<MonthBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (sub === "ozet") {
      setBundle(null);
      setLoading(false);
      setLoadError(null);
      return;
    }
    if (sub === 1) {
      setBundle({ data: ocak, matrix: ocakMatrix });
      setLoading(false);
      setLoadError(null);
      return;
    }
    if (sub === 10) {
      setBundle({ data: ekim, matrix: ekimMatrix });
      setLoading(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadMonth(sub)
      .then((mod) => {
        if (cancelled) return;
        const meta = data.months[sub - 1];
        const built = buildYillikMonthCompare({
          monthFile: mod.default,
          meta,
          people: data.people,
          generatedAt: data.generatedAt,
          unit: data.unit,
          template: ocakMatrix,
        });
        setBundle(built);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBundle(null);
        setLoading(false);
        setLoadError(err instanceof Error ? err.message : "Ay yüklenemedi");
      });
    return () => {
      cancelled = true;
    };
  }, [sub, ocak, ocakMatrix, ekim, ekimMatrix]);

  const y = data.totals.year;
  const lastCalc = data.months.reduce(
    (a, m) => (m.lastCalculatedAt && (!a || m.lastCalculatedAt > a) ? m.lastCalculatedAt : a),
    "",
  );

  const monthTabs = useMemo(
    () => (
      <nav className="subtabs year-months" aria-label="2026 ayları">
        <button
          type="button"
          className={sub === "ozet" ? "active" : ""}
          aria-current={sub === "ozet" ? "page" : undefined}
          onClick={() => setSub("ozet")}
        >
          Özet
        </button>
        {data.months.map((m) => (
          <button
            key={m.month}
            type="button"
            className={sub === m.month ? "active" : ""}
            aria-current={sub === m.month ? "page" : undefined}
            onClick={() => setSub(m.month)}
          >
            {m.label}
            {m.month === 1 || m.month === 10 ? <span className="count">Luca</span> : null}
          </button>
        ))}
      </nav>
    ),
    [sub],
  );

  if (sub !== "ozet") {
    return (
      <div className="page yillik-page">
        {monthTabs}
        {loading ? (
          <p className="muted year-loading">Ay yükleniyor…</p>
        ) : loadError ? (
          <p className="muted year-loading">{loadError}</p>
        ) : bundle ? (
          <AppView key={sub} data={bundle.data} matrix={bundle.matrix} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="page compare">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">dhrtest2 · {data.unit} · DHR × Luca × YZ</p>
          <h1>2026 yıllık bordro — özet</h1>
          <p className="lead">
            12 ay ayrı sekmelerde; Ocak ve Ekim diğer testlerle aynı DHR × Luca × YZ JSON’u. Luca PDF yalnız
            Ocak ve Ekim’de var, diğer aylarda Luca bekliyor. Hakem YZ (aylık izole 2026 mevzuatı).
          </p>
          <p className="meta">
            Üretim: {new Date(data.generatedAt).toLocaleString("tr-TR")}
            {lastCalc ? ` · Son hesap: ${new Date(lastCalc).toLocaleString("tr-TR")}` : ""}
          </p>
        </div>
      </header>

      {monthTabs}

      <section className="stats">
        <div className="stat">
          <div className="stat-value">{data.people.length}</div>
          <div className="stat-label">Çalışan</div>
        </div>
        <div className="stat">
          <div className="stat-value">12</div>
          <div className="stat-label">Hesaplanan ay</div>
        </div>
        <div className="stat ok">
          <div className="stat-value">{tr(y.net, 0)}</div>
          <div className="stat-label">Yıl net (TL)</div>
        </div>
        <div className="stat">
          <div className="stat-value">{tr(y.gross, 0)}</div>
          <div className="stat-label">Yıl brüt (TL)</div>
        </div>
        <div className="stat warn">
          <div className="stat-value">{tr(y.gv, 0)}</div>
          <div className="stat-label">Yıl GV (TL)</div>
        </div>
        <div className="stat">
          <div className="stat-value">{tr(y.overtime, 0)}</div>
          <div className="stat-label">Yıl fazla mesai (TL)</div>
        </div>
      </section>

      <Section
        collapsible={false}
        title="Aylık birim toplamları"
        caption="Satıra tıklayınca o ayın DHR × Luca × YZ karşılaştırması açılır. Luca PDF yalnız Ocak ve Ekim’de; diğer aylarda Durum = BEKLİYOR."
      >
        <div className="table-scroll flow">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="left">Ay</th>
                {MONTH_TOTAL_COLS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.months.map((m, i) => (
                <tr key={m.periodId} className="year-row-link" onClick={() => setSub(m.month)}>
                  <td className="left">
                    <button type="button" className="linkish">
                      {m.label}
                    </button>
                    <span className="muted small">
                      {" "}
                      · {m.people} kişi · {m.month === 1 || m.month === 10 ? "DHR × Luca × YZ" : "DHR × YZ (Luca bekliyor)"}
                    </span>
                  </td>
                  {MONTH_TOTAL_COLS.map((c) => (
                    <td key={c.key}>
                      <Money value={data.totals.months[i][c.key]} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="left">
                  <strong>Yıl</strong>
                </td>
                {MONTH_TOTAL_COLS.map((c) => (
                  <td key={c.key}>
                    <strong>
                      <Money value={y[c.key]} />
                    </strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
