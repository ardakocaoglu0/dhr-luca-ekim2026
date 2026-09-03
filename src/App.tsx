import { useMemo, useState } from "react";
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
import type { CompareRow, ComparisonData, LineItem } from "./types";
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
  const [selectedTc, setSelectedTc] = useState(rows[0]?.tc ?? "");
  const selected = useMemo(
    () => rows.find((r) => r.tc === selectedTc) || rows[0],
    [rows, selectedTc],
  );
  const kalemler = data.kalemler || [];

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
      fill: "#22c55e",
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
      dhrApplied: data.legal.dhrObserved.exemptApplied,
  }));

  const drivers = [
    {
      title: "Kapsam farkı",
      body: `DHR’de yemek+yol neredeyse herkese; Luca PDF’de yalnızca ${data.summary.mealOnLuca ?? "?"} kişide yemek/yol görünüyor.`,
    },
    {
      title: "BES %3",
      body: `DHR BES (toplam ${tr0(kalemler.find((k) => k.key === "bes")?.dhrSum)} TL); Luca’da BES satırı ${data.summary.besOnLuca ?? 0} kişi.`,
    },
    {
      title: "GV istisnası",
      body: "Ocak UI’da istisna 4.211,33 TL uygulanıyor (yasal Ocak bandı). Luca Ekim PDF hâlâ ~4.211; yasal Ekim 5.615 TL.",
    },
  ];

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">dhrtest × Luca · İnsan Kaynakları</p>
          <h1>DHR × Luca — Ocak 2026 (UI) vs Ekim Luca</h1>
          <p className="lead">
            32 kişilik test matrisi. DHR rakamları Ocak 2026 UI; Luca referans Ekim PDF. Hande kısmi
            uygulandı; tek açık DHR bug Okan masraf. GV/BES/stajyer/4691 düzeltmeleri listeden çıktı.
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
            Üretim: {new Date(data.generatedAt).toLocaleString("tr-TR")} · Kaynak PDF:{" "}
            {data.lucaPdfVersion || "bordro_d1_tech.pdf"} · Eşleşen {data.summary.matched} kişi
          </p>
          <nav className="toc" aria-label="Bölümler">
            <a href="#kalemler">Kalemler</a>
            <a href="#kisi-kalem">Kişi detay</a>
            <a href="#matrix">Matris</a>
            <a href="#checks">Kontroller</a>
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
          label="Luca’da FM / yemek"
          value={`${data.summary.overtimeOnLuca ?? 0} / ${data.summary.mealOnLuca ?? 0}`}
          tone={(data.summary.overtimeOnLuca ?? 0) >= 4 ? "ok" : "warn"}
        />
      </section>

      <section className="panel verdict">
        <h2>Hüküm</h2>
        <p>
          Ocak UI: GV istisnası 4.211,33 (32/32), BES yalnız Pelin, Hande kısmi puantajdan uygulandı,
          Alper/Berna/Cemil 4691 çalışıyor. Tek açık DHR bug: Okan masraf 750 (PPV orphan). Luca
          tarafında kanun/PDF sapmaları duruyor.
        </p>
      </section>

      <section className="panel" id="kalemler">
        <h2>Kalem kalem — DHR × Luca (toplam)</h2>
        <p className="caption">
          32 kişinin kalem toplamları. Δ = DHR − Luca. Eşleşen = |Δ| ≤ 0,05 TL olan kişi sayısı.
        </p>
        <div className="table-scroll">
          <table className="kalem-table">
            <thead>
              <tr>
                <th>Kalem</th>
                <th>Grup</th>
                <th>DHR toplam</th>
                <th>Luca toplam</th>
                <th>Δ (DHR−Luca)</th>
                <th>Değeri olan</th>
                <th>Eşleşen</th>
              </tr>
            </thead>
            <tbody>
              {kalemler.map((k) => (
                <tr key={k.key} className={Math.abs(k.deltaSum) > 1000 ? "warn" : Math.abs(k.deltaSum) < 1 ? "ok" : ""}>
                  <td className="left">{k.label}</td>
                  <td className="note">{groupLabel(k.group)}</td>
                  <td>{tr(k.dhrSum)}</td>
                  <td>{tr(k.lucaSum)}</td>
                  <td className={deltaClass(k.deltaSum)}>
                    {k.deltaSum > 0 ? "+" : ""}
                    {tr(k.deltaSum)}
                  </td>
                  <td>{k.peopleWithValue}</td>
                  <td>
                    {k.matchCount}/{k.compared}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" id="kisi-kalem">
        <h2>Kişi bazlı kalem tablosu</h2>
        <p className="caption">Çalışan seç → her kalemde DHR, Luca ve fark yan yana</p>
        <label className="person-pick">
          <span>Çalışan</span>
          <select value={selected?.tc || ""} onChange={(e) => setSelectedTc(e.target.value)}>
            {rows.map((r) => (
              <option key={r.tc} value={r.tc}>
                #{r.n} {r.name} — {r.note || r.profile}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <>
            <div className="stats compact">
              <Stat label="DHR net" value={`${tr(selected.dhr!.net)} TL`} />
              <Stat label="Luca net" value={`${tr(selected.luca.net)} TL`} />
              <Stat
                label="ΔNet"
                value={`${selected.delta!.net > 0 ? "+" : ""}${tr(selected.delta!.net)}`}
                tone={Math.abs(selected.delta!.net) > 2000 ? "bad" : Math.abs(selected.delta!.net) > 500 ? "warn" : "ok"}
              />
              <Stat
                label="Luca kanun"
                value={selected.luca.kanun || "—"}
                tone={
                  selected.lucaKanunExpected &&
                  selected.luca.kanun &&
                  !String(selected.lucaKanunExpected).includes(String(selected.luca.kanun))
                    ? "bad"
                    : "ok"
                }
              />
            </div>
            {(selected.luca.digText || selected.luca.ozText) && (
              <p className="caption dig-oz">
                {selected.luca.digText ? (
                  <>
                    <strong>Luca dig:</strong> {selected.luca.digText}{" "}
                  </>
                ) : null}
                {selected.luca.ozText ? (
                  <>
                    <strong>Öz kesinti:</strong> {selected.luca.ozText}
                  </>
                ) : null}
              </p>
            )}
            <div className="table-scroll">
              <table className="kalem-table">
                <thead>
                  <tr>
                    <th>Kalem</th>
                    <th>DHR</th>
                    <th>Luca</th>
                    <th>Δ</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.lineItems || []).map((item) => (
                    <LineItemRow key={item.key} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
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
        {matrix.warnings && matrix.warnings.length > 0 && (
          <>
            <h3>Uyarılar</h3>
            <div className="cards bugs">
              {matrix.warnings.map((w) => (
                <article key={w.id} className="card">
                  <h3>
                    <span className={`pill ${w.severity === "error" ? "bad" : w.severity === "info" ? "ok" : "warn"}`}>
                      {(w.severity || "warn").toUpperCase()}
                    </span>{" "}
                    {w.title}
                  </h3>
                  <p>{w.detail}</p>
                </article>
              ))}
            </div>
          </>
        )}
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
                <strong>DHR Ocak:</strong> İstisna 4.211,33 TL fiilen uygulandı (yasal Ocak bandı).
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
                <th>DHR BES</th>
                <th>Luca FM</th>
                <th>Luca Yemek</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RowLine key={r.tc} r={r} onSelect={() => setSelectedTc(r.tc)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        <p>
          D1-Tech · dhrtest İK birimi · Ocak 2026 dönem ID 67d5ddbc-5000-48b3-abac-b89e429cf5c2
        </p>
        <p className="footer-note">
          Bu site bilgilendirme amaçlıdır. Bordro kararı için Luca + mevzuat birlikte değerlendirilmelidir.
        </p>
      </footer>
    </div>
  );
}

function groupLabel(g: string): string {
  if (g === "kazanc") return "Kazanç";
  if (g === "kesinti") return "Kesinti";
  if (g === "ozet") return "Özet";
  return g;
}

function deltaClass(n: number | null | undefined): string {
  if (n == null || Math.abs(n) < 0.05) return "";
  return n > 0 ? "pos" : "neg";
}

function LineItemRow({ item }: { item: LineItem }) {
  const hideZero =
    (item.dhr == null || item.dhr === 0) && (item.luca == null || item.luca === 0) && item.key !== "net";
  if (hideZero && item.key !== "gross" && item.key !== "salary" && item.key !== "gv" && item.key !== "sgk" && item.key !== "damga") {
    // still show structural rows; skip pure empty extras
    if (["masraf", "prim", "ikramiye", "overtime", "advance", "kesinti", "meal", "transport", "bes", "unemployment"].includes(item.key)) {
      // show anyway for transparency of 0 vs 0 match — keep visible
    }
  }
  return (
    <tr className={item.match ? "ok" : "warn"}>
      <td className="left">{item.label}</td>
      <td>{tr(item.dhr)}</td>
      <td>{tr(item.luca)}</td>
      <td className={deltaClass(item.delta)}>
        {item.delta == null ? "—" : `${item.delta > 0 ? "+" : ""}${tr(item.delta)}`}
      </td>
      <td>
        <span className={`badge ${item.match ? "ok" : "bad"}`}>{item.match ? "OK" : "FARK"}</span>
      </td>
    </tr>
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

function RowLine({ r, onSelect }: { r: CompareRow; onSelect: () => void }) {
  const d = r.delta!;
  const tone = Math.abs(d.net) > 4000 ? "bad" : Math.abs(d.net) > 1500 ? "warn" : "ok";
  return (
    <tr className={tone} onClick={onSelect} style={{ cursor: "pointer" }} title="Kalem detayına git">
      <td>{r.n ?? "—"}</td>
      <td>
        <a href="#kisi-kalem" onClick={onSelect}>
          {r.name}
        </a>
      </td>
      <td className="note">{r.note || r.profile}</td>
      <td>{tr(r.dhr!.net)}</td>
      <td>{tr(r.luca.net)}</td>
      <td className={d.net > 0 ? "pos" : d.net < 0 ? "neg" : ""}>
        {d.net > 0 ? "+" : ""}
        {tr(d.net)}
      </td>
      <td>
        {d.gv > 0 ? "+" : ""}
        {tr(d.gv)}
      </td>
      <td>{tr0(r.dhr!.gross)}</td>
      <td>{tr0(r.luca.topKaz ?? r.luca.gross)}</td>
      <td>{tr0(r.dhr!.bes)}</td>
      <td>{tr0(r.luca.overtime)}</td>
      <td>{tr0(r.luca.meal)}</td>
    </tr>
  );
}
