import { Fragment, useMemo, useState } from "react";
import type { CompareRow, ComparisonData, LineItem } from "./types";
import { tr } from "./types";
import type { MatrixData } from "./matrixTypes";
import { Delta, Money, PendingTag, Section, SectionNav } from "./ui";

type Props = { data: ComparisonData; matrix: MatrixData };

export default function AppView({ data, matrix }: Props) {
  const lucaPending = !!data.pending?.luca;
  const dhrPending = !!data.pending?.dhr;
  const rows = data.rows.filter((r) => r.dhr?.net != null || r.ai?.net != null);
  const [selectedTc, setSelectedTc] = useState(rows[0]?.tc ?? "");
  const selected = useMemo(
    () => rows.find((r) => r.tc === selectedTc) || rows[0],
    [rows, selectedTc],
  );
  const kalemler = data.kalemler || [];
  const ui = data.ui;
  const dhrIsFile = /\.(xlsx|xls|csv)$/i.test(data.sources.dhrExcel || "");

  const kalemScale = useMemo(
    () =>
      Math.max(
        1,
        ...kalemler.map((k) => Math.max(Math.abs(k.deltaDhrAi ?? 0), Math.abs(k.deltaSum ?? 0))),
      ),
    [kalemler],
  );
  const lineScale = useMemo(
    () =>
      Math.max(
        1,
        ...(selected?.lineItems || []).map((i) =>
          Math.max(Math.abs(i.deltaDhrAi ?? 0), Math.abs(i.delta ?? 0)),
        ),
      ),
    [selected],
  );
  const netScale = useMemo(
    () =>
      Math.max(
        1,
        ...rows.map((r) => Math.max(Math.abs(r.delta?.netAi ?? 0), Math.abs(r.delta?.net ?? 0))),
      ),
    [rows],
  );

  const navItems = useMemo(
    () =>
      [
        matrix.scenarios.length > 0 ? { id: "scenarios", label: "Senaryolar" } : null,
        { id: "kisi-kalem", label: "Kişi detay" },
        { id: "kalemler", label: "Kalemler" },
        matrix.dhrBugs.length > 0 ? { id: "correct", label: "DHR sorunları" } : null,
        { id: "people", label: "Tüm çalışanlar" },
      ].filter((i): i is { id: string; label: string } => i != null),
    [matrix.scenarios.length, matrix.dhrBugs.length],
  );

  return (
    <div className="page compare">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">dhrtest · {data.unit} · DHR × Luca × YZ</p>
          <h1>{ui?.title || "DHR × Luca — Bordro Karşılaştırması"}</h1>
          <p className="lead">
            {ui?.lead ||
              "32 kişilik test matrisi: kanun/teşvik profilleri, ek kazanç ve kesintiler."}
          </p>
          <div className="hero-actions">
            {data.sources.lucaPdf && !lucaPending ? (
              <a className="btn primary" href={data.sources.lucaPdf} download>
                Luca PDF indir
              </a>
            ) : (
              <span className="btn disabled" title="Luca PDF henüz yok">
                Luca PDF bekliyor
              </span>
            )}
            {dhrPending ? (
              <span className="btn disabled">DHR bekliyor</span>
            ) : dhrIsFile ? (
              <a className="btn" href={data.sources.dhrExcel} download>
                DHR dosyası indir
              </a>
            ) : (
              <span className="btn disabled" title={data.sources.dhrExcel}>
                DHR: UI / API okuması
              </span>
            )}
          </div>
          <p className="meta">
            Üretim: {new Date(data.generatedAt).toLocaleString("tr-TR")}
            {data.lucaPdfVersion ? ` · Kaynak PDF: ${data.lucaPdfVersion}` : " · Luca PDF henüz yok"}
            {" · "}
            {dhrPending || lucaPending
              ? `YZ ${data.summary.aiCount ?? rows.length} kişi`
              : `Eşleşen ${data.summary.matched} kişi`}
          </p>
        </div>
      </header>

      <SectionNav items={navItems} />

      {matrix.scenarios.length > 0 && (
        <Section
          id="scenarios"
          collapsible={false}
          title={`Test edilen senaryolar (${matrix.scenarios.length})`}
          caption="DHR / Luca / YZ. Geçme ±0,01 TL. Luca referanstır, doğru kabul edilmez. Bekleyen kaynak kolon başlığında bir kez işaretlenir."
        >
          <div className="table-scroll flow">
            <table className="matrix-table">
              <colgroup>
                <col className="col-n" />
                <col className="col-g" />
                <col className="col-name" />
                <col className="col-scen" />
                <col className="col-profile" />
                <col className="col-law" />
                <col className="col-input" />
                <col className="col-badge" />
                <col className="col-badge" />
                <col className="col-badge" />
                <col className="col-verdict" />
                <col className="col-which" />
                <col className="col-legal" />
              </colgroup>
              <thead>
                <tr className="group-row">
                  <th className="center sticky-col" />
                  <th className="center sticky-col-2" />
                  <th className="left sticky-col-3 sticky-edge" />
                  <th className="left" colSpan={4}>
                    Senaryo
                  </th>
                  <th className="center col-sep" colSpan={3}>
                    Sonuç ±0,01 TL
                  </th>
                  <th className="left col-sep" colSpan={3}>
                    Sapma hakemi
                  </th>
                </tr>
                <tr>
                  <th className="center sticky-col">#</th>
                  <th className="center sticky-col-2">G</th>
                  <th className="left sticky-col-3 sticky-edge">Çalışan</th>
                  <th className="left">Senaryo</th>
                  <th className="left">Profil</th>
                  <th className="center">Kanun</th>
                  <th className="center">Girdi</th>
                  <th className="center col-sep">
                    DHR
                    <PendingTag show={dhrPending} />
                  </th>
                  <th className="center">
                    Luca
                    <PendingTag show={lucaPending} />
                  </th>
                  <th className="center">YZ</th>
                  <th className="left col-sep">Hüküm</th>
                  <th className="left">Hangisi doğru</th>
                  <th className="left">Mevzuat</th>
                </tr>
              </thead>
              <tbody>
                {matrix.scenarios.map((s) => (
                  <tr key={s.n} className={toneOf(lucaPending ? s.ai || "pending" : s.luca)}>
                    <td className="center sticky-col">{s.n}</td>
                    <td className="center sticky-col-2">{s.group}</td>
                    <td className="left sticky-col-3 sticky-edge">{s.name}</td>
                    <td className="left">{s.scenario}</td>
                    <td className="left note">{s.profile}</td>
                    <td className="center">{s.law}</td>
                    <td className="center">{s.input}</td>
                    <td className="center col-sep">
                      <Badge status={dhrPending ? "pending" : s.dhr} />
                    </td>
                    <td className="center">
                      <Badge status={lucaPending ? "pending" : s.luca} />
                    </td>
                    <td className="center">
                      <Badge status={s.ai || "pass"} />
                    </td>
                    <td className="note left col-sep">{s.verdict}</td>
                    <td className="note left">{s.whichCorrect || "—"}</td>
                    <td className="note left">{s.legalBasis || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section
        id="kisi-kalem"
        collapsible={false}
        title="Kişi bazlı kalem tablosu"
        caption={ui?.personCaption || "Çalışan seç → her kalemde DHR, Luca ve fark yan yana."}
      >
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
              <Stat
                label="DHR net"
                value={dhrPending || selected.dhr?.net == null ? "bekliyor" : `${tr(selected.dhr.net)} TL`}
              />
              <Stat
                label="Luca net"
                value={lucaPending || selected.luca.net == null ? "bekliyor" : `${tr(selected.luca.net)} TL`}
              />
              <Stat
                label="YZ net"
                value={selected.ai?.net != null ? `${tr(selected.ai.net)} TL` : "—"}
                tone="ok"
              />
              <Stat
                label="YZ GV / istisna"
                value={
                  selected.ai
                    ? `${tr(selected.ai.gv)} / ${tr(selected.ai.gvExemptApplied ?? 0)}`
                    : "—"
                }
              />
            </div>
            {selected.ai?.notes && selected.ai.notes.length > 0 ? (
              <p className="caption">{selected.ai.notes.join(" ")}</p>
            ) : null}
            {(selected.luca.digText || selected.luca.ozText) && (
              <p className="caption dig-oz">
                {selected.luca.digText ? (
                  <>
                    <strong>Luca diğer kazanç:</strong> {selected.luca.digText}
                  </>
                ) : null}
                {selected.luca.digText && selected.luca.ozText ? " · " : null}
                {selected.luca.ozText ? (
                  <>
                    <strong>Öz kesinti:</strong> {selected.luca.ozText}
                  </>
                ) : null}
              </p>
            )}
            <div className="table-scroll flow">
              <table className="kalem-table stacked-table">
                <colgroup>
                  <col style={{ width: "17rem" }} />
                  <col span={3} />
                  <col span={2} />
                  <col style={{ width: "6rem" }} />
                </colgroup>
                <thead>
                  <tr className="group-row">
                    <th className="left" />
                    <th className="center col-sep" colSpan={3}>
                      Kaynaklar (TL)
                    </th>
                    <th className="center col-sep" colSpan={2}>
                      Farklar
                    </th>
                    <th className="center col-sep" />
                  </tr>
                  <tr>
                    <th className="left">Kalem</th>
                    <th className="num col-sep">
                      DHR
                      <PendingTag show={dhrPending} />
                    </th>
                    <th className="num">
                      Luca
                      <PendingTag show={lucaPending} />
                    </th>
                    <th className="num">YZ</th>
                    <th className="num col-sep">Δ DHR−Luca</th>
                    <th className="num">Δ DHR−YZ</th>
                    <th className="center col-sep">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.lineItems || []).map((item) => (
                    <LineItemRow
                      key={item.key}
                      item={item}
                      lucaPending={lucaPending}
                      dhrPending={dhrPending}
                      scale={lineScale}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section
        id="kalemler"
        collapsible={false}
        title="Kalem kalem — DHR × Luca × YZ (toplam)"
        hint={`${kalemler.length} kalem`}
        caption="YZ = 2026 Türk mevzuatı (işçi SGK, işsizlik, GV, damga). Δ hücrelerindeki ince bar, farkın tablodaki en büyük farka oranını gösterir."
      >
        <div className="table-scroll flow">
          <table className="kalem-table sticky-name">
            <colgroup>
              <col style={{ width: "17rem" }} />
              <col span={3} />
              <col span={2} />
              <col span={2} />
            </colgroup>
            <thead>
              <tr className="group-row">
                <th className="left sticky-col sticky-edge" />
                <th className="center col-sep" colSpan={3}>
                  Kaynaklar (toplam TL)
                </th>
                <th className="center col-sep" colSpan={2}>
                  Farklar
                </th>
                <th className="center col-sep" colSpan={2}>
                  Kapsam
                </th>
              </tr>
              <tr>
                <th className="left sticky-col sticky-edge">Kalem</th>
                <th className="num col-sep">
                  DHR
                  <PendingTag show={dhrPending} />
                </th>
                <th className="num">
                  Luca
                  <PendingTag show={lucaPending} />
                </th>
                <th className="num">YZ</th>
                <th className="num col-sep">Δ DHR−Luca</th>
                <th className="num">Δ DHR−YZ</th>
                <th className="num col-sep">Değeri olan</th>
                <th className="num">DHR=Luca</th>
              </tr>
            </thead>
            <tbody>
              {kalemler.map((k, idx) => {
                const dhrAi = k.deltaDhrAi;
                const tone = deltaRowTone(k.deltaSum, dhrPending || lucaPending);
                const newGroup = idx === 0 || kalemler[idx - 1].group !== k.group;
                return (
                  <Fragment key={k.key}>
                    {newGroup ? (
                      <tr className="group-divider">
                        <td colSpan={8}>{groupLabel(k.group)}</td>
                      </tr>
                    ) : null}
                    <tr className={tone}>
                      <td className="left sticky-col sticky-edge">{k.label}</td>
                      <td className="num col-sep">
                        <Money value={k.dhrSum} pending={dhrPending} />
                      </td>
                      <td className="num">
                        <Money value={k.lucaSum} pending={lucaPending} />
                      </td>
                      <td className="num">
                        <Money value={k.aiSum ?? 0} yz />
                      </td>
                      <td className="num delta-cell col-sep">
                        <Delta value={dhrPending || lucaPending ? null : k.deltaSum} scale={kalemScale} />
                      </td>
                      <td className="num delta-cell">
                        <Delta value={dhrAi} scale={kalemScale} />
                      </td>
                      <td className="num col-sep">{k.peopleWithValue}</td>
                      <td className="num">
                        {k.compared ? `${k.matchCount}/${k.compared}` : <span className="zero">—</span>}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {matrix.dhrBugs.length > 0 && (
        <Section
          id="correct"
          collapsible={false}
          title="DHR’de tespit edilen yasal / hesap sorunları"
          hint={`${matrix.dhrBugs.length} bulgu`}
        >
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
                      <span
                        className={`pill ${w.severity === "error" ? "bad" : w.severity === "info" ? "ok" : "warn"}`}
                      >
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
        </Section>
      )}

      <Section id="people" collapsible={false} title="Tüm çalışanlar" hint={`${rows.length} kişi`}>
        <div className="table-scroll flow">
          <table className="sticky-name">
            <colgroup>
              <col style={{ width: "3.2rem" }} />
              <col style={{ width: "11rem" }} />
              <col style={{ width: "18rem" }} />
              <col span={3} />
              <col span={2} />
            </colgroup>
            <thead>
              <tr className="group-row">
                <th className="center sticky-col" />
                <th className="left sticky-col-2 sticky-edge" />
                <th className="left" />
                <th className="center col-sep" colSpan={3}>
                  Net (TL)
                </th>
                <th className="center col-sep" colSpan={2}>
                  Farklar
                </th>
              </tr>
              <tr>
                <th className="center sticky-col">#</th>
                <th className="left sticky-col-2 sticky-edge">Ad</th>
                <th className="left">Profil / not</th>
                <th className="num col-sep">
                  DHR
                  <PendingTag show={dhrPending} />
                </th>
                <th className="num">
                  Luca
                  <PendingTag show={lucaPending} />
                </th>
                <th className="num">YZ</th>
                <th className="num col-sep">Δ DHR−Luca</th>
                <th className="num">Δ DHR−YZ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RowLine
                  key={r.tc}
                  r={r}
                  lucaPending={lucaPending}
                  dhrPending={dhrPending}
                  scale={netScale}
                  onSelect={() => setSelectedTc(r.tc)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <footer className="footer">
        <p>{ui?.footer || `${data.unit} · ${data.period}`}</p>
        <p className="footer-note">
          Bilgilendirme amaçlıdır; bordro kararı için DHR + Luca + mevzuat birlikte değerlendirilir.
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

function deltaRowTone(n: number | null | undefined, pending: boolean): "" | "ok" | "warn" | "bad" {
  if (pending || n == null) return "";
  const abs = Math.abs(n);
  if (abs <= 0.01) return "ok";
  if (abs > 1500) return "bad";
  return "warn";
}

function LineItemRow({
  item,
  lucaPending,
  dhrPending,
  scale,
}: {
  item: LineItem;
  lucaPending: boolean;
  dhrPending: boolean;
  scale?: number;
}) {
  const vsAi = item.deltaDhrAi;
  const vsLuca = item.delta;
  const pending = dhrPending || lucaPending;
  const matchLuca = item.match;
  const status = pending ? "BEKLİYOR" : matchLuca ? "OK" : "FARK";
  return (
    <tr className={pending ? "" : matchLuca ? "ok" : "warn"}>
      <td className="left" data-label="Kalem">
        {item.label}
      </td>
      <td className="num col-sep" data-label="DHR">
        <Money value={item.dhr} pending={dhrPending} />
      </td>
      <td className="num" data-label="Luca">
        <Money value={item.luca} pending={lucaPending} />
      </td>
      <td className="num" data-label="YZ">
        <Money value={item.ai} yz />
      </td>
      <td className="num delta-cell col-sep" data-label="Δ DHR−Luca">
        <Delta value={pending ? null : vsLuca} scale={scale} />
      </td>
      <td className="num delta-cell" data-label="Δ DHR−YZ">
        <Delta value={vsAi} scale={scale} />
      </td>
      <td className="center col-sep" data-label="Durum">
        <span className={`badge ${status === "OK" ? "ok" : status === "BEKLİYOR" ? "pending" : "bad"}`}>
          {status}
        </span>
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
  if (s === "pending") return "warn";
  return "";
}

function Badge({ status }: { status: string }) {
  const label = status === "pass" ? "OK" : status === "fail" ? "FAIL" : status === "pending" ? "BEKLİYOR" : status;
  return <span className={`badge ${status === "pending" ? "pending" : toneOf(status)}`}>{label}</span>;
}

function RowLine({
  r,
  onSelect,
  lucaPending,
  dhrPending,
  scale,
}: {
  r: CompareRow;
  onSelect: () => void;
  lucaPending: boolean;
  dhrPending: boolean;
  scale?: number;
}) {
  const dhrLuca = r.delta?.net;
  const note = r.note || r.profile || "";
  return (
    <tr
      className={deltaRowTone(dhrLuca, dhrPending || lucaPending)}
      onClick={onSelect}
      style={{ cursor: "pointer" }}
      title="Kalem detayına git"
    >
      <td className="center sticky-col">{r.n ?? "—"}</td>
      <td className="left sticky-col-2 sticky-edge">
        <a href="#kisi-kalem" onClick={onSelect}>
          {r.name}
        </a>
      </td>
      <td className="note left">{note}</td>
      <td className="num col-sep">
        <Money value={r.dhr?.net} pending={dhrPending} />
      </td>
      <td className="num">
        <Money value={r.luca.net} pending={lucaPending} />
      </td>
      <td className="num">
        <Money value={r.ai?.net} yz />
      </td>
      <td className="num delta-cell col-sep">
        <Delta value={dhrPending || lucaPending ? null : r.delta?.net} scale={scale} />
      </td>
      <td className="num delta-cell">
        <Delta value={r.delta?.netAi} scale={scale} />
      </td>
    </tr>
  );
}
