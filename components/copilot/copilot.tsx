"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAgent,
  runAgent,
  decideAction,
  agentStatus,
  agentModels,
  actionLabel,
  type CopilotMessage,
} from "@/stores/agent-store";
import {
  COPILOT_PROVIDERS,
  copilotLabels,
  defaultModels,
  type CopilotProvider,
} from "@/lib/ai/agent";
import { Field, Icon } from "../crm/ui";
import Markdown from "../local/markdown";
import VoiceInput from "../ai/voice-input";

type Status = Awaited<ReturnType<typeof agentStatus>>;
const QUICK = [
  "Co powinienem zrobić dzisiaj?",
  "Pokaż ryzyka w sprzedaży",
  "Przygotuj szkice follow-up do najważniejszych szans",
  "Wygeneruj raport zarządczy za ostatnie 30 dni",
  "Zaplanuj codzienny briefing o 8:00",
  "Przeanalizuj lejek i prognozę",
];
const providerInfo: Record<
  CopilotProvider,
  { icon: string; text: string; tag: string }
> = {
  builtin: {
    icon: "spark",
    text: "Działa od razu i offline. Reguły eksperckie dla CRM, raportów i harmonogramu.",
    tag: "Bez konfiguracji",
  },
  openrouter: {
    icon: "agent",
    text: "GPT, Claude, Gemini, Llama, DeepSeek — setki modeli przez jeden klucz.",
    tag: "Klucz API",
  },
  openai: {
    icon: "agent",
    text: "Modele ChatGPT (GPT-4o, GPT-5) przez klucz z platform.openai.com.",
    tag: "Klucz API",
  },
  local: {
    icon: "settings",
    text: "Ollama lub LM Studio na Twoim komputerze. Dane nie opuszczają firmy.",
    tag: "LOCAL_AI_BASE_URL",
  },
  codex: {
    icon: "agent",
    text: "Twoja subskrypcja ChatGPT Plus/Pro przez zalogowany Codex CLI (codex login).",
    tag: "Subskrypcja",
  },
  claude: {
    icon: "agent",
    text: "Plan Claude Pro/Max przez zalogowany Claude Code CLI.",
    tag: "Subskrypcja",
  },
};

function ready(
  p: CopilotProvider,
  status: Status | null,
  keys: Partial<Record<string, string>>,
) {
  if (p === "builtin") return { ok: true, label: "Gotowy" };
  if (!status) return { ok: false, label: "Sprawdzanie…" };
  if (p === "openrouter" || p === "openai")
    return keys[p]
      ? { ok: true, label: "Twój klucz" }
      : status.server[p]
        ? { ok: true, label: "Klucz serwera" }
        : { ok: false, label: "Podaj klucz" };
  if (p === "local")
    return status.server.local
      ? { ok: true, label: "Połączony" }
      : { ok: false, label: "Ustaw adres" };
  if (!status.localhost) return { ok: false, label: "Tylko lokalnie" };
  if (!status.cli.enabled) return { ok: false, label: "Włącz CLI" };
  return status.cli[p]
    ? { ok: true, label: "Zalogowany CLI" }
    : { ok: false, label: "Brak CLI" };
}

function ActionCard({
  message,
  item,
  readOnly,
}: {
  message: CopilotMessage;
  item: CopilotMessage["actions"][number];
  readOnly: boolean;
}) {
  const info = actionLabel(item.action);
  const tone =
    item.status === "executed"
      ? "border-emerald-200 bg-emerald-50/60"
      : item.status === "failed"
        ? "border-rose-200 bg-rose-50/60"
        : item.status === "rejected"
          ? "border-slate-200 bg-slate-50 opacity-70"
          : "border-violet-200 bg-violet-50/60";
  return (
    <div className={`rounded-2xl border p-3.5 ${tone}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-violet-700 shadow-sm">
          <Icon name={info.icon} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm break-words text-slate-800">
            {info.title}
          </strong>
          <span className="block text-xs break-words text-slate-500">
            {info.detail}
          </span>
          {item.action.type === "draft_email" && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-violet-700">
                Podgląd treści
              </summary>
              <pre className="mt-1 text-xs break-words whitespace-pre-wrap text-slate-600">
                {item.action.body}
              </pre>
            </details>
          )}
          {item.result && (
            <span
              className={`mt-1 block text-xs font-medium ${item.status === "failed" ? "text-rose-700" : "text-emerald-700"}`}
            >
              {item.status === "failed" ? "⚠ " : "✓ "}
              {item.result}
            </span>
          )}
          {item.status === "rejected" && (
            <span className="mt-1 block text-xs text-slate-500">Odrzucono</span>
          )}
        </div>
        {item.status === "pending" && (
          <div className="flex shrink-0 gap-1.5">
            <button
              className="crm-button px-3! py-1.5! text-xs!"
              disabled={readOnly}
              onClick={() => decideAction(message.id, item.id, true)}
            >
              Wykonaj
            </button>
            <button
              className="crm-button secondary px-2.5! py-1.5! text-xs!"
              onClick={() => decideAction(message.id, item.id, false)}
            >
              <span className="sr-only">Odrzuć</span>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Copilot({
  workspace,
  readOnly = false,
  request,
}: {
  workspace: string;
  readOnly?: boolean;
  request?: { text: string; at: number } | null;
}) {
  const agent = useAgent();
  const messages = agent.messages[workspace] ?? [];
  const { provider, model, autopilot, remember } = agent.settings;
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [info, setInfo] = useState("");
  const [engineOpen, setEngineOpen] = useState(false);
  const handled = useRef(0);
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    agent.setWorkspace(workspace, readOnly);
  }, [workspace, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true;
    agentStatus()
      .then((s) => active && setStatus(s))
      .catch(
        () =>
          active &&
          setStatus({
            trusted: false,
            localhost: false,
            server: { openrouter: false, openai: false, local: false },
            cli: { enabled: false, codex: false, claude: false },
          }),
      );
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (follow.current && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [messages.length, busy]);
  const send = useCallback(async (text: string) => {
    if (!text.trim() || inFlight.current) return;
    inFlight.current = true;
    follow.current = true;
    setBusy(true);
    try {
      const reply = await runAgent(text.trim());
      if (!reply.error) setPrompt((draft) => (draft === text ? "" : draft));
    } catch {
      setInfo(
        "Nie udało się wysłać wiadomości. Treść pozostaje w polu — spróbuj ponownie.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!request || request.at === handled.current) return;
    handled.current = request.at;
    queueMicrotask(() => void send(request.text));
  }, [request, send]);
  const pending = messages.flatMap((m) =>
    m.actions.filter((a) => a.status === "pending").map((a) => ({ m, a })),
  );
  const executed = messages.reduce(
    (n, m) => n + m.actions.filter((a) => a.status === "executed").length,
    0,
  );
  const state = ready(provider, status, agent.keys);
  async function loadModels() {
    if (!["openrouter", "openai", "local"].includes(provider)) return;
    setInfo("Pobieranie listy modeli…");
    try {
      const list = await agentModels(
        provider as "openrouter" | "openai" | "local",
      );
      setModels(list);
      setInfo(
        `Dostępnych modeli: ${list.length}. Wybierz z listy lub wpisz identyfikator.`,
      );
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Nie udało się pobrać modeli.");
    }
  }
  const engine = (
    <section className="crm-card min-w-0 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <span className="crm-eyebrow">SILNIK AI</span>
          <h3 className="mt-1 text-base!">Wybierz model agenta</h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
        >
          {state.ok ? "● " : "○ "}
          {state.label}
        </span>
      </div>
      <div className="grid gap-2" role="group" aria-label="Dostawca AI">
        {COPILOT_PROVIDERS.map((p) => {
          const r = ready(p, status, agent.keys);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={provider === p}
              disabled={busy}
              onClick={() => {
                agent.setSettings({ provider: p, model: defaultModels[p] });
                setModels([]);
                setInfo("");
              }}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${provider === p ? "border-violet-400 bg-violet-50/70 ring-2 ring-violet-200" : "border-slate-200 hover:border-violet-200"}`}
            >
              <span
                className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${provider === p ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                <Icon name={providerInfo[p].icon} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2">
                  <strong className="text-sm text-slate-800">
                    {copilotLabels[p]}
                  </strong>
                  <span
                    className={`text-[10px] font-semibold ${r.ok ? "text-emerald-600" : "text-slate-400"}`}
                  >
                    {r.label}
                  </span>
                </span>
                <span className="block text-[11px] leading-snug text-slate-500">
                  {providerInfo[p].text}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {provider !== "builtin" && (
        <div className="mt-4 grid gap-3">
          <Field
            label="Model"
            hint={
              provider === "codex"
                ? "Wpisz default, aby użyć modelu z konta ChatGPT."
                : undefined
            }
          >
            <input
              list="copilot-models"
              value={model}
              maxLength={150}
              onChange={(e) =>
                agent.setSettings({ model: e.target.value.trim() })
              }
            />
          </Field>
          <datalist id="copilot-models">
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </datalist>
          {(provider === "openrouter" || provider === "openai") && (
            <>
              <Field
                label={
                  provider === "openrouter"
                    ? "Klucz OpenRouter (sk-or-…)"
                    : "Klucz OpenAI (sk-…)"
                }
                hint={
                  status?.server[provider]
                    ? "Serwer ma własny klucz — pole jest opcjonalne."
                    : "Klucz trafia tylko do Twojego serwera Growth OS i dostawcy AI."
                }
              >
                <input
                  type="password"
                  autoComplete="off"
                  value={agent.keys[provider] ?? ""}
                  onChange={(e) => agent.setKey(provider, e.target.value)}
                  placeholder={
                    status?.server[provider]
                      ? "Użyj klucza serwera"
                      : "Wklej klucz API"
                  }
                />
              </Field>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="accent-violet-600"
                  checked={remember}
                  onChange={(e) =>
                    agent.setSettings({ remember: e.target.checked })
                  }
                />
                Zapamiętaj klucz na tym urządzeniu
              </label>
            </>
          )}
          {["openrouter", "openai", "local"].includes(provider) && (
            <button
              className="crm-button secondary"
              onClick={() => void loadModels()}
            >
              Pobierz listę modeli
            </button>
          )}
          {(provider === "codex" || provider === "claude") && (
            <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
              Uruchom lokalnie z <code>LOCAL_AI_CLI_ENABLED=1</code>, zainstaluj
              i zaloguj CLI:{" "}
              <code>
                {provider === "codex"
                  ? "npm i -g @openai/codex && codex login"
                  : "npm i -g @anthropic-ai/claude-code && claude"}
              </code>
              . CLI działa bez narzędzi i dostępu do plików.
            </p>
          )}
          {provider === "local" && !status?.server.local && (
            <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
              Dodaj do <code>.env.local</code>:{" "}
              <code>LOCAL_AI_BASE_URL=http://127.0.0.1:11434/v1</code> (Ollama)
              lub <code>http://127.0.0.1:1234/v1</code> (LM Studio) i zrestartuj
              aplikację.
            </p>
          )}
          {info && <p className="text-xs text-slate-500">{info}</p>}
        </div>
      )}
      <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3">
        <span>
          <strong className="block text-sm">Autopilot</strong>
          <span className="text-[11px] text-slate-500">
            Agent sam wykonuje akcje: zadania, szanse, szkice, raporty.
          </span>
        </span>
        <input
          type="checkbox"
          className="size-5 accent-violet-600"
          checked={autopilot}
          disabled={readOnly}
          onChange={(e) => agent.setSettings({ autopilot: e.target.checked })}
        />
      </label>
    </section>
  );
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22em]">
      <div className="grid min-w-0 gap-4">
        <div className="crm-agent-summary grid grid-cols-3 gap-3">
          {[
            { label: "Rozmowy", value: messages.length, icon: "agent" },
            { label: "Czeka na decyzję", value: pending.length, icon: "clock" },
            { label: "Wykonane akcje", value: executed, icon: "check" },
          ].map((x) => (
            <div key={x.label} className="crm-card flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                <Icon name={x.icon} size={18} />
              </span>
              <span className="min-w-0">
                <strong className="block text-xl tabular-nums">
                  {x.value}
                </strong>
                <span className="block truncate text-xs text-slate-500">
                  {x.label}
                </span>
              </span>
            </div>
          ))}
        </div>
        <section className="crm-card flex min-h-[620px] min-w-0 flex-col overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 text-white">
                <Icon name="agent" size={18} />
                <i
                  className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-white ${state.ok ? "bg-emerald-500" : "bg-amber-400"}`}
                />
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-sm">
                  Evolution Agent
                </strong>
                <span className="block truncate text-xs text-slate-500">
                  {copilotLabels[provider]} · {model}
                  {autopilot && " · autopilot"}
                </span>
              </span>
            </div>
            <div className="flex gap-2">
              {pending.length > 1 && (
                <button
                  className="crm-button px-3! py-1.5! text-xs!"
                  disabled={readOnly}
                  onClick={() =>
                    pending.forEach(({ m, a }) =>
                      decideAction(m.id, a.id, true),
                    )
                  }
                >
                  Wykonaj wszystkie ({pending.length})
                </button>
              )}
              <button
                className="crm-button secondary px-3! py-1.5! text-xs! xl:hidden"
                onClick={() => setEngineOpen((v) => !v)}
              >
                Silnik AI
              </button>
              {messages.length > 0 && (
                <button
                  className="crm-icon-button"
                  aria-label="Wyczyść rozmowę"
                  onClick={() => agent.clear()}
                >
                  <Icon name="trash" size={16} />
                </button>
              )}
            </div>
          </header>
          {engineOpen && (
            <div className="border-b border-slate-100 p-4 xl:hidden">
              {engine}
            </div>
          )}
          <div
            ref={log}
            className="crm-agent-log flex-1 overflow-y-auto p-5 sm:p-6"
            role="log"
            aria-label="Rozmowa z Evolution Agent"
            aria-live="polite"
            onScroll={(e) => {
              const el = e.currentTarget;
              follow.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {messages.length ? (
              <div className="grid gap-6">
                {messages.map((m) => (
                  <article key={m.id} className="grid gap-3">
                    <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-600 px-4 py-3 text-sm text-white shadow-md">
                      {m.source === "job" && (
                        <span className="mb-1 block text-[10px] font-bold tracking-wider text-violet-200 uppercase">
                          Harmonogram
                        </span>
                      )}
                      <p className="break-words whitespace-pre-wrap">
                        {m.prompt}
                      </p>
                    </div>
                    <div className="flex max-w-[94%] gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                        <Icon name="agent" size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-xs text-slate-400">
                          {copilotLabels[m.provider]} · {m.model} ·{" "}
                          {new Intl.DateTimeFormat("pl-PL", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "short",
                          }).format(new Date(m.at))}
                        </p>
                        <div className="rounded-2xl rounded-tl-md border border-slate-100 bg-white px-4 py-3 text-[14px] leading-7 break-words shadow-[0_1px_2px_#0f172a08]">
                          <Markdown
                            content={m.answer}
                            documents={[]}
                            open={() => {}}
                          />
                        </div>
                        {m.rejected && (
                          <p className="mt-2 text-xs text-amber-700">
                            Pominięto {m.rejected.length} nieprawidłowe
                            propozycje: {m.rejected.join("; ")}
                          </p>
                        )}
                        {m.actions.length > 0 && (
                          <div className="mt-3 grid gap-2">
                            {m.actions.map((a) => (
                              <ActionCard
                                key={a.id}
                                message={m}
                                item={a}
                                readOnly={readOnly}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
                {busy && (
                  <div
                    className="flex items-center gap-3 text-sm text-slate-500"
                    role="status"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-700">
                      <Icon name="agent" size={18} />
                    </span>
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <i
                          key={i}
                          className="size-2 animate-bounce rounded-full bg-violet-400"
                          style={{ animationDelay: `${i * 120}ms` }}
                        />
                      ))}
                    </span>
                    Agent analizuje dane…
                  </div>
                )}
              </div>
            ) : (
              <div className="grid place-items-center py-10 text-center">
                <span className="grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-100 to-indigo-50 text-violet-700">
                  <Icon name="spark" size={30} />
                </span>
                <h3 className="mt-4 text-lg!">
                  Agent, który obsługuje CRM za Ciebie
                </h3>
                <p className="mt-2! max-w-lg text-sm leading-relaxed text-slate-500">
                  Dodaje zadania, firmy, kontakty i szanse, aktualizuje etapy,
                  pisze szkice maili, generuje raporty i planuje automatyzacje.
                  Każdą akcję zatwierdzasz — albo włączasz autopilota.
                </p>
                {busy && (
                  <p className="mt-4 text-sm text-violet-700">
                    Agent analizuje dane…
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  className="shrink-0 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
                  onClick={() => void send(q)}
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100"
              onSubmit={(e) => {
                e.preventDefault();
                void send(prompt);
              }}
            >
              <textarea
                aria-label="Wiadomość do agenta"
                rows={2}
                maxLength={4000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    if (!busy && prompt.trim())
                      e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Np. „Dodaj firmę Acme z Poznania i szansę 20 000 zł na etapie Oferta” — Enter wysyła"
                className="min-h-0! flex-1 resize-none border-0! bg-transparent! p-2! shadow-none! focus:outline-none"
              />
              <button
                className="crm-button shrink-0"
                disabled={busy || !prompt.trim()}
              >
                {busy ? "…" : <Icon name="arrow" size={18} />}
                <span className="sr-only">Wyślij</span>
              </button>
            </form>
            <VoiceInput
              value={prompt}
              onChange={setPrompt}
              disabled={busy}
              maxLength={4000}
            />
          </div>
        </section>
      </div>
      <div className="hidden h-fit min-w-0 gap-5 xl:grid">{engine}</div>
    </div>
  );
}
