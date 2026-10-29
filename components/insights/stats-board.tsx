"use client";
import { useMemo } from "react";
import { useCrm } from "@/stores/crm-store";
import { money, offsetDate, today, type Section } from "@/lib/crm/model";
import { generateReport, kpiDelta, formatKpi } from "@/lib/reports/generate";
import { scheduleLabel, jobKindLabels } from "@/lib/automation/model";
import {
  closingSchedule,
  funnelConversion,
  pipelineStats,
} from "@/lib/crm/insights";
import {
  BarList,
  Donut,
  Funnel,
  Heatmap,
  KpiTile,
  Panel,
  Columns,
  Schedule,
} from "./kit";
import BrandPresence from "../brand/brand-presence";
import { Icon } from "../crm/ui";

const count = (v: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(v);
function relative(iso: string) {
  const diff = Date.parse(iso) - Date.now();
  const abs = Math.abs(diff),
    rtf = new Intl.RelativeTimeFormat("pl-PL", { numeric: "auto" });
  if (abs < 3600000) return rtf.format(Math.round(diff / 60000), "minute");
  if (abs < 86400000) return rtf.format(Math.round(diff / 3600000), "hour");
  return rtf.format(Math.round(diff / 86400000), "day");
}

export default function StatsBoard({
  navigate,
  serviceMode,
}: {
  navigate: (s: Section) => void;
  serviceMode: boolean;
}) {
  const s = useCrm();
  const day = today();
  const data = useMemo(
    () => ({
      firms: s.firms,
      contacts: s.contacts,
      deals: s.deals,
      tasks: s.tasks,
      mails: s.mails,
    }),
    [s.firms, s.contacts, s.deals, s.tasks, s.mails],
  );
  const report = useMemo(
    () => generateReport(data, serviceMode ? "services" : "sales", "30d", day),
    [data, day, serviceMode],
  );
  const activity = useMemo(
    () => generateReport(data, "activity", "30d", day),
    [data, day],
  );
  const stats = useMemo(() => pipelineStats(data), [data]);
  const conversion = useMemo(() => funnelConversion(data), [data]);
  const schedule = useMemo(() => closingSchedule(data, day), [data, day]);
  const brand = s.brand;
  const weeks = useMemo(() => {
    const result: { label: string; won: number; tasks: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const from = offsetDate(-7 * i - 6),
        to = offsetDate(-7 * i);
      result.push({
        label: from.slice(5),
        won: data.deals
          .filter((d) =>
            d.service
              ? d.service.status === "completed" &&
                d.service.start.slice(0, 10) >= from &&
                d.service.start.slice(0, 10) <= to
              : d.stage === "Wygrana" &&
                d.closeDate >= from &&
                d.closeDate <= to,
          )
          .reduce((x, d) => x + d.value, 0),
        tasks: data.tasks.filter((t) => t.date >= from && t.date <= to).length,
      });
    }
    return result;
  }, [data]);
  const heat = useMemo(() => {
    const map = new Map<string, number>();
    const bump = (d: string) => map.set(d, (map.get(d) ?? 0) + 1);
    data.tasks.forEach((t) => bump(t.date));
    data.mails.forEach((m) => bump((m.sentAt ?? m.created).slice(0, 10)));
    data.firms.forEach((f) => bump(f.created));
    data.deals.forEach((d) => d.service && bump(d.service.start.slice(0, 10)));
    return Array.from({ length: 84 }, (_, i) => {
      const date = offsetDate(i - 83);
      return { date, value: map.get(date) ?? 0 };
    });
  }, [data]);
  const open = data.tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.date < day).length;
  const dueSoon = open.filter(
    (t) => t.date >= day && t.date <= offsetDate(7),
  ).length;
  const firmName = (id: string) =>
    data.firms.find((f) => f.id === id)?.name ?? "—";
  const topClients = useMemo(() => {
    const totals = new Map<string, number>();
    for (const d of data.deals)
      if (d.stage !== "Przegrana" && d.service?.status !== "cancelled")
        totals.set(d.companyId, (totals.get(d.companyId) ?? 0) + d.value);
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, value]) => ({
        label: data.firms.find((f) => f.id === id)?.name ?? "—",
        value,
      }));
  }, [data]);
  const funnel = serviceMode
    ? (["booked", "in_progress", "completed", "cancelled"] as const).map(
        (status) => ({
          label: {
            booked: "Zarezerwowane",
            in_progress: "W realizacji",
            completed: "Zakończone",
            cancelled: "Anulowane",
          }[status],
          value: data.deals.filter((d) => d.service?.status === status).length,
        }),
      )
    : (["Nowa", "Rozmowa", "Oferta", "Wygrana"] as const).map((stage) => {
        const list = data.deals.filter((d) => !d.service && d.stage === stage);
        return {
          label: stage,
          value: list.reduce((x, d) => x + d.value, 0),
          sub: `${list.length} szt.`,
        };
      });
  const jobs = [...s.automation.jobs]
    .filter((j) => j.enabled)
    .sort((a, b) => a.nextRun.localeCompare(b.nextRun))
    .slice(0, 4);
  const reports = s.automation.reports.slice(0, 3);
  const k = report.kpis;
  const ak = activity.kpis;
  const tiles = [
    {
      label: serviceMode
        ? "Przychód z realizacji · 30 dni"
        : "Wygrana sprzedaż · 30 dni",
      value: formatKpi(k[0]),
      delta: kpiDelta(k[0]),
      icon: "check",
      color: "var(--brand-accent)",
      trend: weeks.map((w) => w.won),
      target: "deals" as Section,
    },
    serviceMode
      ? {
          label: "Zlecenia · 30 dni",
          value: formatKpi(k[1]),
          delta: kpiDelta(k[1]),
          icon: "deals",
          color: "var(--brand-500)",
          target: "deals" as Section,
        }
      : {
          label: "Prognoza ważona",
          value: money(stats.forecast),
          hint: `${stats.open} otwartych szans`,
          icon: "dashboard",
          color: "var(--brand-500)",
          target: "deals" as Section,
        },
    serviceMode
      ? {
          label: "Zakończone · 30 dni",
          value: formatKpi(k[2]),
          delta: kpiDelta(k[2]),
          icon: "check",
          color: "#0ea5e9",
          target: "deals" as Section,
        }
      : {
          label: "Skuteczność · 30 dni",
          value: k[2].hint ? "—" : formatKpi(k[2]),
          delta: k[2].hint ? undefined : kpiDelta(k[2]),
          deltaUnit: " pp",
          hint: k[2].hint,
          icon: "spark",
          color: "#0ea5e9",
          target: "deals" as Section,
        },
    {
      label: "Wykonanie zadań · 30 dni",
      value: formatKpi(ak[1]),
      delta: kpiDelta(ak[1]),
      deltaUnit: " pp",
      icon: "tasks",
      color: "#f59e0b",
      trend: weeks.map((w) => w.tasks),
      target: "tasks" as Section,
    },
    {
      label: "Zaległe zadania",
      value: count(overdue),
      hint: `${dueSoon} w ciągu 7 dni`,
      icon: "clock",
      color: overdue ? "#f43f5e" : "#10b981",
      target: "tasks" as Section,
    },
    {
      label: "Wysłane wiadomości · 30 dni",
      value: formatKpi(ak[2]),
      delta: kpiDelta(ak[2]),
      icon: "mail",
      color: "#6366f1",
      target: "mail" as Section,
    },
  ];
  return (
    <div className="mb-6 grid min-w-0 gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="crm-eyebrow">
            STATYSTYKI · OSTATNIE 30 DNI VS POPRZEDNIE 30
          </span>
          <h2 className="mt-1 text-xl!">Wyniki firmy w liczbach</h2>
        </div>
        <button
          className="crm-button secondary"
          onClick={() => navigate("reports")}
        >
          <Icon name="file" size={16} /> Generuj raport
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((t) => (
          <KpiTile key={t.label} {...t} onClick={() => navigate(t.target)} />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {serviceMode ? (
          <Panel
            eyebrow="ZLECENIA"
            title="Zlecenia według statusu"
            action={
              <button
                className="crm-text-button"
                onClick={() => navigate("deals")}
              >
                Otwórz <Icon name="arrow" size={14} />
              </button>
            }
          >
            <BarList items={funnel} format={count} />
          </Panel>
        ) : (
          <Panel
            eyebrow="LEJEK KONWERSJI"
            title="Jak szanse przechodzą przez etapy"
            action={
              <button
                className="crm-text-button"
                onClick={() => navigate("deals")}
              >
                Otwórz <Icon name="arrow" size={14} />
              </button>
            }
          >
            <Funnel stages={conversion} format={money} />
          </Panel>
        )}
        {serviceMode ? (
          <Panel eyebrow="ZADANIA" title="Status planu działania">
            <Donut
              center={count(open.length)}
              caption="otwartych"
              segments={[
                { label: "Zaległe", value: overdue, color: "#f43f5e" },
                { label: "Na 7 dni", value: dueSoon, color: "#f59e0b" },
                {
                  label: "Później",
                  value: open.length - overdue - dueSoon,
                  color: "var(--brand-300)",
                },
                {
                  label: "Wykonane",
                  value: data.tasks.length - open.length,
                  color: "#10b981",
                },
              ]}
            />
          </Panel>
        ) : (
          <Panel eyebrow="PROGNOZA" title="Kiedy zamkniesz otwarte szanse">
            <Schedule buckets={schedule} format={money} />
          </Panel>
        )}
        <Panel eyebrow="KLIENCI" title="Najwięksi klienci (wartość)">
          <BarList
            items={topClients}
            format={money}
            color="var(--brand-accent)"
            empty="Dodaj szanse lub zlecenia, aby zobaczyć ranking."
          />
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {brand?.name && <BrandPresence brand={brand} navigate={navigate} />}
        {!serviceMode && (
          <Panel eyebrow="ZADANIA" title="Status planu działania">
            <Donut
              center={count(open.length)}
              caption="otwartych"
              segments={[
                { label: "Zaległe", value: overdue, color: "#f43f5e" },
                { label: "Na 7 dni", value: dueSoon, color: "#f59e0b" },
                {
                  label: "Później",
                  value: open.length - overdue - dueSoon,
                  color: "var(--brand-300)",
                },
                {
                  label: "Wykonane",
                  value: data.tasks.length - open.length,
                  color: "#10b981",
                },
              ]}
            />
          </Panel>
        )}
        <Panel
          eyebrow="AKTYWNOŚĆ · 12 TYGODNI"
          className={
            ["xl:col-span-3", "xl:col-span-2", ""][
              Number(!!brand?.name) + Number(!serviceMode)
            ]
          }
          title="Mapa aktywności zespołu"
        >
          <Heatmap
            days={heat}
            title="Aktywność: zadania, wiadomości, nowe firmy i zlecenia"
          />
          <div className="mt-5">
            <Columns
              items={weeks.map((w) => ({ label: w.label, value: w.tasks }))}
              format={count}
              height={90}
              color="#f59e0b"
              empty="Brak zadań w ostatnich 8 tygodniach — zaplanuj pierwsze."
            />
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          eyebrow="HARMONOGRAM"
          title="Najbliższe automatyzacje"
          action={
            <button
              className="crm-text-button"
              onClick={() => navigate("automations")}
            >
              Zarządzaj <Icon name="arrow" size={14} />
            </button>
          }
        >
          {jobs.length ? (
            <ul className="grid gap-2.5">
              {jobs.map((j) => (
                <li
                  key={j.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                    <Icon
                      name={
                        j.kind === "report"
                          ? "file"
                          : j.kind === "agent"
                            ? "agent"
                            : "tasks"
                      }
                      size={17}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-slate-800">
                      {j.name}
                    </strong>
                    <span className="block truncate text-xs text-slate-500">
                      {jobKindLabels[j.kind]} · {scheduleLabel(j)}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                    {relative(j.nextRun)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid place-items-center gap-3 py-6 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                <Icon name="clock" size={22} />
              </span>
              <p className="max-w-[22em] text-sm text-slate-500">
                Zaplanuj poranny briefing agenta, cotygodniowy raport lub
                automatyczne follow-upy.
              </p>
              <button
                className="crm-button"
                onClick={() => navigate("automations")}
              >
                Dodaj automatyzację
              </button>
            </div>
          )}
        </Panel>
        <Panel
          eyebrow="RAPORTY"
          title="Ostatnio wygenerowane"
          action={
            <button
              className="crm-text-button"
              onClick={() => navigate("reports")}
            >
              Wszystkie <Icon name="arrow" size={14} />
            </button>
          }
        >
          {reports.length ? (
            <ul className="grid gap-2.5">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:border-violet-200"
                    onClick={() => navigate("reports")}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Icon name="file" size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-slate-800">
                        {r.data.title}
                      </strong>
                      <span className="block truncate text-xs text-slate-500">
                        {r.data.period.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {relative(r.created)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid place-items-center gap-3 py-6 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon name="file" size={22} />
              </span>
              <p className="max-w-[22em] text-sm text-slate-500">
                Raporty zarządcze, sprzedaży i aktywności — z eksportem do PDF,
                Markdown i CSV.
              </p>
              <button
                className="crm-button secondary"
                onClick={() => navigate("reports")}
              >
                Utwórz pierwszy raport
              </button>
            </div>
          )}
          {open.length > 0 && (
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              Najbliższe zadanie:{" "}
              <strong className="text-slate-700">
                {
                  [...open].sort((a, b) => a.date.localeCompare(b.date))[0]
                    .title
                }
              </strong>{" "}
              ·{" "}
              {firmName(
                [...open].sort((a, b) => a.date.localeCompare(b.date))[0]
                  .companyId,
              )}
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
