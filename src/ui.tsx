import { useEffect, useState, type ReactNode } from "react";
import { tr } from "./types";

/** Panel. `collapsible` kapalıysa başlık her zaman açık, caret yok. */
export function Section({
  id,
  title,
  hint,
  caption,
  defaultOpen = true,
  collapsible = true,
  className = "",
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  caption?: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const head = (
    <div className="sec-head">
      {collapsible ? (
        <span className="sec-caret" aria-hidden="true">
          ▶
        </span>
      ) : null}
      <h2>{title}</h2>
      {hint ? <span className="sec-hint">{hint}</span> : null}
    </div>
  );
  const body = (
    <>
      {caption ? <p className="caption">{caption}</p> : null}
      {children}
    </>
  );
  if (!collapsible) {
    return (
      <section className={`panel ${className}`.trim()} id={id}>
        {head}
        {body}
      </section>
    );
  }
  return (
    <details className={`panel ${className}`.trim()} id={id} open={defaultOpen}>
      <summary>{head}</summary>
      {body}
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

const tabIconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
  className: "tab-ico",
  focusable: "false" as const,
};

/** Üst dönem sekmeleri — metinle birlikte küçük çizgi ikon. */
export function TabIcon({ id }: { id: string }) {
  switch (id) {
    case "durum":
      return (
        <svg {...tabIconProps}>
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      );
    case "ekim":
      return (
        <svg {...tabIconProps}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
        </svg>
      );
    case "ocak":
      return (
        <svg {...tabIconProps}>
          <path d="M12 2v4" />
          <path d="M12 18v4" />
          <path d="m4.93 4.93 2.83 2.83" />
          <path d="m16.24 16.24 2.83 2.83" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
          <path d="m4.93 19.07 2.83-2.83" />
          <path d="m16.24 7.76 2.83-2.83" />
        </svg>
      );
    case "izole":
      return (
        <svg {...tabIconProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      );
    case "paket":
      return (
        <svg {...tabIconProps}>
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "faz1":
      return (
        <svg {...tabIconProps}>
          <path d="M10 2v7.31" />
          <path d="M14 9.3V2" />
          <path d="M8.5 2h7" />
          <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
        </svg>
      );
    case "girisler":
      return (
        <svg {...tabIconProps}>
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="m21 2-9.6 9.6" />
          <path d="m15.5 7.5 3 3L22 7l-3-3" />
        </svg>
      );
    default:
      return null;
  }
}
