"use client";
import { useId, useState, type ReactNode } from "react";
import { Icon } from "../crm/ui";

export function Delta({
  value,
  unit = "%",
  invert = false,
}: {
  value: number | null;
  unit?: string;
  invert?: boolean;
}) {
  if (value === null || !Number.isFinite(value))
    return <span className="text-[11px] text-slate-400">brak porównania</span>;
  const good = invert ? value < 0 : value > 0;
  const flat = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${flat ? "bg-slate-100 text-slate-500" : good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
    >
      {flat ? "±" : value > 0 ? "▲" : "▼"} {Math.abs(value)}
      {unit}
    </span>
  );
}

export function Spark({
  values,
  color = "var(--brand-500)",
  height = 36,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const gid = useId().replace(/:/g, "");
  if (values.length < 2) return <div style={{ height }} />;
  const max = Math.max(1, ...values),
    min = Math.min(0, ...values),
    w = 120;
  const pts = values.map(
    (v, i) =>
      [
        (i / (values.length - 1)) * w,
        height - 3 - ((v - min) / (max - min || 1)) * (height - 6),
      ] as const,
  );
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full"
      style={{ height }}
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${line} L${w},${height} L0,${height} Z`}
        fill={`url(#${gid})`}
      />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function KpiTile({
  label,
  value,
  icon,
  delta,
  deltaUnit,
  invert,
  trend,
  color = "var(--brand-500)",
  hint,
  onClick,
}: {
  label: string;
  value: string;
  icon: string;
  delta?: number | null;
  deltaUnit?: string;
  invert?: boolean;
  trend?: number[];
  color?: string;
  hint?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-slate-200/70 bg-white p-4 text-left shadow-[0_1px_2px_#1e1b4b0a] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_#3a22b8]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-slate-500">
          {label}
        </span>
        <span
          className="grid size-8 shrink-0 place-items-center rounded-xl"
          style={{
            background: `color-mix(in srgb, ${color} 9%, transparent)`,
            color,
          }}
        >
          <Icon name={icon} size={16} />
        </span>
      </div>
      <strong className="mt-2 block truncate text-[24px] leading-tight font-bold tracking-tight text-slate-800 tabular-nums">
        {value}
      </strong>
      <div className="mt-1 flex min-h-5 items-center gap-2">
        {delta !== undefined && (
          <Delta value={delta} unit={deltaUnit} invert={invert} />
        )}
        {hint && (
          <span className="truncate text-[11px] text-slate-400">{hint}</span>
        )}
      </div>
      {trend && (
        <div className="-mx-4 mt-2 -mb-4">
          <Spark values={trend} color={color} />
        </div>
      )}
    </Tag>
  );
}

export function BarList({
  items,
  format,
  color = "var(--brand-500)",
  empty = "Brak danych w tym okresie.",
}: {
  items: { label: string; value: number; sub?: string }[];
  format: (v: number) => string;
  color?: string;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length || items.every((i) => !i.value))
    return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="grid gap-3">
      {items.map((i) => (
        <li key={i.label} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">
              {i.label}
              {i.sub && (
                <small className="ml-2 text-xs text-slate-400">{i.sub}</small>
              )}
            </span>
            <strong className="shrink-0 text-slate-800 tabular-nums">
              {format(i.value)}
            </strong>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${(i.value / max) * 100}%`,
                background: `linear-gradient(90deg, color-mix(in srgb, ${color} 65%, transparent), ${color})`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Columns({
  items,
  format,
  color = "var(--brand-500)",
  height = 160,
  empty,
}: {
  items: { label: string; value: number }[];
  format: (v: number) => string;
  color?: string;
  height?: number;
  empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const active = hover ?? items.length - 1;
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total && empty)
    return <p className="py-4 text-center text-sm text-slate-400">{empty}</p>;
  return (
    <div>
      <div
        className="mb-3 flex items-baseline justify-between gap-3"
        aria-live="polite"
      >
        <span className="text-xs text-slate-500">
          {items[active]?.label ?? "—"}
        </span>
        <strong className="text-sm text-slate-800 tabular-nums">
          {items[active] ? format(items[active].value) : "—"}
          <small className="ml-2 text-xs font-normal text-slate-400">
            suma {format(total)}
          </small>
        </strong>
      </div>
      <div
        className="flex items-end gap-1.5"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {items.map((i, index) => (
          <button
            type="button"
            key={`${i.label}-${index}`}
            aria-label={`${i.label}: ${format(i.value)}`}
            onMouseEnter={() => setHover(index)}
            onFocus={() => setHover(index)}
            className="flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
          >
            <span
              className="block w-full rounded-t-md transition-all duration-500"
              style={{
                height: `${Math.max(i.value ? 4 : 2, (i.value / max) * 100)}%`,
                background: i.value
                  ? index === active
                    ? color
                    : `color-mix(in srgb, ${color} 55%, transparent)`
                  : "#e2e8f0",
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {items.map((i, index) => (
          <span
            key={`${i.label}-l-${index}`}
            className={`min-w-0 flex-1 truncate text-center text-[10px] ${index === active ? "font-semibold text-slate-700" : "text-slate-400"}`}
          >
            {items.length > 14 && index % 2 ? "" : i.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Donut({
  segments,
  center,
  caption,
}: {
  segments: { label: string; value: number; color: string }[];
  center: string;
  caption: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 40,
    c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative grid size-[120px] shrink-0 place-items-center">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 -rotate-90"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="11"
          />
          {total > 0 &&
            segments.map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="11"
                  strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="text-center">
          <strong className="block text-xl leading-none font-bold text-slate-800 tabular-nums">
            {center}
          </strong>
          <span className="text-[10px] text-slate-500">{caption}</span>
        </div>
      </div>
      <ul className="grid min-w-[140px] flex-1 gap-2 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <i
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="flex-1 truncate text-slate-600">{s.label}</span>
            <strong className="text-slate-800 tabular-nums">{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Heatmap({
  days,
  title,
}: {
  days: { date: string; value: number }[];
  title: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const first = days[0]
    ? (new Date(`${days[0].date}T12:00:00Z`).getUTCDay() + 6) % 7
    : 0;
  const cells = [...Array(first).fill(null), ...days];
  const weeks: ({ date: string; value: number } | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const shade = (v: number) =>
    !v
      ? "#f1f5f9"
      : v / max > 0.75
        ? "var(--brand-700)"
        : v / max > 0.5
          ? "var(--brand-500)"
          : v / max > 0.25
            ? "var(--brand-300)"
            : "var(--brand-200)";
  return (
    <div role="img" aria-label={title} className="overflow-x-auto">
      <div className="flex gap-[3px]">
        {weeks.map((w, wi) => (
          <div key={wi} className="grid gap-[3px]">
            {Array.from({ length: 7 }, (_, di) => {
              const d = w[di];
              return (
                <span
                  key={di}
                  title={d ? `${d.date}: ${d.value}` : undefined}
                  className="block size-3.5 rounded-[4px]"
                  style={{ background: d ? shade(d.value) : "transparent" }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
        mniej
        {[
          "#f1f5f9",
          "var(--brand-200)",
          "var(--brand-300)",
          "var(--brand-500)",
          "var(--brand-700)",
        ].map((c) => (
          <i
            key={c}
            className="size-2.5 rounded-[3px]"
            style={{ background: c }}
          />
        ))}
        więcej
      </div>
    </div>
  );
}

export function Panel({
  eyebrow,
  title,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`crm-card min-w-0 p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <span className="crm-eyebrow">{eyebrow}</span>}
          <h3 className="mt-1 text-base! leading-snug">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Funnel({
  stages,
  format,
  empty = "Dodaj szanse sprzedaży, aby zobaczyć konwersję etapów.",
}: {
  stages: {
    label: string;
    count: number;
    value: number;
    rate: number | null;
  }[];
  format: (v: number) => string;
  empty?: string;
}) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  if (!stages[0]?.count)
    return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  const overall =
    stages[0].count && stages.length
      ? Math.round((stages[stages.length - 1].count / stages[0].count) * 100)
      : 0;
  return (
    <div>
      <ol className="grid gap-1.5">
        {stages.map((s, i) => (
          <li key={s.label} className="grid gap-1">
            {i > 0 && (
              <span className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400 tabular-nums">
                ↓ {s.rate ?? 0}% przechodzi dalej
              </span>
            )}
            <div
              className="relative mx-auto flex h-10 items-center justify-between overflow-hidden rounded-xl px-3 text-xs text-white transition-[width] duration-700"
              style={{
                width: `${52 + (s.count / max) * 48}%`,
                background: `linear-gradient(90deg, var(--brand-${[400, 500, 600, 700][i] ?? 600}), var(--brand-${[500, 600, 700, 800][i] ?? 700}))`,
              }}
            >
              <strong className="truncate">{s.label}</strong>
              <span className="shrink-0 tabular-nums opacity-90">
                {s.count} · {format(s.value)}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Od nowej szansy do wygranej:{" "}
        <strong className="text-slate-800 tabular-nums">{overall}%</strong>
      </p>
    </div>
  );
}

export function Schedule({
  buckets,
  format,
}: {
  buckets: {
    label: string;
    count: number;
    value: number;
    weighted: number;
    overdue: boolean;
  }[];
  format: (v: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const total = buckets.reduce((s, b) => s + b.value, 0);
  if (!total)
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        Brak otwartych szans z terminem zamknięcia.
      </p>
    );
  const point = active === null ? null : buckets[active];
  return (
    <div>
      <div
        className="mb-3 flex items-baseline justify-between gap-3"
        aria-live="polite"
      >
        <span className="text-xs text-slate-500">
          {point
            ? `${point.label} · ${point.count} szans`
            : "Otwarty lejek razem"}
        </span>
        <strong className="text-sm text-slate-800 tabular-nums">
          {format(point ? point.value : total)}
          <small className="ml-2 text-xs font-normal text-slate-400">
            ważone{" "}
            {format(
              point
                ? point.weighted
                : buckets.reduce((s, b) => s + b.weighted, 0),
            )}
          </small>
        </strong>
      </div>
      <div
        className="flex h-36 items-end gap-2"
        onMouseLeave={() => setActive(null)}
      >
        {buckets.map((b, i) => (
          <button
            key={b.label}
            type="button"
            aria-label={`${b.label}: ${format(b.value)}, ważone ${format(b.weighted)}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
          >
            <span
              className="relative block w-full overflow-hidden rounded-t-lg transition-all duration-500"
              style={{
                height: `${Math.max(b.value ? 4 : 2, (b.value / max) * 100)}%`,
                background: b.value
                  ? b.overdue
                    ? "#fecdd3"
                    : "var(--brand-200)"
                  : "#e2e8f0",
              }}
            >
              <span
                className="absolute inset-x-0 bottom-0 block"
                style={{
                  height: `${b.value ? (b.weighted / b.value) * 100 : 0}%`,
                  background: b.overdue ? "#f43f5e" : "var(--brand-600)",
                  opacity: active === null || active === i ? 1 : 0.55,
                }}
              />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {buckets.map((b) => (
          <span
            key={b.label}
            className={`min-w-0 flex-1 truncate text-center text-[10px] ${b.overdue && b.count ? "font-semibold text-rose-600" : "text-slate-500"}`}
          >
            {b.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm bg-[var(--brand-600)]" />
          Wartość ważona
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm bg-[var(--brand-200)]" />
          Pełna wartość
        </span>
      </div>
    </div>
  );
}
