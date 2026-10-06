"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { localRequest } from "@/lib/local/client";
import { downloadFile } from "@/lib/crm/backup";
import { today as currentDate } from "@/lib/crm/model";
import GoogleAccount from "../integrations/google-account";
import GoogleSetup from "../integrations/google-setup";
import { GoogleReportView } from "../integrations/google-reports";
import {
  providerLabels,
  type Provider,
  type Resource,
  type GoogleReport,
  type PaymentsReport,
  type ResourceProvider,
  RESOURCE_PROVIDERS,
} from "@/lib/integrations/model";
import { Badge } from "../crm/ui";
import {
  BRANDS,
  CATEGORIES,
  ConnectorLogo,
  PaymentsView,
  PLANNED,
  type ConnectorCategory,
} from "./connector-catalog";
type Status = {
  provider: string;
  status: string;
  last_sync?: string;
  error?: string;
};
type Config = {
  provider: Provider;
  configured: boolean;
  required: string[];
  authConfigured?: boolean;
  resource?: Resource;
};
export default function Connectors({
  wid,
  mailSettings,
  openAi,
  openBrain,
}: {
  wid: string;
  mailSettings: () => void;
  openAi: () => void;
  openBrain: () => void;
}) {
  const [states, setStates] = useState<Status[]>([]),
    [configs, setConfigs] = useState<Config[]>([]),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [events, setEvents] = useState<unknown[][]>([]),
    [payments, setPayments] = useState<PaymentsReport | null>(null),
    [category, setCategory] = useState<ConnectorCategory>("all"),
    [search, setSearch] = useState(""),
    [reports, setReports] = useState<
      { report: GoogleReport; stale: boolean }[]
    >([]);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(
    () =>
      localRequest(wid, "integrations")
        .then((r) => {
          setStates(r.states);
          setConfigs(r.providers);
          const posthog = r.snapshots?.find(
            (s: { provider: string }) => s.provider === "posthog",
          );
          setEvents(
            r.states.some(
              (s: Status) =>
                s.provider === "posthog" && s.status === "disconnected",
            )
              ? []
              : posthog?.payload.events || [],
          );
          const stripe = r.snapshots?.find(
            (s: { provider: string }) => s.provider === "stripe",
          );
          setPayments(
            r.states.some(
              (s: Status) =>
                s.provider === "stripe" && s.status === "disconnected",
            )
              ? null
              : stripe?.payload.payments || null,
          );
          setReports(
            (r.snapshots || [])
              .filter(
                (s: { provider: string; payload: { report?: GoogleReport } }) =>
                  s.payload.report &&
                  !r.states.some(
                    (x: Status) =>
                      x.provider === s.provider && x.status === "disconnected",
                  ),
              )
              .map(
                (s: {
                  provider: string;
                  payload: { report: GoogleReport };
                }) => ({
                  report: s.payload.report,
                  stale: r.states.some(
                    (x: Status) =>
                      x.provider === s.provider && x.status === "error",
                  ),
                }),
              ),
          );
        })
        .catch((e) => setError(e.message)),
    [wid],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function action(
    provider: string,
    operation: string,
    resource?: Resource,
  ) {
    setBusy(provider);
    setError("");
    setMessage("");
    try {
      const r = await localRequest(wid, "integrations", {
        method: "POST",
        body: JSON.stringify({ provider, action: operation, resource }),
      });
      setMessage(r.summary || r.message);
      if (r.events) setEvents(r.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd połączenia.");
    } finally {
      setBusy("");
      await load();
    }
  }
  async function importCsv(file?: File) {
    if (!file) return;
    setBusy("csv");
    setError("");
    try {
      if (file.size > 2_000_000) throw Error("CSV może mieć do 2 MB.");
      const result = await localRequest(wid, "marketing", {
        method: "POST",
        body: JSON.stringify({ csv: await file.text() }),
      });
      setMessage(
        `Zapisano ${result.count} wierszy. Pulpit pokaże przeliczone wyniki; ponowny import aktualizuje te same kampanie i daty.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd importu.");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }
  const show = (id: string) => {
    const brand = BRANDS[id];
    if (!brand) return false;
    if (category !== "all" && brand.category !== category) return false;
    const q = search.trim().toLowerCase();
    return !q || `${brand.name} ${brand.keywords}`.toLowerCase().includes(q);
  };
  const visible = [
    "ai",
    "website",
    "ads",
    "resend",
    ...configs.map((c) => c.provider),
    ...PLANNED.map((p) => p.id),
  ].some(show);
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <section className="relative overflow-hidden rounded-[26px] bg-[radial-gradient(120%_140%_at_0%_100%,#5b3bff_0%,#2f1d93_45%,#160f38_100%)] p-6 text-white shadow-[0_24px_60px_-28px_#3a22b8] sm:p-8">
        <div className="pointer-events-none absolute -top-24 right-0 size-80 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <span className="text-[11px] font-bold tracking-[1.8px] text-violet-200">
              KONEKTORY · ODCZYT I IMPORT
            </span>
            <h2 className="mt-2 text-[28px]! font-bold text-white!">
              Twoje źródła danych, w jednym miejscu.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-violet-100/90">
              Tokeny Google są szyfrowane osobno dla firmy. Pozostałe sekrety
              zostają na serwerze w .env.local. Konfiguracja dotyczy tej
              instalacji, a importy są oddzielne dla każdej przestrzeni.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {[
              [
                "Połączone",
                configs.filter(
                  (c) =>
                    c.configured &&
                    states.some(
                      (s) =>
                        s.provider === c.provider && s.status === "checked",
                    ),
                ).length,
              ],
              ["Gotowe", configs.filter((c) => c.configured).length],
              ["W katalogu", configs.length + 3 + PLANNED.length],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"
              >
                <dt className="text-[11px] text-violet-200">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="sr-only">
          {
            configs.filter(
              (c) =>
                c.configured &&
                states.some(
                  (s) => s.provider === c.provider && s.status === "checked",
                ),
            ).length
          }{" "}
          sprawdzonych odczytów API
        </p>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white/70 p-1 shadow-sm"
          role="tablist"
          aria-label="Kategorie konektorów"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${category === c.id ? "bg-violet-600 text-white shadow" : "text-slate-600 hover:bg-violet-50"}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="crm-search w-full sm:w-auto sm:min-w-[220px]">
          <input
            aria-label="Szukaj konektora"
            placeholder="Szukaj konektora…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="crm-alert error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="crm-alert">
          {message}
        </p>
      )}
      <GoogleAccount wid={wid} changed={load} />
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {show("ai") && (
          <article className="crm-card crm-connector grid content-start gap-4 border-violet-200! p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ConnectorLogo id="ai" />
                <h3 className="text-lg!">Twoje AI · Twój model</h3>
              </div>
              <Badge tone="green">Wbudowany agent + OpenRouter / CLI</Badge>
            </div>
            <p className="crm-muted">
              Wbudowany Evolution Agent działa od razu, bez klucza. Dla
              generatywnych odpowiedzi podłącz OpenRouter API albo lokalne CLI
              Codex / Claude Code i zatwierdzaj propozycje agenta.
            </p>
            <button className="crm-button justify-self-start" onClick={openAi}>
              Otwórz połączenie AI
            </button>
          </article>
        )}
        {show("website") && (
          <article className="crm-card crm-connector grid content-start gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ConnectorLogo id="website" />
                <h3 className="text-lg!">Strona firmy → Company Brain</h3>
              </div>
              <Badge tone="purple">Publiczny HTML</Badge>
            </div>
            <p className="crm-muted">
              Podaj adres HTTPS. Generator z wybranym modelem przygotuje
              kontekst firmy, ofertę, markę i propozycje marketingowe ze
              źródłami. Sprawdzony szkic zapiszesz i pobierzesz do Obsidiana.
            </p>
            <button
              className="crm-button secondary justify-self-start"
              onClick={openBrain}
            >
              Otwórz wiedzę firmy
            </button>
          </article>
        )}
        {configs
          .filter((c) => show(c.provider))
          .map((c) => {
            const s = states.find((s) => s.provider === c.provider),
              label = providerLabels[c.provider],
              checked = c.configured && s?.status === "checked",
              disconnected = s?.status === "disconnected";
            return (
              <article
                key={c.provider}
                className="crm-card crm-connector grid content-start gap-4 p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ConnectorLogo id={c.provider} />
                    <h3 className="text-lg!">{label}</h3>
                  </div>
                  <Badge
                    tone={
                      checked ? "green" : s?.status === "error" ? "red" : "gray"
                    }
                  >
                    {checked
                      ? "Odczyt API sprawdzony"
                      : !c.configured
                        ? "Wymaga konfiguracji"
                        : disconnected
                          ? "Wyłączony"
                          : s?.status === "error"
                            ? "Błąd"
                            : c.configured
                              ? "Gotowy do sprawdzenia"
                              : "Wymaga konfiguracji"}
                  </Badge>
                </div>
                <p className="crm-muted">
                  {c.provider === "wordpress"
                    ? "Odczyt opublikowanych stron i import treści do Company Brain. Bez publikacji lub zmian w WordPressie."
                    : c.provider === "posthog"
                      ? "Odczyt liczby zdarzeń z ostatnich 30 dni z PostHog Cloud EU/US. Bez tworzenia własnego session replay."
                      : c.provider === "stripe"
                        ? "Płatności, zwroty i saldo z ostatnich 30 dni. Klucz ograniczony tylko do odczytu; bez tworzenia płatności i zmian w koncie."
                        : c.provider === "meta_ads"
                          ? "Wydatki, wyświetlenia, kliknięcia, leady i wartość zakupów z kampanii Facebook i Instagram (30 dni). Wyniki trafiają do Pulpitu obok Google Ads."
                          : c.provider === "plausible"
                            ? "Odwiedzający, wizyty, odsłony, współczynnik odrzuceń i źródła ruchu z Plausible (30 dni). Analityka bez cookies, zgodna z RODO."
                            : c.provider === "ga4"
                              ? "Sesje, użytkownicy, odsłony, kluczowe zdarzenia i przychód z usługi GA4. Zapisany raport pokaże się też na Pulpicie."
                              : c.provider === "google_ads"
                                ? "Bezpośredni odczyt kosztów, kliknięć, konwersji i ROAS przez Google Ads API. Bez zmian reklam i bez sumowania z CSV."
                                : "Kliknięcia, wyświetlenia, CTR, średnia pozycja oraz zapytania z wyszukiwarki Google. Zapisany raport pokaże się też na Pulpicie."}
                </p>
                <details>
                  <summary className="cursor-pointer text-sm text-violet-700">
                    Jak podłączyć?
                  </summary>
                  <ul className="mt-3 grid gap-2 text-sm">
                    {c.required.map((k) => (
                      <li key={k}>
                        <code>{k}</code>
                      </li>
                    ))}
                  </ul>
                  {(c.provider === "ga4" ||
                    c.provider === "search_console" ||
                    c.provider === "google_ads") && (
                    <p className="crm-muted mt-3">
                      Połącz konto w panelu Google powyżej i włącz odpowiednie
                      API w Google Cloud. GA4 wymaga Data API i Admin API do
                      listy usług; Search Console wymaga Search Console API. Ads
                      wymaga tokenu deweloperskiego i zgody adwords. Dla GA4/GSC
                      działa też konto usługi. Szczegóły tutaj.{" "}
                      <a
                        className="text-violet-700 underline"
                        href="https://github.com/aievolutionpl/CRM-DASHBOARD/blob/main/docs/GOOGLE-INTEGRATIONS.md"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Pełna instrukcja Google
                      </a>
                    </p>
                  )}
                  <p className="crm-muted mt-3">
                    Uzupełnij .env.local i zrestartuj serwer. Nie wklejaj kluczy
                    do notatek ani CSV.
                  </p>
                </details>
                {RESOURCE_PROVIDERS.includes(
                  c.provider as ResourceProvider,
                ) && (
                  <>
                    <p className="crm-muted">
                      {c.provider === "meta_ads" || c.provider === "plausible"
                        ? c.authConfigured
                          ? "Klucz API jest skonfigurowany; dostęp potwierdzi dopiero odczyt."
                          : "Najpierw dodaj klucz w .env.local i zrestartuj serwer."
                        : c.authConfigured
                          ? "Uwierzytelnienie Google jest skonfigurowane; dostęp potwierdzi dopiero odczyt API."
                          : "Połącz Google w panelu powyżej lub skonfiguruj dostęp w .env.local. Dla Ads dodaj token deweloperski."}
                    </p>
                    <GoogleSetup
                      wid={wid}
                      key={`${wid}:${c.provider}:${JSON.stringify(c.resource)}`}
                      provider={c.provider as ResourceProvider}
                      resource={c.resource || {}}
                      busy={!!busy}
                      save={(resource) =>
                        action(c.provider, "configure", resource)
                      }
                    />
                  </>
                )}
                {s?.error && (
                  <p role="alert" className="crm-alert error">
                    {s.error}
                  </p>
                )}
                {s?.last_sync && (
                  <p className="crm-muted">
                    Ostatni udany odczyt:{" "}
                    {new Date(s.last_sync).toLocaleString("pl-PL")}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    className="crm-button secondary"
                    disabled={!c.configured || !!busy}
                    onClick={() => void action(c.provider, "check")}
                  >
                    {busy === c.provider
                      ? "Łączenie…"
                      : disconnected
                        ? "Połącz ponownie"
                        : "Sprawdź odczyt"}
                  </button>
                  <button
                    className="crm-button"
                    disabled={!c.configured || disconnected || !!busy}
                    onClick={() => void action(c.provider, "sync")}
                  >
                    {c.provider === "wordpress"
                      ? "Importuj strony"
                      : c.provider === "posthog"
                        ? "Odczytaj zdarzenia"
                        : c.provider === "stripe"
                          ? "Pobierz płatności"
                          : c.provider === "meta_ads"
                            ? "Pobierz kampanie"
                            : "Pobierz statystyki"}
                  </button>
                  {s && !disconnected && (
                    <button
                      className="crm-text-button"
                      disabled={!!busy}
                      onClick={() => void action(c.provider, "disconnect")}
                    >
                      Wyłącz w przestrzeni
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        {show("ads") && (
          <article className="crm-card crm-connector grid content-start gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ConnectorLogo id="ads" />
                <h3 className="text-lg!">Google Ads / Microsoft Ads</h3>
              </div>
              <Badge tone="purple">Import CSV</Badge>
            </div>
            <p className="crm-muted">
              Wczytaj dzienne wyniki kampanii w PLN. Adapter importu waliduje
              dane i aktualizuje istniejące wiersze. Import pozostaje osobny
              względem odczytu Google Ads API.
            </p>
            <p className="text-sm">
              Kolumny: date, source, campaign, spend, impressions, clicks,
              leads, qualified, revenue. Źródła: google_ads, microsoft_ads,
              meta_ads, organic, gbp, direct.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="crm-button"
                disabled={!!busy}
                onClick={() => input.current?.click()}
              >
                {busy === "csv" ? "Importowanie…" : "Importuj CSV"}
              </button>
              <button
                className="crm-button secondary"
                onClick={() =>
                  downloadFile(
                    "szablon-kampanii.csv",
                    `date;source;campaign;spend;impressions;clicks;leads;qualified;revenue\n${currentDate()};google_ads;Przykład do uzupełnienia;0;0;0;0;0;0\n`,
                  )
                }
              >
                Pobierz szablon
              </button>
            </div>
          </article>
        )}
        {show("resend") && (
          <article className="crm-card crm-connector grid content-start gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ConnectorLogo id="resend" />
                <h3 className="text-lg!">Poczta · Resend</h3>
              </div>
              <Badge tone="purple">Wysyłka</Badge>
            </div>
            <p className="crm-muted">
              Bezpośrednia wysyłka z CRM z potwierdzeniem użytkownika. Klucz API
              na serwerze, token wysyłki tylko w pamięci sesji.
            </p>
            <button
              className="crm-button secondary justify-self-start"
              onClick={mailSettings}
            >
              Otwórz konfigurację poczty
            </button>
          </article>
        )}
        {PLANNED.filter((p) => show(p.id)).map((p) => (
          <article
            key={p.id}
            className="crm-card crm-connector grid content-start gap-4 p-6 opacity-90"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ConnectorLogo id={p.id} />
                <h3 className="text-lg!">{p.name}</h3>
              </div>
              <Badge tone="gray">Planowane</Badge>
            </div>
            <p className="crm-muted">{p.description}</p>
            <p className="text-xs text-slate-500">Teraz: {p.workaround}</p>
          </article>
        ))}
      </div>
      {!visible && (
        <p className="crm-muted text-center">
          Brak konektorów dla tego filtra.
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => void importCsv(e.target.files?.[0])}
      />
      {payments && <PaymentsView report={payments} />}
      {reports.map((r) => (
        <GoogleReportView
          key={`${r.report.provider}:${r.report.resource}`}
          {...r}
        />
      ))}
      {!!events.length && (
        <section className="crm-card p-6">
          <h3>Zdarzenia PostHog · ostatnie 30 dni</h3>
          <ul className="mt-4 grid gap-2 text-sm">
            {events.map((r, i) => (
              <li key={i}>
                {String(r[0])}: <strong>{String(r[1])}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
