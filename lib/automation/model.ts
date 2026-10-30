export const REPORT_KINDS = [
  "executive",
  "sales",
  "activity",
  "services",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export const REPORT_PRESETS = [
  "7d",
  "30d",
  "month",
  "prev_month",
  "quarter",
  "ytd",
] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];
export const JOB_KINDS = ["report", "followup", "agent", "brand"] as const;
export type JobKind = (typeof JOB_KINDS)[number];
export const FREQUENCIES = ["daily", "weekdays", "weekly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const reportKindLabels: Record<ReportKind, string> = {
  executive: "Raport zarządczy",
  sales: "Raport sprzedaży",
  activity: "Raport aktywności zespołu",
  services: "Raport realizacji usług",
};
export const presetLabels: Record<ReportPreset, string> = {
  "7d": "Ostatnie 7 dni",
  "30d": "Ostatnie 30 dni",
  month: "Bieżący miesiąc",
  prev_month: "Poprzedni miesiąc",
  quarter: "Bieżący kwartał",
  ytd: "Od początku roku",
};
export const jobKindLabels: Record<JobKind, string> = {
  report: "Generuj raport",
  followup: "Zaplanuj follow-upy",
  agent: "Zadanie dla agenta AI",
  brand: "Monitoruj markę",
};
export const frequencyLabels: Record<Frequency, string> = {
  daily: "Codziennie",
  weekdays: "W dni robocze",
  weekly: "Co tydzień",
  monthly: "Co miesiąc",
};
export const weekdayLabels = [
  "niedziela",
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
];

export type Job = {
  id: string;
  name: string;
  kind: JobKind;
  frequency: Frequency;
  time: string;
  weekday: number;
  monthDay: number;
  enabled: boolean;
  reportKind: ReportKind;
  preset: ReportPreset;
  prompt: string;
  created: string;
  nextRun: string;
  lastRun?: string;
  lastStatus?: "ok" | "error";
  lastMessage?: string;
};
export type JobRun = {
  id: string;
  jobId: string;
  name: string;
  at: string;
  status: "ok" | "error";
  message: string;
};
export type ReportKpi = {
  label: string;
  value: number;
  format: "money" | "number" | "percent";
  previous?: number | null;
  hint?: string;
};
export type ReportChart = {
  title: string;
  format: "money" | "number";
  items: { label: string; value: number }[];
};
export type ReportTable = {
  title: string;
  columns: string[];
  rows: string[][];
};
export type ReportData = {
  kind: ReportKind;
  title: string;
  period: { from: string; to: string; label: string };
  kpis: ReportKpi[];
  charts: ReportChart[];
  tables: ReportTable[];
  highlights: string[];
  recommendations: string[];
};
export type ReportRecord = {
  id: string;
  created: string;
  source: "manual" | "job" | "agent";
  data: ReportData;
  summary?: string;
};
export type Automation = {
  jobs: Job[];
  runs: JobRun[];
  reports: ReportRecord[];
};
export const MAX_REPORTS = 24;
export const MAX_RUNS = 40;
export const MAX_JOBS = 30;

export function emptyAutomation(): Automation {
  return { jobs: [], runs: [], reports: [] };
}

function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function text(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length <= max;
}
function iso(v: unknown): v is string {
  return text(v, 40) && !Number.isNaN(Date.parse(v));
}
function day(v: unknown): v is string {
  return text(v, 10) && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function validateJob(j: unknown): Job {
  if (
    !record(j) ||
    !text(j.id, 100) ||
    !j.id ||
    !text(j.name, 120) ||
    !String(j.name).trim() ||
    !JOB_KINDS.includes(j.kind as JobKind) ||
    !FREQUENCIES.includes(j.frequency as Frequency) ||
    !text(j.time, 5) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(j.time) ||
    !Number.isInteger(j.weekday) ||
    Number(j.weekday) < 0 ||
    Number(j.weekday) > 6 ||
    !Number.isInteger(j.monthDay) ||
    Number(j.monthDay) < 1 ||
    Number(j.monthDay) > 28 ||
    typeof j.enabled !== "boolean" ||
    !REPORT_KINDS.includes(j.reportKind as ReportKind) ||
    !REPORT_PRESETS.includes(j.preset as ReportPreset) ||
    !text(j.prompt, 2000) ||
    (j.kind === "agent" && !String(j.prompt).trim()) ||
    !iso(j.created) ||
    !iso(j.nextRun) ||
    (j.lastRun !== undefined && !iso(j.lastRun)) ||
    (j.lastStatus !== undefined &&
      !["ok", "error"].includes(j.lastStatus as string)) ||
    (j.lastMessage !== undefined && !text(j.lastMessage, 1000))
  )
    throw Error("Nieprawidłowe zadanie harmonogramu.");
  return j as unknown as Job;
}

function validateReport(r: unknown): ReportRecord {
  if (
    !record(r) ||
    !text(r.id, 100) ||
    !iso(r.created) ||
    !["manual", "job", "agent"].includes(r.source as string) ||
    (r.summary !== undefined && !text(r.summary, 20000)) ||
    !record(r.data) ||
    !REPORT_KINDS.includes(r.data.kind as ReportKind) ||
    !text(r.data.title, 200) ||
    !record(r.data.period) ||
    !day(r.data.period.from) ||
    !day(r.data.period.to) ||
    !text(r.data.period.label, 100) ||
    !["kpis", "charts", "tables", "highlights", "recommendations"].every((k) =>
      Array.isArray((r.data as Record<string, unknown>)[k]),
    ) ||
    JSON.stringify(r.data).length > 120_000
  )
    throw Error("Nieprawidłowy raport.");
  return r as unknown as ReportRecord;
}

export function validateAutomation(value: unknown): Automation {
  if (value === undefined || value === null) return emptyAutomation();
  if (!record(value)) throw Error("Nieprawidłowa automatyzacja.");
  const jobs = Array.isArray(value.jobs) ? value.jobs : [],
    runs = Array.isArray(value.runs) ? value.runs : [],
    reports = Array.isArray(value.reports) ? value.reports : [];
  if (
    jobs.length > MAX_JOBS ||
    runs.length > MAX_RUNS * 2 ||
    reports.length > MAX_REPORTS * 2
  )
    throw Error("Za dużo zadań harmonogramu lub raportów.");
  for (const run of runs)
    if (
      !record(run) ||
      !text(run.id, 100) ||
      !text(run.jobId, 100) ||
      !text(run.name, 120) ||
      !iso(run.at) ||
      !["ok", "error"].includes(run.status as string) ||
      !text(run.message, 1000)
    )
      throw Error("Nieprawidłowa historia harmonogramu.");
  return {
    jobs: jobs.map(validateJob),
    runs: (runs as JobRun[]).slice(0, MAX_RUNS),
    reports: reports.map(validateReport).slice(0, MAX_REPORTS),
  };
}

function warsawParts(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour),
    min: Number(parts.minute),
  };
}
export function warsawToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let result = guess;
  for (let i = 0; i < 2; i++) {
    const p = warsawParts(new Date(result));
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    result += guess - shown;
  }
  return new Date(result);
}

export function nextRun(
  job: Pick<Job, "frequency" | "time" | "weekday" | "monthDay">,
  after: Date = new Date(),
) {
  const [h, min] = job.time.split(":").map(Number);
  const start = warsawParts(after);
  for (let i = 0; i < 70; i++) {
    const cal = new Date(Date.UTC(start.y, start.m - 1, start.d + i, 12));
    const y = cal.getUTCFullYear(),
      m = cal.getUTCMonth() + 1,
      d = cal.getUTCDate(),
      dow = cal.getUTCDay();
    const matches =
      job.frequency === "daily" ||
      (job.frequency === "weekdays" && dow >= 1 && dow <= 5) ||
      (job.frequency === "weekly" && dow === job.weekday) ||
      (job.frequency === "monthly" && d === job.monthDay);
    if (!matches) continue;
    const at = warsawToUtc(y, m, d, h, min);
    if (at.getTime() > after.getTime()) return at.toISOString();
  }
  throw Error("Nie udało się wyznaczyć terminu.");
}

export function scheduleLabel(
  job: Pick<Job, "frequency" | "time" | "weekday" | "monthDay">,
) {
  if (job.frequency === "weekly")
    return `Co tydzień · ${weekdayLabels[job.weekday]} ${job.time}`;
  if (job.frequency === "monthly")
    return `Co miesiąc · ${job.monthDay}. dnia ${job.time}`;
  return `${frequencyLabels[job.frequency]} · ${job.time}`;
}

export function dueJobs(jobs: Job[], now: Date = new Date()) {
  return jobs.filter(
    (j) => j.enabled && Date.parse(j.nextRun) <= now.getTime(),
  );
}

export function newJob(
  input: Partial<Job> & Pick<Job, "name" | "kind">,
  id: string,
  now: Date = new Date(),
): Job {
  const base = {
    frequency: "daily" as Frequency,
    time: "08:00",
    weekday: 1,
    monthDay: 1,
    enabled: true,
    reportKind: "executive" as ReportKind,
    preset: "7d" as ReportPreset,
    prompt: "",
    ...input,
    id,
    created: now.toISOString(),
  };
  return validateJob({ ...base, nextRun: nextRun(base, now) });
}

export const JOB_TEMPLATES: (Partial<Job> & Pick<Job, "name" | "kind">)[] = [
  {
    name: "Poranny briefing od agenta",
    kind: "agent",
    frequency: "weekdays",
    time: "08:00",
    prompt: "Co powinienem zrobić dzisiaj?",
  },
  {
    name: "Tygodniowy raport zarządczy",
    kind: "report",
    frequency: "weekly",
    weekday: 1,
    time: "07:30",
    reportKind: "executive",
    preset: "7d",
  },
  {
    name: "Automatyczne follow-upy",
    kind: "followup",
    frequency: "weekdays",
    time: "09:00",
  },
  {
    name: "Cotygodniowy monitoring marki",
    kind: "brand",
    frequency: "weekly",
    weekday: 1,
    time: "08:15",
  },
  {
    name: "Miesięczny raport sprzedaży",
    kind: "report",
    frequency: "monthly",
    monthDay: 1,
    time: "07:00",
    reportKind: "sales",
    preset: "prev_month",
  },
];
