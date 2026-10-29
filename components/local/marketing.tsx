"use client";
import GoogleReports from "../integrations/google-reports";
import { useCallback, useEffect, useState } from "react";
import { localRequest } from "@/lib/local/client";
import {
  metrics,
  SOURCES,
  sourceLabels,
  type CampaignDay,
} from "@/lib/integrations/marketing";
import { money, today, offsetDate } from "@/lib/crm/model";
import { Empty } from "../crm/ui";
import { dailySeries } from "@/lib/crm/analytics";
import { AreaChart, DonutChart } from "../crm/charts";
import ChannelReturns from "../insights/channel-returns";
import type { IntegrationResult } from "@/lib/integrations/model";
export default function Marketing({
  wid,
  openConnectors,
}: {
  wid: string;
  openConnectors: () => void;
}) {
  const [rows, setRows] = useState<CampaignDay[]>([]),
    [days, setDays] = useState("30"),
    [start, setStart] = useState(offsetDate(-29)),
    [end, setEnd] = useState(today()),
    [source, setSource] = useState("all"),
    [error, setError] = useState(""),
    [chartMetric, setChartMetric] = useState("leads"),
    [adsDaily, setAdsDaily] = useState<{ date: string; cost: number }[]>([]);
  useEffect(() => {
    let active = true;
    localRequest(wid, "integrations")
      .then((r) => {
        const states = r.states as { provider: string; status: string }[];
        const ads = (
          r.snapshots as { provider: string; payload: IntegrationResult }[]
        ).find(
          (s) =>
            s.provider === "google_ads" &&
            s.payload.report?.currency === "PLN" &&
            !states.some(
              (x) => x.provider === "google_ads" && x.status === "disconnected",
            ),
        );
        if (active)
          setAdsDaily(
            (ads?.payload.report?.daily ?? []).map((d) => ({
              date: String(d.date),
              cost: Number(d.cost) || 0,
            })),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [wid]);
  const load = useCallback(
    () =>
      localRequest(wid, "marketing")
        .then((r) => setRows(r.rows))
        .catch((e) => setError(e.message)),
    [wid],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const from = days === "custom" ? start : offsetDate(1 - Number(days)),
    to = days === "custom" ? end : today();
  const filtered = rows.filter(
      (r) =>
        r.date >= from &&
        r.date <= to &&
        (source === "all" || r.source === source),
    ),
    m = metrics(filtered),
    length = Math.max(
      1,
      Math.floor((Date.parse(to) - Date.parse(from)) / 86400000) + 1,
    );
  const previousStart = new Date(Date.parse(from) - length * 86400000)
      .toISOString()
      .slice(0, 10),
    previousEnd = new Date(Date.parse(from) - 86400000)
      .toISOString()
      .slice(0, 10),
    previous = metrics(
      rows.filter(
        (r) =>
          r.date >= previousStart &&
          r.date <= previousEnd &&
          (source === "all" || r.source === source),
      ),
    );
  const trend = (value: number, old: number) =>
    old
      ? `${(((value - old) / old) * 100).toFixed(1)}% względem poprzedniego okresu`
      : "Brak wartości bazowej do porównania";
  const campaigns = Object.values(
    filtered.reduce<Record<string, CampaignDay[]>>((acc, r) => {
      const key = `${r.source}:${r.campaign}`;
      (acc[key] ??= []).push(r);
      return acc;
    }, {}),
  );
  return (
    <div className="mb-7 grid gap-5">
      <GoogleReports wid={wid} />
      <section className="crm-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="crm-eyebrow">
              WYNIKI MARKETINGU · DANE Z IMPORTU
            </span>
            <h2>Co pracuje na rozwój firmy?</h2>
            <p className="crm-muted">
              PLN · wyniki zadeklarowane w CSV · nie potwierdzają poprawności
              trackingu.
            </p>
          </div>
          <button className="crm-button secondary" onClick={openConnectors}>
            Konektory i import
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <select
            aria-label="Okres marketingu"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="7">7 dni</option>
            <option value="30">30 dni</option>
            <option value="90">90 dni</option>
            <option value="custom">Własny zakres</option>
          </select>
          <select
            aria-label="Źródło marketingu"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">Wszystkie źródła</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceLabels[s]}
              </option>
            ))}
          </select>
          {days === "custom" && (
            <>
              <input
                aria-label="Początek okresu"
                type="date"
                value={start}
                max={end}
                onChange={(e) => setStart(e.target.value || today())}
              />
              <input
                aria-label="Koniec okresu"
                type="date"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value || today())}
              />
            </>
          )}
        </div>
      </section>
      {error && (
        <p role="alert" className="crm-alert error">
          {error}
        </p>
      )}
      <ChannelReturns
        rows={source === "all" ? rows : rows.filter((r) => r.source === source)}
        adsDaily={source === "all" || source === "google_ads" ? adsDaily : []}
        from={from}
        to={to}
        spendSources={rows.length > 0 || adsDaily.length > 0}
      />
      {!filtered.length ? (
        <section className="crm-card">
          <Empty
            title="Ten okres czeka na dane"
            description="Zaimportuj wyniki kampanii w Konektorach. Wskaźniki zostaną obliczone z rzeczywistych wierszy pliku."
            action={
              <button className="crm-button" onClick={openConnectors}>
                Importuj wyniki
              </button>
            }
          />
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                label: "Wydatki",
                value: money(m.spend),
                caption: trend(m.spend, previous.spend),
              },
              {
                label: "Leady",
                value: m.leads,
                caption: trend(m.leads, previous.leads),
              },
              {
                label: "Koszt leada",
                value: m.cpa === null ? "—" : money(m.cpa),
                caption: "Wydatki / liczba leadów",
              },
              {
                label: "Zakwalifikowane leady",
                value: m.qualified,
                caption:
                  m.cpql === null
                    ? "Brak zakwalifikowanych leadów"
                    : `${money(m.cpql)} za kwalifikowany lead`,
              },
              {
                label: "Przychód",
                value: money(m.revenue),
                caption: "Wartość przypisana w imporcie",
              },
              {
                label: "ROAS",
                value: m.roas === null ? "—" : `${m.roas.toFixed(2)}×`,
                caption: `${m.clicks} kliknięć · CVR ${m.cvr === null ? "—" : `${m.cvr.toFixed(2)}%`}`,
              },
            ].map((k) => (
              <article key={k.label} className="crm-card p-5">
                <p className="crm-muted">{k.label}</p>
                <strong className="my-3 block text-3xl text-slate-800">
                  {k.value}
                </strong>
                <p className="crm-muted">{k.caption}</p>
              </article>
            ))}
          </div>
          <div className="growth-analytics-grid">
            <section className="crm-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="crm-eyebrow">TREND W WYBRANYM OKRESIE</span>
                  <h3 className="text-xl!">
                    Zobacz, kiedy pojawiają się wyniki
                  </h3>
                </div>
                <select
                  aria-label="Wskaźnik na wykresie"
                  value={chartMetric}
                  onChange={(e) => setChartMetric(e.target.value)}
                >
                  <option value="leads">Leady</option>
                  <option value="spend">Wydatki (PLN)</option>
                  <option value="revenue">Przychód (PLN)</option>
                </select>
              </div>
              <AreaChart
                key={chartMetric + from + to + source}
                points={dailySeries(filtered, from, to, chartMetric)}
                title={
                  chartMetric === "leads"
                    ? "Liczba leadów"
                    : chartMetric === "spend"
                      ? "Wydatki (PLN)"
                      : "Przychód (PLN)"
                }
                format={chartMetric === "leads" ? undefined : money}
              />
              <p className="crm-muted">
                Wskaż punkt, aby zobaczyć wartość. Luki oznaczają brak importu.
                Dłuższe zakresy sumujemy w maksymalnie 30 przedziałach.
              </p>
            </section>
            <section className="crm-card p-6">
              <span className="crm-eyebrow">SKĄD PRZYCHODZĄ KONTAKTY?</span>
              <h3 className="mb-5 text-xl!">Leady według kanału</h3>
              <DonutChart
                title="leadów"
                items={SOURCES.filter((s) =>
                  filtered.some((r) => r.source === s),
                ).map((s, i) => ({
                  label: sourceLabels[s],
                  value: metrics(filtered.filter((r) => r.source === s)).leads,
                  color: [
                    "var(--brand-500)",
                    "#a99aff",
                    "#24b995",
                    "#72a7f3",
                    "#e5a563",
                  ][i],
                }))}
              />
              <p className="crm-muted mt-5">
                Udział w imporcie z wybranego okresu i źródła.
              </p>
            </section>
          </div>
          <section className="crm-card p-6">
            <h3 className="text-lg!">Kampanie w wybranym okresie</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[38em] text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    {[
                      "Kampania",
                      "Wydatki",
                      "Leady",
                      "Kwalifikowane",
                      "CPA",
                      "ROAS",
                    ].map((h) => (
                      <th key={h} className="p-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 100).map((group) => {
                    const k = metrics(group),
                      r = group[0];
                    return (
                      <tr
                        key={`${r.source}:${r.campaign}`}
                        className="border-t border-slate-100"
                      >
                        <td className="p-3">
                          <strong>{r.campaign}</strong>
                          <br />
                          <small>{sourceLabels[r.source]}</small>
                        </td>
                        <td className="p-3">{money(k.spend)}</td>
                        <td className="p-3">{k.leads}</td>
                        <td className="p-3">{k.qualified}</td>
                        <td className="p-3">
                          {k.cpa === null ? "—" : money(k.cpa)}
                        </td>
                        <td className="p-3">
                          {k.roas === null ? "—" : `${k.roas.toFixed(2)}×`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {campaigns.some(
              (g) => metrics(g).spend > 0 && metrics(g).qualified === 0,
            ) && (
              <p className="crm-alert mt-5">
                Są kampanie z wydatkami i bez zakwalifikowanych leadów. Sprawdź
                zapytania, jakość kontaktów i kompletność importu przed zmianą
                budżetu.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
