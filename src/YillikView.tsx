import { useEffect, useMemo, useState } from "react";
import { Money, Section } from "./ui";
import { tr } from "./types";
import type { YillikData, YillikMonthFile, YillikPay, YillikPerson } from "./yillikTypes";
import index from "./data/yillik_ik.json";

type Metric = keyof YillikPay;
type Sub = "ozet" | number;

const data = index as YillikData;

const KALEMS: { key: Metric; label: string; group: string; always?: boolean }[] = [
  { key: "salary", label: "Temel maaş", group: "Kazanç", always: true },
  { key: "meal", label: "Yemek yardımı", group: "Kazanç", always: true },
  { key: "transport", label: "Yol yardımı", group: "Kazanç", always: true },
  { key: "overtime", label: "Fazla mesai", group: "Kazanç" },
  { key: "overtimeNet", label: "Net fazla mesai", group: "Kazanç" },
  { key: "prim", label: "Prim", group: "Kazanç" },
  { key: "ikramiye", label: "İkramiye", group: "Kazanç" },
  { key: "masraf", label: "Masraf", group: "Kazanç" },
  { key: "childAid", label: "Çocuk yardımı", group: "Kazanç" },
  { key: "spouseAid", label: "Eş yardımı", group: "Kazanç" },
  { key: "leaveAllowance", label: "İzin harçlığı", group: "Kazanç" },
  { key: "health", label: "Özel sağlık", group: "Kazanç" },
  { key: "besEmployer", label: "BES işveren", group: "Kazanç" },
  { key: "kidem", label: "Kıdem tazminatı", group: "Kazanç" },
  { key: "ihbar", label: "İhbar tazminatı", group: "Kazanç" },
  { key: "rounding", label: "Yuvarlama", group: "Kazanç" },
  { key: "gross", label: "Toplam kazanç", group: "Özet", always: true },
  { key: "sgkBase", label: "Prime esas kazanç", group: "Özet", always: true },
  { key: "sgk", label: "SGK işçi", group: "Kesinti", always: true },
  { key: "unemployment", label: "İşsizlik işçi", group: "Kesinti", always: true },
  { key: "bes", label: "BES kesinti", group: "Kesinti" },
  { key: "icra", label: "İcra", group: "Kesinti" },
  { key: "nafaka", label: "Nafaka", group: "Kesinti" },
  { key: "kesinti", label: "Genel kesinti", group: "Kesinti" },
  { key: "advance", label: "Avans mahsubu", group: "Kesinti" },
  { key: "deductionTotal", label: "Kesintiler toplamı", group: "Özet", always: true },
  { key: "gvMatrah", label: "GV matrah", group: "Vergi", always: true },
  { key: "gvExempt", label: "GV istisna", group: "Vergi", always: true },
  { key: "gv", label: "Gelir vergisi", group: "Vergi", always: true },
  { key: "gvCum", label: "GV kümülatif matrah", group: "Vergi", always: true },
  { key: "disability", label: "Engellilik indirimi", group: "Vergi" },
  { key: "damga", label: "Damga vergisi", group: "Vergi", always: true },
  { key: "damgaExempt", label: "Damga istisna", group: "Vergi", always: true },
  { key: "net", label: "Net maaş", group: "Özet", always: true },
  { key: "employerSgk", label: "SGK işveren", group: "Maliyet", always: true },
  { key: "employerUnemp", label: "İşsizlik işveren", group: "Maliyet", always: true },
  { key: "employerCost", label: "İşveren maliyeti", group: "Maliyet", always: true },
  { key: "sgkDays", label: "SGK gün", group: "Puantaj", always: true },
  { key: "missingDays", label: "Eksik gün", group: "Puantaj" },
];

const PEOPLE_COLS: { key: Metric; label: string }[] = [
  { key: "sgkDays", label: "Gün" },
  { key: "salary", label: "Maaş" },
  { key: "meal", label: "Yemek" },
  { key: "transport", label: "Yol" },
  { key: "overtime", label: "FM" },
  { key: "prim", label: "Prim" },
  { key: "ikramiye", label: "İkramiye" },
  { key: "gross", label: "Brüt" },
  { key: "sgk", label: "SGK" },
  { key: "gv", label: "GV" },
  { key: "damga", label: "Damga" },
  { key: "advance", label: "Avans" },
  { key: "kesinti", label: "Kesinti" },
  { key: "net", label: "Net" },
];

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

function days(key: Metric) {
  return key === "sgkDays" || key === "missingDays" ? 0 : 2;
}

export default function YillikView() {
  const [sub, setSub] = useState<Sub>(1);
  const [monthFile, setMonthFile] = useState<YillikMonthFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sicil, setSicil] = useState(data.people[0]?.sicil ?? "");
  const [hideZero, setHideZero] = useState(true);

  useEffect(() => {
    if (sub === "ozet") {
      setMonthFile(null);
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
        setMonthFile(mod.default);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMonthFile(null);
        setLoading(false);
        setLoadError(err instanceof Error ? err.message : "Ay yüklenemedi");
      });
    return () => {
      cancelled = true;
    };
  }, [sub]);

  const monthMeta = typeof sub === "number" ? data.months[sub - 1] : null;
  const monthTotals = typeof sub === "number" ? data.totals.months[sub - 1] : null;
  const payBySicil = useMemo(() => {
    const map = new Map<string, YillikPay>();
    if (!monthFile) return map;
    for (const row of monthFile.people) map.set(row.sicil, row.pay);
    return map;
  }, [monthFile]);

  const people = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return data.people;
    return data.people.filter(
      (p) =>
        p.name.toLocaleLowerCase("tr").includes(needle) ||
        p.sicil.includes(needle) ||
        p.note.toLocaleLowerCase("tr").includes(needle) ||
        p.profile.toLocaleLowerCase("tr").includes(needle),
    );
  }, [q]);

  const selected: YillikPerson | undefined =
    data.people.find((p) => p.sicil === sicil) || people[0] || data.people[0];
  const selectedPay = selected ? payBySicil.get(selected.sicil) : undefined;

  const kalems = useMemo(() => {
    if (!selectedPay) return hideZero ? KALEMS.filter((k) => k.always) : KALEMS;
    if (!hideZero) return KALEMS;
    return KALEMS.filter((k) => k.always || Math.abs(selectedPay[k.key] || 0) > 0.001);
  }, [hideZero, selectedPay]);

  const y = data.totals.year;
  const lastCalc = monthMeta?.lastCalculatedAt || data.months.reduce((a, m) => (m.lastCalculatedAt && (!a || m.lastCalculatedAt > a) ? m.lastCalculatedAt : a), "");

  return (
    <div className="page compare">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">dhrtest2 · {data.unit} · yalnız DHR</p>
          <h1>
            {sub === "ozet"
              ? "2026 yıllık bordro — özet"
              : `${monthMeta?.label || ""} 2026 — İnsan Kaynakları`}
          </h1>
          <p className="lead">
            {sub === "ozet"
              ? "12 ay ayrı sekmelerde. Özet yalnız birim toplamlarını gösterir; kişi kalemleri ilgili ay sekmesinde."
              : `${monthMeta?.people ?? 32} kişi, dhrtest2 bordro API dump’ı. Luca ve YZ bu sekmede yok.`}
          </p>
          <p className="meta">
            Üretim: {new Date(data.generatedAt).toLocaleString("tr-TR")}
            {lastCalc ? ` · Son hesap: ${new Date(lastCalc).toLocaleString("tr-TR")}` : ""}
            {monthMeta?.periodId ? ` · ${monthMeta.periodId.slice(0, 8)}` : ""}
          </p>
        </div>
      </header>

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
          </button>
        ))}
      </nav>

      {sub === "ozet" ? (
        <>
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
            caption="Satıra tıklayınca o ayın 32 kişilik bordrosu açılır. Avans, taksit deductionAmount alanından."
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
                        <span className="muted small"> · {m.people} kişi</span>
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
        </>
      ) : loading ? (
        <p className="muted year-loading">Ay yükleniyor…</p>
      ) : loadError ? (
        <p className="muted year-loading">{loadError}</p>
      ) : (
        <>
          <section className="stats compact">
            <div className="stat">
              <div className="stat-value">{monthMeta?.people ?? "—"}</div>
              <div className="stat-label">Çalışan</div>
            </div>
            <div className="stat ok">
              <div className="stat-value">{tr(monthTotals?.net, 0)}</div>
              <div className="stat-label">Ay net (TL)</div>
            </div>
            <div className="stat">
              <div className="stat-value">{tr(monthTotals?.gross, 0)}</div>
              <div className="stat-label">Ay brüt (TL)</div>
            </div>
            <div className="stat warn">
              <div className="stat-value">{tr(monthTotals?.gv, 0)}</div>
              <div className="stat-label">Ay GV (TL)</div>
            </div>
            <div className="stat">
              <div className="stat-value">{tr(monthTotals?.overtime, 0)}</div>
              <div className="stat-label">Fazla mesai (TL)</div>
            </div>
            <div className="stat">
              <div className="stat-value">{tr(monthTotals?.advance, 0)}</div>
              <div className="stat-label">Avans mahsubu (TL)</div>
            </div>
          </section>

          <Section
            collapsible={false}
            title={`${monthMeta?.label} — 32 kişi`}
            caption="Satıra tıklayınca aşağıdaki kalem dökümü o kişiye geçer. Yalnız bu ayın DHR sayıları."
          >
            <div className="year-toolbar">
              <label className="year-search">
                Ara
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ad, sicil, not"
                />
              </label>
            </div>
            <div className="table-scroll tall">
              <table className="matrix-table sticky-name year-heat">
                <thead>
                  <tr>
                    <th className="center sticky-col">#</th>
                    <th className="left sticky-col-2 sticky-edge">Ad</th>
                    {PEOPLE_COLS.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => {
                    const pay = payBySicil.get(p.sicil);
                    return (
                      <tr
                        key={p.sicil}
                        className={selected?.sicil === p.sicil ? "selected" : undefined}
                        onClick={() => setSicil(p.sicil)}
                      >
                        <td className="center sticky-col">{p.n}</td>
                        <td className="left sticky-col-2 sticky-edge">
                          <button type="button" className="linkish">
                            {p.name}
                          </button>
                          <div className="muted small">
                            {p.sicil} · {p.note}
                          </div>
                        </td>
                        {PEOPLE_COLS.map((c) => (
                          <td key={c.key}>
                            <Money value={pay?.[c.key]} digits={days(c.key)} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {selected && selectedPay ? (
            <Section
              collapsible={false}
              title={`${selected.n}. ${selected.name} — ${monthMeta?.label}`}
              caption={`${selected.sicil} · ${selected.profile} · ${selected.note} · net ${tr(selectedPay.net)} · GV kümülatif ${tr(selectedPay.gvCum)}`}
            >
              <div className="year-toolbar">
                <label className="year-search">
                  Çalışan
                  <select value={selected.sicil} onChange={(e) => setSicil(e.target.value)}>
                    {data.people.map((p) => (
                      <option key={p.sicil} value={p.sicil}>
                        {p.n}. {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={`filter-chip ${hideZero ? "active" : ""}`}
                  onClick={() => setHideZero((v) => !v)}
                >
                  Sıfır kalemleri gizle
                </button>
              </div>
              <div className="table-scroll flow">
                <table className="matrix-table year-kalem">
                  <thead>
                    <tr>
                      <th className="left">Kalem</th>
                      <th>Grup</th>
                      <th>{monthMeta?.short}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kalems.map((k) => (
                      <tr key={k.key} className={k.key === "net" || k.key === "gross" ? "year-emph" : undefined}>
                        <td className="left">{k.label}</td>
                        <td className="left muted">{k.group}</td>
                        <td>
                          <Money value={selectedPay[k.key]} digits={days(k.key)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
