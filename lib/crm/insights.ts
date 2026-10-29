import type { WorkspaceData, Deal } from "./model";

export type InsightTone = "red" | "amber" | "green" | "violet";
export type InsightTarget = "deals" | "tasks" | "contacts" | "companies" | "ai";
export type Insight = {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  target: InsightTarget;
  action: string;
  weight: number;
};

const CLOSED = ["Wygrana", "Przegrana"];
const pln = (value: number) =>
  new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
const plural = (n: number, one: string, few: string, many: string) =>
  n === 1
    ? one
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
      ? few
      : many;
function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function openSales(data: WorkspaceData) {
  return data.deals.filter((d) => !d.service && !CLOSED.includes(d.stage));
}

export function pipelineStats(data: WorkspaceData) {
  const sales = data.deals.filter((d) => !d.service),
    open = openSales(data),
    won = sales.filter((d) => d.stage === "Wygrana"),
    lost = sales.filter((d) => d.stage === "Przegrana"),
    closed = won.length + lost.length;
  return {
    open: open.length,
    openValue: open.reduce((s, d) => s + d.value, 0),
    forecast: open.reduce((s, d) => s + (d.value * d.probability) / 100, 0),
    wonValue: won.reduce((s, d) => s + d.value, 0),
    won: won.length,
    lost: lost.length,
    winRate: closed ? Math.round((won.length / closed) * 100) : null,
    averageDeal: sales.length
      ? sales.reduce((s, d) => s + d.value, 0) / sales.length
      : 0,
  };
}

export function monthlyRevenue(data: WorkspaceData, today: string, months = 6) {
  const [year, month] = today.split("-").map(Number);
  const result: {
    key: string;
    label: string;
    won: number;
    forecast: number;
  }[] = [];
  for (let i = months - 1; i >= -1; i--) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    result.push({
      key: date.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("pl-PL", {
        month: "short",
        timeZone: "UTC",
      })
        .format(date)
        .replace(".", ""),
      won: 0,
      forecast: 0,
    });
  }
  const bucket = (d: Deal) =>
    result.find(
      (m) => m.key === (d.service ? d.service.start : d.closeDate).slice(0, 7),
    );
  for (const d of data.deals) {
    const m = bucket(d);
    if (!m) continue;
    if (d.service) {
      if (d.service.status === "completed") m.won += d.value;
      else if (d.service.status !== "cancelled") m.forecast += d.value;
    } else if (d.stage === "Wygrana") m.won += d.value;
    else if (!CLOSED.includes(d.stage))
      m.forecast += (d.value * d.probability) / 100;
  }
  return result;
}

export function insights(data: WorkspaceData, today: string): Insight[] {
  const list: Insight[] = [];
  const firm = (id: string) =>
    data.firms.find((f) => f.id === id)?.name ?? "firma";
  const open = data.tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.date < today);
  if (overdue.length)
    list.push({
      id: "tasks-overdue",
      tone: "red",
      title: `${overdue.length} ${plural(overdue.length, "zaległe zadanie", "zaległe zadania", "zaległych zadań")}`,
      detail: `Najstarsze: „${overdue.sort((a, b) => a.date.localeCompare(b.date))[0].title}” (${firm(overdue[0].companyId)}).`,
      target: "tasks",
      action: "Nadrób zadania",
      weight: 100,
    });
  const sales = openSales(data);
  const late = sales.filter((d) => d.closeDate < today);
  if (late.length)
    list.push({
      id: "deals-late",
      tone: "red",
      title: `${late.length} ${plural(late.length, "szansa po terminie", "szanse po terminie", "szans po terminie")}`,
      detail: `${pln(late.reduce((s, d) => s + d.value, 0))} czeka na decyzję. Zaktualizuj etap lub datę zamknięcia.`,
      target: "deals",
      action: "Przejrzyj szanse",
      weight: 90,
    });
  const soon = sales.filter(
    (d) => d.closeDate >= today && d.closeDate <= addDays(today, 7),
  );
  if (soon.length)
    list.push({
      id: "deals-soon",
      tone: "amber",
      title: `${soon.length} ${plural(soon.length, "szansa zamyka się", "szanse zamykają się", "szans zamyka się")} w 7 dni`,
      detail: `Łącznie ${pln(soon.reduce((s, d) => s + d.value, 0))}. Największa: „${[...soon].sort((a, b) => b.value - a.value)[0].name}”.`,
      target: "deals",
      action: "Przygotuj domknięcie",
      weight: 80,
    });
  const orphan = sales.filter(
    (d) => !open.some((t) => t.companyId === d.companyId),
  );
  if (orphan.length)
    list.push({
      id: "deals-no-task",
      tone: "amber",
      title: `${orphan.length} ${plural(orphan.length, "szansa bez", "szanse bez", "szans bez")} kolejnego kroku`,
      detail: `Np. ${firm(orphan[0].companyId)} — „${orphan[0].name}”. Agent AI zaproponuje zadania do zatwierdzenia.`,
      target: "ai",
      action: "Zapytaj agenta",
      weight: 70,
    });
  const noContact = data.firms.filter(
    (f) => !data.contacts.some((c) => c.companyId === f.id),
  );
  if (noContact.length)
    list.push({
      id: "firms-no-contact",
      tone: "violet",
      title: `${noContact.length} ${plural(noContact.length, "firma bez", "firmy bez", "firm bez")} osoby kontaktowej`,
      detail: `Dodaj decydenta, aby agent follow-up mógł przygotować wiadomość.`,
      target: "contacts",
      action: "Dodaj kontakt",
      weight: 40,
    });
  const stats = pipelineStats(data);
  if (stats.winRate !== null && stats.won + stats.lost >= 3)
    list.push({
      id: "win-rate",
      tone: stats.winRate >= 40 ? "green" : "amber",
      title: `Skuteczność zamknięć: ${stats.winRate}%`,
      detail:
        stats.winRate >= 40
          ? "Dobry wynik. Utrzymaj tempo follow-upów w szansach na etapie oferty."
          : "Sprawdź powody przegranych i doprecyzuj kwalifikację na etapie rozmowy.",
      target: "deals",
      action: "Analizuj lejek",
      weight: 30,
    });
  const jobs = data.deals.filter(
    (d) =>
      d.service &&
      ["booked", "in_progress"].includes(d.service.status) &&
      d.service.end.slice(0, 10) < today,
  );
  if (jobs.length)
    list.push({
      id: "jobs-late",
      tone: "red",
      title: `${jobs.length} ${plural(jobs.length, "realizacja wymaga", "realizacje wymagają", "realizacji wymaga")} zamknięcia`,
      detail:
        "Termin minął, a status nadal jest aktywny. Oznacz jako zakończone lub przełóż.",
      target: "deals",
      action: "Zaktualizuj zlecenia",
      weight: 95,
    });
  if (!list.length)
    list.push({
      id: "all-good",
      tone: "green",
      title: "Wszystko pod kontrolą",
      detail:
        "Brak zaległości i ryzyk w CRM. Zapytaj agenta o pomysły na rozwój sprzedaży.",
      target: "ai",
      action: "Zapytaj agenta",
      weight: 0,
    });
  return list.sort((a, b) => b.weight - a.weight);
}

export function healthScore(data: WorkspaceData, today: string) {
  let score = 100;
  for (const i of insights(data, today))
    score -=
      i.tone === "red"
        ? 18
        : i.tone === "amber"
          ? 9
          : i.tone === "violet"
            ? 4
            : 0;
  if (!data.deals.length && !data.firms.length) return null;
  return Math.max(0, Math.min(100, score));
}

const FUNNEL = ["Nowa", "Rozmowa", "Oferta", "Wygrana"] as const;
export function funnelConversion(data: WorkspaceData) {
  const sales = data.deals.filter((d) => !d.service);
  const reached = (index: number) =>
    sales.filter((d) =>
      d.stage === "Przegrana"
        ? index === 0
        : FUNNEL.indexOf(d.stage as (typeof FUNNEL)[number]) >= index,
    );
  return FUNNEL.map((label, i) => {
    const list = reached(i),
      previous = i ? reached(i - 1).length : list.length;
    return {
      label,
      count: list.length,
      value: list.reduce((s, d) => s + d.value, 0),
      rate: previous ? Math.round((list.length / previous) * 100) : null,
    };
  });
}

export function closingSchedule(data: WorkspaceData, today: string) {
  const buckets = [
    { label: "Po terminie", from: -Infinity, to: -1 },
    { label: "0–30 dni", from: 0, to: 30 },
    { label: "31–60 dni", from: 31, to: 60 },
    { label: "61–90 dni", from: 61, to: 90 },
    { label: "> 90 dni", from: 91, to: Infinity },
  ];
  const day = Date.parse(`${today}T12:00:00Z`);
  const open = openSales(data);
  return buckets.map((b) => {
    const list = open.filter((d) => {
      const diff = Math.round(
        (Date.parse(`${d.closeDate}T12:00:00Z`) - day) / 86400000,
      );
      return diff >= b.from && diff <= b.to;
    });
    return {
      label: b.label,
      count: list.length,
      value: list.reduce((s, d) => s + d.value, 0),
      weighted: list.reduce((s, d) => s + (d.value * d.probability) / 100, 0),
      overdue: b.to < 0,
    };
  });
}
