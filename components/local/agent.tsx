"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { localRequest } from "@/lib/local/client";
import {
  AGENT_PROVIDERS,
  agentProviderLabels,
  type AgentProvider,
  type AgentMessage,
} from "@/lib/ai/model";
import AgentChat from "./agent-chat";
import { Field, Badge, Icon } from "../crm/ui";
type Status = {
  builtin?: boolean;
  openrouter: boolean;
  codex: boolean;
  claude: boolean;
  cliEnabled: boolean;
};
const BUILTIN_MODEL = "evolution-local";
const descriptions: Record<AgentProvider, string> = {
  builtin:
    "Działa od razu, offline. Analizuje CRM, zadania i marketing regułami eksperckimi.",
  openrouter:
    "Setki modeli (GPT, Claude, Gemini, Llama) przez jeden klucz API.",
  codex: "Twoja subskrypcja ChatGPT przez zalogowany Codex CLI.",
  claude: "Twój plan Anthropic przez zalogowany Claude Code CLI.",
};
export default function AiAgent({
  wid,
  storageBusy,
  onApplied,
  request,
}: {
  wid: string;
  storageBusy?: boolean;
  onApplied: () => void;
  request?: { text: string; at: number } | null;
}) {
  const [provider, setProvider] = useState<AgentProvider>("builtin"),
    [model, setModel] = useState(BUILTIN_MODEL),
    [prompt, setPrompt] = useState(""),
    [key, setKey] = useState(""),
    [messages, setMessages] = useState<AgentMessage[]>([]),
    [status, setStatus] = useState<Status>({
      builtin: true,
      openrouter: false,
      codex: false,
      claude: false,
      cliEnabled: false,
    }),
    [models, setModels] = useState<{ id: string; name: string }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const handled = useRef(0);
  const inFlight = useRef(false);
  const available = (p: AgentProvider) =>
    p === "builtin" ? true : Boolean(status[p]);
  const load = useCallback(async () => {
    try {
      const result = await localRequest(wid, "ai");
      setStatus(result.status);
      setMessages(result.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd odczytu agenta.");
    }
  }, [wid]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  const send = useCallback(
    async (text: string, p: AgentProvider, m: string) => {
      if (!text.trim() || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const r = await localRequest(wid, "ai", {
          method: "POST",
          body: JSON.stringify({ provider: p, model: m, prompt: text }),
        });
        setMessages(r.messages);
        setPrompt((draft) => (draft === text ? "" : draft));
        if (r.usage)
          setNotice(
            `Zużycie zgłoszone przez dostawcę: ${JSON.stringify(r.usage)}`,
          );
      } catch (e) {
        setPrompt((draft) => draft || text);
        setError(
          e instanceof Error
            ? e.message
            : "Nie udało się przeprowadzić analizy.",
        );
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [wid],
  );
  useEffect(() => {
    if (!request || request.at === handled.current) return;
    handled.current = request.at;
    queueMicrotask(() => {
      setProvider("builtin");
      setModel(BUILTIN_MODEL);
      void send(request.text, "builtin", BUILTIN_MODEL);
    });
  }, [request, send]);
  async function fetchModels() {
    setBusy(true);
    setError("");
    try {
      const r = await localRequest(wid, "ai/models");
      setModels(r.models);
      setNotice(
        `Pobrano ${r.models.length} modeli. Wybierz identyfikator; koszt zależy od wybranego modelu i konta.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się pobrać modeli.");
    } finally {
      setBusy(false);
    }
  }
  async function connectKey() {
    setBusy(true);
    setError("");
    try {
      await localRequest(wid, "ai/key", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      setKey("");
      setNotice(
        "Klucz zapisano w pamięci serwera na 30 minut. Nie trafia do SQLite ani localStorage.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd klucza.");
    } finally {
      setBusy(false);
    }
  }
  async function decision(id: string, approve: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await localRequest(wid, "ai/decision", {
        method: "POST",
        body: JSON.stringify({ id, approve }),
      });
      setMessages(r.messages);
      if (approve) onApplied();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Nie udało się zatwierdzić propozycji.",
      );
    } finally {
      setBusy(false);
    }
  }
  const pending = messages.reduce(
    (n, m) => n + m.actions.filter((a) => a.status === "pending").length,
    0,
  );
  const executed = messages.reduce(
    (n, m) => n + m.actions.filter((a) => a.status === "executed").length,
    0,
  );
  const choose = (p: AgentProvider) => {
    setProvider(p);
    setModel(p === "builtin" ? BUILTIN_MODEL : "");
    setNotice("");
  };
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <section className="relative overflow-hidden rounded-[26px] bg-[radial-gradient(120%_140%_at_100%_0%,#7c5cff_0%,#3a22b8_45%,#1c1446_100%)] p-6 text-white shadow-[0_24px_60px_-28px_#3a22b8] sm:p-7">
        <div className="pointer-events-none absolute -top-20 left-1/4 size-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
              <Icon name="agent" size={28} />
            </span>
            <div>
              <span className="text-[11px] font-bold tracking-[1.8px] text-violet-200">
                AI BRAIN · ASYSTENT TWOJEJ FIRMY
              </span>
              <h2 className="text-2xl! font-bold text-white!">
                Zapytaj. Sprawdź. Zdecyduj.
              </h2>
              <p className="text-sm text-violet-100/90">
                Agent zna CRM, zadania, marketing i Company Brain. Każdą zmianę
                zatwierdzasz osobno.
              </p>
            </div>
          </div>
          <dl className="flex gap-6">
            {[
              ["Rozmowy", messages.length],
              ["Do decyzji", pending],
              ["Wykonane", executed],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] text-violet-200">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      {error && (
        <p className="crm-alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="crm-alert break-all" role="status">
          {notice}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AgentChat
          messages={messages}
          prompt={prompt}
          setPrompt={setPrompt}
          busy={busy}
          storageBusy={storageBusy}
          canAsk={available(provider) && Boolean(model)}
          ask={async (e) => {
            e.preventDefault();
            await send(prompt, provider, model);
          }}
          quick={(text) => void send(text, provider, model)}
          decision={decision}
        />
        <aside className="crm-card grid gap-4 p-5 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base!">Silnik AI</h3>
            <Badge tone={available(provider) ? "green" : "gray"}>
              {provider === "builtin"
                ? "Gotowy · offline"
                : provider === "openrouter"
                  ? status.openrouter
                    ? "Klucz dostępny"
                    : "Podłącz klucz"
                  : status[provider]
                    ? "CLI dostępne · logowanie do sprawdzenia"
                    : "CLI niedostępne lub wyłączone"}
            </Badge>
          </div>
          <div className="grid gap-2" role="group" aria-label="Silnik AI">
            {AGENT_PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={provider === p}
                disabled={busy}
                onClick={() => choose(p)}
                className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${provider === p ? "border-violet-400 bg-violet-50/80 shadow-[0_0_0_3px_#ede9fe]" : "border-slate-100 bg-white/70 hover:border-violet-200"}`}
              >
                <span
                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${available(p) ? "bg-emerald-500" : "bg-slate-300"}`}
                />
                <span className="min-w-0">
                  <strong className="block text-sm text-slate-800">
                    {agentProviderLabels[p]}
                  </strong>
                  <span className="block text-xs leading-relaxed text-slate-500">
                    {descriptions[p]}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="sr-only">
            <Field label="Dostawca AI">
              <select
                value={provider}
                disabled={busy}
                onChange={(e) => choose(e.target.value as AgentProvider)}
              >
                {AGENT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {agentProviderLabels[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {provider !== "builtin" && (
            <>
              <Field
                label="Model AI"
                hint="Wybierz z listy lub wpisz identyfikator dostępny na swoim koncie."
              >
                <input
                  list="growth-models"
                  value={model}
                  disabled={busy}
                  maxLength={151}
                  placeholder="ID modelu lub alias"
                  onChange={(e) => setModel(e.target.value)}
                />
              </Field>
              <datalist id="growth-models">
                {provider === "openrouter"
                  ? models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))
                  : provider === "claude"
                    ? ["sonnet", "opus", "haiku"].map((m) => (
                        <option key={m} value={m} />
                      ))
                    : null}
              </datalist>
            </>
          )}
          {provider === "openrouter" && (
            <div className="grid gap-3">
              <Field label="Klucz OpenRouter (sesja 30 minut)">
                <input
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="sk-or-…"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button
                  className="crm-button secondary"
                  disabled={busy || !key}
                  onClick={() => void connectKey()}
                >
                  Podłącz API
                </button>
                <button
                  className="crm-button secondary"
                  disabled={busy || !status.openrouter}
                  onClick={() => void fetchModels()}
                >
                  Pobierz modele
                </button>
                <button
                  className="crm-text-button"
                  disabled={busy}
                  onClick={() =>
                    void localRequest(wid, "ai/disconnect", {
                      method: "POST",
                      body: "{}",
                    })
                      .then(() => {
                        setModels([]);
                        return load();
                      })
                      .catch((e) => setError(e.message))
                  }
                >
                  Usuń klucz sesji
                </button>
              </div>
            </div>
          )}
          {(provider === "codex" || provider === "claude") && (
            <p className="crm-alert">
              {provider === "codex"
                ? "Subskrypcję ChatGPT wykorzystasz przez zainstalowany Codex CLI: zaloguj się poleceniem codex login. To nie jest podłączenie strony chatgpt.com ani klucz API z subskrypcji."
                : "Zainstaluj Claude Code i zaloguj konto w CLI. Dostęp i limity modeli zależą od Twojego planu Anthropic."}{" "}
              W .env.local ustaw LOCAL_AI_CLI_ENABLED=1 i uruchom serwer
              ponownie. Adapter działa bez narzędzi systemowych i MCP.
            </p>
          )}
          <p className="crm-muted text-xs leading-relaxed">
            {provider === "builtin"
              ? "Wbudowany agent liczy wyłącznie na danych tej przestrzeni i nie wysyła ich poza komputer."
              : "Kliknięcie „Analizuj” wysyła ograniczony kontekst tej przestrzeni do wybranego dostawcy. Klucze i konfiguracja integracji nie są częścią kontekstu."}{" "}
            Agent może proponować zadania i notatki; nie zmienia kampanii i nie
            wysyła e-maili.
          </p>
        </aside>
      </div>
    </div>
  );
}
