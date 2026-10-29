"use client";
import { useState } from "react";
import { useCrm } from "@/stores/crm-store";
import {
  money,
  today,
  offsetDate,
  serviceLabels,
  type Deal,
  type Section,
} from "@/lib/crm/model";
import { serviceTotals } from "@/lib/crm/services";
import { dailySeries } from "@/lib/crm/analytics";
import { AreaChart, DonutChart } from "../crm/charts";
import { Icon, Empty, Badge } from "../crm/ui";
import { bookingTime } from "./jobs";
export default function ServiceDashboard({
  openJob,
  navigate,
}: {
  openJob: (d?: Deal) => void;
  navigate: (s: Section) => void;
}) {
  const s = useCrm(),
    [days, setDays] = useState(30),
    totals = serviceTotals(s.deals),
    from = offsetDate(1 - days);
  const period = totals.completed.filter(
    (d) =>
      d.service!.start.slice(0, 10) >= from &&
      d.service!.start.slice(0, 10) <= today(),
  );
  const upcoming = totals.active
    .filter((d) => d.service!.end.slice(0, 10) >= today())
    .sort((a, b) => a.service!.start.localeCompare(b.service!.start));
  const points = dailySeries(
    period.map((d) => ({
      date: d.service!.start.slice(0, 10),
      value: d.value,
    })),
    from,
    today(),
    "value",
  ).map((p) => ({ ...p, value: p.value ?? 0 }));
  return (
    <div className="grid gap-6">
      <section className="crm-welcome growth-hero">
        <div>
          <span className="crm-eyebrow">TWOJA FIRMA USŁUGOWA</span>
          <h2>
            Klienci zaopiekowani.
            <br />
            Praca zaplanowana.
          </h2>
          <p>Rezerwacje, realizacje i historia współpracy w jednym miejscu.</p>
        </div>
        <button
          className="crm-button"
          onClick={() => (s.firms.length ? openJob() : navigate("companies"))}
        >
          <Icon name="plus" />
          {s.firms.length ? "Zarezerwuj pracę" : "Dodaj pierwszego klienta"}
        </button>
      </section>
      <div className="crm-metrics">
        {[
          {
            label: "Twoi klienci",
            value: String(s.firms.length),
            caption: "Osoby i firmy, z którymi współpracujesz",
            icon: "contacts",
          },
          {
            label: "Zarezerwowane prace",
            value: String(totals.active.length),
            caption: `${totals.active.filter((d) => d.service!.start.slice(0, 10) === today()).length} rozpoczyna się dzisiaj`,
            icon: "clock",
          },
          {
            label: "Wartość rezerwacji",
            value: money(totals.reservedValue),
            caption: "Zaplanowane i w realizacji · bez anulowanych",
            icon: "deals",
          },
          {
            label: "Zakończone realizacje",
            value: String(totals.completed.length),
            caption: `${money(totals.completedValue)} wartości wykonanych prac`,
            icon: "check",
          },
        ].map((k) => (
          <article className="crm-metric" key={k.label}>
            <div className="crm-metric-top">
              <span>{k.label}</span>
              <span className="crm-metric-icon">
                <Icon name={k.icon} />
              </span>
            </div>
            <strong>{k.value}</strong>
            <small>{k.caption}</small>
          </article>
        ))}
      </div>
      <div className="growth-analytics-grid">
        <section className="crm-card p-6">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <span className="crm-eyebrow">WYKONANE USŁUGI</span>
              <h3 className="text-xl!">Wartość realizacji w czasie</h3>
            </div>
            <select
              aria-label="Okres realizacji"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 dni</option>
              <option value={30}>30 dni</option>
              <option value={90}>90 dni</option>
            </select>
          </div>
          <AreaChart
            key={days}
            points={points}
            title="Wartość zakończonych realizacji (PLN)"
            format={money}
            color="#7a5af5"
          />
          <p className="crm-muted">
            Według początku pracy i aktualnego statusu. Wartość zlecenia nie
            oznacza opłaconej faktury.
          </p>
        </section>
        <section className="crm-card p-6">
          <span className="crm-eyebrow">STATUS WSPÓŁPRACY</span>
          <h3 className="mb-5 text-xl!">Jak idą Twoje zlecenia?</h3>
          <DonutChart
            title="wszystkich prac"
            items={(
              ["booked", "in_progress", "completed", "cancelled"] as const
            ).map((status, i) => ({
              label: serviceLabels[status],
              value: totals.jobs.filter((d) => d.service!.status === status)
                .length,
              color: [
                "var(--brand-300)",
                "var(--brand-500)",
                "#24b995",
                "#d9deeb",
              ][i],
            }))}
          />
        </section>
      </div>
      <section className="crm-card p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <span className="crm-eyebrow">NAJBLIŻSZE TERMINY</span>
            <h3 className="text-xl!">Twój plan pracy</h3>
          </div>
          <button className="crm-text-button" onClick={() => navigate("deals")}>
            Wszystkie zlecenia <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          {upcoming.slice(0, 5).map((d) => (
            <button
              key={d.id}
              className="growth-agenda-row"
              onClick={() => openJob(d)}
            >
              <span className="growth-agenda-day">
                <b>{d.service!.start.slice(8, 10)}</b>
                <small>{d.service!.start.slice(11)}</small>
              </span>
              <span className="min-w-0">
                <strong>{d.name}</strong>
                <small className="block">
                  {s.firms.find((f) => f.id === d.companyId)?.name} ·{" "}
                  {bookingTime(d.service!.start)} · {d.service!.resource}
                </small>
              </span>
              <Badge tone="purple">{serviceLabels[d.service!.status]}</Badge>
            </button>
          ))}
        </div>
        {!upcoming.length && (
          <Empty
            title="Twój kalendarz jest gotowy"
            description="Dodaj klienta i zarezerwuj pierwszą pracę. Terminy pojawią się tutaj."
            action={
              <button
                className="crm-button secondary"
                onClick={() => navigate("companies")}
              >
                Otwórz klientów
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}
