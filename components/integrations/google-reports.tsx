"use client";
import { useEffect, useState } from "react";
import { localRequest } from "@/lib/local/client";
import {
  providerLabels,
  type GoogleReport,
  type IntegrationResult,
} from "@/lib/integrations/model";
import { AreaChart } from "../crm/charts";
import { dailySeries } from "@/lib/crm/analytics";
const labels: Record<string, string> = {
  cost: "Koszt reklam",
  conversions: "Konwersje Ads",
  conversionValue: "Wartość konwersji",
  cpc: "Średni CPC",
  cpa: "Koszt konwersji (CPA)",
  roas: "ROAS",
  sessions: "Sesje",
  totalUsers: "Użytkownicy w okresie",
  screenPageViews: "Odsłony",
  keyEvents: "Kluczowe zdarzenia",
  totalRevenue: "Przychód GA4",
  clicks: "Kliknięcia",
  impressions: "Wyświetlenia",
  ctr: "CTR",
  position: "Średnia pozycja",
  visitors: "Unikalni odwiedzający",
  visits: "Wizyty",
  pageviews: "Odsłony",
  bounce_rate: "Współczynnik odrzuceń",
  visit_duration: "Średni czas wizyty",
};
function value(metric: string, number: number, currency?: string) {
  if (metric === "bounce_rate")
    return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(number)}%`;
  if (metric === "visit_duration")
    return `${Math.floor(number / 60)} min ${Math.round(number % 60)} s`;
  if (metric === "ctr")
    return new Intl.NumberFormat("pl-PL", {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(number);
  if (
    ["totalRevenue", "cost", "conversionValue", "cpc", "cpa"].includes(
      metric,
    ) &&
    currency
  )
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(number);
  return (
    new Intl.NumberFormat("pl-PL", {
      maximumFractionDigits:
        metric === "conversions" ||
        metric === "roas" ||
        metric === "position" ||
        metric === "totalRevenue" ||
        metric === "keyEvents"
          ? 2
          : 0,
    }).format(number) +
    (metric === "roas"
      ? "×"
      : metric === "totalRevenue" && !currency
        ? " (waluta niepodana)"
        : "")
  );
}
export function GoogleReportView({
  report,
  stale = false,
}: {
  report: GoogleReport;
  stale?: boolean;
}) {
  const plausible = report.provider === "plausible";
  const [metric, setMetric] = useState(
    plausible
      ? "visitors"
      : report.provider === "ga4"
        ? "sessions"
        : report.provider === "google_ads"
          ? "cost"
          : "clicks",
  );
  const metrics = plausible
    ? ["visitors", "pageviews"]
    : report.provider === "ga4"
      ? ["sessions", "screenPageViews", "keyEvents"]
      : report.provider === "google_ads"
        ? ["cost", "clicks", "impressions", "conversions", "conversionValue"]
        : ["clicks", "impressions"];
  const breakdown = plausible
    ? ["visitors", "visits"]
    : report.provider === "ga4"
      ? ["sessions", "keyEvents", "totalRevenue"]
      : report.provider === "google_ads"
        ? ["cost", "clicks", "impressions", "conversions", "conversionValue"]
        : ["clicks", "impressions", "ctr", "position"];
  return (
    <section className="crm-card grid min-w-0 gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="crm-eyebrow">
            {plausible ? "ODCZYT API PLAUSIBLE" : "ODCZYT API GOOGLE"} · ZAPIS
            LOKALNY
          </span>
          <h3 className="text-xl!">{providerLabels[report.provider]}</h3>
          <p className="crm-muted break-all">
            {report.resource} · {report.from} – {report.to}
          </p>
        </div>
        <p className="crm-muted">
          Zapisano{" "}
          {new Date(report.fetched_at).toLocaleString("pl-PL", {
            timeZone: "Europe/Warsaw",
          })}
        </p>
      </div>
      {stale && (
        <p className="crm-alert">
          Ostatnie sprawdzenie zgłosiło błąd. Poniżej pozostaje wcześniejszy
          zapis raportu.
        </p>
      )}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(report.totals).map(([key, n]) => (
          <div
            key={key}
            className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4"
          >
            <dt className="text-sm text-slate-500">{labels[key] || key}</dt>
            <dd className="mt-2 text-xl font-semibold break-words text-slate-800">
              {((key === "position" || key === "ctr") &&
                !report.totals.impressions) ||
              (key === "cpc" && !report.totals.clicks) ||
              (key === "cpa" && !report.totals.conversions) ||
              (key === "roas" && !report.totals.cost)
                ? "—"
                : value(key, n, report.currency)}
            </dd>
          </div>
        ))}
      </dl>
      <label className="grid max-w-xs gap-2 text-sm">
        Wykres {providerLabels[report.provider]}
        <select
          className="crm-select"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          {metrics.map((k) => (
            <option key={k} value={k}>
              {labels[k]}
            </option>
          ))}
        </select>
      </label>
      <AreaChart
        points={dailySeries(report.daily, report.from, report.to, metric)}
        title={`${providerLabels[report.provider]} · ${labels[metric]}`}
        format={(v) => value(metric, v, report.currency)}
      />
      <details>
        <summary className="cursor-pointer text-sm font-medium text-violet-700">
          {plausible
            ? "Źródła ruchu — do 20 pozycji"
            : report.provider === "ga4"
              ? "Kanały pozyskania sesji"
              : report.provider === "google_ads"
                ? "Kampanie Google Ads — do 20 według kosztu"
                : "Zapytania w Google — do 20 pozycji"}
        </summary>
        <div className="mt-4 grid gap-3">
          {report.breakdown.length ? (
            report.breakdown.map((row, i) => (
              <article
                key={`${row.label}:${i}`}
                className="rounded-xl border border-slate-100 p-4"
              >
                <p className="font-semibold break-words">{row.label}</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {breakdown.map((k) => (
                    <div key={k}>
                      <dt className="text-xs text-slate-500">{labels[k]}</dt>
                      <dd className="text-sm">
                        {value(k, row.values[k], report.currency)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))
          ) : (
            <p className="crm-muted">
              Dostawca nie zwrócił wierszy dla tego zakresu.
            </p>
          )}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer text-sm text-slate-500">
          Zakres i ograniczenia raportu
        </summary>
        <ul className="mt-3 grid gap-2 pl-5 text-sm text-slate-600">
          {report.warnings.map((warning, i) => (
            <li key={i} className="list-disc">
              {warning}
            </li>
          ))}
          <li className="list-disc">
            Metryki analityczne są osobnym źródłem; nie są dodawane do leadów
            lub przychodu z CSV ani do wpłat Lead Hub.
          </li>
        </ul>
      </details>
    </section>
  );
}
export default function GoogleReports({ wid }: { wid: string }) {
  const [reports, setReports] = useState<
      { report: GoogleReport; stale: boolean }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    localRequest(wid, "integrations")
      .then((r) => {
        if (!active) return;
        const states = r.states as { provider: string; status: string }[];
        setReports(
          (r.snapshots as { provider: string; payload: IntegrationResult }[])
            .filter(
              (s) =>
                s.payload.report &&
                !states.some(
                  (x) =>
                    x.provider === s.provider && x.status === "disconnected",
                ),
            )
            .map((s) => ({
              report: s.payload.report!,
              stale: states.some(
                (x) => x.provider === s.provider && x.status === "error",
              ),
            })),
        );
        setError("");
      })
      .catch(() => {
        if (active)
          setError(
            "Nie udało się wczytać zapisanych raportów Google. Spróbuj ponownie w Konektorach.",
          );
      });
    return () => {
      active = false;
    };
  }, [wid]);
  return (
    <>
      {error && (
        <p role="alert" className="crm-alert error">
          {error}
        </p>
      )}
      {reports.map((r) => (
        <GoogleReportView
          key={`${r.report.provider}:${r.report.resource}`}
          {...r}
        />
      ))}
    </>
  );
}
