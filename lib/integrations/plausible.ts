import "server-only";
import { apiJson, IntegrationError } from "./http";
import {
  validateResource,
  type GoogleReport,
  type IntegrationResult,
  type Resource,
} from "./model";

export function plausibleConfigured() {
  return /^[A-Za-z0-9_-]{20,200}$/.test(process.env.PLAUSIBLE_API_KEY || "");
}

function host() {
  const url = new URL(process.env.PLAUSIBLE_HOST || "https://plausible.io");
  if (url.protocol !== "https:" || url.username || url.password || url.search)
    throw new IntegrationError("PLAUSIBLE_HOST musi być adresem HTTPS.", 400);
  return url.origin;
}

type Results<T> = { results?: T };
const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) && x >= 0 ? x : 0;
};

export function plausibleReport(
  site: string,
  aggregate: Record<string, { value?: number }>,
  series: { date?: string; visitors?: number; pageviews?: number }[],
  sources: { source?: string; visitors?: number; visits?: number }[],
  from: string,
  to: string,
): GoogleReport {
  return {
    provider: "plausible",
    resource: site,
    from,
    to,
    fetched_at: new Date().toISOString(),
    totals: {
      visitors: n(aggregate.visitors?.value),
      visits: n(aggregate.visits?.value),
      pageviews: n(aggregate.pageviews?.value),
      bounce_rate: n(aggregate.bounce_rate?.value),
      visit_duration: n(aggregate.visit_duration?.value),
    },
    daily: series
      .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(String(d.date)))
      .slice(0, 62)
      .map((d) => ({
        date: String(d.date).slice(0, 10),
        visitors: n(d.visitors),
        pageviews: n(d.pageviews),
      })),
    breakdown: sources.slice(0, 20).map((s) => ({
      label: String(s.source || "Direct / None").slice(0, 200),
      values: { visitors: n(s.visitors), visits: n(s.visits) },
    })),
    warnings: [],
  };
}

export async function readPlausible(
  settings: Resource,
): Promise<IntegrationResult> {
  if (!plausibleConfigured())
    throw new IntegrationError("Ustaw PLAUSIBLE_API_KEY w .env.local.", 400);
  const { siteId } = validateResource("plausible", settings);
  const base = host(),
    headers = { Authorization: `Bearer ${process.env.PLAUSIBLE_API_KEY}` },
    site = encodeURIComponent(siteId!);
  const [aggregate, series, sources] = (await Promise.all([
    apiJson(
      `${base}/api/v1/stats/aggregate?site_id=${site}&period=30d&metrics=visitors,visits,pageviews,bounce_rate,visit_duration`,
      { headers },
    ),
    apiJson(
      `${base}/api/v1/stats/timeseries?site_id=${site}&period=30d&metrics=visitors,pageviews`,
      { headers },
    ),
    apiJson(
      `${base}/api/v1/stats/breakdown?site_id=${site}&period=30d&property=visit:source&metrics=visitors,visits&limit=20`,
      { headers },
    ),
  ])) as [
    Results<Record<string, { value?: number }>>,
    Results<{ date?: string; visitors?: number; pageviews?: number }[]>,
    Results<{ source?: string; visitors?: number; visits?: number }[]>,
  ];
  if (
    !aggregate.results ||
    typeof aggregate.results !== "object" ||
    !Array.isArray(series.results) ||
    !Array.isArray(sources.results)
  )
    throw new IntegrationError("Nieprawidłowa odpowiedź Plausible.");
  const days = series.results.map((d) => String(d.date).slice(0, 10)).sort();
  const report = plausibleReport(
    siteId!,
    aggregate.results,
    series.results,
    sources.results,
    days[0] || "",
    days.at(-1) || "",
  );
  return {
    summary: `Plausible: ${report.totals.visitors} unikalnych odwiedzających w 30 dni.`,
    report,
  };
}
