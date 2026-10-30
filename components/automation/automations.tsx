"use client";
import { useState } from "react";
import { useCrm } from "@/stores/crm-store";
import { useAgent } from "@/stores/agent-store";
import { runJob } from "@/stores/scheduler";
import { id as newId } from "@/lib/crm/model";
import { copilotLabels } from "@/lib/ai/agent";
import {
  FREQUENCIES,
  JOB_KINDS,
  JOB_TEMPLATES,
  REPORT_KINDS,
  REPORT_PRESETS,
  frequencyLabels,
  jobKindLabels,
  newJob,
  nextRun,
  presetLabels,
  reportKindLabels,
  scheduleLabel,
  weekdayLabels,
  validateJob,
  type Job,
} from "@/lib/automation/model";
import { Field, Icon, Modal } from "../crm/ui";

const kindIcon = {
  report: "file",
  followup: "tasks",
  agent: "agent",
  brand: "star",
} as const;
const kindText = {
  report: "Tworzy raport i zapisuje go w sekcji Raporty.",
  followup: "Dodaje zadania dla otwartych szans bez kolejnego kroku.",
  agent: "Agent AI wykonuje polecenie; w autopilocie sam wprowadza zmiany.",
  brand:
    "Ponownie skanuje stronę i GitHub, zapisuje historię i ostrzega o spadkach.",
};
const when = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat("pl-PL", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Warsaw",
      }).format(new Date(iso))
    : "—";

function JobEditor({
  job,
  onClose,
}: {
  job: Partial<Job>;
  onClose: () => void;
}) {
  const s = useCrm();
  const [form, setForm] = useState({
    name: job.name ?? "",
    kind: job.kind ?? "report",
    frequency: job.frequency ?? "weekdays",
    time: job.time ?? "08:00",
    weekday: job.weekday ?? 1,
    monthDay: job.monthDay ?? 1,
    reportKind: job.reportKind ?? "executive",
    preset: job.preset ?? "7d",
    prompt: job.prompt ?? "",
    enabled: job.enabled ?? true,
  });
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (job.id) {
        const updated = { ...(job as Job), ...form, name: form.name.trim() };
        s.saveJob(validateJob({ ...updated, nextRun: nextRun(updated) }));
      } else {
        if (s.automation.jobs.length >= 30)
          throw Error("Limit 30 zadań harmonogramu.");
        s.saveJob(newJob({ ...form, name: form.name.trim() }, newId()));
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sprawdź formularz.");
    }
  }
  return (
    <Modal
      title={job.id ? "Edytuj automatyzację" : "Nowa automatyzacja"}
      onClose={onClose}
    >
      <form className="crm-form" onSubmit={save}>
        <Field label="Nazwa">
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="np. Poniedziałkowy raport dla zarządu"
          />
        </Field>
        <div
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          role="radiogroup"
          aria-label="Rodzaj zadania"
        >
          {JOB_KINDS.map((k) => (
            <button
              type="button"
              key={k}
              role="radio"
              aria-checked={form.kind === k}
              onClick={() => set("kind", k)}
              className={`rounded-2xl border p-3 text-left transition ${form.kind === k ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200"}`}
            >
              <Icon name={kindIcon[k]} size={18} />
              <strong className="mt-1 block text-sm">{jobKindLabels[k]}</strong>
              <span className="block text-[11px] leading-snug text-slate-500">
                {kindText[k]}
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Częstotliwość">
            <select
              value={form.frequency}
              onChange={(e) =>
                set("frequency", e.target.value as Job["frequency"])
              }
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {frequencyLabels[f]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Godzina (czas polski)">
            <input
              type="time"
              required
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </Field>
          {form.frequency === "weekly" && (
            <Field label="Dzień tygodnia">
              <select
                value={form.weekday}
                onChange={(e) => set("weekday", Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <option key={d} value={d}>
                    {weekdayLabels[d]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {form.frequency === "monthly" && (
            <Field label="Dzień miesiąca">
              <select
                value={form.monthDay}
                onChange={(e) => set("monthDay", Number(e.target.value))}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}.
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {form.kind === "report" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rodzaj raportu">
              <select
                value={form.reportKind}
                onChange={(e) =>
                  set("reportKind", e.target.value as Job["reportKind"])
                }
              >
                {REPORT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {reportKindLabels[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Okres">
              <select
                value={form.preset}
                onChange={(e) => set("preset", e.target.value as Job["preset"])}
              >
                {REPORT_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {presetLabels[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        {form.kind === "agent" && (
          <Field
            label="Polecenie dla agenta"
            hint="Np. „Zaplanuj follow-upy dla szans bez kroku i przygotuj szkice maili”."
          >
            <textarea
              required
              rows={3}
              maxLength={2000}
              value={form.prompt}
              onChange={(e) => set("prompt", e.target.value)}
            />
          </Field>
        )}
        {error && <p className="crm-alert error">{error}</p>}
        <div className="crm-form-actions">
          <button
            type="button"
            className="crm-button secondary"
            onClick={onClose}
          >
            Anuluj
          </button>
          <button className="crm-button">Zapisz</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Automations({
  notify,
  readOnly,
}: {
  notify: (text: string) => void;
  readOnly?: boolean;
}) {
  const s = useCrm();
  const settings = useAgent((a) => a.settings);
  const setSettings = useAgent((a) => a.setSettings);
  const [editor, setEditor] = useState<Partial<Job> | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const jobs = [...s.automation.jobs].sort((a, b) =>
    a.nextRun.localeCompare(b.nextRun),
  );
  const active = jobs.filter((j) => j.enabled);
  const runs = s.automation.runs;
  const okRuns = runs.filter((r) => r.status === "ok").length;
  async function run(job: Job) {
    setRunning(job.id);
    try {
      const result = await runJob(job, true);
      notify(
        `${result.status === "ok" ? "✓" : "⚠"} ${job.name}: ${result.message}`,
      );
    } finally {
      setRunning(null);
    }
  }
  return (
    <div className="grid min-w-0 gap-5">
      <section className="relative overflow-hidden rounded-[26px] bg-[radial-gradient(120%_140%_at_100%_0%,#0ea5e9_0%,#4f46e5_45%,#1c1446_100%)] p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <span className="text-[11px] font-bold tracking-[1.8px] text-sky-100 uppercase">
              Harmonogram · Europe/Warsaw
            </span>
            <h2 className="mt-2 text-2xl! font-bold text-white! sm:text-3xl!">
              Firma, która pracuje sama.
            </h2>
            <p className="mt-3! max-w-xl text-sm leading-relaxed text-sky-50/90">
              Raporty, follow-upy i zadania agenta AI uruchamiają się
              automatycznie, gdy Growth OS jest otwarty — pominięte terminy są
              nadrabiane przy kolejnym uruchomieniu.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Aktywne", value: active.length },
              { label: "Uruchomienia", value: runs.length },
              {
                label: "Skuteczność",
                value: runs.length
                  ? `${Math.round((okRuns / runs.length) * 100)}%`
                  : "—",
              },
            ].map((x) => (
              <div
                key={x.label}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"
              >
                <dd className="text-2xl font-bold tabular-nums">{x.value}</dd>
                <dt className="text-[11px] text-sky-100">{x.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="crm-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="crm-eyebrow">SZABLONY</span>
            <h3 className="mt-1 text-base!">Dodaj jednym kliknięciem</h3>
          </div>
          <button
            className="crm-button"
            disabled={readOnly}
            onClick={() => setEditor({})}
          >
            <Icon name="plus" size={16} /> Własna automatyzacja
          </button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14em),1fr))] gap-3">
          {JOB_TEMPLATES.map((t) => {
            const exists = jobs.some((j) => j.name === t.name);
            return (
              <button
                key={t.name}
                disabled={readOnly || exists}
                onClick={() => {
                  s.saveJob(newJob(t, newId()));
                  notify(`Dodano automatyzację: ${t.name}.`);
                }}
                className="group flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-violet-300 hover:shadow-sm disabled:opacity-60"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700">
                  <Icon name={kindIcon[t.kind]} size={17} />
                </span>
                <strong className="text-sm text-slate-800">{t.name}</strong>
                <span className="text-xs text-slate-500">
                  {scheduleLabel({
                    frequency: t.frequency ?? "daily",
                    time: t.time ?? "08:00",
                    weekday: t.weekday ?? 1,
                    monthDay: t.monthDay ?? 1,
                  })}
                </span>
                <span className="mt-auto text-xs font-semibold text-violet-700">
                  {exists ? "✓ Dodano" : "Dodaj →"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="crm-card min-w-0 p-5 sm:p-6">
          <span className="crm-eyebrow">ZADANIA CYKLICZNE</span>
          <h3 className="mt-1 mb-4 text-base!">Twoje automatyzacje</h3>
          {jobs.length ? (
            <ul className="grid gap-3">
              {jobs.map((j) => (
                <li
                  key={j.id}
                  className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${j.enabled ? "border-slate-200" : "border-dashed border-slate-200 opacity-70"}`}
                >
                  <span
                    className={`grid size-11 place-items-center rounded-2xl ${j.enabled ? "bg-gradient-to-br from-violet-600 to-indigo-500 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    <Icon name={kindIcon[j.kind]} size={19} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm text-slate-800">
                      {j.name}
                    </strong>
                    <span className="block text-xs text-slate-500">
                      {jobKindLabels[j.kind]}
                      {j.kind === "report" &&
                        ` · ${reportKindLabels[j.reportKind]}, ${presetLabels[j.preset].toLowerCase()}`}{" "}
                      · {scheduleLabel(j)}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>
                        Następnie:{" "}
                        <b className="text-slate-700">
                          {j.enabled ? when(j.nextRun) : "wstrzymane"}
                        </b>
                      </span>
                      {j.lastRun && (
                        <span
                          className={
                            j.lastStatus === "error"
                              ? "text-rose-600"
                              : "text-emerald-700"
                          }
                        >
                          {j.lastStatus === "error" ? "⚠" : "✓"}{" "}
                          {when(j.lastRun)}: {j.lastMessage}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="mr-1 inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={j.enabled}
                        disabled={readOnly}
                        onChange={(e) =>
                          s.saveJob({
                            ...j,
                            enabled: e.target.checked,
                            nextRun: nextRun(j),
                          })
                        }
                      />
                      <span className="relative h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-violet-600 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
                      <span className="sr-only">Aktywne</span>
                    </label>
                    <button
                      className="crm-button secondary px-3! py-1.5! text-xs!"
                      disabled={readOnly || running === j.id}
                      onClick={() => void run(j)}
                    >
                      {running === j.id ? "Trwa…" : "Uruchom"}
                    </button>
                    <button
                      className="crm-icon-button"
                      aria-label={`Edytuj ${j.name}`}
                      disabled={readOnly}
                      onClick={() => setEditor(j)}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      className="crm-icon-button"
                      aria-label={`Usuń ${j.name}`}
                      disabled={readOnly}
                      onClick={() => s.deleteJob(j.id)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              Brak automatyzacji. Zacznij od szablonu powyżej.
            </p>
          )}
        </section>
        <div className="grid h-fit gap-5">
          <section className="crm-card p-5">
            <span className="crm-eyebrow">AGENT W HARMONOGRAMIE</span>
            <h3 className="mt-1 text-base!">
              {copilotLabels[settings.provider]}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Zadania „agent AI” używają modelu wybranego w sekcji Agent AI. Bez
              autopilota propozycje czekają na Twoje zatwierdzenie w czacie.
            </p>
            <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
              <span>
                <strong className="block">Autopilot</strong>
                <span className="text-xs text-slate-500">
                  Agent sam wykonuje swoje propozycje
                </span>
              </span>
              <input
                type="checkbox"
                className="size-5 accent-violet-600"
                checked={settings.autopilot}
                onChange={(e) => setSettings({ autopilot: e.target.checked })}
              />
            </label>
          </section>
          <section className="crm-card p-5">
            <span className="crm-eyebrow">HISTORIA</span>
            <h3 className="mt-1 mb-3 text-base!">Ostatnie uruchomienia</h3>
            {runs.length ? (
              <ol className="relative grid gap-3 border-l border-slate-200 pl-4">
                {runs.slice(0, 12).map((r) => (
                  <li key={r.id} className="relative">
                    <span
                      className={`absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-white ${r.status === "ok" ? "bg-emerald-500" : "bg-rose-500"}`}
                    />
                    <strong className="block text-xs text-slate-800">
                      {r.name}
                    </strong>
                    <span className="block text-[11px] text-slate-500">
                      {when(r.at)} · {r.message}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">
                Jeszcze nic nie uruchomiono.
              </p>
            )}
          </section>
        </div>
      </div>
      {editor && <JobEditor job={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}
