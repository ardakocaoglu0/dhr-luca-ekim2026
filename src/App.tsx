import { Fragment, useMemo, useState } from "react";
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
import type { CompareRow, ComparisonData, LineItem, MismatchRow } from "./types";
import { tr, tr0 } from "./types";
import type { MatrixData } from "./matrixTypes";
import mevzuat from "./data/mevzuat.json";
import { Delta, Money, PendingTag, Section, SectionNav } from "./ui";

type Props = { data: ComparisonData; matrix: MatrixData };

const LEGAL_REFS = mevzuat.sources;

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

  const mismatches = data.mismatches || [];
  const mismatchSummary = data.mismatchSummary;
  const [causeFilter, setCauseFilter] = useState("all");
  const visibleMismatches = useMemo(
    () =>
      causeFilter === "all"
        ? mismatches
        : mismatches.filter((m) => m.causes.some((c) => c.id === causeFilter)),
    [mismatches, causeFilter],
  );

  // With DHR present but Luca still pending the useful chart is Δ DHR−YZ; with
  // neither comparison available it falls back to the YZ net itself.
  const netMode: "delta" | "deltaAi" | "ai" = !lucaPending && !dhrPending ? "delta" : dhrPending ? "ai" : "deltaAi";
  const netKey = netMode === "delta" ? "net" : "netAi";
  const topNet =
    netMode === "ai"
      ? [...rows]
          .sort((a, b) => (b.ai?.net || 0) - (a.ai?.net || 0))
          .slice(0, 12)
          .map((r) => ({
            name: r.name.split(" ")[0],
            full: r.name,
            dNet: Math.round(r.ai?.net || 0),
          }))
      : [...rows]
          .filter((r) => r.delta?.[netKey] != null)
          .sort((a, b) => Math.abs(b.delta![netKey]!) - Math.abs(a.delta![netKey]!))
          .slice(0, 12)
          .map((r) => ({
            name: r.name.split(" ")[0],
            full: r.name,
            dNet: Math.round(r.delta![netKey]!),
          }));
  const netChartTitle =
    netMode === "delta"
      ? "En büyük |ΔNet DHR−Luca| (TL)"
      : netMode === "deltaAi"
        ? "En büyük |ΔNet DHR−YZ| (TL)"
        : "YZ net (mevzuat, TL)";
  const netChartLabel = netMode === "ai" ? "YZ net" : netMode === "delta" ? "ΔNet" : "ΔNet DHR−YZ";

  const passCount = matrix.checkedItems.filter((c) => c.result === "pass").length;
  const failCount = matrix.checkedItems.filter((c) => c.result === "fail").length;
  const lucaPass = matrix.scenarios.filter((s) => s.luca === "pass").length;

  const ui = data.ui;
  const gvApplied = data.legal.dhrObserved.exemptApplied;
  const yzExempt = selected?.ai?.gvExemptApplied ?? mevzuat.monthExemptTax[String(data.aiReport?.month || 10) as keyof typeof mevzuat.monthExemptTax];
  const gvCompare = [
    {
      label: "DHR uyguladığı",
      value: dhrPending ? 0 : gvApplied,
      fill: dhrPending ? "#64748b" : gvApplied > 0 ? "#22c55e" : "#ef4444",
    },
    {
      label: "DHR parametre",
      value: data.legal.dhrObserved.paramFormulaValue,
      fill: "#f97316",
    },
    {
      label: lucaPending ? "Luca (bekliyor)" : "Luca uyguladığı",
      value: lucaPending ? 0 : data.legal.lucaObserved.exemptApplied,
      fill: lucaPending ? "#64748b" : "#eab308",
    },
    {
      label: "YZ yasal istisna",
      value: yzExempt,
      fill: "#38bdf8",
    },
    {
      label: "Yasal Ağu–Ara 2026",
      value: data.legal.lucaObserved.octoberLegal,
      fill: "#22c55e",
    },
  ];

  const gvMonthly = data.legal.gvMonthly2026.map((m) => ({
    month: m.month,
    istisna: m.exempt,
    dhrParam: data.legal.dhrObserved.paramFormulaValue,
    dhrApplied: gvApplied,
  }));

  const drivers = ui?.drivers || [
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
      body: "DHR ve Luca istisna değerlerini yukarıdaki yasal grafiklerle karşılaştırın.",
    },
  ];

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
        { id: "hukum", label: "Hüküm" },
        mismatches.length > 0 ? { id: "uyusmayan", label: "Uyuşmayanlar" } : null,
        data.aiReport ? { id: "yz-hukum", label: "YZ hüküm" } : null,
        { id: "kalemler", label: "Kalemler" },
        { id: "kisi-kalem", label: "Kişi detay" },
        matrix.scenarios.length > 0 ? { id: "matrix", label: "Matris" } : null,
        matrix.checkedItems.length > 0 ? { id: "checks", label: "Kontroller" } : null,
        matrix.scenarios.length > 0 ? { id: "scenarios", label: "Senaryolar" } : null,
        { id: "legal", label: "GV yasal" },
        { id: "mevzuat", label: "Mevzuat" },
        { id: "people", label: "Net karşılaştırma" },
      ].filter((i): i is { id: string; label: string } => i != null),
    [mismatches.length, data.aiReport, matrix.scenarios.length, matrix.checkedItems.length],
  );

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">dhrtest · {data.unit} · DHR × Luca × YZ</p>
          <h1>{ui?.title || "DHR × Luca — Bordro Karşılaştırması"}</h1>
          <p className="lead">
            {ui?.lead ||
              "32 kişilik test matrisi: kanun/teşvik profilleri, ek kazanç ve kesintiler."}
          </p>
          <div className="source-chips" aria-label="Kaynaklar">
            <span className={`source-chip ${dhrPending ? "wait" : ""}`}>
              DHR {dhrPending ? "bekliyor" : "export"}
            </span>
            <span className={`source-chip ${lucaPending ? "wait" : ""}`}>
              Luca {lucaPending ? "bekliyor" : "PDF"}
            </span>
            <span className="source-chip yz">YZ — Türkiye mevzuatı</span>
          </div>
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
            {data.sources.dhrExcel && !dhrPending ? (
              <a className="btn" href={data.sources.dhrExcel} download>
                DHR Excel indir
              </a>
            ) : (
              <span className="btn disabled">DHR Excel bekliyor</span>
            )}
            <a className="btn yz" href="#mevzuat">
              YZ mevzuat kaynakları
            </a>
          </div>
          <p className="meta">
            Üretim: {new Date(data.generatedAt).toLocaleString("tr-TR")}
            {data.lucaPdfVersion ? ` · Kaynak PDF: ${data.lucaPdfVersion}` : " · Luca PDF henüz yok"}
            {" · "}
            {dhrPending || lucaPending
              ? `YZ ${data.summary.aiCount ?? rows.length} kişi`
              : `Eşleşen ${data.summary.matched} kişi`}
            {data.sources.aiMevzuat ? ` · ${data.sources.aiMevzuat}` : ""}
          </p>
        </div>
      </header>

      <SectionNav items={navItems} />

      <section className="stats">
        <Stat
          label="YZ kişi"
          value={String(data.summary.aiCount ?? rows.length)}
          tone="ok"
        />
        {lucaPending || dhrPending ? (
          <>
            <Stat label="Luca kolonu" value="bekliyor" tone="warn" />
            <Stat label="DHR kolonu" value={dhrPending ? "bekliyor" : String(data.summary.dhrCount)} tone="warn" />
            <Stat
              label="YZ kaynak"
              value="TR mevzuat"
              tone="ok"
            />
          </>
        ) : (
          <>
            <Stat label="Eşleşen kişi" value={`${data.summary.matched}/${data.summary.lucaCount}`} />
            <Stat
              label="DHR−YZ net ±100"
              value={String(data.summary.netWithin100Ai ?? 0)}
              tone={(data.summary.netWithin100Ai ?? 0) === 0 ? "bad" : "ok"}
            />
            <Stat
              label="Ort. |DHR−YZ|"
              value={`${tr0(data.summary.avgAbsNetDeltaAi)} TL`}
              tone="warn"
            />
          </>
        )}
      </section>

      <section className="panel verdict" id="hukum">
        <h2>Hüküm</h2>
        <p>{ui?.verdict}</p>
      </section>

      {data.aiReport && (
        <Section
          id="yz-hukum"
          title="YZ’ye göre sonuç — Türkiye mevzuatı"
          hint={`${data.aiReport.findings.length} bulgu`}
          caption={`${data.aiReport.engine}. ${data.aiReport.disclaimer}`}
        >
          <div className="cards bugs">
            {data.aiReport.findings.map((f) => (
              <article key={f.id} className="card">
                <h3>
                  <span className={`pill ${f.vs === "dhr" ? "bad" : f.vs === "luca" ? "warn" : "ok"}`}>
                    {f.vs === "dhr" ? "DHR × YZ" : f.vs === "luca" ? "Luca × YZ" : "YZ"}
                  </span>{" "}
                  {f.result}
                </h3>
                <p>{f.detail}</p>
              </article>
            ))}
          </div>
        </Section>
      )}

      {mismatches.length > 0 && mismatchSummary && (
        <Section
          id="uyusmayan"
          title="Uyuşmayan çalışanlar — hangi değerler tutmuyor"
          hint={`${mismatchSummary.mismatchCount} kişi`}
          caption={
            <>
              Geçme kriteri ±0,01 TL — “kısmen geçti” yok. Her satırda farklı kalemler{" "}
              <strong>DHR / Luca (Δ)</strong>. Koyu çerçeve = girdi farkı; soluk = türeyen sonuç
              (SGK, vergi, brüt, net). Beklenen sapma (Okan masraf, 5746 damga) hata sayılmaz.
            </>
          }
        >
          <div className="stats compact">
            <Stat
              label="Uyuşmayan kişi"
              value={`${mismatchSummary.mismatchCount}/${mismatchSummary.totalCompared}`}
              tone={mismatchSummary.mismatchCount > 0 ? "bad" : "ok"}
            />
            <Stat
              label="Tam eşleşen kişi"
              value={String(mismatchSummary.fullMatchCount)}
              tone={mismatchSummary.fullMatchCount > 0 ? "ok" : "bad"}
            />
            <Stat
              label="Net ±0,01 TL"
              value={String(mismatchSummary.netPass001 ?? 0)}
              tone={(mismatchSummary.netPass001 ?? 0) > 0 ? "ok" : "bad"}
            />
            <Stat
              label="Farklı sebep sayısı"
              value={String(mismatchSummary.causeTally.length)}
              tone="warn"
            />
          </div>
          <label className="person-pick">
            <span>Sebebe göre filtrele</span>
            <select value={causeFilter} onChange={(e) => setCauseFilter(e.target.value)}>
              <option value="all">Tümü ({mismatches.length} kişi)</option>
              {mismatchSummary.causeTally.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.count} kişi)
                </option>
              ))}
            </select>
          </label>
          <div className="table-scroll">
            <table className="kalem-table mismatch-table">
              <thead>
                <tr>
                  <th className="center">#</th>
                  <th className="left">Çalışan ve fark sebebi</th>
                  <th className="num">ΔNet</th>
                  <th className="left col-sep">Uyuşmayan kalemler — DHR / Luca (Δ)</th>
                </tr>
              </thead>
              <tbody>
                {visibleMismatches.map((m) => (
                  <MismatchRowLine key={m.name} m={m} />
                ))}
              </tbody>
            </table>
          </div>

          <h3>Fark sebepleri — hangisi doğru + mevzuat</h3>
          <div className="cards bugs">
            {mismatchSummary.causeTally.map((c) => (
              <article key={c.id} className="card">
                <h3>
                  <span className={`pill ${c.expected ? "ok" : c.count >= 10 ? "bad" : "warn"}`}>
                    {c.expected ? "beklenen" : `${c.count} kişi`}
                  </span>{" "}
                  {c.title}
                </h3>
                <p>{c.detail}</p>
                {c.whichCorrect ? (
                  <p className="note">
                    <strong>Hangisi doğru:</strong> {c.whichCorrect}
                  </p>
                ) : null}
                {c.legalBasis ? (
                  <p className="note">
                    <strong>Mevzuat:</strong> {c.legalBasis}
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          {mismatchSummary.normalizations.length > 0 && (
            <>
              <h3>Kaynak verisi normalizasyonu</h3>
              <p className="caption">
                Aşağıdaki kalemler gerçekte uyuşuyor; yalnızca kaynak dosyalarda farklı yere
                yazıldığı için fark gibi görünüyordu. Karşılaştırmada düzeltildi.
              </p>
              <ul className="ok-list">
                {mismatchSummary.normalizations.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      <Section
        id="kalemler"
        title="Kalem kalem — DHR × Luca × YZ (toplam)"
        hint={`${kalemler.length} kalem`}
        caption="YZ = 2026 Türk mevzuatı (işçi SGK, işsizlik, GV, damga). Δ hücrelerindeki ince bar, farkın tablodaki en büyük farka oranını gösterir."
      >
        <div className="table-scroll">
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
                <th className="num">DHR=YZ</th>
              </tr>
            </thead>
            <tbody>
              {kalemler.map((k, idx) => {
                const dhrAi = k.deltaDhrAi;
                const tone = deltaRowTone(dhrAi, dhrPending || lucaPending);
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

      <section className="panel" id="kisi-kalem">
        <h2>Kişi bazlı kalem tablosu</h2>
        <p className="caption">
          {ui?.personCaption || "Çalışan seç → her kalemde DHR, Luca ve fark yan yana."}
        </p>
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
            <div className="table-scroll">
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
      </section>

      {matrix.scenarios.length > 0 && (
      <Section
        id="matrix"
        title="Test matrisi tasarımı"
        hint={`${matrix.matrixDesign.layers.length} katman`}
        defaultOpen={false}
        caption={`${matrix.environment} · ${matrix.sourceOfTruth}`}
      >
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
          {matrix.checkedItems.length > 0 && (
            <>
              <Stat label="Kontrol geçti" value={`${passCount}`} tone="ok" />
              <Stat label="Kontrol fail" value={`${failCount}`} tone="bad" />
            </>
          )}
          <Stat
            label="Luca senaryo"
            value={lucaPending ? "bekliyor" : `${lucaPass}/${matrix.scenarios.length}`}
            tone={lucaPending ? "warn" : "ok"}
          />
          <Stat
            label="YZ senaryo"
            value={`${matrix.scenarios.filter((s) => s.ai === "pass").length}/${matrix.scenarios.length}`}
            tone="ok"
          />
        </div>
      </Section>
      )}

      {matrix.checkedItems.length > 0 && (
      <Section
        id="checks"
        title="Kontrol edilenler"
        hint={`${passCount} geçti · ${failCount} fail`}
        defaultOpen={false}
        caption="Bordro / puantaj / kart doğrulama checklist’i"
      >
        <div className="table-scroll">
          <table>
            <colgroup>
              <col style={{ width: "22rem" }} />
              <col style={{ width: "7rem" }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th className="left">Kontrol</th>
                <th className="center">Sonuç</th>
                <th className="left">Not</th>
              </tr>
            </thead>
            <tbody>
              {matrix.checkedItems.map((c) => (
                <tr key={c.item} className={toneOf(c.result)}>
                  <td className="left">{c.item}</td>
                  <td className="center">
                    <Badge status={c.result} />
                  </td>
                  <td className="note left">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      )}

      {(matrix.correctFindings.length > 0 || matrix.dhrBugs.length > 0) && (
      <Section
        id="correct"
        title="Doğru çalışanlar"
        hint={`${matrix.dhrBugs.length} bulgu`}
        defaultOpen={false}
      >
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
      </Section>
      )}

      {matrix.scenarios.length > 0 && (
      <Section
        id="scenarios"
        title={`Test edilen senaryolar (${matrix.scenarios.length})`}
        defaultOpen={false}
        caption="DHR / Luca / YZ. YZ = 2026 Türkiye mevzuatı. Bekleyen kaynak kolon başlığında bir kez işaretlenir."
      >
        <div className="table-scroll">
          <table className="matrix-table sticky-name">
            <colgroup>
              <col style={{ width: "3.2rem" }} />
              <col style={{ width: "2.6rem" }} />
              <col style={{ width: "11rem" }} />
              <col span={4} />
              <col span={3} />
              <col />
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
                  Sonuç
                </th>
                <th className="left col-sep" />
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
              </tr>
            </thead>
            <tbody>
              {matrix.scenarios.map((s) => (
                <tr key={s.n} className={toneOf(lucaPending ? s.ai || "pending" : s.luca)}>
                  <td className="center sticky-col">{s.n}</td>
                  <td className="center sticky-col-2">{s.group}</td>
                  <td className="left sticky-col-3 sticky-edge">{s.name}</td>
                  <td className="left clamp2">
                    <span title={s.scenario}>{s.scenario}</span>
                  </td>
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
                  <td className="note left clamp2 col-sep">
                    <span title={s.verdict}>{s.verdict}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      )}

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
        <h2>{netChartTitle}</h2>
        <p className="caption">
          {netMode === "ai"
            ? "Luca ve DHR bekliyor; çubuklar YZ netini gösterir."
            : netMode === "deltaAi"
              ? "Luca bekliyor; çubuklar DHR ile YZ mevzuat neti arasındaki farkı gösterir. Pozitif = DHR net daha yüksek."
              : ui?.deltaChartCaption || "Pozitif = DHR net daha yüksek"}
        </p>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topNet} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3852" />
              <XAxis dataKey="name" tick={{ fill: "#9cabc1", fontSize: 13 }} />
              <YAxis tick={{ fill: "#9cabc1", fontSize: 13 }} unit=" TL" />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                formatter={(v: number) => [`${tr0(v)} TL`, netChartLabel]}
                labelFormatter={(_, p) => (p?.[0]?.payload as { full: string })?.full || ""}
              />
              <Bar dataKey="dNet" name={netChartLabel} radius={[4, 4, 0, 0]}>
                {topNet.map((e) => (
                  <Cell
                    key={e.full}
                    fill={
                      netMode === "ai"
                        ? "#38bdf8"
                        : Math.abs(e.dNet) > 4000
                          ? "#ef4444"
                          : Math.abs(e.dNet) > 1500
                            ? "#f59e0b"
                            : "#64748b"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <Section id="legal" title="Gelir vergisi istisnası — yasal çerçeve" className="legal">
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
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={gvMonthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3852" />
                  <XAxis dataKey="month" tick={{ fill: "#9cabc1", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#9cabc1", fontSize: 12 }} domain={[4000, 5800]} />
                  <Tooltip contentStyle={{ background: "#0f1626", border: "1px solid #2a3852" }} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Line type="stepAfter" dataKey="istisna" name="Yasal / YZ istisna" stroke="#38bdf8" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="dhrParam" name="DHR parametre (sabit)" stroke="#f97316" strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="dhrApplied" name="DHR fiilen uygulanan" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3>{ui?.gvCompareTitle || "İstisna karşılaştırması"}</h3>
            <p className="caption">TL · %15 dilim etkisi ≈ istisna × 0,15</p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gvCompare} layout="vertical" margin={{ left: 24, right: 12, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3852" />
                  <XAxis type="number" tick={{ fill: "#9cabc1", fontSize: 12 }} domain={[0, 6000]} />
                  <YAxis type="category" dataKey="label" width={140} tick={{ fill: "#9cabc1", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#0f1626", border: "1px solid #2a3852" }} formatter={(v: number) => [`${tr(v)} TL`, ""]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {gvCompare.map((e) => (
                      <Cell key={e.label} fill={e.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="legal-bullets">
              {(ui?.gvBullets || []).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>

        <h3 id="mevzuat">YZ kaynakları — Türkiye mevzuatı</h3>
        <p className="caption">{mevzuat.disclaimer}</p>
        <ul className="ref-list">
          {LEGAL_REFS.map((r) => (
            <li key={r.id}>
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.title}
              </a>
              <span>{r.usedFor}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="people" title="Tüm çalışanlar" hint={`${rows.length} kişi`}>
        <div className="table-scroll tall">
          <table className="sticky-name">
            <colgroup>
              <col style={{ width: "3.2rem" }} />
              <col style={{ width: "11rem" }} />
              <col style={{ width: "18rem" }} />
              <col span={3} />
              <col span={2} />
              <col span={4} />
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
                <th className="center col-sep" colSpan={4}>
                  YZ kesinti detayı
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
                <th className="num col-sep">GV</th>
                <th className="num">SGK</th>
                <th className="num">Damga</th>
                <th className="num">BES</th>
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
        <p>
          {ui?.footer || `${data.unit} · ${data.period}`}
        </p>
        <p className="footer-note">
          Bu site bilgilendirme amaçlıdır. YZ kolonu 2026 Türkiye mevzuatına (GVK, 5510, 4447, 488,
          7352) göre aylık izole hesaptır. Bordro kararı için DHR + Luca + mevzuat birlikte
          değerlendirilmelidir.
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
  const status = pending ? "YZ" : item.matchAi ? "OK" : "FARK";
  return (
    <tr className={pending ? "" : item.matchAi ? "ok" : "warn"}>
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
        <span className={`badge ${status === "OK" ? "ok" : status === "YZ" ? "yz" : "bad"}`}>
          {status}
        </span>
      </td>
    </tr>
  );
}

function MismatchRowLine({ m }: { m: MismatchRow }) {
  const net = m.netDelta ?? 0;
  const tone = m.severity === "high" ? "bad" : m.severity === "medium" || m.severity === "known" ? "warn" : "";
  return (
    <tr className={tone}>
      <td className="center">{m.n ?? "—"}</td>
      <td className="left">
        <strong>{m.name}</strong>
        <div className="note">{m.note}</div>
        <div className="causes">
          {m.causes.map((c) => (
            <span
              key={c.id}
              className={`pill ${c.expected ? "ok" : "warn"} cause-pill`}
              title={`${c.title} — ${c.detail}${c.whichCorrect ? ` · Hangisi doğru: ${c.whichCorrect}` : ""}`}
            >
              {c.short || c.title}
            </span>
          ))}
        </div>
      </td>
      <td className="num delta-cell">
        <Delta value={net} />
      </td>
      <td className="left col-sep">
        <div className="chips">
          {m.items.map((i) => (
            <span key={i.key} className={`chip ${i.derived ? "" : "input"}`}>
              <b>{i.label}</b>
              <span className="chip-vals">
                {tr(i.dhr)} / {tr(i.luca)}
              </span>
              <em className={deltaClass(i.delta)}>
                {i.delta == null ? "—" : `${i.delta > 0 ? "+" : ""}${tr(i.delta)}`}
              </em>
            </span>
          ))}
        </div>
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
  if (s === "known" || s === "partial" || s === "pending") return "warn";
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
            : status === "pending"
              ? "BEKLİYOR"
              : status;
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
  const dhrAi = r.delta?.netAi;
  const note = r.note || r.profile || "";
  return (
    <tr
      className={deltaRowTone(dhrAi, dhrPending || lucaPending)}
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
      <td className="note left clamp2">
        <span title={note}>{note}</span>
      </td>
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
        <Delta value={dhrAi} scale={scale} />
      </td>
      <td className="num col-sep">
        <Money value={r.ai?.gv} />
      </td>
      <td className="num">
        <Money value={r.ai?.sgk} digits={0} />
      </td>
      <td className="num">
        <Money value={r.ai?.damga} />
      </td>
      <td className="num">
        <Money value={r.ai?.bes} digits={0} />
      </td>
    </tr>
  );
}
