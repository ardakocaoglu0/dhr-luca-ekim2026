import { useEffect, useState, type ReactNode } from "react";
import { tr } from "./types";

/** Katlanabilir panel. Uzun sayfalarda ikincil bölümler kapalı başlar. */
export function Section({
  id,
  title,
  hint,
  caption,
  defaultOpen = true,
  className = "",
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  caption?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={`panel ${className}`.trim()} id={id} open={defaultOpen}>
      <summary>
        <div className="sec-head">
          <span className="sec-caret" aria-hidden="true">
            ▶
          </span>
          <h2>{title}</h2>
          {hint ? <span className="sec-hint">{hint}</span> : null}
        </div>
      </summary>
      {caption ? <p className="caption">{caption}</p> : null}
      {children}
    </details>
  );
}

/** Para hücresi: bekleyen kolon → nokta, 0 → soluk, dolu → normal. */
export function Money({
  value,
  pending = false,
  yz = false,
  digits = 2,
}: {
  value: number | null | undefined;
  pending?: boolean;
  yz?: boolean;
  digits?: number;
}) {
  if (pending) {
    return (
      <span className="wait-cell" title="Bu kaynak henüz yok">
        ·
      </span>
    );
  }
  if (value == null || !Number.isFinite(value)) return <span className="zero">—</span>;
  const cls = [yz ? "yz-cell" : "", value === 0 ? "zero" : ""].filter(Boolean).join(" ");
  return <span className={cls || undefined}>{tr(value, digits)}</span>;
}

export function deltaTone(n: number | null | undefined): "ok" | "warn" | "bad" | "none" {
  if (n == null || !Number.isFinite(n)) return "none";
  const abs = Math.abs(n);
  if (abs <= 0.01) return "ok";
  if (abs <= 1500) return "warn";
  return "bad";
}

/**
 * Fark hücresi. Renk tek ayırt edici işaret değil: yön glifi (▲/▼) her zaman var.
 * `scale` verilirse büyüklük oranını gösteren ince bir bar çizilir.
 */
export function Delta({ value, scale }: { value: number | null | undefined; scale?: number }) {
  if (value == null || !Number.isFinite(value)) return <span className="zero">—</span>;
  const tone = deltaTone(value);
  if (tone === "ok") {
    return (
      <span className="delta delta-ok" title="Fark ±0,01 TL içinde">
        0,00
      </span>
    );
  }
  const pct = scale && scale > 0 ? Math.min(100, (Math.abs(value) / scale) * 100) : null;
  return (
    <span className={`delta delta-${tone}`}>
      <span className="delta-sign" aria-hidden="true">
        {value > 0 ? "▲" : "▼"}
      </span>
      {tr(Math.abs(value))}
      {pct != null ? <span className="delta-bar" style={{ width: `${Math.max(4, pct)}%` }} /> : null}
    </span>
  );
}

/** Kolon başlığında bir kez gösterilen bekleme rozeti. */
export function PendingTag({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="th-badge">BEKLİYOR</span>;
}

/** İlk `max` etiketi gösterir, kalanını "+N" olarak toplar. */
export function Tags({ items, max = 3 }: { items?: string[]; max?: number }) {
  if (!items || items.length === 0) return <span className="zero">—</span>;
  const head = items.slice(0, max);
  const rest = items.length - head.length;
  return (
    <>
      {head.map((t) => (
        <span key={t} className="tag">
          {t}
        </span>
      ))}
      {rest > 0 ? (
        <span className="tag more" title={items.join(", ")}>
          +{rest}
        </span>
      ) : null}
    </>
  );
}

/** Yapışkan bölüm gezinmesi; kaydırırken aktif bölümü vurgular. */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const targets = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el != null);
    if (!targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="section-nav" aria-label="Bölümler">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className={active === i.id ? "active" : undefined}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}
