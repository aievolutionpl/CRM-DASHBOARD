import type { Proposal } from "./model";
import type { StatsDigest } from "./stats";

export const BUILTIN_MODEL = "evolution-local";

type Ctx = {
  date: string;
  businessMode?: string;
  marketing?: {
    spend: number;
    clicks: number;
    leads: number;
    qualified: number;
    revenue: number;
    cpa: number | null;
    roas: number | null;
    cvr: number | null;
  };
  companies: {
    id: string;
    name: string;
    industry?: string;
    status?: string;
    owner?: string;
    tags?: string[];
  }[];
  deals: {
    id: string;
    companyId: string;
    name: string;
    value: number;
    probability: number;
    stage: string;
    closeDate: string;
    service?: { status: string; start: string; end: string; resource: string };
  }[];
  tasks: { id: string; companyId: string; title: string; date: string }[];
  notes: { title: string; content: string }[];
  crm?: {
    pipeline: {
      open: number;
      openValue: number;
      forecast: number;
      wonValue: number;
      winRate: number | null;
    };
    monthly: { key: string; won: number; forecast: number }[];
    insights: { title: string; detail: string; tone: string }[];
  };
  stats?: Omit<StatsDigest, "sources"> & { sources: string[] };
};

const pct = (now: number, before: number) =>
  before
    ? `${now >= before ? "+" : ""}${Math.round(((now - before) / before) * 100)}%`
    : "brak bazy";
const metricLabel: Record<string, string> = {
  sessions: "sesje",
  totalUsers: "użytkownicy",
  screenPageViews: "odsłony",
  keyEvents: "kluczowe zdarzenia",
  totalRevenue: "przychód",
  clicks: "kliknięcia",
  impressions: "wyświetlenia",
  ctr: "CTR",
  position: "śr. pozycja",
  visitors: "odwiedzający",
  visits: "wizyty",
  pageviews: "odsłony",
  bounce_rate: "odrzucenia %",
  visit_duration: "czas wizyty s",
};
const analyticsLabel: Record<string, string> = {
  ga4: "Google Analytics 4",
  search_console: "Search Console",
  plausible: "Plausible",
};

function fullReport(ctx: Ctx, firm: (id: string) => string) {
  const lines: string[] = [`**Pełna analiza firmy · ${ctx.date}**`, ""];
  const priorities: string[] = [];
  const st = ctx.stats;
  if (ctx.crm) {
    const p = ctx.crm.pipeline;
    const months = ctx.crm.monthly;
    const last = months.at(-2),
      before = months.at(-3);
    lines.push(
      "**Sprzedaż (CRM)**",
      `- Otwarte szanse: ${p.open} · ${pln(p.openValue)}, prognoza ważona ${pln(p.forecast)}`,
      `- Wygrane łącznie: ${pln(p.wonValue)}${p.winRate !== null ? `, skuteczność ${p.winRate}%` : ""}`,
    );
    if (last && before)
      lines.push(
        `- Ten miesiąc do dziś: ${pln(last.won)} wygranych (poprzedni: ${pln(before.won)})`,
      );
    for (const i of ctx.crm.insights
      .filter((i) => i.tone === "red")
      .slice(0, 2))
      priorities.push(`${i.title} — ${i.detail}`);
    lines.push("");
  }
  if (st?.leads) {
    const l = st.leads;
    lines.push(
      "**Leady (Lead Hub)**",
      `- ${l.total} leadów, w procesie ${pln(l.pipelineValue)}, przychód ${pln(l.revenue)}`,
      `- Statusy: ${Object.entries(l.byStatus)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`,
      `- Najwięcej leadów: ${l.bySource
        .slice(0, 3)
        .map((s) => `${s.source} (${s.count})`)
        .join(", ")}`,
      "",
    );
  }
  if (st?.marketing.bySource.length) {
    const m = st.marketing;
    const spend = m.bySource.reduce((s, x) => s + x.spend, 0),
      leads = m.bySource.reduce((s, x) => s + x.leads, 0),
      revenue = m.bySource.reduce((s, x) => s + x.revenue, 0);
    lines.push(
      "**Kampanie · 30 dni**",
      `- Wydatki ${pln(spend)} (${pct(spend, m.previous.spend)}), leady ${num(leads)} (${pct(leads, m.previous.leads)}), przychód ${pln(revenue)} (${pct(revenue, m.previous.revenue)})`,
      ...m.bySource.map(
        (x) =>
          `- ${x.source}: ${pln(x.spend)}, ${num(x.leads)} leadów, CPA ${x.cpa !== null ? pln(x.cpa) : "—"}, ROAS ${x.roas !== null ? `${num(x.roas, 2)}×` : "—"}`,
      ),
    );
    const scored = m.bySource.filter((x) => x.cpa !== null);
    if (scored.length > 1) {
      const best = [...scored].sort((a, b) => a.cpa! - b.cpa!)[0],
        worst = [...scored].sort((a, b) => b.cpa! - a.cpa!)[0];
      priorities.push(
        `Przesuń część budżetu z ${worst.source} (CPA ${pln(worst.cpa!)}) do ${best.source} (CPA ${pln(best.cpa!)}).`,
      );
    }
    if (m.previous.leads && leads < m.previous.leads * 0.8)
      priorities.push(
        `Leady spadły o ${Math.round((1 - leads / m.previous.leads) * 100)}% względem poprzednich 30 dni — sprawdź kampanie i formularze.`,
      );
    lines.push("");
  } else
    priorities.push(
      "Zaimportuj wyniki kampanii (CSV lub Meta Ads), aby liczyć CPA i ROAS.",
    );
  for (const a of st?.analytics || []) {
    lines.push(
      `**${analyticsLabel[a.provider] ?? a.provider}** · ${a.from} – ${a.to}`,
      `- ${Object.entries(a.totals)
        .map(([k, v]) => `${metricLabel[k] ?? k}: ${num(v, 2)}`)
        .join(", ")}`,
    );
    if (a.top.length)
      lines.push(
        `- Top: ${a.top
          .slice(0, 3)
          .map((t) => t.label)
          .join(", ")}`,
      );
    lines.push("");
  }
  if (!st?.analytics.length)
    priorities.push(
      "Podłącz GA4, Search Console lub Plausible, aby agent widział ruch na stronie.",
    );
  if (st?.payments) {
    const p = st.payments;
    lines.push(
      "**Płatności (Stripe)**",
      `- Netto ${num(p.net, 2)} ${p.currency} z ${p.count} płatności, zwroty ${num(p.refunded, 2)} ${p.currency}`,
      "",
    );
  }
  if (st?.productEvents.length)
    lines.push(
      "**Zdarzenia produktu (PostHog)**",
      `- ${st.productEvents
        .slice(0, 5)
        .map((e) => `${e.event}: ${num(e.count)}`)
        .join(", ")}`,
      "",
    );
  const overdue = ctx.tasks.filter((t) => t.date < ctx.date);
  if (overdue.length && !priorities.some((p) => p.includes("zaległ")))
    priorities.push(
      `Zamknij ${overdue.length} zaległych zadań, zaczynając od „${overdue[0].title}” (${firm(overdue[0].companyId)}).`,
    );
  lines.push(
    "**Priorytety na ten tydzień**",
    ...(priorities.length
      ? priorities.slice(0, 5).map((p, i) => `${i + 1}. ${p}`)
      : ["1. Utrzymaj tempo — brak krytycznych sygnałów w danych."]),
    "",
    `Źródła w analizie: ${st?.sources.join(", ") || "CRM"}.`,
  );
  return lines;
}

const pln = (v: number) =>
  new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(v);
const num = (v: number, digits = 0) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: digits }).format(v);
const has = (text: string, words: string[]) =>
  words.some((w) => text.includes(w));
function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextStep(stage: string) {
  return stage === "Nowa"
    ? "Umów rozmowę kwalifikacyjną"
    : stage === "Rozmowa"
      ? "Wyślij podsumowanie potrzeb i propozycję zakresu"
      : "Zadzwoń w sprawie decyzji o ofercie";
}

export function builtinAnswer(prompt: string, contextText: string) {
  const ctx = JSON.parse(contextText) as Ctx;
  const q = prompt.toLowerCase();
  const today = ctx.date;
  const firm = (id: string) =>
    ctx.companies.find((c) => c.id === id)?.name ?? "nieznana firma";
  const sales = ctx.deals.filter(
    (d) => !d.service && !["Wygrana", "Przegrana"].includes(d.stage),
  );
  const overdue = ctx.tasks.filter((t) => t.date < today);
  const dueToday = ctx.tasks.filter((t) => t.date === today);
  const late = sales.filter((d) => d.closeDate < today);
  const soon = sales.filter(
    (d) => d.closeDate >= today && d.closeDate <= addDays(today, 7),
  );
  const orphans = sales
    .filter((d) => !ctx.tasks.some((t) => t.companyId === d.companyId))
    .sort((a, b) => b.value * b.probability - a.value * a.probability);
  const forecast = sales.reduce(
    (s, d) => s + (d.value * d.probability) / 100,
    0,
  );
  const actions: Proposal[] = [];
  const lines: string[] = [];
  const proposeTasks = (limit: number) => {
    for (const d of orphans.slice(0, limit))
      actions.push({
        type: "create_task",
        title: `${nextStep(d.stage)} — ${d.name}`.slice(0, 200),
        companyId: d.companyId,
        date: d.closeDate < today ? today : addDays(today, 1),
      });
  };
  const mentioned = ctx.companies.find(
    (c) => c.name.length > 2 && q.includes(c.name.toLowerCase()),
  );

  if (
    has(q, [
      "wszystk",
      "statysty",
      "pełn",
      "raport",
      "całoś",
      "podsumuj firm",
      "przegląd firmy",
    ])
  ) {
    lines.push(...fullReport(ctx, firm));
    proposeTasks(3);
  } else if (mentioned) {
    const deals = ctx.deals.filter((d) => d.companyId === mentioned.id);
    const tasks = ctx.tasks.filter((t) => t.companyId === mentioned.id);
    lines.push(
      `**${mentioned.name}**${mentioned.industry ? ` · ${mentioned.industry}` : ""}${mentioned.status ? ` · status: ${mentioned.status}` : ""}${mentioned.owner ? ` · opiekun: ${mentioned.owner}` : ""}`,
      "",
      deals.length
        ? deals
            .map(
              (d) =>
                `- ${d.name}: ${pln(d.value)}, ${d.service ? `status ${d.service.status}` : `etap ${d.stage}, ${d.probability}%`}, termin ${d.service ? d.service.start.slice(0, 10) : d.closeDate}`,
            )
            .join("\n")
        : "- Brak szans i zleceń przypisanych do tej firmy.",
      "",
      tasks.length
        ? `Otwarte zadania: ${tasks.map((t) => `„${t.title}” (${t.date})`).join(", ")}.`
        : "Brak otwartych zadań — warto zaplanować kolejny krok.",
    );
    const open = deals.find(
      (d) => !d.service && !["Wygrana", "Przegrana"].includes(d.stage),
    );
    if (open && !tasks.length)
      actions.push({
        type: "create_task",
        title: `${nextStep(open.stage)} — ${open.name}`.slice(0, 200),
        companyId: mentioned.id,
        date: addDays(today, 1),
      });
  } else if (
    has(q, ["marketing", "kampan", "roas", "wydatk", "reklam", "lead", "cpa"])
  ) {
    const m = ctx.marketing;
    if (!m || (!m.spend && !m.leads && !m.revenue))
      lines.push(
        "Nie widzę importu kampanii z ostatnich 30 dni.",
        "",
        "Wejdź w **Konektory → Google Ads / Microsoft Ads → Importuj CSV** albo pobierz statystyki z GA4. Po imporcie policzę CPA, ROAS i konwersję.",
      );
    else {
      lines.push(
        "**Marketing · ostatnie 30 dni (dane z importu)**",
        "",
        `- Wydatki: ${pln(m.spend)}`,
        `- Leady: ${num(m.leads)} (zakwalifikowane: ${num(m.qualified)})`,
        `- Koszt leada: ${m.cpa !== null ? pln(m.cpa) : "brak"}`,
        `- Przychód przypisany: ${pln(m.revenue)}`,
        `- ROAS: ${m.roas !== null ? `${num(m.roas, 2)}×` : "brak"}`,
        `- Konwersja kliknięć: ${m.cvr !== null ? `${num(m.cvr, 1)}%` : "brak"}`,
        "",
        m.roas !== null && m.roas < 2
          ? "ROAS poniżej 2× — sprawdź kampanie z najwyższym CPA i jakość leadów."
          : m.leads && m.qualified / m.leads < 0.4
            ? "Mniej niż 40% leadów jest zakwalifikowanych — doprecyzuj grupę docelową i formularz."
            : "Wyniki wyglądają stabilnie. Porównaj kanały na Pulpicie i przesuń budżet do najtańszego leada.",
        "",
        "Dane pochodzą z importu i nie potwierdzają poprawności trackingu.",
      );
    }
  } else if (
    has(q, ["ryzyk", "zagroż", "problem", "zaległ", "opóźn", "uwag"])
  ) {
    lines.push("**Ryzyka w CRM**", "");
    if (overdue.length)
      lines.push(
        `- ${overdue.length} zaległych zadań, np. „${overdue[0].title}” (${firm(overdue[0].companyId)}).`,
      );
    if (late.length)
      lines.push(
        `- ${late.length} szans po terminie zamknięcia (${pln(late.reduce((s, d) => s + d.value, 0))}).`,
      );
    if (orphans.length)
      lines.push(
        `- ${orphans.length} otwartych szans bez zaplanowanego kroku.`,
      );
    if (lines.length === 2)
      lines.push("- Nie widzę ryzyk w zapisanych danych. 👍");
    proposeTasks(3);
  } else if (has(q, ["notat", "wiedz", "brain", "proces", "podsumowanie"])) {
    lines.push(
      ctx.notes.length
        ? `W Company Brain widzę ${ctx.notes.length} pasujących notatek: ${ctx.notes.map((n) => `„${n.title}”`).join(", ")}.`
        : "Company Brain nie zawiera jeszcze notatek. Wygeneruj wiedzę ze strony firmy albo zatwierdź poniższą notatkę.",
      "",
      "Proponuję notatkę ze stanem sprzedaży — zapisze się po zatwierdzeniu.",
    );
    actions.push({
      type: "create_note",
      title: `Stan sprzedaży ${today}`,
      category: "processes",
      content: [
        `# Stan sprzedaży ${today}`,
        "",
        `- Otwarte szanse: ${sales.length} (${pln(sales.reduce((s, d) => s + d.value, 0))})`,
        `- Prognoza ważona: ${pln(forecast)}`,
        `- Otwarte zadania: ${ctx.tasks.length}, zaległe: ${overdue.length}`,
        "",
        "## Najważniejsze szanse",
        ...[...sales]
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
          .map(
            (d) =>
              `- ${d.name} · ${firm(d.companyId)} · ${pln(d.value)} · ${d.stage}`,
          ),
      ].join("\n"),
    });
  } else if (
    has(q, [
      "dziś",
      "dzis",
      "dzisiaj",
      "plan",
      "zrobić",
      "zrobic",
      "priorytet",
      "tydzień",
      "tydzien",
    ])
  ) {
    lines.push(`**Plan na ${today}**`, "");
    const items = [
      ...overdue.map(
        (t) => `- 🔴 Zaległe: ${t.title} (${firm(t.companyId)}, ${t.date})`,
      ),
      ...dueToday.map((t) => `- 🟡 Dziś: ${t.title} (${firm(t.companyId)})`),
      ...soon.map(
        (d) => `- 💰 Domknij: ${d.name} · ${pln(d.value)} do ${d.closeDate}`,
      ),
    ];
    lines.push(
      ...(items.length
        ? items.slice(0, 10)
        : ["- Brak pilnych zadań. Dobry moment na prospecting."]),
    );
    if (orphans.length) {
      lines.push("", "Te szanse nie mają kolejnego kroku — proponuję zadania:");
      proposeTasks(3);
    }
  } else if (
    has(q, [
      "sprzeda",
      "szans",
      "pipeline",
      "lejek",
      "prognoz",
      "przychód",
      "przychod",
      "zlecen",
      "realizac",
    ])
  ) {
    const byStage = ["Nowa", "Rozmowa", "Oferta"].map((stage) => {
      const list = sales.filter((d) => d.stage === stage);
      return `- ${stage}: ${list.length} · ${pln(list.reduce((s, d) => s + d.value, 0))}`;
    });
    const won = ctx.deals.filter((d) => !d.service && d.stage === "Wygrana");
    const jobs = ctx.deals.filter((d) => d.service);
    lines.push(
      "**Lejek sprzedaży**",
      "",
      ...byStage,
      "",
      `Prognoza ważona: **${pln(forecast)}**. Wygrane: ${won.length} (${pln(won.reduce((s, d) => s + d.value, 0))}).`,
    );
    if (jobs.length)
      lines.push(
        `Zlecenia usługowe: ${jobs.length}, aktywne: ${jobs.filter((d) => ["booked", "in_progress"].includes(d.service!.status)).length}.`,
      );
    const top = [...sales].sort(
      (a, b) => b.value * b.probability - a.value * a.probability,
    )[0];
    if (top)
      lines.push(
        "",
        `Największy wpływ na wynik ma „${top.name}” (${firm(top.companyId)}): ${pln(top.value)} × ${top.probability}%. Następny krok: ${nextStep(top.stage).toLowerCase()}.`,
      );
    proposeTasks(2);
  } else {
    lines.push(
      "**Podsumowanie przestrzeni**",
      "",
      `- Firmy: ${ctx.companies.length}, otwarte szanse: ${sales.length} (${pln(sales.reduce((s, d) => s + d.value, 0))})`,
      `- Prognoza ważona: ${pln(forecast)}`,
      `- Otwarte zadania: ${ctx.tasks.length}, zaległe: ${overdue.length}`,
      ctx.marketing && ctx.marketing.spend
        ? `- Marketing 30 dni: ${pln(ctx.marketing.spend)} wydatków, ${num(ctx.marketing.leads)} leadów`
        : "- Marketing: brak importu z ostatnich 30 dni",
      "",
      "Mogę przygotować **plan na dziś**, przeanalizować **lejek**, **marketing**, **ryzyka** albo konkretną firmę — wpisz jej nazwę.",
    );
  }
  return JSON.stringify({
    answer: lines.join("\n").slice(0, 19000),
    actions: actions.slice(0, 5),
  });
}
