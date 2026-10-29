"use client";
import { useState } from "react";
import { useCrm } from "@/stores/crm-store";
import { monitorBrand } from "@/stores/brand-scan";
import { brandAlerts, type BrandPoint } from "@/lib/brand/model";
import { newJob } from "@/lib/automation/model";
import { id as newId } from "@/lib/crm/model";
import { Icon } from "../crm/ui";
import { Panel } from "../insights/kit";

const SERIES = [
  {
    key: "score",
    label: "Wynik strony",
    color: "var(--brand-600)",
    value: (p: BrandPoint) => p.score,
    format: (v: number) => `${v}/100`,
  },
  {
    key: "rating",
    label: "Ocena klientów",
    color: "#f59e0b",
    value: (p: BrandPoint) => (p.rating === null ? null : p.rating * 20),
    format: (v: number) => (v / 20).toFixed(1),
  },
] as const;
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
  });

export default function BrandHistory({
  notify,
  readOnly,
}: {
  notify: (text: string) => void;
  readOnly: boolean;
}) {
  const brand = useCrm((s) => s.brand);
  const jobs = useCrm((s) => s.automation.jobs);
  const saveJob = useCrm((s) => s.saveJob);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  if (!brand) return null;
  const history = brand.history;
  const monitored = jobs.find((j) => j.kind === "brand" && j.enabled);
  const alerts = brandAlerts(history);
  const w = 600,
    h = 150,
    pad = 8;
  const x = (i: number) =>
    history.length < 2
      ? w / 2
      : pad + (i / (history.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - (v / 100) * (h - 2 * pad);
  const point = active === null ? history.at(-1) : history[active];
  async function scanNow() {
    setBusy(true);
    try {
      notify((await monitorBrand()).message);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Nie udało się przeskanować.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      eyebrow="MONITORING MARKI"
      title="Jak zmienia się Twoja obecność online"
      action={
        <div className="flex flex-wrap gap-2">
          <button
            className="crm-button secondary"
            disabled={busy || readOnly}
            onClick={() => void scanNow()}
          >
            {busy ? "Skanuję…" : "Skanuj teraz"}
          </button>
          {!monitored && (
            <button
              className="crm-button"
              disabled={readOnly}
              onClick={() => {
                saveJob(
                  newJob(
                    {
                      name: "Cotygodniowy monitoring marki",
                      kind: "brand",
                      frequency: "weekly",
                      weekday: 1,
                      time: "08:15",
                    },
                    newId(),
                  ),
                );
                notify(
                  "Dodano cotygodniowy monitoring marki (poniedziałek 8:15) w Harmonogramie.",
                );
              }}
            >
              <Icon name="clock" size={15} /> Monitoruj co tydzień
            </button>
          )}
        </div>
      }
    >
      {alerts.length > 0 && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          Od poprzedniego skanu: {alerts.join("; ")}.
        </p>
      )}
      {history.length ? (
        <>
          <div
            className="mb-3 flex flex-wrap items-baseline justify-between gap-3"
            aria-live="polite"
          >
            <span className="text-xs text-slate-500">
              {point ? `Skan ${date(point.at)}` : ""}
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {point?.score !== null && point?.score !== undefined && (
                <span>
                  Strona{" "}
                  <strong className="tabular-nums">{point.score}/100</strong>
                </span>
              )}
              {point?.rating !== null && point?.rating !== undefined && (
                <span>
                  Ocena{" "}
                  <strong className="tabular-nums">
                    {point.rating.toFixed(1)}
                  </strong>{" "}
                  ({point.reviews})
                </span>
              )}
              {point?.stars !== null && point?.stars !== undefined && (
                <span>
                  GitHub{" "}
                  <strong className="tabular-nums">★ {point.stars}</strong>
                </span>
              )}
              {point && (
                <span>
                  Problemy{" "}
                  <strong className="tabular-nums">{point.issues}</strong>
                </span>
              )}
            </span>
          </div>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="h-36 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Historia wyniku strony i oceny klientów"
            onMouseLeave={() => setActive(null)}
          >
            {[25, 50, 75].map((v) => (
              <line
                key={v}
                x1="0"
                x2={w}
                y1={y(v)}
                y2={y(v)}
                stroke="#eef0f6"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {SERIES.map((s) => {
              const pts = history
                .map((p, i) => [i, s.value(p)] as const)
                .filter((p): p is readonly [number, number] => p[1] !== null);
              if (!pts.length) return null;
              return (
                <g key={s.key}>
                  {pts.length > 1 && (
                    <path
                      d={pts
                        .map(
                          ([i, v], n) =>
                            `${n ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`,
                        )
                        .join(" ")}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {pts.map(([i, v]) => (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={active === i ? 5 : 3.5}
                      fill={s.color}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              );
            })}
            {history.map((p, i) => (
              <rect
                key={p.at}
                x={x(i) - w / Math.max(2, history.length) / 2}
                y="0"
                width={w / Math.max(2, history.length)}
                height={h}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
              />
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="flex gap-4">
              {SERIES.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  <i
                    className="size-2.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </span>
              ))}
            </span>
            <span>
              {history.length} skan(ów) ·{" "}
              {monitored
                ? `automatycznie: ${monitored.name}`
                : "monitoring wyłączony"}
            </span>
          </div>
          <details className="crm-data-table mt-3">
            <summary>Dane historii</summary>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Strona</th>
                    <th>Ocena</th>
                    <th>Opinie</th>
                    <th>GitHub ★</th>
                    <th>Problemy</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((p) => (
                    <tr key={p.at}>
                      <th scope="row">{p.at.slice(0, 10)}</th>
                      <td>{p.score ?? "—"}</td>
                      <td>{p.rating?.toFixed(1) ?? "—"}</td>
                      <td>{p.reviews}</td>
                      <td>{p.stars ?? "—"}</td>
                      <td>{p.issues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Historia pojawi się po kolejnym skanie. Włącz cotygodniowy monitoring,
          a Harmonogram sam porówna wyniki i ostrzeże o spadkach.
        </p>
      )}
    </Panel>
  );
}
