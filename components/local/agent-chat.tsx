"use client";
import { useEffect, useRef } from "react";
import {
  agentProviderLabels,
  type AgentProvider,
  type AgentMessage,
} from "@/lib/ai/model";
import { Field, Icon } from "../crm/ui";
import Markdown from "./markdown";
const QUICK = [
  "Przeanalizuj wszystkie statystyki firmy i przygotuj priorytety na ten tydzień.",
  "Co powinienem zrobić dzisiaj?",
  "Pokaż ryzyka w sprzedaży",
  "Przeanalizuj lejek i prognozę",
  "Przeanalizuj marketing z ostatnich 30 dni.",
  "Zaproponuj notatkę z podsumowaniem sprzedaży.",
];
export default function AgentChat({
  messages,
  prompt,
  setPrompt,
  busy,
  storageBusy,
  canAsk,
  ask,
  quick,
  decision,
}: {
  messages: AgentMessage[];
  prompt: string;
  setPrompt: (v: string) => void;
  busy: boolean;
  storageBusy?: boolean;
  canAsk: boolean;
  ask: (e: React.FormEvent) => Promise<void>;
  quick: (text: string) => void;
  decision: (id: string, approve: boolean) => Promise<void>;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length, busy]);
  return (
    <section className="crm-card flex min-h-[560px] flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 sm:p-6" aria-live="polite">
        {messages.length ? (
          <div className="grid gap-6">
            {messages.map((m) => (
              <article key={m.id} className="grid gap-3">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-600 px-4 py-3 text-sm text-white shadow-md">
                  <span className="sr-only">Ty</span>
                  <p className="break-words whitespace-pre-wrap">{m.prompt}</p>
                </div>
                <div className="flex max-w-[92%] gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                    <Icon name="agent" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="crm-muted mb-1 text-xs">
                      {agentProviderLabels[m.provider as AgentProvider] ??
                        m.provider}{" "}
                      · {m.model}
                    </p>
                    <div className="rounded-2xl rounded-tl-md border border-slate-100 bg-white/80 px-4 py-3 text-[14px] leading-7 break-words">
                      <Markdown
                        content={m.answer}
                        documents={[]}
                        open={() => {}}
                      />
                    </div>
                    <div className="mt-3 grid gap-3">
                      {m.actions.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4"
                        >
                          <div className="flex items-start gap-2">
                            <Icon
                              name={
                                a.payload.type === "create_task"
                                  ? "tasks"
                                  : "file"
                              }
                              size={18}
                            />
                            <strong className="text-sm">
                              {a.payload.type === "create_task"
                                ? "Propozycja zadania"
                                : "Propozycja notatki"}
                              : {a.payload.title}
                            </strong>
                          </div>
                          <p className="crm-muted mt-1 text-xs">
                            {a.payload.type === "create_task"
                              ? `Termin: ${a.payload.date}`
                              : `Folder: ${a.payload.category}`}
                          </p>
                          {a.payload.type === "create_note" && (
                            <details className="my-3">
                              <summary className="cursor-pointer text-sm text-violet-700">
                                Sprawdź treść przed zapisem
                              </summary>
                              <pre className="mt-2 text-sm break-words whitespace-pre-wrap">
                                {a.payload.content}
                              </pre>
                            </details>
                          )}
                          {a.status === "pending" ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                className="crm-button"
                                disabled={busy || storageBusy}
                                onClick={() => void decision(a.id, true)}
                              >
                                Zatwierdź i wykonaj
                              </button>
                              <button
                                className="crm-button secondary"
                                disabled={busy || storageBusy}
                                onClick={() => void decision(a.id, false)}
                              >
                                Odrzuć
                              </button>
                            </div>
                          ) : (
                            <p
                              className={`mt-2 text-sm font-medium ${a.status === "executed" ? "text-emerald-700" : "text-slate-500"}`}
                            >
                              {a.status === "executed"
                                ? "Wykonano po zatwierdzeniu"
                                : "Odrzucono"}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
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
            <div ref={end} />
          </div>
        ) : (
          <div className="grid place-items-center py-10 text-center">
            <span className="grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-100 to-indigo-50 text-violet-700">
              <Icon name="spark" size={30} />
            </span>
            <h3 className="mt-4 text-lg!">Od czego zacząć?</h3>
            <p className="crm-muted mt-1 max-w-md text-sm">
              Zapytaj o plan dnia, lejek sprzedaży, marketing, ryzyka albo wpisz
              nazwę firmy z CRM.
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 bg-white/60 p-4 sm:p-5">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy || storageBusy || !canAsk}
              className="shrink-0 rounded-full border border-violet-100 bg-violet-50/70 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
              onClick={() => quick(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={ask} className="grid gap-3">
          <Field label="Wiadomość do agenta">
            <textarea
              rows={3}
              required
              maxLength={2000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  if (busy || storageBusy || !canAsk || !prompt.trim()) return;
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Co chcesz przeanalizować? Enter wysyła, Shift+Enter nowa linia."
            />
          </Field>
          <button
            className="crm-button justify-self-end"
            disabled={busy || storageBusy || !canAsk || !prompt.trim()}
          >
            {busy ? "Agent pracuje…" : "Analizuj"}
          </button>
        </form>
      </div>
    </section>
  );
}
