import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompareRow, ComparisonData } from "./types";
import { tr, tr0 } from "./types";
import type { MatrixData } from "./matrixTypes";

type Props = { data: ComparisonData; matrix: MatrixData };

const LEGAL_REFS = [
  {
    title: "Gelir Vergisi Kanunu (GVK) md. 23/18",
    desc: "Ücret gelirlerinde asgari ücret düzeyinde kalan kısım gelir vergisinden istisna edilir.",
    url: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=193&MevzuatTur=1&MevzuatTertip=5",
  },
  {
    title: "7352 sayılı Kanun (2022) — istisna uygulaması",
    desc: "Asgari ücret GV istisnası brüt asgari ücret × (1 − SGK/issizlik) × dilim oranı ile hesaplanır.",
    url: "https://www.resmigazete.gov.tr/",
  },
  {
    title: "2026 asgari ücret (33.030 TL brüt)",
    desc: "Resmi brüt asgari ücret; istisna matrahının temel girdisi.",
    url: "https://www.resmigazete.gov.tr/",
  },
  {
    title: "GİB — Gelir vergisi tarifesi",
    desc: "2026 yılı ücret gelirleri için uygulanacak vergi dilimleri.",
    url: "https://www.gib.gov.tr/vergi_daireleri/2026-yili-ucret-gelirlerinde-uygulanacak-vergi-tarifesi",
  },
];

export default function AppView({ data, matrix }: Props) {
  const rows = data.rows.filter((r) => r.dhr?.net != null);
  const topNet = [...rows]
    .sort((a, b) => Math.abs(b.delta!.net) - Math.abs(a.delta!.net))
    .slice(0, 12)
    .map((r) => ({
      name: r.name.split(" ")[0],
      full: r.name,
      dNet: Math.round(r.delta!.net),
    }));

  const passCount = matrix.checkedItems.filter((c) => c.result === "pass").length;
  const failCount = matrix.checkedItems.filter((c) => c.result === "fail").length;
  const lucaPass = matrix.scenarios.filter((s) => s.luca === "pass").length;
  const lucaFail = matrix.scenarios.filter((s) => s.luca === "fail").length;
  const lucaPartial = matrix.scenarios.filter((s) => s.luca === "partial").length;

  const gvCompare = [
    {
      label: "DHR uyguladığı",
      value: data.legal.dhrObserved.exemptApplied,
      fill: "#ef4444",
    },
    {
      label: "DHR parametre",
      value: data.legal.dhrObserved.paramFormulaValue,
      fill: "#f97316",
    },
    {
      label: "Luca (Ekim)",
      value: data.legal.lucaObserved.exemptApplied,
      fill: "#eab308",
    },
    {
      label: "Yasal Ekim 2026",
      value: data.legal.lucaObserved.octoberLegal,
      fill: "#22c55e",
    },
  ];

  const gvMonthly = data.legal.gvMonthly2026.map((m) => ({
    month: m.month,
    istisna: m.exempt,
    dhrParam: 4211.33,
    dhrApplied: 0,
  }));

  const drivers = [
    {
      title: "Kapsam farkı",
      body: "DHR brüte yemek (5.500) + yol (3.200) ekler; Luca topKaz genelde maaş + prim/FM.",
    },
    {
      title: "BES %3",
      body: "DHR otomatik BES kesintisi uygular; Luca puantajında çoğu kişide yok.",
    },
    {
      title: "GV istisnası",
      body: "DHR parametrede formül var ama fiilen 0; Luca ~4.211 TL; yasal Ekim 5.615 TL.",
    },
  ];

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">dhrtest × Luca · İnsan Kaynakları</p>
          <h1>DHR × Luca — Ekim 2026 Bordro Karşılaştırması</h1>
          <p className="lead">
            32 kişilik test matrisi: kanun/teşvik profilleri, ek kazanç ve kesintiler. Luca referans;
            DHR sapmaları yasal kaynaklarla birlikte görselleştirildi.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href={data.sources.lucaPdf} download>
              Luca PDF indir
            </a>
            <a className="btn" href={data.sources.dhrExcel} download>
              DHR Excel indir
            </a>
          </div>
          <p className="meta">
            Üretim: {new Date(data.generatedAt).toLocaleString("tr-TR")} · Eşleşen{" "}
            {data.summary.matched} kişi
          </p>
          <nav className="toc" aria-label="Bölümler">
            <a href="#matrix">Matris</a>
            <a href="#checks">Kontroller</a>
            <a href="#correct">Doğrular</a>
            <a href="#scenarios">32 senaryo</a>
            <a href="#legal">GV yasal</a>
            <a href="#people">Net karşılaştırma</a>
          </nav>
        </div>
      </header>

      <section className="stats">
        <Stat label="Eşleşen kişi" value={`${data.summary.matched}/${data.summary.lucaCount}`} />
        <Stat
          label="Net ±100 TL içinde"
          value={String(data.summary.netWithin100)}
          tone={data.summary.netWithin100 === 0 ? "bad" : "ok"}
        />
        <Stat label="Ort. |ΔNet|" value={`${tr0(data.summary.avgAbsNetDelta)} TL`} tone="warn" />
        <Stat
          label="Luca FM toplam saat"
          value={data.summary.fmHoursTotalLuca != null ? String(data.summary.fmHoursTotalLuca) : "—"}
          tone={data.summary.fmHoursTotalLuca === 0 ? "bad" : "ok"}
        />
      </section>

      <section className="panel verdict">
        <h2>Hüküm</h2>
        <p>
          Ham netler örtüşmüyor. Standart satırlarda tipik <strong>ΔGV ≈ +4.619 TL</strong> (DHR’de
          istisna fiilen 0 + yol matrahı). En büyük sapmalar: net ücret profili, FM/brüt ölçeği,
          yemek-yol ve BES.
        </p>
      </section>

      <section className="panel" id="matrix">
        <h2>Test matrisi tasarımı</h2>
        <p className="caption">
          {matrix.environment} · {matrix.sourceOfTruth}
        </p>
        <p>{matrix.matrixDesign.notFullCombinatorial}</p>
        <div className="cards three">
          {matrix.matrixDesign.layers.map((l) => (
            <article key={l.id} className="card">
              <h3>
                Grup {l.id} — {l.title}
              </h3>
              <p>{l.desc}</p>
            </article>
          ))}
        </div>
        <div className="stats compact">
          <Stat label="Kontrol geçti" value={`${passCount}`} tone="ok" />
          <Stat label="Kontrol fail" value={`${failCount}`} tone="bad" />
          <Stat label="Luca senaryo OK" value={`${lucaPass}/32`} tone="ok" />
          <Stat label="Luca fail / kısmi" value={`${lucaFail} / ${lucaPartial}`} tone="warn" />
        </div>
      </section>

      <section className="panel" id="checks">
        <h2>Kontrol edilenler</h2>
        <p className="caption">Bordro / puantaj / kart doğrulama checklist’i</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kontrol</th>
                <th>Sonuç</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {matrix.checkedItems.map((c) => (
                <tr key={c.item} className={toneOf(c.result)}>
                  <td className="left">{c.item}</td>
                  <td>
                    <Badge status={c.result} />
                  </td>
                  <td className="note left">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" id="correct">
        <h2>Doğru çalışanlar</h2>
        <ul className="ok-list">
          {matrix.correctFindings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <h3>DHR’de tespit edilen yasal / hesap sorunları</h3>
        <div className="cards bugs">
          {matrix.dhrBugs.map((b) => (
            <article key={b.id} className="card">
              <h3>
                <span className={`pill ${b.severity === "Yüksek" ? "bad" : "warn"}`}>{b.severity}</span>{" "}
                {b.title}
              </h3>
              <p>{b.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" id="scenarios">
        <h2>Test edilen tüm olasılıklar (32)</h2>
        <p className="caption">
          A = motor/profil · B = girdi · C = çapraz · DHR/Luca sütunları senaryo hazırlığı ve doğrulama
          durumunu gösterir
        </p>
        <div className="table-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>#</th>
                <th>G</th>
                <th>Çalışan</th>
                <th>Senaryo</th>
                <th>Profil</th>
                <th>Kanun</th>
                <th>Girdi</th>
                <th>DHR</th>
                <th>Luca</th>
                <th>Hüküm</th>
              </tr>
            </thead>
            <tbody>
              {matrix.scenarios.map((s) => (
                <tr key={s.n} className={toneOf(s.luca)}>
                  <td>{s.n}</td>
                  <td>{s.group}</td>
                  <td className="left">{s.name}</td>
                  <td className="left">{s.scenario}</td>
                  <td className="left note">{s.profile}</td>
                  <td>{s.law}</td>
                  <td>{s.input}</td>
                  <td>
                    <Badge status={s.dhr} />
                  </td>
                  <td>
                    <Badge status={s.luca} />
                  </td>
                  <td className="note left">{s.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Sistematik sürücüler</h2>
        <div className="cards three">
          {drivers.map((d) => (
            <article key={d.title} className="card">
              <h3>{d.title}</h3>
              <p>{d.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>En büyük |ΔNet| (TL)</h2>
        <p className="caption">Pozitif = DHR net daha yüksek · Kaynak: Ekim 2026 karşılaştırma</p>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topNet} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" TL" />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                formatter={(v: number) => [`${tr0(v)} TL`, "ΔNet"]}
                labelFormatter={(_, p) => (p?.[0]?.payload as { full: string })?.full || ""}
              />
              <Bar dataKey="dNet" name="ΔNet" radius={[4, 4, 0, 0]}>
                {topNet.map((e) => (
                  <Cell key={e.full} fill={e.dNet > 4000 ? "#ef4444" : e.dNet > 1500 ? "#f59e0b" : "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel legal" id="legal">
        <h2>Gelir vergisi istisnası — yasal çerçeve</h2>
        <p>
          2026’da asgari ücret brüt <strong>33.030 TL</strong>. GV istisna tutarı yıl içinde asgari
          ücret artışlarıyla değişir; uygulama genelde{" "}
          <code>Brüt asgari × (1 − %15 SGK − %1 issizlik) × %15 dilim</code> formülüne dayanır.
        </p>

        <div className="charts-grid">
          <div>
            <h3>2026 aylık istisna tutarları (TL)</h3>
            <p className="caption">Ocak–Haziran düşük band; Temmuz ara; Ağustos–Aralık güncel band</p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={gvMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[4000, 5800]} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                  <Legend />
                  <Line type="stepAfter" dataKey="istisna" name="Yasal istisna" stroke="#22c55e" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="dhrParam" name="DHR parametre (sabit)" stroke="#f97316" strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="dhrApplied" name="DHR fiilen uygulanan" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3>Ekim 2026 — istisna karşılaştırması</h3>
            <p className="caption">TL · %15 dilim etkisi ≈ istisna × 0,15</p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={gvCompare} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: "#94a3b8" }} domain={[0, 6000]} />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} formatter={(v: number) => [`${tr(v)} TL`, ""]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {gvCompare.map((e) => (
                      <Cell key={e.label} fill={e.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="legal-bullets">
              <li>
                <strong>DHR bug:</strong> Parametre tüm aylara 4.211,33 yazar ama hesapta istisna ≈ 0.
              </li>
              <li>
                <strong>Luca:</strong> ~4.211 TL uygular — yasal Ekim değeri 5.615,10 değil.
              </li>
              <li>
                Ekim’de yasal istisna ile Luca arası fark:{" "}
                <strong>{tr(5615.1 - 4211.33)} TL</strong> → net etki ~{" "}
                <strong>{tr((5615.1 - 4211.33) * 0.15)} TL/kişi</strong>.
              </li>
            </ul>
          </div>
        </div>

        <h3>Resmi kaynaklar</h3>
        <ul className="ref-list">
          {LEGAL_REFS.map((r) => (
            <li key={r.title}>
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.title}
              </a>
              <span>{r.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" id="people">
        <h2>Tüm çalışanlar</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Ad</th>
                <th>Profil / not</th>
                <th>DHR Net</th>
                <th>Luca Net</th>
                <th>ΔNet</th>
                <th>ΔGV</th>
                <th>DHR Brüt</th>
                <th>Luca Top</th>
                <th>BES</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RowLine key={r.tc} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        <p>
          D1-Tech · dhrtest İK birimi · Ekim 2026 dönem ID 9d85c4e1-d469-4f35-8eb4-4f1cd6dabe2a
        </p>
        <p className="footer-note">
          Bu site bilgilendirme amaçlıdır. Bordro kararı için Luca + mevzuat birlikte değerlendirilmelidir.
        </p>
      </footer>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" | "warn" }) {
  return (
    <div className={`stat ${tone || ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function toneOf(s: string): "ok" | "bad" | "warn" | "" {
  if (s === "pass") return "ok";
  if (s === "fail") return "bad";
  if (s === "partial" || s === "known") return "warn";
  return "";
}

function Badge({ status }: { status: string }) {
  const label =
    status === "pass"
      ? "OK"
      : status === "fail"
        ? "FAIL"
        : status === "partial"
          ? "KISMİ"
          : status === "known"
            ? "BİLİNEN"
            : status;
  return <span className={`badge ${toneOf(status)}`}>{label}</span>;
}

function RowLine({ r }: { r: CompareRow }) {
  const d = r.delta!;
  const tone = Math.abs(d.net) > 4000 ? "bad" : Math.abs(d.net) > 1500 ? "warn" : "ok";
  return (
    <tr className={tone}>
      <td>{r.n ?? "—"}</td>
      <td>{r.name}</td>
      <td className="note">{r.note || r.profile}</td>
      <td>{tr(r.dhr!.net)}</td>
      <td>{tr(r.luca.net)}</td>
      <td className={d.net > 0 ? "pos" : d.net < 0 ? "neg" : ""}>
        {d.net > 0 ? "+" : ""}
        {tr(d.net)}
      </td>
      <td>{d.gv > 0 ? "+" : ""}{tr(d.gv)}</td>
      <td>{tr0(r.dhr!.gross)}</td>
      <td>{tr0(r.luca.topKaz)}</td>
      <td>{tr0(r.dhr!.bes)}</td>
    </tr>
  );
}
