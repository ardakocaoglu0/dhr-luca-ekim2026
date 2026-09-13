import { useMemo, useState } from "react";
import type { DashboardData } from "./dashboardTypes";
import { Section, SectionNav, Tags } from "./ui";

const SEVERITY_TONE: Record<string, string> = { Yüksek: "bad", Orta: "warn", Düşük: "ok" };

export default function DashboardView({ data }: { data: DashboardData }) {
  const [area, setArea] = useState("all");

  const areas = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of [...data.works, ...data.bugs, ...data.untested]) {
      map.set(item.area, (map.get(item.area) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const works = area === "all" ? data.works : data.works.filter((w) => w.area === area);
  const bugs = area === "all" ? data.bugs : data.bugs.filter((b) => b.area === area);
  const untested = area === "all" ? data.untested : data.untested.filter((u) => u.area === area);
  const high = data.bugs.filter((b) => b.severity === "Yüksek").length;

  const navItems = [
    { id: "dash-works", label: "Çalışanlar" },
    { id: "dash-bugs", label: "Buglar" },
    { id: "dash-untested", label: "Test edilmeyen" },
    { id: "dash-disputes", label: "İhtilaflar" },
    { id: "dash-periods", label: "Dönemler" },
  ];

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">dhrtest · DHR bordro durum panosu</p>
          <h1>DHR bordro: ne çalışıyor, ne bozuk, ne test edilmedi</h1>
          <p className="lead">{data.sourceNote}</p>
          <p className="meta">
            Ortam: {data.environment} · Güncelleme:{" "}
            {new Date(data.generatedAt).toLocaleString("tr-TR")}
          </p>
        </div>
      </header>

      <SectionNav items={navItems} />

      <section className="stats">
        <div className="stat ok">
          <div className="stat-value">{data.works.length}</div>
          <div className="stat-label">Doğrulanmış özellik</div>
        </div>
        <div className="stat bad">
          <div className="stat-value">{data.bugs.length}</div>
          <div className="stat-label">Açık bug ({high} yüksek)</div>
        </div>
        <div className="stat warn">
          <div className="stat-value">{data.untested.length}</div>
          <div className="stat-label">Test edilmeyen senaryo</div>
        </div>
        <div className="stat">
          <div className="stat-value">{data.periods.length}</div>
          <div className="stat-label">Karşılaştırılan dönem</div>
        </div>
      </section>

      <div className="filter-chips" role="group" aria-label="Alan filtresi">
        <button
          type="button"
          className={`filter-chip ${area === "all" ? "active" : ""}`}
          onClick={() => setArea("all")}
        >
          Tümü <b>{data.works.length + data.bugs.length + data.untested.length}</b>
        </button>
        {areas.map(([name, count]) => (
          <button
            key={name}
            type="button"
            className={`filter-chip ${area === name ? "active" : ""}`}
            onClick={() => setArea(name)}
          >
            {name} <b>{count}</b>
          </button>
        ))}
      </div>

      <Section
        id="dash-works"
        title="Sorunsuz çalışan özellikler"
        hint={`${works.length} madde`}
        caption="Bordro UI/API okumasıyla doğrulanan davranışlar. Dönem etiketi, hangi koşumda görüldüğünü gösterir."
      >
        <div className="table-scroll">
          <table className="dash-table">
            <colgroup>
              <col style={{ width: "22rem" }} />
              <col />
              <col style={{ width: "10rem" }} />
              <col style={{ width: "9rem" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="left">Özellik</th>
                <th className="left">Kanıt</th>
                <th className="left">Dönem</th>
                <th className="left">Alan</th>
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.id} className="ok">
                  <td className="left">
                    <strong>{w.title}</strong>
                  </td>
                  <td className="note left">{w.detail}</td>
                  <td className="left small">
                    <Tags items={w.periods} max={3} />
                  </td>
                  <td className="left small">{w.area}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="dash-bugs" title="Açık buglar" hint={`${bugs.length} bulgu`}>
        <div className="cards bugs">
          {bugs.map((b) => (
            <article key={b.id} className="card">
              <h3>
                <span className={`pill ${SEVERITY_TONE[b.severity] || "warn"}`}>{b.severity}</span>{" "}
                {b.title}
              </h3>
              <p>{b.detail}</p>
              <p className="note">
                <strong>Etki:</strong> {b.impact}
              </p>
              <p className="small">
                <Tags items={b.periods} max={3} /> <span className="muted">· {b.area}</span>
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        id="dash-untested"
        title="Hâlâ test edilmeyen senaryolar"
        hint={`${untested.length} senaryo`}
        caption="Kurulmuş ama koşulmamış ya da ürün kısıtı yüzünden doğrulanamamış senaryolar."
      >
        <div className="table-scroll">
          <table className="dash-table">
            <colgroup>
              <col style={{ width: "20rem" }} />
              <col />
              <col style={{ width: "20rem" }} />
              <col style={{ width: "9rem" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="left">Senaryo</th>
                <th className="left">İçerik</th>
                <th className="left">Neden bekliyor</th>
                <th className="left">Alan</th>
              </tr>
            </thead>
            <tbody>
              {untested.map((u) => (
                <tr key={u.id} className="warn">
                  <td className="left">
                    <strong>{u.title}</strong>
                  </td>
                  <td className="note left">{u.detail}</td>
                  <td className="note left">{u.blocker}</td>
                  <td className="left small">{u.area}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="dash-disputes"
        title="Mevzuat / tasarım kararı bekleyenler"
        hint={`${data.disputes.length} konu`}
        defaultOpen={false}
        caption="DHR ile Luca farklı davranıyor ama hangisinin doğru olduğu henüz karara bağlanmadı."
      >
        <div className="cards bugs">
          {data.disputes.map((d) => (
            <article key={d.id} className="card">
              <h3>
                <span className="pill ok">karar bekliyor</span> {d.title}
              </h3>
              <p>{d.detail}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="dash-periods" title="Karşılaştırılan dönemler" hint={`${data.periods.length} dönem`}>
        <div className="table-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th className="left">Dönem</th>
                <th className="left">Birim</th>
                <th className="num">Kişi</th>
                <th className="left">Durum</th>
                <th className="left">Karşılaştırma</th>
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p.id}>
                  <td className="left">
                    <strong>{p.label}</strong>
                  </td>
                  <td className="left">{p.unit}</td>
                  <td className="num">{p.people}</td>
                  <td className="note left">{p.state}</td>
                  <td className="left small">{p.compare}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
