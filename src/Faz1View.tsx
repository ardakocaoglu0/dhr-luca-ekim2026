import { useMemo, useState } from "react";
import AppView from "./App";
import type { ComparisonData } from "./types";
import { tr0 } from "./types";
import type { MatrixData } from "./matrixTypes";
import type { Faz1DhrLab, Faz1LabCard, Faz1Person, Faz1Roster } from "./faz1Types";
import dhrLab from "./data/faz1_dhr_lab.json";
import { Section, Tags } from "./ui";

type SubTab = "manuel" | "kadro" | "eslemeler" | "kosum" | "yz";

type Props = {
  roster: Faz1Roster;
  comparison: ComparisonData;
  matrix: MatrixData;
};

const UNIT_LABEL: Record<string, string> = {
  lab: "Laboratuvar",
  ana: "Ana Kadro",
  operasyon: "Operasyon",
  kenar: "Kenar",
  yuvarlama: "Yuvarlama",
  takvim: "Takvim",
  blokaj: "Blokaj",
  "sirket-b": "Şirket B",
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

function PersonRow({ p }: { p: Faz1Person }) {
  return (
    <tr>
      <td className="mono sticky-col sticky-edge">{p.sicil}</td>
      <td className="left">
        <div>{p.name}</div>
        <div className="muted small">{p.email}</div>
      </td>
      <td>{UNIT_LABEL[p.unit] || p.unit}</td>
      <td>{p.profile}</td>
      <td className="num mono">{tr0(p.maas)}</td>
      <td className="small">
        <Tags items={p.tv} />
      </td>
      <td className="small">
        <Tags items={p.pay} />
      </td>
      <td className="small">
        <Tags items={p.edge} />
      </td>
      <td className="small clamp2">
        <span title={p.note}>{p.note}</span>
      </td>
    </tr>
  );
}

export default function Faz1View({ roster, comparison, matrix }: Props) {
  const [unit, setUnit] = useState("all");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<SubTab>("yz");
  const hasCompare = (comparison.rows || []).length > 0;

  const unitCounts = useMemo(() => {
    const map = new Map<string, number>();
    roster.people.forEach((p) => map.set(p.unit, (map.get(p.unit) || 0) + 1));
    return map;
  }, [roster.people]);

  const people = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return roster.people.filter((p) => {
      if (unit !== "all" && p.unit !== unit) return false;
      if (!needle) return true;
      const hay = [p.sicil, p.name, p.email, p.profile, p.note, ...(p.tv || []), ...(p.pay || []), ...(p.edge || [])]
        .join(" ")
        .toLocaleLowerCase("tr");
      return hay.includes(needle);
    });
  }, [roster.people, unit, q]);

  const tvEntries = Object.entries(roster.tvMap).sort(([a], [b]) => a.localeCompare(b, "tr"));
  const edgeEntries = Object.entries(roster.edgeMap).sort(([a], [b]) => a.localeCompare(b, "tr"));
  const lab = dhrLab as Faz1DhrLab;

  const subTabs: { id: SubTab; label: string; count?: number }[] = [
    { id: "yz", label: "Luca YZ DHR karşılaştırma", count: hasCompare ? comparison.rows.length : undefined },
    { id: "manuel", label: "Manuel dene", count: lab.ready.length + lab.manual.length },
    { id: "kadro", label: "Kadro", count: roster.people.length },
    { id: "eslemeler", label: "Eşlemeler", count: tvEntries.length + edgeEntries.length },
    { id: "kosum", label: "Koşum", count: roster.kosumOrder.length },
  ];

  // The YZ tab renders its own hero and stats; the lab header would only repeat it.
  const showLabHeader = tab !== "yz";

  return (
    <div className="page">
      {showLabHeader && (
        <>
          <header className="hero">
            <div className="hero-inner">
              <p className="eyebrow">dhrtest · Faz 1 Bordro Laboratuvarı</p>
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

      {tab === "kadro" && (
      <section id="kadro" className="panel">
        <div className="card-head">
          <h2>Kadro</h2>
          <div className="faz1-filters">
            <label>
              Birim
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="all">Tümü</option>
                {roster.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ara
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="sicil, ad, TV-06, EDGE-037…"
              />
            </label>
          </div>
        </div>
        <div className="filter-chips" role="group" aria-label="Birim filtresi">
          <button
            type="button"
            className={`filter-chip ${unit === "all" ? "active" : ""}`}
            onClick={() => setUnit("all")}
          >
            Tümü <b>{roster.people.length}</b>
          </button>
          {roster.units.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`filter-chip ${unit === u.id ? "active" : ""}`}
              onClick={() => setUnit(u.id)}
            >
              {u.name} <b>{unitCounts.get(u.id) || 0}</b>
            </button>
          ))}
        </div>
        <p className="muted small">
          {people.length} kişi · birim ağacı: Lab → Ana + Operasyon; Kenar / Yuvarlama / Takvim / Blokaj D1 kardeşi.
        </p>
        <div className="table-scroll tall">
          <table className="faz1-table sticky-name">
            <colgroup>
              <col style={{ width: "5.5rem" }} />
              <col style={{ width: "13rem" }} />
              <col style={{ width: "7rem" }} />
              <col style={{ width: "9rem" }} />
              <col style={{ width: "6rem" }} />
              <col span={3} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th className="sticky-col sticky-edge">Sicil</th>
                <th className="left">Ad</th>
                <th>Birim</th>
                <th>Profil</th>
                <th className="num">Brüt</th>
                <th>TV</th>
                <th>PAY</th>
                <th>EDGE</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <PersonRow key={p.sicil} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {tab === "eslemeler" && (
        <>
          <Section id="tv" title="TV-01…22" hint={`${tvEntries.length} eşleme`} defaultOpen={false}>
            <div className="map-grid">
              {tvEntries.map(([k, sicils]) => (
                <div key={k} className="map-item">
                  <strong>{k}</strong>
                  <span title={sicils.join(", ")}>{sicils.join(", ")}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section
            id="edge"
            title="EDGE eşlemesi"
            hint={`${edgeEntries.length} eşleme`}
            defaultOpen={false}
          >
            <div className="map-grid">
              {edgeEntries.map(([k, sicils]) => (
                <div key={k} className="map-item">
                  <strong>{k}</strong>
                  <span title={sicils.join(", ")}>{sicils.join(", ")}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {tab === "kosum" && (
      <section id="kosum" className="panel">
        <h2>Koşum sırası</h2>
        <ol className="kosum-list">
          {roster.kosumOrder.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
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
    </div>
  );
}
