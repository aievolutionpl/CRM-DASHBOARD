"use client";
import { useMemo, useState } from "react";
import { useCrm } from "@/stores/crm-store";
import { money, today, type Section } from "@/lib/crm/model";
import {
  healthScore,
  insights,
  monthlyRevenue,
  pipelineStats,
  type InsightTone,
} from "@/lib/crm/insights";
import { Icon } from "./ui";
import BrandAtmosphere from "./brand-atmosphere";

const tones: Record<InsightTone, string> = {
  red: "bg-rose-500",
  amber: "bg-amber-400",
  green: "bg-emerald-500",
  violet: "bg-violet-500",
};
const QUICK = [
  "Co powinienem zrobić dzisiaj?",
  "Pokaż ryzyka w sprzedaży",
  "Przeanalizuj lejek i prognozę",
  "Jak idzie marketing?",
];

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("pl-PL", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Warsaw",
    }).format(new Date()),
  );
  return hour < 5
    ? "Dobrej nocy"
    : hour < 12
      ? "Dzień dobry"
      : hour < 18
        ? "Miłego popołudnia"
        : "Dobry wieczór";
}

function ScoreRing({ score }: { score: number | null }) {
  const r = 42,
    c = 2 * Math.PI * r,
    value = score ?? 0;
  return (
    <div className="relative grid size-[112px] shrink-0 place-items-center">
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
          stroke="#ffffff22"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#crm-score)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
        <defs>
          <linearGradient id="crm-score" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center">
        <strong className="block text-[28px] leading-none font-bold text-white tabular-nums">
          {score ?? "—"}
        </strong>
        <span className="text-[10px] font-semibold tracking-[1.4px] text-violet-200 uppercase">
          kondycja
        </span>
      </div>
    </div>
  );
}

function RevenueChart({
  months,
}: {
  months: { key: string; label: string; won: number; forecast: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(1, ...months.map((m) => m.won + m.forecast));
  const current = today().slice(0, 7);
  const active =
    hover ?? months.findIndex((m) => m.key === (selected ?? current));
  const point = months[active] ?? months[months.length - 1];
  return (
    <div>
      <div
        className="mb-4 flex flex-wrap items-end justify-between gap-3"
        aria-live="polite"
      >
        <div>
          <span className="text-xs text-slate-500 capitalize">
            {point.label} {point.key.slice(0, 4)}
          </span>
          <strong className="block text-2xl font-bold tracking-tight text-slate-800 tabular-nums">
            {money(point.won + point.forecast)}
          </strong>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-sm bg-gradient-to-t from-violet-600 to-violet-400" />
            Zrealizowane {money(point.won)}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-sm bg-violet-200" />
            Prognoza {money(point.forecast)}
          </span>
        </div>
      </div>
      <div
        className="flex h-44 items-end gap-2 sm:gap-3"
        onMouseLeave={() => setHover(null)}
      >
        {months.map((m, i) => (
          <button
            key={m.key}
            type="button"
            aria-label={`${m.label}: zrealizowane ${money(m.won)}, prognoza ${money(m.forecast)}`}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 outline-none"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => setSelected(m.key)}
            aria-pressed={selected === m.key}
          >
            <div className="flex w-full max-w-11 flex-1 flex-col justify-end overflow-hidden rounded-xl">
              <div
                className={`w-full rounded-t-xl bg-violet-200/80 transition-all duration-500 ${i === active ? "bg-violet-300" : ""}`}
                style={{ height: `${(m.forecast / max) * 100}%` }}
              />
              <div
                className={`w-full bg-gradient-to-t from-violet-600 to-violet-400 transition-all duration-500 ${m.forecast ? "" : "rounded-t-xl"} ${i === active ? "brightness-110" : "opacity-90"}`}
                style={{
                  height: `${(m.won / max) * 100}%`,
                  minHeight: m.won ? 4 : 0,
                }}
              />
              {!m.won && !m.forecast && (
                <div className="h-1 w-full rounded-full bg-slate-100" />
              )}
            </div>
            <span
              className={`text-[11px] capitalize ${months.length > 7 && i % 2 === 1 ? "invisible sm:visible" : ""} ${m.key === current ? "font-bold text-violet-700" : "text-slate-500"}`}
            >
              {m.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CommandCenter({
  navigate,
  askAgent,
  serviceMode,
}: {
  navigate: (section: Section) => void;
  askAgent: (prompt: string) => void;
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
  const list = useMemo(() => insights(data, day), [data, day]);
  const score = useMemo(() => healthScore(data, day), [data, day]);
  const [range, setRange] = useState(6);
  const months = useMemo(
    () =>
      monthlyRevenue(
        {
          ...data,
          deals: data.deals.filter((deal) =>
            serviceMode ? Boolean(deal.service) : !deal.service,
          ),
        },
        day,
        range,
      ),
    [data, day, range, serviceMode],
  );
  const stats = useMemo(() => pipelineStats(data), [data]);
  const [question, setQuestion] = useState("");
  const todayTasks = s.tasks.filter((t) => !t.done && t.date <= day).length;
  const jobs = s.deals.filter((d) => d.service);
  const activeJobs = jobs.filter((d) =>
    ["booked", "in_progress"].includes(d.service!.status),
  );
  const kpis = serviceMode
    ? [
        { label: "Aktywne zlecenia", value: String(activeJobs.length) },
        {
          label: "Wartość w realizacji",
          value: money(activeJobs.reduce((x, d) => x + d.value, 0)),
        },
        { label: "Zadania na dziś", value: String(todayTasks) },
      ]
    : [
        { label: "Prognoza ważona", value: money(stats.forecast) },
        {
          label: "Skuteczność",
          value: stats.winRate === null ? "—" : `${stats.winRate}%`,
        },
        { label: "Zadania na dziś", value: String(todayTasks) },
      ];
  const dateLabel = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Warsaw",
  }).format(new Date());
  const submit = (prompt: string) => {
    if (prompt.trim()) askAgent(prompt.trim());
  };
  return (
    <div className="mb-6 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <section className="crm-command-hero relative overflow-hidden rounded-[26px] bg-[radial-gradient(120%_140%_at_0%_0%,#5b3bff_0%,#3a22b8_38%,#1c1446_100%)] p-6 text-white shadow-[0_24px_60px_-28px_#3a22b8] sm:p-8">
        <BrandAtmosphere />
        <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <span className="text-[11px] font-bold tracking-[1.8px] text-violet-200 uppercase">
              Centrum dowodzenia · {dateLabel}
            </span>
            <h2 className="mt-2 text-[28px]! leading-tight font-bold tracking-tight text-white! sm:text-[34px]!">
              {greeting()}!{" "}
              {list[0]?.tone === "green"
                ? "Wszystko idzie zgodnie z planem."
                : "Oto co dziś wymaga uwagi."}
            </h2>
            <form
              className="mt-5 flex max-w-2xl items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-1.5 pl-4 backdrop-blur-md focus-within:border-white/40"
              onSubmit={(e) => {
                e.preventDefault();
                submit(question);
              }}
            >
              <Icon name="spark" size={18} />
              <input
                aria-label="Zapytaj Evolution Agent"
                className="min-h-0! min-w-0 flex-1 rounded-none! border-0! bg-transparent! px-0! py-2 text-sm text-white! shadow-none! placeholder:text-violet-200/80 focus:outline-none"
                placeholder="Zapytaj agenta AI o swoją firmę…"
                value={question}
                maxLength={2000}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
                disabled={!question.trim()}
              >
                Zapytaj
              </button>
            </form>
            <div className="crm-command-questions mt-3 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-violet-100 transition hover:bg-white/15"
                  onClick={() => submit(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <ScoreRing score={score} />
            <dl className="grid gap-3">
              {kpis.map((k) => (
                <div key={k.label}>
                  <dt className="text-[11px] text-violet-200">{k.label}</dt>
                  <dd className="text-lg font-bold text-white tabular-nums">
                    {k.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section className="crm-card p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="crm-eyebrow">
                PRZYCHÓD · {range} MIESIĘCY + NASTĘPNY
              </span>
              <h3 className="mt-1 text-lg!">
                {serviceMode
                  ? "Zakończone i zaplanowane realizacje"
                  : "Wygrana sprzedaż i prognoza ważona"}
              </h3>
            </div>
            <button
              className="crm-text-button"
              onClick={() => navigate("deals")}
            >
              {serviceMode ? "Wszystkie zlecenia" : "Pełny lejek"}{" "}
              <Icon name="arrow" size={15} />
            </button>
          </div>
          <div
            className="crm-period-control mb-5"
            role="group"
            aria-label="Okres wykresu przychodów"
          >
            {[6, 12].map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={range === period}
                onClick={() => setRange(period)}
              >
                {period} miesięcy
              </button>
            ))}
          </div>
          <RevenueChart key={range} months={months} />
          <p className="crm-muted mt-3! text-xs">
            Dotknij słupka lub wybierz go klawiaturą, aby sprawdzić miesiąc.
            Prognoza nie jest przychodem.
          </p>
          <details className="crm-revenue-table mt-4">
            <summary>Dane wykresu i sposób obliczania</summary>
            <p className="crm-muted mt-2! text-xs">
              {serviceMode
                ? "Realizacja: zakończone usługi. Prognoza: zarezerwowane i trwające usługi."
                : "Realizacja: wygrane szanse. Prognoza: wartość otwartych szans × prawdopodobieństwo."}{" "}
              Miesiąc wynika z terminu zamknięcia szansy lub rozpoczęcia usługi.
              To wartości CRM, nie zaksięgowane wpływy.
            </p>
            <div className="overflow-x-auto">
              <table>
                <caption className="sr-only">
                  Miesięczne wartości CRM w PLN
                </caption>
                <thead>
                  <tr>
                    <th>Miesiąc</th>
                    <th>Zrealizowane</th>
                    <th>Prognoza</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month) => (
                    <tr key={month.key}>
                      <th scope="row">{month.key}</th>
                      <td>{money(month.won)}</td>
                      <td>{money(month.forecast)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="crm-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <span className="crm-eyebrow">PRIORYTETY TWOJEJ FIRMY</span>
              <h3 className="mt-1 text-lg!">Następne najlepsze kroki</h3>
            </div>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
              {list.filter((i) => i.tone !== "green").length} do zrobienia
            </span>
          </div>
          <ul className="grid gap-2.5">
            {list.slice(0, 5).map((i) => (
              <li
                key={i.id}
                className="crm-priority-row group flex items-start gap-3 rounded-2xl border border-slate-100 bg-white/70 p-3.5 transition hover:border-violet-200 hover:shadow-sm"
              >
                <span
                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${tones[i.tone]} ring-4 ring-slate-50`}
                />
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm text-slate-800">
                    {i.title}
                  </strong>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {i.detail}
                  </p>
                </div>
                <button
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                  onClick={() =>
                    i.target === "ai"
                      ? askAgent(
                          i.id === "deals-no-task"
                            ? "Pokaż ryzyka w sprzedaży"
                            : "Co powinienem zrobić dzisiaj?",
                        )
                      : navigate(i.target)
                  }
                >
                  {i.action}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
