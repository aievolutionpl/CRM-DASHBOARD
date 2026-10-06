"use client";
import { useState } from "react";
import type { PaymentsReport } from "@/lib/integrations/model";

export type ConnectorCategory =
  | "all"
  | "ai"
  | "analytics"
  | "marketing"
  | "sales"
  | "communication";

export const CATEGORIES: { id: ConnectorCategory; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "ai", label: "AI i wiedza" },
  { id: "analytics", label: "Analityka" },
  { id: "marketing", label: "Marketing" },
  { id: "sales", label: "Sprzedaż i płatności" },
  { id: "communication", label: "Komunikacja" },
];

type Brand = {
  name: string;
  mono: string;
  gradient: string;
  category: Exclude<ConnectorCategory, "all">;
  keywords: string;
};

export const BRANDS: Record<string, Brand> = {
  ai: {
    name: "Evolution AI",
    mono: "AI",
    gradient: "from-violet-500 to-indigo-600",
    category: "ai",
    keywords: "openrouter claude codex chatgpt agent model",
  },
  website: {
    name: "Strona firmy",
    mono: "WWW",
    gradient: "from-slate-600 to-slate-800",
    category: "ai",
    keywords: "company brain generator html",
  },
  wordpress: {
    name: "WordPress",
    mono: "WP",
    gradient: "from-sky-600 to-blue-800",
    category: "ai",
    keywords: "elementor strony cms",
  },
  posthog: {
    name: "PostHog",
    mono: "PH",
    gradient: "from-amber-400 to-orange-600",
    category: "analytics",
    keywords: "zdarzenia product analytics",
  },
  ga4: {
    name: "Google Analytics 4",
    mono: "GA",
    gradient: "from-amber-500 to-orange-500",
    category: "analytics",
    keywords: "google sesje ruch",
  },
  search_console: {
    name: "Google Search Console",
    mono: "SC",
    gradient: "from-blue-500 to-emerald-500",
    category: "analytics",
    keywords: "google seo zapytania",
  },
  google_ads: {
    name: "Google Ads API",
    mono: "Ads",
    gradient: "from-emerald-500 to-blue-600",
    category: "marketing",
    keywords: "google reklamy kampanie oauth api roas mcc",
  },
  stripe: {
    name: "Stripe",
    mono: "S",
    gradient: "from-indigo-500 to-violet-600",
    category: "sales",
    keywords: "płatności payments przychód",
  },
  ads: {
    name: "Google Ads / Microsoft Ads",
    mono: "Ads",
    gradient: "from-emerald-500 to-blue-600",
    category: "marketing",
    keywords: "kampanie csv import ppc bing",
  },
  resend: {
    name: "Resend",
    mono: "@",
    gradient: "from-zinc-700 to-black",
    category: "communication",
    keywords: "poczta email mail",
  },
  meta_ads: {
    name: "Meta Ads",
    mono: "M",
    gradient: "from-blue-500 to-indigo-700",
    category: "marketing",
    keywords: "facebook instagram reklamy",
  },
  plausible: {
    name: "Plausible Analytics",
    mono: "P",
    gradient: "from-indigo-400 to-indigo-700",
    category: "analytics",
    keywords: "statystyki ruch odwiedzający rodo cookieless",
  },
  hubspot: {
    name: "HubSpot",
    mono: "HS",
    gradient: "from-orange-400 to-rose-500",
    category: "sales",
    keywords: "crm import kontakty",
  },
  slack: {
    name: "Slack",
    mono: "SL",
    gradient: "from-fuchsia-500 to-purple-700",
    category: "communication",
    keywords: "powiadomienia kanał",
  },
  calendly: {
    name: "Calendly",
    mono: "CA",
    gradient: "from-sky-400 to-blue-600",
    category: "sales",
    keywords: "kalendarz spotkania rezerwacje",
  },
  gbp: {
    name: "Profil Firmy w Google",
    mono: "GBP",
    gradient: "from-blue-500 to-sky-400",
    category: "marketing",
    keywords: "google maps opinie",
  },
};

export const PLANNED: {
  id: string;
  name: string;
  description: string;
  workaround: string;
}[] = [
  {
    id: "hubspot",
    name: "HubSpot",
    description:
      "Jednorazowa migracja firm, kontaktów i szans z HubSpot do Evolution Growth OS.",
    workaround: "eksport CSV z HubSpot i import firm w module Firmy.",
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Codzienny skrót od agenta AI: zaległe zadania, ryzyka i nowe leady na kanale zespołu.",
    workaround: "Centrum dowodzenia na Pulpicie pokazuje te same rekomendacje.",
  },
  {
    id: "calendly",
    name: "Calendly",
    description:
      "Umówione spotkania jako zdarzenia w Lead Hub i zadania w CRM.",
    workaround: "dodaj spotkanie jako zdarzenie w karcie leada.",
  },
  {
    id: "gbp",
    name: "Profil Firmy w Google",
    description:
      "Wyświetlenia, połączenia, trasy i nowe opinie z profilu firmy.",
    workaround: "import CSV ze źródłem gbp.",
  },
];

export function ConnectorLogo({ id }: { id: string }) {
  const brand = BRANDS[id];
  return (
    <span
      aria-hidden
      className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${brand?.gradient ?? "from-slate-400 to-slate-600"} text-[13px] font-extrabold tracking-tight text-white shadow-[0_8px_18px_-10px_rgba(40,30,90,.6),inset_0_1px_0_rgba(255,255,255,.35)]`}
    >
      {brand?.mono ?? "?"}
    </span>
  );
}

export function PaymentsView({ report }: { report: PaymentsReport }) {
  const [hover, setHover] = useState<number | null>(null);
  const money = (v: number) =>
    new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: report.currency,
      maximumFractionDigits: 0,
    }).format(v);
  const max = Math.max(1, ...report.daily.map((d) => d.amount));
  const point = hover !== null ? report.daily[hover] : null;
  return (
    <section className="crm-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ConnectorLogo id="stripe" />
          <div>
            <span className="crm-eyebrow">
              STRIPE · {report.from} → {report.to}
            </span>
            <h3 className="text-lg!">Płatności z ostatnich 30 dni</h3>
          </div>
        </div>
        {report.truncated && (
          <span className="text-xs text-amber-700">
            Odczytano pierwsze 100 transakcji
          </span>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Przychód netto", money(report.net)],
          ["Udane płatności", String(report.count)],
          ["Średnia płatność", money(report.average)],
          ["Saldo dostępne", money(report.available)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-100 bg-white/70 p-4"
          >
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 text-xl font-bold text-slate-800 tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5">
        <p className="mb-2 text-xs text-slate-500" aria-live="polite">
          {point
            ? `${point.date}: ${money(point.amount)}`
            : `Zwroty: ${money(report.refunded)} · nieudane: ${report.failed} · oczekujące saldo: ${money(report.pending)}`}
        </p>
        <div
          className="flex h-28 items-end gap-[3px]"
          onMouseLeave={() => setHover(null)}
        >
          {report.daily.map((d, i) => (
            <button
              key={d.date}
              type="button"
              aria-label={`${d.date}: ${money(d.amount)}`}
              className="flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
            >
              <span
                className={`block w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-violet-400 transition-opacity ${hover === i ? "opacity-100" : "opacity-75"}`}
                style={{
                  height: `${Math.max(d.amount ? 4 : 2, (d.amount / max) * 100)}%`,
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
