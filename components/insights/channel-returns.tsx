"use client";
import { useMemo } from "react";
import { useCrm } from "@/stores/crm-store";
import { money } from "@/lib/crm/model";
import { channel, channelLabel, channelReturns } from "@/lib/crm/attribution";
import type { CampaignDay } from "@/lib/integrations/marketing";
import { Panel } from "./kit";

const ratio = (v: number | null) =>
  v === null
    ? "—"
    : `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(v)}×`;
const pln = (v: number | null) => (v === null ? "—" : money(v));

export default function ChannelReturns({
  rows = [],
  adsDaily = [],
  from,
  to,
  spendSources = true,
  channelFilter,
}: {
  rows?: CampaignDay[];
  adsDaily?: { date: string; cost: number }[];
  from: string;
  to: string;
  spendSources?: boolean;
  channelFilter?: string;
}) {
  const deals = useCrm((s) => s.deals);
  const { channels, total, unattributed } = useMemo(
    () =>
      channelReturns(
        rows,
        channelFilter
          ? deals.filter((d) => channel(d.source) === channel(channelFilter))
          : deals,
        { from, to },
        adsDaily,
      ),
    [rows, deals, from, to, adsDaily, channelFilter],
  );
  const max = Math.max(1, ...channels.map((c) => Math.max(c.spend, c.revenue)));
  const tiles = [
    { label: "Wydatki marketingowe", value: money(total.spend) },
    { label: "Nowi klienci (wygrane)", value: String(total.customers) },
    { label: "Średni koszt pozyskania (CAC)", value: pln(total.cac) },
    { label: "ROAS z przychodu CRM", value: ratio(total.roas) },
  ];
  return (
    <Panel
      eyebrow={`ZWROT Z MARKETINGU · ${from} – ${to}`}
      title="Ile kosztuje klient i który kanał zarabia"
    >
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-slate-50 p-3.5">
            <dt className="text-[11px] text-slate-500">{t.label}</dt>
            <dd className="mt-1 text-lg font-bold text-slate-800 tabular-nums">
              {t.value}
            </dd>
          </div>
        ))}
      </dl>
      {channels.length ? (
        <>
          <ul
            className="mt-5 grid gap-3"
            aria-label="Wydatki i przychód według kanału"
          >
            {channels.slice(0, 8).map((c) => (
              <li key={c.channel} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-slate-700">
                    {channelLabel(c.channel)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                    {money(c.spend)} →{" "}
                    <strong className="text-slate-800">
                      {money(c.revenue)}
                    </strong>
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-rose-400 transition-[width] duration-700"
                      style={{ width: `${(c.spend / max) * 100}%` }}
                    />
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${(c.revenue / max) * 100}%`,
                        background: "var(--brand-accent)",
                      }}
                    />
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm bg-rose-400" />
              Wydatki
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm bg-[var(--brand-accent)]" />
              Przychód z wygranych szans
            </span>
          </div>
          <details className="crm-data-table mt-4">
            <summary>
              Tabela kanałów: CAC, ROAS, koszt leada i otwarty lejek
            </summary>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Kanał</th>
                    <th>Wydatki</th>
                    <th>Leady</th>
                    <th>Klienci</th>
                    <th>Przychód</th>
                    <th>CAC</th>
                    <th>ROAS</th>
                    <th>Koszt leada</th>
                    <th>Otwarty lejek</th>
                  </tr>
                </thead>
                <tbody>
                  {[...channels, total].map((c) => (
                    <tr key={c.channel}>
                      <th scope="row">
                        {c.channel === "total"
                          ? "Razem"
                          : channelLabel(c.channel)}
                      </th>
                      <td>{money(c.spend)}</td>
                      <td>{c.leads}</td>
                      <td>{c.customers}</td>
                      <td>{money(c.revenue)}</td>
                      <td>{pln(c.cac)}</td>
                      <td>{ratio(c.roas)}</td>
                      <td>{pln(c.cpl)}</td>
                      <td>{money(c.pipeline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          Brak wydatków i wygranych szans w tym okresie.
        </p>
      )}
      <ul className="mt-4 grid gap-1 text-xs text-slate-500">
        {unattributed > 0 && (
          <li>
            → {money(unattributed)} przychodu nie ma źródła. Uzupełnij pole
            „Źródło klienta” w szansach lub konwertuj leady z Lead Hub.
          </li>
        )}
        {!spendSources && (
          <li>
            → Wydatki pojawią się po imporcie CSV kampanii lub połączeniu Google
            Ads w Konektorach (edycja SQLite).
          </li>
        )}
        <li>
          Przychód = wygrane szanse i zakończone zlecenia z CRM według daty
          zamknięcia. Google Ads w PLN uzupełnia dni bez importu CSV.
        </li>
      </ul>
    </Panel>
  );
}
