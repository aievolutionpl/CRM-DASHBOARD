"use client";
import { useMemo, useState } from "react";
import { useCrm } from "@/stores/crm-store";
import { useAgent, summarizeReport } from "@/stores/agent-store";
import { id as newId, money, today, type Section } from "@/lib/crm/model";
import { downloadFile } from "@/lib/crm/backup";
import {
  REPORT_KINDS,
  REPORT_PRESETS,
  presetLabels,
  reportKindLabels,
  type ReportKind,
  type ReportPreset,
  type ReportRecord,
} from "@/lib/automation/model";
import {
  formatKpi,
  generateReport,
  kpiDelta,
  reportCsv,
  reportMarkdown,
} from "@/lib/reports/generate";
import { BarList, Columns, Delta } from "../insights/kit";
import Markdown from "../local/markdown";
import { Icon } from "../crm/ui";

const kindInfo: Record<ReportKind, { icon: string; text: string }> = {
  executive: {
    icon: "dashboard",
    text: "Sprzedaż, aktywność i rekomendacje na jednej stronie.",
  },
  sales: {
    icon: "deals",
    text: "Wygrane, skuteczność, lejek i szanse do zamknięcia.",
  },
  activity: {
    icon: "tasks",
    text: "Zadania, wiadomości, nowe firmy i zaległości.",
  },
  services: {
    icon: "clock",
    text: "Zlecenia, realizacje, przychód i obłożenie zasobów.",
  },
};
const count = (v: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(v);
const when = (iso: string) =>
  new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(iso));
const sourceLabel = {
  manual: "Ręcznie",
  job: "Harmonogram",
  agent: "Agent AI",
};

function ReportView({
  report,
  onSummary,
  onDelete,
  busy,
  canSummarize,
}: {
  report: ReportRecord;
  onSummary: () => void;
  onDelete: () => void;
  busy: boolean;
  canSummarize: boolean;
}) {
  const r = report.data;
  const slug = `${r.kind}-${r.period.from}-${r.period.to}`;
  const print = () => {
    document.body.classList.add("printing-report");
    const done = () => {
      document.body.classList.remove("printing-report");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
    setTimeout(done, 1500);
  };
  return (
    <article className="report-print crm-card min-w-0 overflow-hidden">
      <header className="relative overflow-hidden bg-[radial-gradient(120%_140%_at_0%_0%,var(--brand-hero-a)_0%,var(--brand-hero-b)_45%,var(--brand-hero-c)_100%)] p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-16 size-60 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-bold tracking-[1.6px] text-violet-200 uppercase">
              Evolution Growth OS · {sourceLabel[report.source]} ·{" "}
              {when(report.created)}
            </span>
            <h2 className="mt-2 text-2xl! font-bold text-white!">{r.title}</h2>
            <p className="mt-1 text-sm text-violet-100">{r.period.label}</p>
          </div>
          <div className="report-actions flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
              onClick={print}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon name="download" size={15} /> PDF
              </span>
            </button>
            <button
              className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
              onClick={() =>
                downloadFile(
                  `raport-${slug}.md`,
                  reportMarkdown(r, report.summary),
                  "text/markdown",
                )
              }
            >
              Markdown
            </button>
            <button
              className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
              onClick={() =>
                downloadFile(
                  `raport-${slug}.csv`,
                  reportCsv(r),
                  "text/csv;charset=utf-8",
                )
              }
            >
              CSV
            </button>
            <button
              aria-label="Usuń raport"
              className="rounded-xl border border-white/25 bg-white/10 px-2.5 py-2 text-white hover:bg-rose-500/40"
              onClick={onDelete}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>
      </header>
      <div className="grid gap-6 p-5 sm:p-7">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11em),1fr))] gap-3">
          {r.kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
            >
              <span className="text-xs text-slate-500">{k.label}</span>
              <strong className="mt-1 block text-xl font-bold text-slate-800 tabular-nums">
                {k.hint ? "—" : formatKpi(k)}
              </strong>
              <div className="mt-1">
                {k.hint ? (
                  <span className="text-[11px] text-slate-400">{k.hint}</span>
                ) : (
                  <Delta
                    value={kpiDelta(k)}
                    unit={k.format === "percent" ? " pp" : "%"}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm! font-semibold text-violet-900">
              <Icon name="spark" size={16} />{" "}
              {report.summary ? "Podsumowanie AI" : "Najważniejsze fakty"}
            </h3>
            {!report.summary && (
              <button
                className="crm-text-button report-actions"
                disabled={busy || !canSummarize}
                onClick={onSummary}
              >
                {busy ? "Agent pisze…" : "Napisz podsumowanie"}
              </button>
            )}
          </div>
          {report.summary ? (
            <div className="text-sm leading-7 text-slate-700">
              <Markdown
                content={report.summary}
                documents={[]}
                open={() => {}}
              />
            </div>
          ) : (
            <ul className="grid gap-1.5 text-sm text-slate-700">
              {r.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="text-violet-500">•</span>
                  {h}
                </li>
              ))}
              {!canSummarize && (
                <li className="mt-1 text-xs text-slate-500">
                  Podłącz model AI w sekcji Agent AI, aby otrzymać opisowe
                  podsumowanie.
                </li>
              )}
            </ul>
          )}
        </section>
        {r.charts.length > 0 && (
          <div className="grid gap-5 lg:grid-cols-2">
            {r.charts.map((c) => (
              <section
                key={c.title}
                className="rounded-2xl border border-slate-100 p-5"
              >
                <h3 className="mb-4 text-sm! font-semibold">{c.title}</h3>
                {c.items.length > 5 ? (
                  <Columns
                    items={c.items}
                    format={c.format === "money" ? money : count}
                    height={120}
                  />
                ) : (
                  <BarList
                    items={c.items}
                    format={c.format === "money" ? money : count}
                  />
                )}
              </section>
            ))}
          </div>
        )}
        {r.tables.map((t) => (
          <section key={t.title} className="min-w-0">
            <h3 className="mb-3 text-sm! font-semibold">{t.title}</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[34em] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {t.columns.map((c) => (
                      <th key={c} className="px-4 py-2.5 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className={`px-4 py-2.5 ${j === 0 ? "font-medium text-slate-800" : "text-slate-600"}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        <section>
          <h3 className="mb-3 text-sm! font-semibold">Rekomendacje</h3>
          <ol className="grid gap-2">
            {r.recommendations.map((x, i) => (
              <li
                key={x}
                className="flex gap-3 rounded-2xl border border-slate-100 p-3 text-sm text-slate-700"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                  {i + 1}
                </span>
                {x}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}

export default function Reports({
  notify,
  navigate,
  readOnly,
}: {
  notify: (text: string) => void;
  navigate: (s: Section) => void;
  readOnly?: boolean;
}) {
  const s = useCrm();
  const provider = useAgent((a) => a.settings.provider);
  const [kind, setKind] = useState<ReportKind>(
    s.businessMode === "services" ? "services" : "executive",
  );
  const [preset, setPreset] = useState<ReportPreset>("30d");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reports = s.automation.reports;
  const current = useMemo(
    () => reports.find((r) => r.id === selected) ?? reports[0],
    [reports, selected],
  );
  function generate() {
    const data = generateReport(
      {
        firms: s.firms,
        contacts: s.contacts,
        deals: s.deals,
        tasks: s.tasks,
        mails: s.mails,
      },
      kind,
      preset,
      today(),
    );
    const record: ReportRecord = {
      id: newId(),
      created: new Date().toISOString(),
      source: "manual",
      data,
    };
    s.saveReport(record);
    setSelected(record.id);
    notify(`Wygenerowano: ${data.title} · ${presetLabels[preset]}.`);
  }
  async function summary(report: ReportRecord) {
    setBusy(true);
    try {
      const text = await summarizeReport(reportMarkdown(report.data));
      if (text) s.saveReport({ ...report, summary: text });
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "Nie udało się przygotować podsumowania.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid min-w-0 gap-5">
      <section className="crm-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="crm-eyebrow">GENERATOR RAPORTÓW</span>
            <h2 className="mt-1 text-lg!">Jaki raport przygotować?</h2>
          </div>
          <button
            className="crm-text-button"
            onClick={() => navigate("automations")}
          >
            Raport cykliczny w harmonogramie <Icon name="arrow" size={14} />
          </button>
        </div>
        <div
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14em),1fr))] gap-3"
          role="radiogroup"
          aria-label="Rodzaj raportu"
        >
          {REPORT_KINDS.map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`flex gap-3 rounded-2xl border p-4 text-left transition ${kind === k ? "border-violet-400 bg-violet-50/70 ring-2 ring-violet-200" : "border-slate-200 hover:border-violet-200"}`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${kind === k ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                <Icon name={kindInfo[k].icon} size={18} />
              </span>
              <span className="min-w-0">
                <strong className="block text-sm text-slate-800">
                  {reportKindLabels[k]}
                </strong>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  {kindInfo[k].text}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-slate-500">
            Okres:
          </span>
          {REPORT_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${preset === p ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 text-slate-600 hover:border-violet-300"}`}
            >
              {presetLabels[p]}
            </button>
          ))}
          <button
            className="crm-button ml-auto"
            disabled={readOnly}
            onClick={generate}
          >
            <Icon name="spark" size={16} /> Generuj raport
          </button>
        </div>
      </section>
      {reports.length ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[17em_minmax(0,1fr)]">
          <aside className="crm-card h-fit p-3">
            <h3 className="px-2 pt-1 pb-2 text-xs! font-semibold tracking-wide text-slate-500 uppercase">
              Historia ({reports.length})
            </h3>
            <ul className="grid gap-1">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelected(r.id)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition ${current?.id === r.id ? "bg-violet-50 text-violet-900" : "hover:bg-slate-50"}`}
                  >
                    <strong className="block truncate text-sm">
                      {r.data.title}
                    </strong>
                    <span className="block truncate text-xs text-slate-500">
                      {r.data.period.from} – {r.data.period.to} ·{" "}
                      {sourceLabel[r.source]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          {current && (
            <ReportView
              key={current.id}
              report={current}
              busy={busy}
              canSummarize={provider !== "builtin" && !readOnly}
              onSummary={() => void summary(current)}
              onDelete={() => {
                s.deleteReport(current.id);
                setSelected(null);
              }}
            />
          )}
        </div>
      ) : (
        <section className="crm-card grid place-items-center gap-3 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-3xl bg-violet-50 text-violet-700">
            <Icon name="file" size={26} />
          </span>
          <h3 className="text-lg!">Brak raportów</h3>
          <p className="max-w-md text-sm text-slate-500">
            Wybierz rodzaj i okres, a raport z KPI, porównaniem do poprzedniego
            okresu, wykresami i rekomendacjami powstanie w sekundę. Agent AI
            dopisze podsumowanie zarządcze.
          </p>
        </section>
      )}
    </div>
  );
}
