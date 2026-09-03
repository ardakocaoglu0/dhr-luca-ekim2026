import { useMemo, useState } from "react";
import type { OcakBug, OcakData, OcakRow, OcakWarning } from "./ocakTypes";

type Props = { data: OcakData };

export default function OcakView({ data }: Props) {
  const rows = data.rows;
  const bugs = data.bugs;
  const warnings = data.warnings ?? [];
  const [sortKey, setSortKey] = useState<"name" | "net" | "gv" | "bes">("name");

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sortKey === "net") copy.sort((a, b) => (b.ocak.net ?? 0) - (a.ocak.net ?? 0));
    else if (sortKey === "gv") copy.sort((a, b) => (b.ocak.gv ?? 0) - (a.ocak.gv ?? 0));
    else if (sortKey === "bes") copy.sort((a, b) => (b.ocak.bes ?? 0) - (a.ocak.bes ?? 0));
    else copy.sort((a, b) => (a.sicil || "").localeCompare(b.sicil || "", undefined, { numeric: true }));
    return copy;
  }, [rows, sortKey]);

  const fixedCount = bugs.filter((b) => b.ocakStatus === "fixed").length;
  const brokenCount = bugs.filter((b) => b.ocakStatus === "still_broken").length;

  return (
    <div>
      <section className="panel">
        <h2>Ocak 2026 — Bug Durumu</h2>
        <p className="caption">
          Açık kalan DHR sapmaları. Düzelen GV/BES/stajyer kayıtları listeden çıkarıldı. Kaynak: UI API.
        </p>
        <div className="stats compact">
          <Stat label="Düzelen bug" value={String(fixedCount)} tone="ok" />
          <Stat label="Devam eden" value={String(brokenCount)} tone="bad" />
          <Stat label="Uyarı" value={String(warnings.length)} tone={warnings.length ? "warn" : "ok"} />
          <Stat label="Toplam net" value={`${tr0(data.summary.totalNet)} TL`} />
          <Stat label="Ort. net" value={`${tr0(data.summary.avgNet)} TL`} />
          <Stat label="GV istisna uygulanan" value={`${data.summary.gvExemptionAppliedCount}/32`} tone="ok" />
          <Stat label="BES > 0" value={`${data.summary.besCount} kişi`} tone={data.summary.besCount <= 1 ? "ok" : "warn"} />
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Bug ID</th>
                <th>Başlık</th>
                <th>Ekim</th>
                <th>Ocak</th>
                <th>Detay</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((b) => (
                <BugRow key={b.id} bug={b} />
              ))}
            </tbody>
          </table>
        </div>

        {warnings.length > 0 && (
          <>
            <h3>Uyarılar</h3>
            <div className="cards bugs">
              {warnings.map((w) => (
                <WarningCard key={w.id} warning={w} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Ocak 2026 — 32 Çalışan Bordro Detayı (UI)</h2>
        <p className="caption">
          Kaynak: dhrtest UI API — <code>/api/PayrollPeriod</code> detail. Excel:{" "}
          <a href="downloads/Payroll_Ocak_2026.xlsx" download>
            Payroll_Ocak_2026.xlsx
          </a>
        </p>
        <label className="person-pick">
          <span>Sıralama</span>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)}>
            <option value="name">Sicil</option>
            <option value="net">Net (azalan)</option>
            <option value="gv">GV (azalan)</option>
            <option value="bes">BES (azalan)</option>
          </select>
        </label>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sicil</th>
                <th>Ad Soyad</th>
                <th>Brüt</th>
                <th>GV</th>
                <th>GV İst.</th>
                <th>Damga</th>
                <th>SGK İşçi</th>
                <th>İşsizlik</th>
                <th>BES</th>
                <th>Kesinti Top.</th>
                <th>Net</th>
                <th>İşveren Mal.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <OcakRowView key={r.sicil} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rows.some((r) => r.ekim) && (
        <section className="panel">
          <h2>Ocak vs Ekim Karşılaştırması</h2>
          <p className="caption">ΔNet = Ocak net − Ekim net</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sicil</th>
                  <th>Ad</th>
                  <th>Ekim Net</th>
                  <th>Ocak Net</th>
                  <th>ΔNet</th>
                  <th>ΔBES</th>
                  <th>ΔGV</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.ekim)
                  .map((r) => (
                    <tr
                      key={r.sicil}
                      className={Math.abs(r.delta?.net ?? 0) > 3000 ? "warn" : ""}
                    >
                      <td>{r.sicil}</td>
                      <td className="left">{r.name}</td>
                      <td>{tr(r.ekim?.net)}</td>
                      <td>{tr(r.ocak.net)}</td>
                      <td className={deltaClass(r.delta?.net)}>
                        {r.delta?.net != null
                          ? `${r.delta.net > 0 ? "+" : ""}${tr(r.delta.net)}`
                          : "—"}
                      </td>
                      <td className={deltaClass(r.delta?.bes)}>
                        {r.delta?.bes != null
                          ? `${r.delta.bes > 0 ? "+" : ""}${tr(r.delta.bes)}`
                          : "—"}
                      </td>
                      <td className={deltaClass(r.delta?.gv)}>
                        {r.delta?.gv != null
                          ? `${r.delta.gv > 0 ? "+" : ""}${tr(r.delta.gv)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function OcakRowView({ row }: { row: OcakRow }) {
  const o = row.ocak;
  return (
    <tr>
      <td>{row.sicil}</td>
      <td className="left">{row.name}</td>
      <td>{tr(o.gross)}</td>
      <td>{tr(o.gv)}</td>
      <td>{tr(o.gvExemption)}</td>
      <td>{tr(o.damga)}</td>
      <td>{tr(o.sgk)}</td>
      <td>{tr(o.unemployment)}</td>
      <td>{tr(o.bes)}</td>
      <td>{tr(o.kesintilerToplami)}</td>
      <td><strong>{tr(o.net)}</strong></td>
      <td>{tr(o.isverenMaliyeti)}</td>
    </tr>
  );
}

function BugRow({ bug }: { bug: OcakBug }) {
  const statusColor = bug.ocakStatus === "fixed" ? "ok" : bug.ocakStatus === "still_broken" ? "bad" : "warn";
  const statusLabel = bug.ocakStatus === "fixed" ? "DÜZELDİ" : bug.ocakStatus === "still_broken" ? "DEVAM" : bug.ocakStatus.toUpperCase();
  return (
    <tr className={statusColor}>
      <td><code>{bug.id}</code></td>
      <td className="left">{bug.title}</td>
      <td><span className={`badge ${bug.ekimStatus === "fail" ? "bad" : bug.ekimStatus === "known" ? "warn" : "ok"}`}>{bug.ekimStatus.toUpperCase()}</span></td>
      <td><span className={`badge ${statusColor}`}>{statusLabel}</span></td>
      <td className="note left">{bug.ocakDetail}</td>
    </tr>
  );
}

function WarningCard({ warning }: { warning: OcakWarning }) {
  const tone = warning.severity === "error" ? "bad" : warning.severity === "info" ? "ok" : "warn";
  return (
    <article className={`card ${tone}`}>
      <h3>
        <span className={`pill ${tone}`}>{warning.severity.toUpperCase()}</span> {warning.title}
      </h3>
      <p>{warning.detail}</p>
    </article>
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

function deltaClass(n: number | null | undefined): string {
  if (n == null || Math.abs(n) < 0.05) return "";
  return n > 0 ? "pos" : "neg";
}

function tr(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function tr0(n: number | null | undefined): string {
  return tr(n, 0);
}
