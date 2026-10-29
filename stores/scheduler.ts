"use client";
import { useEffect, useRef } from "react";
import { useCrm } from "./crm-store";
import { runAgent } from "./agent-store";
import { monitorBrand } from "./brand-scan";
import { dueJobs, nextRun, type Job } from "@/lib/automation/model";
import { generateReport } from "@/lib/reports/generate";
import { id as newId, offsetDate, today } from "@/lib/crm/model";

function followups() {
  const s = useCrm.getState();
  const day = today();
  const open = s.tasks.filter((t) => !t.done);
  const deals = s.deals
    .filter(
      (d) =>
        !d.service &&
        !["Wygrana", "Przegrana"].includes(d.stage) &&
        !open.some((t) => t.companyId === d.companyId),
    )
    .sort((a, b) => b.value * b.probability - a.value * a.probability)
    .slice(0, 10);
  for (const d of deals)
    s.saveTask({
      id: newId(),
      companyId: d.companyId,
      title:
        `${d.stage === "Nowa" ? "Umów rozmowę" : d.stage === "Rozmowa" ? "Wyślij propozycję zakresu" : "Zapytaj o decyzję"} — ${d.name}`.slice(
          0,
          200,
        ),
      date: d.closeDate < day ? day : offsetDate(1),
      done: false,
    });
  return deals.length
    ? `Zaplanowano ${deals.length} follow-up(ów) dla szans bez kolejnego kroku.`
    : "Każda otwarta szansa ma zaplanowany krok — nic do dodania.";
}

export async function runJob(job: Job, manual = false) {
  const s = useCrm.getState();
  let status: "ok" | "error" = "ok",
    message = "";
  try {
    if (job.kind === "report") {
      const data = generateReport(
        {
          firms: s.firms,
          contacts: s.contacts,
          deals: s.deals,
          tasks: s.tasks,
          mails: s.mails,
        },
        job.reportKind,
        job.preset,
        today(),
      );
      s.saveReport({
        id: newId(),
        created: new Date().toISOString(),
        source: "job",
        data,
      });
      message = `Wygenerowano „${data.title}” · ${data.period.label}.`;
    } else if (job.kind === "followup") message = followups();
    else if (job.kind === "brand") {
      const result = await monitorBrand();
      message = result.message;
      if (result.alerts.length) status = "error";
    } else {
      const reply = await runAgent(job.prompt, { source: "job" });
      const executed = reply.actions.filter(
        (a) => a.status === "executed",
      ).length;
      message = `Agent odpowiedział${reply.actions.length ? ` i zaproponował ${reply.actions.length} akcji (wykonano ${executed})` : ""}.`;
      if (reply.error) status = "error";
    }
  } catch (e) {
    status = "error";
    message = e instanceof Error ? e.message : "Zadanie nie powiodło się.";
  }
  const at = new Date();
  const current =
    useCrm.getState().automation.jobs.find((j) => j.id === job.id) ?? job;
  useCrm.getState().saveJob({
    ...current,
    lastRun: at.toISOString(),
    lastStatus: status,
    lastMessage: message.slice(0, 1000),
    nextRun:
      manual && Date.parse(current.nextRun) > at.getTime()
        ? current.nextRun
        : nextRun(current, at),
  });
  useCrm.getState().addRun({
    id: newId(),
    jobId: job.id,
    name: job.name,
    at: at.toISOString(),
    status,
    message: message.slice(0, 1000),
  });
  return { status, message };
}

const LOCK = "evolution-scheduler-lock";
function acquire(owner: string) {
  try {
    const raw = localStorage.getItem(LOCK);
    const lock = raw
      ? (JSON.parse(raw) as { owner: string; at: number })
      : null;
    if (lock && lock.owner !== owner && Date.now() - lock.at < 90_000)
      return false;
    localStorage.setItem(LOCK, JSON.stringify({ owner, at: Date.now() }));
    return true;
  } catch {
    return true;
  }
}

export function useScheduler(enabled: boolean, notify: (text: string) => void) {
  const busy = useRef(false);
  const say = useRef(notify);
  useEffect(() => {
    say.current = notify;
  }, [notify]);
  useEffect(() => {
    if (!enabled) return;
    const owner = newId();
    const tick = async () => {
      if (busy.current) return;
      const due = dueJobs(useCrm.getState().automation.jobs);
      if (!due.length || !acquire(owner)) return;
      busy.current = true;
      try {
        for (const job of due) {
          const result = await runJob(job);
          say.current(
            `${result.status === "ok" ? "✓" : "⚠"} Harmonogram: ${job.name} — ${result.message}`,
          );
        }
      } finally {
        busy.current = false;
      }
    };
    const first = setTimeout(() => void tick(), 2500);
    const timer = setInterval(() => void tick(), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [enabled]);
}
