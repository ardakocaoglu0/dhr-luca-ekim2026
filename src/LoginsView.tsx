import { useMemo, useState } from "react";
import type { LoginGroup, LoginsData } from "./faz1Types";

type Props = { data: LoginsData };

function GroupTable({ group }: { group: LoginGroup }) {
  const [copied, setCopied] = useState("");

  function copy(key: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? "" : c)), 2000);
  }

  return (
    <section className="panel" id={`login-${group.id}`}>
      <div className="card-head">
        <h2>{group.title}</h2>
        <span className="pill">{group.people.length} hesap</span>
      </div>
      <div className="table-scroll">
        <table className="faz1-table sticky-name">
          <colgroup>
            <col style={{ width: "5.5rem" }} />
            <col style={{ width: "13rem" }} />
            <col />
            <col style={{ width: "10rem" }} />
            <col style={{ width: "10rem" }} />
            <col style={{ width: "6rem" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="sticky-col sticky-edge">Sicil</th>
              <th className="left">Ad</th>
              <th className="left">E-posta</th>
              <th className="left">Şifre</th>
              <th>Profil</th>
              <th className="center">Kopyala</th>
            </tr>
          </thead>
          <tbody>
            {group.people.map((p) => {
              const key = `${group.id}-${p.sicil}`;
              return (
                <tr key={key}>
                  <td className="mono sticky-col sticky-edge">{p.sicil}</td>
                  <td className="left">
                    <div>{p.name}</div>
                    {p.note ? <div className="muted small">{p.note}</div> : null}
                  </td>
                  <td className="mono">{p.email}</td>
                  <td className="mono">{p.password}</td>
                  <td>{p.profile || "—"}</td>
                  <td className="center">
                    <button
                      type="button"
                      className={`copy-btn ${copied === key ? "copied" : ""}`}
                      title="E-posta ve şifreyi kopyala"
                      onClick={() => copy(key, `${p.email}\t${p.password}`)}
                    >
                      {copied === key ? "Kopyalandı" : "Kopyala"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function LoginsView({ data }: Props) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLocaleLowerCase("tr");
  const groups = useMemo(() => {
    if (!needle) return data.groups;
    return data.groups
      .map((g) => ({
        ...g,
        people: g.people.filter((p) =>
          [p.sicil, p.name, p.email, p.profile, p.note, p.unit].join(" ").toLocaleLowerCase("tr").includes(needle)
        ),
      }))
      .filter((g) => g.people.length);
  }, [data.groups, needle]);

  const total = data.groups.reduce((n, g) => n + g.people.length, 0);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">dhrtest girişleri</p>
          <h1>Girişler</h1>
          <p className="lead">
            {data.note} Ortam: <code>{data.environment}</code>. {total} hesap. BT, Arda ve Sude listede yok.
          </p>
        </div>
      </header>

      <div className="login-bar">
        <label className="login-search">
          Ara
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="sicil, ad, e-posta…" />
        </label>
        <nav className="login-groups" aria-label="Gruplar">
          {data.groups.map((g) => (
            <a key={g.id} href={`#login-${g.id}`}>
              {g.title.split(" (")[0]} <b>{g.people.length}</b>
            </a>
          ))}
        </nav>
      </div>

      {groups.length === 0 ? (
        <section className="panel">
          <p className="muted">“{q}” için hesap bulunamadı.</p>
        </section>
      ) : (
        groups.map((g) => <GroupTable key={g.id} group={g} />)
      )}
    </div>
  );
}
