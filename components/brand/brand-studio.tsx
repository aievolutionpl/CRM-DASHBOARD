"use client";
import { useState, type ReactNode } from "react";
import { useCrm } from "@/stores/crm-store";
import { isSqlite } from "@/lib/growth/model";
import { localRequest } from "@/lib/local/client";
import { brandMarkdown, brandNoteTitle } from "@/lib/brand/markdown";
import {
  contrast,
  readablePrimary,
  scale,
  type BrandProfile,
} from "@/lib/brand/model";
import type { Section } from "@/lib/crm/model";
import { Icon } from "../crm/ui";
import { Panel } from "../insights/kit";
import { BrandLogo } from "./theme";
import { SCAN_STEPS, useBrandScan } from "./use-brand-scan";

const count = (v: number) =>
  new Intl.NumberFormat("pl-PL", {
    notation: v > 9999 ? "compact" : "standard",
  }).format(v);

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Ocena ${value.toFixed(1)} na 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span
            key={i}
            className="relative inline-block"
            style={{ width: size, height: size }}
          >
            <span className="absolute inset-0 text-slate-200">
              <StarShape size={size} />
            </span>
            <span
              className="absolute inset-0 overflow-hidden text-amber-400"
              style={{ width: `${fill * 100}%` }}
            >
              <StarShape size={size} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
function StarShape({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"
      />
    </svg>
  );
}

export function ScoreDial({
  score,
  label,
  size = 120,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const r = 42,
    c = 2 * Math.PI * r;
  const tone = score >= 80 ? "#10b981" : score >= 55 ? "#f59e0b" : "#f43f5e";
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
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
          stroke="#eef0f6"
          strokeWidth="9"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="text-center">
        <strong className="block text-[26px] leading-none font-bold text-slate-800 tabular-nums">
          {score}
        </strong>
        <span className="text-[10px] font-semibold tracking-[1.2px] text-slate-500 uppercase">
          {label}
        </span>
      </div>
    </div>
  );
}

function Chips({
  items,
  tone = "slate",
}: {
  items: string[];
  tone?: "slate" | "brand" | "green";
}) {
  if (!items.length)
    return <p className="text-sm text-slate-400">Nie wykryto.</p>;
  const cls =
    tone === "brand"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li
          key={i}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
        >
          {i}
        </li>
      ))}
    </ul>
  );
}

function ContactRow({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-start gap-3 py-2.5 text-sm">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1 pt-1.5 break-words text-slate-700">
        {children}
      </span>
    </li>
  );
}

export function ScanForm({
  notify,
  compact = false,
  disabled = false,
}: {
  notify: (text: string) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const brand = useCrm((s) => s.brand);
  const [website, setWebsite] = useState(brand?.website ?? "");
  const [github, setGithub] = useState(brand?.github ?? "");
  const { scan, busy, step, error } = useBrandScan(notify);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void scan(website, github);
      }}
    >
      <div
        className={`grid gap-3 ${compact ? "md:grid-cols-[1fr_1fr_auto]" : "md:grid-cols-2"}`}
      >
        <label className="grid gap-1.5 text-xs font-semibold text-inherit">
          Strona www firmy
          <span className="flex items-center gap-2 rounded-xl border border-current/15 bg-white/10 px-3 focus-within:border-current/40">
            <Icon name="globe" size={16} />
            <input
              className="min-h-0! w-full min-w-0 rounded-none! border-0! bg-transparent! px-0! py-2.5 text-sm text-inherit! shadow-none! focus:outline-none"
              placeholder="https://twoja-firma.pl"
              inputMode="url"
              autoComplete="url"
              value={website}
              maxLength={2048}
              onChange={(e) => setWebsite(e.target.value)}
              disabled={busy || disabled}
            />
          </span>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-inherit">
          GitHub (profil, organizacja lub repozytorium)
          <span className="flex items-center gap-2 rounded-xl border border-current/15 bg-white/10 px-3 focus-within:border-current/40">
            <Icon name="github" size={16} />
            <input
              className="min-h-0! w-full min-w-0 rounded-none! border-0! bg-transparent! px-0! py-2.5 text-sm text-inherit! shadow-none! focus:outline-none"
              placeholder="https://github.com/twoja-firma"
              inputMode="url"
              value={github}
              maxLength={300}
              onChange={(e) => setGithub(e.target.value)}
              disabled={busy || disabled}
            />
          </span>
        </label>
        {compact && (
          <button
            className="self-end rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
            disabled={busy || disabled || (!website.trim() && !github.trim())}
          >
            {busy ? "Skanuję…" : "Dopasuj dashboard"}
          </button>
        )}
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="crm-button"
            disabled={busy || disabled || (!website.trim() && !github.trim())}
          >
            <Icon name="spark" size={15} />
            {busy
              ? "Skanuję markę…"
              : brand
                ? "Skanuj ponownie i zaktualizuj"
                : "Skanuj i dopasuj dashboard"}
          </button>
          <span className="text-xs text-slate-500">
            Wystarczy jedno pole. Odczytujemy tylko publiczne dane.
          </span>
        </div>
      )}
      {busy && (
        <ol className="grid gap-1.5 text-xs" aria-live="polite">
          {SCAN_STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex items-center gap-2 ${i < step ? "opacity-70" : i === step ? "font-semibold" : "opacity-40"}`}
            >
              <span
                className={`grid size-4 place-items-center rounded-full ${i < step ? "bg-emerald-500 text-white" : i === step ? "animate-pulse bg-current/30" : "bg-current/10"}`}
              >
                {i < step && <Icon name="check" size={10} />}
              </span>
              {label}
            </li>
          ))}
        </ol>
      )}
      {error && !busy && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {error}
        </p>
      )}
    </form>
  );
}

export default function BrandStudio({
  notify,
  navigate,
  readOnly,
  workspace,
}: {
  notify: (text: string) => void;
  navigate: (section: Section) => void;
  readOnly: boolean;
  workspace?: string;
}) {
  const brand = useCrm((s) => s.brand);
  const setBrand = useCrm((s) => s.setBrand);
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<BrandProfile>) =>
    brand && !readOnly && setBrand({ ...brand, ...patch });
  async function toBrain() {
    if (!brand || !workspace) return;
    setSaving(true);
    try {
      const title = brandNoteTitle(brand);
      const content = brandMarkdown(brand);
      const { documents } = (await localRequest(workspace, "brain")) as {
        documents: {
          id: string;
          title: string;
          category: string;
          revision: number;
        }[];
      };
      const existing = documents.find(
        (d) => d.title === title && d.category === "company",
      );
      await localRequest(workspace, "brain", {
        method: "POST",
        body: JSON.stringify({
          id: existing?.id,
          title,
          category: "company",
          content,
          revision: existing?.revision ?? 0,
        }),
      });
      notify(
        existing
          ? "Zaktualizowano notatkę profilu marki w Company Brain."
          : "Profil marki zapisany w Company Brain — agent AI będzie go znał.",
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Nie udało się zapisać notatki.");
    } finally {
      setSaving(false);
    }
  }
  const shades = brand ? scale(readablePrimary(brand.colors.primary)) : null;
  const gh = brand?.githubData;
  const failed = brand?.audit.checks.filter((c) => !c.ok) ?? [];
  const passed = brand?.audit.checks.filter((c) => c.ok) ?? [];
  return (
    <div className="grid min-w-0 gap-5">
      <section className="crm-command-hero relative overflow-hidden rounded-[26px] p-6 text-white shadow-[0_24px_60px_-28px_var(--brand-800)] sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo brand={brand} size={64} fallback="Twoja firma" />
            <div className="min-w-0">
              <span className="text-[11px] font-bold tracking-[1.8px] text-white/70 uppercase">
                Brand Studio · profil firmy
              </span>
              <h2 className="mt-1 truncate text-[26px]! leading-tight font-bold text-white! sm:text-[30px]!">
                {brand?.name || "Dopasuj Growth OS do swojej firmy"}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm text-white/75">
                {brand?.tagline ||
                  brand?.description ||
                  "Wklej adres strony www i/lub link GitHub. Pobierzemy logo, kolory, czcionki, kontakt, opinie, audyt strony i statystyki GitHub — a cały dashboard przyjmie identyfikację Twojej marki."}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur-md [&_.crm-button]:bg-white! [&_.crm-button]:bg-none! [&_.crm-button]:text-violet-700! [&_.text-slate-500]:text-white/70!">
            <ScanForm notify={notify} disabled={readOnly} />
          </div>
        </div>
      </section>
      {!brand && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "palette",
              "Branding w 1 klik",
              "Logo, paleta kolorów i czcionka marki trafiają do menu, wykresów, przycisków i nagłówka pulpitu.",
            ],
            [
              "star",
              "Opinie i reputacja",
              "Ocena i recenzje z danych schema.org na stronie oraz z Google (z kluczem Places API).",
            ],
            [
              "shield",
              "Audyt strony i GitHub",
              "17 kontroli SEO i konwersji, wykryta analityka, technologie oraz aktywność repozytoriów.",
            ],
          ].map(([icon, title, text]) => (
            <div key={title} className="crm-card flex gap-3 p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                <Icon name={icon} size={18} />
              </span>
              <div>
                <strong className="block text-sm text-slate-800">
                  {title}
                </strong>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {brand && (
        <>
          <div className="crm-card flex flex-wrap items-center gap-3 p-4">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${brand.applied ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
            >
              <span
                className={`size-2 rounded-full ${brand.applied ? "bg-emerald-500" : "bg-slate-400"}`}
              />
              {brand.applied
                ? "Branding aktywny w całym dashboardzie"
                : "Domyślny wygląd Growth OS"}
            </span>
            <span className="text-xs text-slate-500">
              Skan:{" "}
              {brand.scannedAt
                ? new Date(brand.scannedAt).toLocaleString("pl-PL")
                : "—"}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                className="crm-button secondary"
                disabled={readOnly}
                onClick={() => update({ applied: !brand.applied })}
              >
                {brand.applied
                  ? "Przywróć domyślny wygląd"
                  : "Zastosuj branding"}
              </button>
              {isSqlite() && workspace && (
                <button
                  className="crm-button secondary"
                  disabled={saving}
                  onClick={() => void toBrain()}
                >
                  <Icon name="file" size={15} />{" "}
                  {saving ? "Zapisywanie…" : "Zapisz w Company Brain"}
                </button>
              )}
              <button className="crm-button" onClick={() => navigate("ai")}>
                <Icon name="spark" size={15} /> Zapytaj agenta o markę
              </button>
              <button
                className="crm-button secondary"
                disabled={readOnly}
                onClick={() => {
                  if (
                    confirm(
                      "Usunąć profil marki? Dashboard wróci do domyślnego wyglądu.",
                    )
                  ) {
                    setBrand(undefined);
                    notify("Profil marki usunięty.");
                  }
                }}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          </div>
          {brand.warnings.length > 0 && (
            <ul className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
              {brand.warnings.map((w) => (
                <li key={w} className="flex gap-2">
                  <span aria-hidden>•</span>
                  {w}
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <Panel eyebrow="IDENTYFIKACJA" title="Nazwa, opis i wygląd">
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="crm-field">
                    <span>Nazwa firmy</span>
                    <input
                      value={brand.name}
                      maxLength={120}
                      disabled={readOnly}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </label>
                  <label className="crm-field">
                    <span>Hasło / slogan</span>
                    <input
                      value={brand.tagline}
                      maxLength={240}
                      disabled={readOnly}
                      onChange={(e) => update({ tagline: e.target.value })}
                    />
                  </label>
                </div>
                <label className="crm-field">
                  <span>Opis firmy</span>
                  <textarea
                    rows={3}
                    value={brand.description}
                    maxLength={1200}
                    disabled={readOnly}
                    onChange={(e) => update({ description: e.target.value })}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["primary", "accent"] as const).map((key) => (
                    <div key={key} className="grid gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        {key === "primary" ? "Kolor główny" : "Kolor akcentu"}
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          aria-label={
                            key === "primary" ? "Kolor główny" : "Kolor akcentu"
                          }
                          className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                          value={brand.colors[key]}
                          disabled={readOnly}
                          onChange={(e) =>
                            update({
                              colors: {
                                ...brand.colors,
                                [key]: e.target.value,
                              },
                            })
                          }
                        />
                        <code className="text-xs text-slate-600">
                          {brand.colors[key]}
                        </code>
                        {key === "primary" &&
                          contrast(brand.colors.primary, "#ffffff") < 4.5 && (
                            <span className="text-[11px] text-amber-700">
                              przyciemniony dla czytelności
                            </span>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
                {brand.colors.palette.length > 0 && (
                  <div className="grid gap-2">
                    <span className="text-xs font-semibold text-slate-600">
                      Kolory wykryte na stronie — kliknij, aby ustawić jako
                      główny
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {brand.colors.palette.map((c) => (
                        <button
                          key={c}
                          type="button"
                          disabled={readOnly}
                          aria-label={`Ustaw ${c} jako kolor główny`}
                          aria-pressed={brand.colors.primary === c}
                          onClick={() =>
                            update({ colors: { ...brand.colors, primary: c } })
                          }
                          onContextMenu={(e) => {
                            e.preventDefault();
                            update({ colors: { ...brand.colors, accent: c } });
                          }}
                          className="size-9 rounded-xl border-2 border-white shadow-[0_0_0_1px_#e2e8f0] transition hover:scale-110 aria-pressed:shadow-[0_0_0_2px_var(--primary)]"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {shades && (
                  <div
                    className="flex overflow-hidden rounded-xl"
                    aria-label="Skala kolorów marki"
                  >
                    {Object.entries(shades).map(([k, v]) => (
                      <span
                        key={k}
                        className="h-8 flex-1"
                        style={{ background: v }}
                        title={`${k}: ${v}`}
                      />
                    ))}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="crm-field">
                    <span>Czcionka nagłówków</span>
                    <select
                      value={brand.headingFont}
                      disabled={readOnly}
                      onChange={(e) => update({ headingFont: e.target.value })}
                    >
                      <option value="">Domyślna (Inter)</option>
                      {[
                        ...new Set([
                          ...brand.fonts,
                          "Inter",
                          "Poppins",
                          "Montserrat",
                          "Manrope",
                          "Playfair Display",
                          "DM Sans",
                        ]),
                      ].map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 pb-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={brand.useFont}
                      disabled={readOnly || !brand.headingFont}
                      onChange={(e) => update({ useFont: e.target.checked })}
                    />
                    Użyj w nagłówkach
                  </label>
                </div>
              </div>
            </Panel>
            <Panel eyebrow="KONTAKT" title="Dane firmy i kanały">
              <ul className="divide-y divide-slate-100">
                {brand.website && (
                  <ContactRow icon="globe">
                    <a
                      className="font-semibold text-violet-700 hover:underline"
                      href={brand.website}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {brand.website
                        .replace(/^https?:\/\//, "")
                        .replace(/\/$/, "")}
                    </a>
                  </ContactRow>
                )}
                <ContactRow icon="mail">
                  {brand.contact.emails.join(", ") || (
                    <span className="text-slate-400">
                      Brak e-maila na stronie
                    </span>
                  )}
                </ContactRow>
                <ContactRow icon="phone">
                  {brand.contact.phones.join(", ") || (
                    <span className="text-slate-400">
                      Brak telefonu na stronie
                    </span>
                  )}
                </ContactRow>
                <ContactRow icon="pin">
                  {brand.contact.address || brand.contact.city || (
                    <span className="text-slate-400">
                      Brak adresu w danych strukturalnych
                    </span>
                  )}
                </ContactRow>
                {brand.contact.nip && (
                  <ContactRow icon="file">NIP {brand.contact.nip}</ContactRow>
                )}
              </ul>
              {brand.socials.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {brand.socials.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
                    >
                      <Icon
                        name={s.network === "GitHub" ? "github" : "link"}
                        size={13}
                      />
                      {s.network}
                    </a>
                  ))}
                </div>
              )}
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              eyebrow="OPINIE"
              title="Reputacja klientów"
              action={
                brand.rating?.url ? (
                  <a
                    className="crm-text-button"
                    href={brand.rating.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Źródło <Icon name="arrow" size={14} />
                  </a>
                ) : undefined
              }
            >
              {brand.rating ? (
                <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl bg-amber-50/60 p-4">
                  <strong className="text-4xl font-bold text-slate-800 tabular-nums">
                    {brand.rating.value.toFixed(1)}
                  </strong>
                  <div>
                    <Stars value={brand.rating.value} size={18} />
                    <p className="mt-1 text-xs text-slate-500">
                      {count(brand.rating.count)} opinii · {brand.rating.source}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Nie znaleziono oceny. Dodaj dane AggregateRating na stronie
                  lub ustaw <code>GOOGLE_PLACES_API_KEY</code>, aby pobrać
                  opinie z Map Google.
                </p>
              )}
              {brand.reviews.length > 0 ? (
                <ul className="grid gap-3">
                  {brand.reviews.slice(0, 4).map((r, i) => (
                    <li
                      key={`${r.author}-${i}`}
                      className="rounded-2xl border border-slate-100 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-slate-800">
                          {r.author}
                        </strong>
                        {r.rating !== null && (
                          <Stars value={r.rating} size={13} />
                        )}
                      </div>
                      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-600">
                        {r.text}
                      </p>
                      <span className="mt-2 block text-[11px] text-slate-400">
                        {r.source}
                        {r.date ? ` · ${r.date}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  Brak treści recenzji w źródłach.
                </p>
              )}
            </Panel>
            <Panel eyebrow="AUDYT STRONY" title="Kondycja strony www">
              {brand.audit.checks.length ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-5">
                    <ScoreDial score={brand.audit.score} label="wynik" />
                    <div className="grid gap-1 text-sm">
                      <span className="text-emerald-700">
                        ✓ {passed.length} elementów poprawnych
                      </span>
                      <span className="text-rose-700">
                        ✕ {failed.length} do poprawy
                      </span>
                      {brand.audit.responseMs !== null && (
                        <span className="text-xs text-slate-500">
                          Odpowiedź serwera:{" "}
                          {(brand.audit.responseMs / 1000).toFixed(2)} s
                        </span>
                      )}
                    </div>
                  </div>
                  <ul className="grid max-h-80 gap-1.5 overflow-y-auto pr-1">
                    {[...failed, ...passed].map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start gap-2.5 rounded-xl px-2 py-1.5 text-sm hover:bg-slate-50"
                      >
                        <span
                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white ${c.ok ? "bg-emerald-500" : "bg-rose-500"}`}
                        >
                          <Icon name={c.ok ? "check" : "close"} size={11} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-slate-700">
                            {c.label}
                          </span>
                          {!c.ok && (
                            <span className="block text-xs text-slate-500">
                              {c.hint}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Podaj adres strony www, aby zobaczyć audyt.
                </p>
              )}
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel eyebrow="OFERTA" title="Usługi i komunikaty ze strony">
              <Chips items={brand.services} tone="brand" />
              <h4 className="mt-5 mb-2 text-xs font-semibold text-slate-500">
                Słowa kluczowe i menu
              </h4>
              <Chips items={brand.keywords} />
            </Panel>
            <Panel
              eyebrow="MARKETING"
              title="Pomiar i technologia"
              action={
                <button
                  className="crm-text-button"
                  onClick={() => navigate("connectors")}
                >
                  Konektory <Icon name="arrow" size={14} />
                </button>
              }
            >
              <h4 className="mb-2 text-xs font-semibold text-slate-500">
                Analityka i piksele
              </h4>
              <Chips items={brand.trackers} tone="green" />
              <h4 className="mt-5 mb-2 text-xs font-semibold text-slate-500">
                Platforma strony
              </h4>
              <Chips items={brand.technologies} />
              <ul className="mt-5 grid gap-2 text-xs text-slate-600">
                {brand.trackers.includes("Google Analytics 4") && (
                  <li>
                    → Strona ma GA4 — podłącz go w Konektorach, aby widzieć ruch
                    na pulpicie.
                  </li>
                )}
                {!brand.trackers.some((t) =>
                  /Analytics|Tag Manager|PostHog|Plausible|Matomo/.test(t),
                ) &&
                  brand.audit.checks.length > 0 && (
                    <li>
                      → Brak analityki — bez niej nie zmierzysz skuteczności
                      kampanii.
                    </li>
                  )}
                {brand.technologies.includes("WordPress") && (
                  <li>
                    → WordPress: zaimportuj treści strony do Company Brain w
                    Konektorach.
                  </li>
                )}
              </ul>
            </Panel>
            <Panel
              eyebrow="GITHUB"
              title={gh ? gh.name : "Aktywność open source"}
              action={
                gh ? (
                  <a
                    className="crm-text-button"
                    href={gh.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Profil <Icon name="arrow" size={14} />
                  </a>
                ) : undefined
              }
            >
              {gh ? (
                <>
                  <dl className="grid grid-cols-2 gap-2">
                    {[
                      ["Gwiazdki", gh.stars],
                      ["Forki", gh.forks],
                      ["Repozytoria", gh.publicRepos],
                      ["Obserwujący", gh.followers],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-3">
                        <dt className="text-[11px] text-slate-500">{label}</dt>
                        <dd className="text-lg font-bold text-slate-800 tabular-nums">
                          {count(Number(value))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {gh.languages.length > 0 && (
                    <>
                      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
                        {gh.languages.map((l, i) => (
                          <span
                            key={l.name}
                            style={{
                              width: `${l.share}%`,
                              background: `var(--brand-${[500, 300, 700, 200, 900, 400][i]})`,
                            }}
                          />
                        ))}
                      </div>
                      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        {gh.languages.map((l, i) => (
                          <li key={l.name} className="flex items-center gap-1">
                            <i
                              className="size-2 rounded-full"
                              style={{
                                background: `var(--brand-${[500, 300, 700, 200, 900, 400][i]})`,
                              }}
                            />
                            {l.name} {l.share}%
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <ul className="mt-4 grid gap-2">
                    {gh.repos.slice(0, 4).map((r) => (
                      <li key={r.url}>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block rounded-xl border border-slate-100 p-3 transition hover:border-violet-200"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <strong className="truncate text-sm text-slate-800">
                              {r.name}
                            </strong>
                            <span className="shrink-0 text-xs text-slate-500">
                              ★ {count(r.stars)}
                            </span>
                          </span>
                          {r.description && (
                            <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500">
                              {r.description}
                            </span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {gh.lastPush && (
                    <p className="mt-3 text-[11px] text-slate-400">
                      Ostatnia aktywność: {gh.lastPush}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Dodaj link GitHub, aby zobaczyć repozytoria, języki i
                  aktywność zespołu.
                </p>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
