import { useState } from "react";
import AppView from "./App";
import type { ComparisonData } from "./types";
import type { MatrixData } from "./matrixTypes";
import type { Faz1DhrLab, Faz1LabCard, Faz1Roster } from "./faz1Types";
import dhrLab from "./data/faz1_dhr_lab.json";

type SubTab = "manuel" | "yz" | "yuv" | "op" | "kenar" | "takvim" | "blokaj";

type Props = {
  roster: Faz1Roster;
  comparison: ComparisonData;
  matrix: MatrixData;
  yuvarlamaComparison: ComparisonData;
  yuvarlamaMatrix: MatrixData;
  operasyonComparison: ComparisonData;
  operasyonMatrix: MatrixData;
  kenarComparison: ComparisonData;
  kenarMatrix: MatrixData;
  takvimComparison: ComparisonData;
  takvimMatrix: MatrixData;
  blokajComparison: ComparisonData;
  blokajMatrix: MatrixData;
};

function LabCard({ card }: { card: Faz1LabCard }) {
  const kind = card.status === "hazır" ? "ready" : "manual";
  return (
    <article className={`lab-card lab-${kind}`}>
      <div className="lab-card-head">
        <span className={`lab-badge lab-badge-${kind}`}>{card.status === "hazır" ? "DHR’de hazır" : "Manuel dene"}</span>
        {card.sicil ? <span className="mono small">{card.sicil}</span> : null}
      </div>
      <h3>{card.title}</h3>
      {card.login ? (
        <p className="muted small">
          Giriş: <code>{card.login}</code>
        </p>
      ) : null}
      {card.where ? <p className="small lab-where">Nerede: {card.where}</p> : null}
      <p>
        <strong>Şimdi: </strong>
        {card.now}
      </p>
      <p>
        <strong>İstediğimiz: </strong>
        {card.want}
      </p>
      {card.try?.length ? (
        <ol className="lab-try">
          {card.try.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      {card.success || card.fail ? (
        <p className="small lab-verdict">
          {card.success ? (
            <>
              <strong>Olursa: </strong>
              {card.success}{" "}
            </>
          ) : null}
          {card.fail ? (
            <>
              <strong>Olmazsa: </strong>
              {card.fail}
            </>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}

export default function Faz1View({
  roster,
  comparison,
  matrix,
  yuvarlamaComparison,
  yuvarlamaMatrix,
  operasyonComparison,
  operasyonMatrix,
  kenarComparison,
  kenarMatrix,
  takvimComparison,
  takvimMatrix,
  blokajComparison,
  blokajMatrix,
}: Props) {
  const [tab, setTab] = useState<SubTab>("yz");
  const hasCompare = (comparison.rows || []).length > 0;
  const hasYuv = (yuvarlamaComparison.rows || []).length > 0;
  const hasOp = (operasyonComparison.rows || []).length > 0;
  const hasKenar = (kenarComparison.rows || []).length > 0;
  const hasTakvim = (takvimComparison.rows || []).length > 0;
  const hasBlokaj = (blokajComparison.rows || []).length > 0;
  const lab = dhrLab as Faz1DhrLab;

  const subTabs: { id: SubTab; label: string; count?: number }[] = [
    { id: "yz", label: "Ana Kadro DHR × Luca × YZ", count: hasCompare ? comparison.rows.length : undefined },
    { id: "yuv", label: "Yuvarlama DHR × Luca × YZ", count: hasYuv ? yuvarlamaComparison.rows.length : roster.counts.yuvarlama },
    { id: "op", label: "Operasyon DHR × Luca × YZ", count: hasOp ? operasyonComparison.rows.length : roster.counts.operasyon },
    { id: "kenar", label: "Kenar DHR × Luca × YZ", count: hasKenar ? kenarComparison.rows.length : roster.counts.kenar },
    { id: "takvim", label: "Takvim DHR × Luca × YZ", count: hasTakvim ? takvimComparison.rows.length : roster.counts.takvim },
    { id: "blokaj", label: "Blokaj DHR × Luca × YZ", count: hasBlokaj ? blokajComparison.rows.length : roster.counts.blokaj },
    { id: "manuel", label: "Manuel dene", count: lab.ready.length + lab.manual.length },
  ];

  const compareTabs: SubTab[] = ["yz", "yuv", "op", "kenar", "takvim", "blokaj"];
  const showLabHeader = !compareTabs.includes(tab);

  return (
    <div className="page">
      {showLabHeader && (
        <>
          <header className="hero">
            <div className="hero-inner">
              <p className="eyebrow">dhrtest2 · Faz 1 Bordro Laboratuvarı</p>
              <h1>{comparison.ui?.title || "Eylül 2026 — Faz 1"}</h1>
              <p className="meta">
                Ortam: {roster.environment} · Şifre: <code>{roster.password}</code> · Login{" "}
                {roster.counts.totalLogins} kişi
              </p>
            </div>
          </header>

          <section className="stats" aria-label="Faz 1 sayılar">
            <div className="stat ok">
              <div className="stat-value">{roster.counts.anaAktif}</div>
              <div className="stat-label">Ana aktif (15’lik)</div>
            </div>
            <div className="stat">
              <div className="stat-value">{roster.counts.anaPasif}</div>
              <div className="stat-label">Ana pasif</div>
            </div>
            <div className="stat">
              <div className="stat-value">{roster.counts.kenar}</div>
              <div className="stat-label">Kenar</div>
            </div>
            <div className="stat">
              <div className="stat-value">{roster.counts.yuvarlama}</div>
              <div className="stat-label">Yuvarlama</div>
            </div>
          </section>
        </>
      )}

      <nav className="subtabs" aria-label="Faz 1 bölümleri">
        {subTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count != null ? <span className="count">{t.count}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "manuel" && (
      <section id="manuel" className="panel">
        <h2>DHR’de ne var / manuel ne denemelisin</h2>
        <p className="muted small">
          {lab.adminHint} Ortam: <code>{lab.environment}</code>
        </p>
        <p className="muted small isolation-note">
          {roster.isolation.ik} · {roster.isolation.bt} · {roster.isolation.laws}
        </p>
        <h3 className="lab-sub">Hazır (tekrar seed etme)</h3>
        <div className="lab-grid">
          {lab.ready.map((card) => (
            <LabCard key={card.id} card={card} />
          ))}
        </div>
        <h3 className="lab-sub">Bunları UI’den dene</h3>
        <div className="lab-grid lab-grid-wide">
          {lab.manual.map((card) => (
            <LabCard key={card.id} card={card} />
          ))}
        </div>
      </section>
      )}

      {tab === "yz" &&
        (hasCompare ? (
          <div id="yz-karsilastirma">
            <AppView data={comparison} matrix={matrix} />
          </div>
        ) : (
          <section className="panel">
            <h2>DHR × Luca</h2>
            <p className="muted">
              {comparison.ui?.verdict || "Export henüz yok."} İK karşılaştırması Ekim ve Ocak
              sekmelerinde kalır.
            </p>
          </section>
        ))}

      {tab === "yuv" &&
        (hasYuv ? (
          <div id="yuv-karsilastirma">
            <AppView data={yuvarlamaComparison} matrix={yuvarlamaMatrix} />
          </div>
        ) : (
          <section className="panel">
            <h2>Yuvarlama — DHR × Luca × YZ</h2>
            <p className="muted">Yuvarlama 100 karşılaştırma verisi henüz yok.</p>
          </section>
        ))}

      {tab === "op" &&
        (hasOp ? (
          <div id="op-karsilastirma">
            <AppView data={operasyonComparison} matrix={operasyonMatrix} />
          </div>
        ) : (
          <section className="panel">
            <h2>Operasyon — DHR × YZ</h2>
            <p className="muted">Operasyon karşılaştırma verisi henüz yok. Luca bilgisi bekleniyor.</p>
          </section>
        ))}

      {tab === "kenar" &&
        (hasKenar ? (
          <div id="kenar-karsilastirma">
            <AppView data={kenarComparison} matrix={kenarMatrix} />
          </div>
        ) : (
          <section className="panel">
            <h2>Kenar — DHR × Luca × YZ</h2>
            <p className="muted">Kenar karşılaştırma verisi henüz yok.</p>
          </section>
        ))}

      {tab === "takvim" &&
        (hasTakvim ? (
          <div id="takvim-karsilastirma">
            <AppView data={takvimComparison} matrix={takvimMatrix} />
          </div>
        ) : (
          <section className="panel">
            <h2>Takvim — DHR × YZ</h2>
            <p className="muted">Takvim karşılaştırma verisi henüz yok. Luca bilgisi bekleniyor.</p>
          </section>
        ))}

      {tab === "blokaj" &&
        (hasBlokaj ? (
          <div id="blokaj-karsilastirma">
            <AppView data={blokajComparison} matrix={blokajMatrix} />
          </div>
        ) : (
          <section className="panel">
            <h2>Blokaj — DHR × YZ</h2>
            <p className="muted">Blokaj karşılaştırma verisi henüz yok. Luca bilgisi bekleniyor.</p>
          </section>
        ))}
    </div>
  );
}
