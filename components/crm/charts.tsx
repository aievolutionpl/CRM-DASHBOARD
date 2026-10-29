"use client";
import { useId, useState } from "react";
import type { ChartPoint } from "@/lib/crm/analytics";
const number = (v: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(v);
export function AreaChart({
  points,
  title,
  format = number,
  color = "var(--brand-500)",
}: {
  points: ChartPoint[];
  title: string;
  format?: (v: number) => string;
  color?: string;
}) {
  const gradient = useId().replace(/:/g, ""),
    [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value ?? 0)),
    width = 700,
    height = 150;
  const x = (i: number) =>
    50 + (points.length <= 1 ? width / 2 : (i * width) / (points.length - 1));
  const y = (value: number) => 170 - (value / max) * height;
  const segments: { path: string; start: number; end: number }[] = [];
  let current: { path: string; start: number; end: number } | null = null;
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current) segments.push(current);
      current = null;
    } else if (current) {
      current.path += ` L${x(i)},${y(p.value)}`;
      current.end = x(i);
    } else current = { path: `M${x(i)},${y(p.value)}`, start: x(i), end: x(i) };
  });
  if (current) segments.push(current);
  const selected =
    hover === null ? points.findLastIndex((p) => p.value !== null) : hover;
  const point = points[selected];
  return (
    <div className="growth-area-chart">
      <div className="growth-chart-readout" aria-live="polite">
        <span>{point?.label || "Brak danych"}</span>
        <strong>
          {point?.value != null ? format(point.value) : "Brak danych"}
        </strong>
      </div>
      <svg viewBox="0 0 800 210" role="group" aria-label={title}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".23" />
            <stop offset="100%" stopColor={color} stopOpacity=".015" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1="50"
              x2="750"
              y1={y(max * ratio)}
              y2={y(max * ratio)}
              stroke="#dde1ef"
              strokeDasharray="4 6"
            />
            <text x="0" y={y(max * ratio) + 4} fill="#687187" fontSize="11">
              {number(max * ratio)}
            </text>
          </g>
        ))}
        {segments.map(({ path, start, end }, i) => (
          <g key={i}>
            <path
              d={`${path} L${end},170 L${start},170 Z`}
              fill={`url(#${gradient})`}
            />
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}
        {points.map(
          (p, i) =>
            p.value !== null && (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={selected === i ? 6 : 4}
                fill="white"
                stroke={color}
                strokeWidth="2"
                tabIndex={0}
                role="button"
                aria-label={`${p.label}: ${format(p.value)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setHover(i);
                  }
                }}
              >
                <title>
                  {p.label}: {format(p.value)}
                </title>
              </circle>
            ),
        )}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1]
          .filter((v, i, a) => v >= 0 && a.indexOf(v) === i)
          .map((i) => (
            <text
              key={i}
              x={x(i)}
              y="202"
              textAnchor="middle"
              fill="#687187"
              fontSize="11"
            >
              {points[i].label.slice(5, 10).split("-").reverse().join(".")}
            </text>
          ))}
      </svg>
      <details className="growth-chart-data">
        <summary>Dane wykresu</summary>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Okres</th>
                <th>{title}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td>{p.value === null ? "Brak danych" : format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
export function DonutChart({
  items,
  title,
  format = number,
}: {
  items: { label: string; value: number; color: string }[];
  title: string;
  format?: (v: number) => string;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  let position = 0;
  const stops = items
    .filter((i) => i.value > 0)
    .map((i) => {
      const start = position;
      position += (i.value / total) * 100;
      return `${i.color} ${start}% ${position}%`;
    });
  return (
    <div className="growth-donut-layout">
      <div
        className="growth-donut"
        role="img"
        aria-label={`${title}: ${items.map((i) => `${i.label} ${format(i.value)}`).join(", ")}`}
        style={{
          background: total ? `conic-gradient(${stops.join(",")})` : "#e6e8f0",
        }}
      >
        <div>
          <strong>{format(total)}</strong>
          <span>{title}</span>
        </div>
      </div>
      <ul className="growth-chart-legend">
        {items.map((i) => (
          <li key={i.label}>
            <span
              className="growth-legend-dot"
              style={{ background: i.color }}
            />
            <span>{i.label}</span>
            <strong>{format(i.value)}</strong>
            <small>{total ? Math.round((i.value / total) * 100) : 0}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
