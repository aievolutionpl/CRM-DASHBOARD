"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  builtinCopilot,
  copilotContext,
  defaultModels,
  describeAction,
  parseCopilotReply,
  type AgentAction,
  type CopilotProvider,
} from "@/lib/ai/agent";
import { useCrm } from "./crm-store";
import {
  id as newId,
  safeWebsite,
  today,
  type DealStage,
  type WorkspaceData,
} from "@/lib/crm/model";
import { generateReport } from "@/lib/reports/generate";
import { newJob } from "@/lib/automation/model";
import { isCloud } from "@/lib/growth/model";

export type ActionState = {
  id: string;
  action: AgentAction;
  status: "pending" | "executed" | "rejected" | "failed";
  result?: string;
};
export type CopilotMessage = {
  id: string;
  prompt: string;
  answer: string;
  provider: CopilotProvider;
  model: string;
  at: string;
  source: "chat" | "job";
  actions: ActionState[];
  rejected?: string[];
  error?: boolean;
};
type Settings = {
  provider: CopilotProvider;
  model: string;
  autopilot: boolean;
  remember: boolean;
};
type State = {
  settings: Settings;
  keys: Partial<Record<"openrouter" | "openai", string>>;
  workspace: string;
  readOnly: boolean;
  messages: Record<string, CopilotMessage[]>;
  setWorkspace: (workspace: string, readOnly?: boolean) => void;
  setSettings: (settings: Partial<Settings>) => void;
  setKey: (provider: "openrouter" | "openai", key: string) => void;
  push: (message: CopilotMessage) => void;
  patchAction: (
    messageId: string,
    actionId: string,
    patch: Partial<ActionState>,
  ) => void;
  clear: () => void;
};

export const useAgent = create<State>()(
  persist(
    (set) => ({
      settings: {
        provider: "builtin",
        model: defaultModels.builtin,
        autopilot: false,
        remember: false,
      },
      keys: {},
      workspace: "local",
      readOnly: false,
      messages: {},
      setWorkspace: (workspace, readOnly = false) =>
        set({ workspace, readOnly }),
      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      setKey: (provider, key) =>
        set((s) => ({
          keys: { ...s.keys, [provider]: key.trim() || undefined },
        })),
      push: (message) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [s.workspace]: [...(s.messages[s.workspace] ?? []), message].slice(
              -40,
            ),
          },
        })),
      patchAction: (messageId, actionId, patch) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [s.workspace]: (s.messages[s.workspace] ?? []).map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    actions: m.actions.map((a) =>
                      a.id === actionId ? { ...a, ...patch } : a,
                    ),
                  }
                : m,
            ),
          },
        })),
      clear: () =>
        set((s) => ({ messages: { ...s.messages, [s.workspace]: [] } })),
    }),
    {
      name: "evolution-agent-v1",
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (k) => {
          try {
            return localStorage.getItem(k);
          } catch {
            return null;
          }
        },
        setItem: (k, v) => {
          try {
            localStorage.setItem(k, v);
          } catch {}
        },
        removeItem: (k) => {
          try {
            localStorage.removeItem(k);
          } catch {}
        },
      })),
      partialize: (s) => ({
        settings: s.settings,
        messages: s.messages,
        keys: s.settings.remember ? s.keys : {},
      }),
    },
  ),
);

const PROBABILITY: Record<DealStage, number> = {
  Nowa: 10,
  Rozmowa: 30,
  Oferta: 60,
  Wygrana: 100,
  Przegrana: 0,
};

function crmData(): WorkspaceData {
  const s = useCrm.getState();
  return {
    firms: s.firms,
    contacts: s.contacts,
    deals: s.deals,
    tasks: s.tasks,
    mails: s.mails,
  };
}

function resolveCompany(companyId?: string, companyName?: string) {
  const firms = useCrm.getState().firms;
  const byId = companyId && firms.find((f) => f.id === companyId);
  if (byId) return byId.id;
  const name = (companyName || companyId || "").trim().toLowerCase();
  const byName =
    name && firms.find((f) => f.name.trim().toLowerCase() === name);
  if (byName) return byName.id;
  return null;
}

export function executeAction(action: AgentAction): string {
  const s = useCrm.getState();
  switch (action.type) {
    case "create_task": {
      const companyId =
        action.companyId || action.companyName
          ? resolveCompany(action.companyId, action.companyName)
          : "";
      if (companyId === null) throw Error("Nie znaleziono wskazanej firmy.");
      s.saveTask({
        id: newId(),
        companyId,
        title: action.title,
        date: action.date,
        done: false,
      });
      return `Dodano zadanie „${action.title}” na ${action.date}.`;
    }
    case "complete_task": {
      const task = s.tasks.find((t) => t.id === action.taskId);
      if (!task) throw Error("Zadanie nie istnieje.");
      s.saveTask({ ...task, done: true });
      return `Oznaczono „${task.title}” jako wykonane.`;
    }
    case "create_company": {
      const existing = resolveCompany(undefined, action.name);
      if (existing)
        return `Firma „${action.name}” już istnieje — pominięto duplikat.`;
      s.saveFirm({
        id: newId(),
        name: action.name,
        nip: "",
        city: action.city ?? "",
        industry: action.industry ?? "",
        website: action.website ? safeWebsite(action.website) : "",
        notes: action.notes ?? "",
        created: today(),
      });
      return `Dodano firmę „${action.name}”.`;
    }
    case "create_contact": {
      const companyId = resolveCompany(action.companyId, action.companyName);
      if (!companyId) throw Error("Kontakt wymaga istniejącej firmy.");
      if (
        s.contacts.some(
          (c) => c.email.toLowerCase() === action.email.toLowerCase(),
        )
      )
        return `Kontakt ${action.email} już istnieje — pominięto duplikat.`;
      s.saveContact({
        id: newId(),
        companyId,
        name: action.name,
        email: action.email,
        role: action.role ?? "",
        phone: action.phone ?? "",
        consent: false,
      });
      return `Dodano kontakt ${action.name}.`;
    }
    case "create_deal": {
      const companyId = resolveCompany(action.companyId, action.companyName);
      if (!companyId) throw Error("Szansa wymaga istniejącej firmy.");
      s.saveDeal({
        id: newId(),
        companyId,
        name: action.name,
        value: action.value,
        stage: action.stage,
        probability: action.probability ?? PROBABILITY[action.stage],
        closeDate: action.closeDate,
      });
      return `Dodano szansę „${action.name}”.`;
    }
    case "update_deal": {
      const deal = s.deals.find((d) => d.id === action.dealId);
      if (!deal) throw Error("Szansa nie istnieje.");
      const stage = action.stage ?? deal.stage;
      s.saveDeal({
        ...deal,
        stage,
        value: action.value ?? deal.value,
        probability:
          action.probability ??
          (action.stage && ["Wygrana", "Przegrana"].includes(stage)
            ? PROBABILITY[stage]
            : deal.probability),
        closeDate: action.closeDate ?? deal.closeDate,
      });
      return `Zaktualizowano „${deal.name}”.`;
    }
    case "draft_email": {
      const contact = s.contacts.find((c) => c.id === action.contactId);
      if (!contact) throw Error("Kontakt nie istnieje.");
      s.saveMail({
        id: newId(),
        contactId: contact.id,
        to: contact.email,
        subject: action.subject,
        body: action.body,
        status: "draft",
        created: new Date().toISOString(),
        agent: true,
      });
      return `Zapisano szkic do ${contact.name} w Poczcie.`;
    }
    case "generate_report": {
      const data = generateReport(
        crmData(),
        action.kind,
        action.preset,
        today(),
      );
      s.saveReport({
        id: newId(),
        created: new Date().toISOString(),
        source: "agent",
        data,
      });
      return `Wygenerowano „${data.title}” (${data.period.label}).`;
    }
    case "schedule_job": {
      if (s.automation.jobs.length >= 30)
        throw Error("Limit 30 zadań harmonogramu.");
      const job = newJob(
        {
          ...action,
          prompt: action.prompt ?? "",
        },
        newId(),
      );
      s.saveJob(job);
      return `Dodano do harmonogramu: „${job.name}”.`;
    }
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  if (!isCloud()) return {};
  try {
    const { browserSupabase, configured } =
      await import("@/lib/supabase/browser");
    if (!configured()) return {};
    const session = (await browserSupabase().auth.getSession()).data.session;
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
}

export async function agentStatus() {
  const r = await fetch("/api/agent", {
    cache: "no-store",
    headers: await authHeaders(),
  });
  if (!r.ok) throw Error("Nie udało się odczytać statusu agenta.");
  return (await r.json()) as {
    trusted: boolean;
    localhost: boolean;
    server: { openrouter: boolean; openai: boolean; local: boolean };
    cli: { enabled: boolean; codex: boolean; claude: boolean };
  };
}

export async function agentModels(provider: "openrouter" | "openai" | "local") {
  const key =
    provider === "local" ? undefined : useAgent.getState().keys[provider];
  const r = await fetch(`/api/agent?models=${provider}`, {
    cache: "no-store",
    headers: { ...(await authHeaders()), ...(key ? { "x-ai-key": key } : {}) },
  });
  const result = await r.json();
  if (!r.ok) throw Error(result.error || "Nie udało się pobrać modeli.");
  return result.models as { id: string; name: string }[];
}

export async function runAgent(
  prompt: string,
  options: { source?: "chat" | "job"; autopilot?: boolean } = {},
) {
  const agent = useAgent.getState();
  const { provider, model } = agent.settings;
  const crm = useCrm.getState();
  const data = crmData();
  const day = today();
  let reply: { answer: string; actions: AgentAction[]; rejected: string[] };
  let error = false;
  try {
    if (provider === "builtin") {
      reply = parseCopilotReply(
        builtinCopilot(prompt, data, day, crm.businessMode),
      );
    } else {
      const history = (agent.messages[agent.workspace] ?? [])
        .slice(-3)
        .flatMap((m) => [
          { role: "user", content: m.prompt },
          { role: "assistant", content: m.answer },
        ]);
      const key =
        provider === "openrouter" || provider === "openai"
          ? agent.keys[provider]
          : undefined;
      const r = await fetch("/api/agent", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
          ...(key ? { "x-ai-key": key } : {}),
        },
        body: JSON.stringify({
          provider,
          model,
          prompt,
          history,
          context: copilotContext(data, day, {
            automation: crm.automation,
            businessMode: crm.businessMode,
            brand: crm.brand,
          }),
        }),
      });
      const result = await r
        .json()
        .catch(() => ({ error: `HTTP ${r.status}` }));
      if (!r.ok) throw Error(result.error || "Agent nie odpowiedział.");
      reply = result;
    }
  } catch (e) {
    error = true;
    const fallback = parseCopilotReply(
      builtinCopilot(prompt, data, day, crm.businessMode),
    );
    reply = {
      answer: `> ⚠️ ${e instanceof Error ? e.message : "Błąd dostawcy AI."} Odpowiada wbudowany agent offline.\n\n${fallback.answer}`,
      actions: fallback.actions,
      rejected: [],
    };
  }
  const message: CopilotMessage = {
    id: newId(),
    prompt,
    answer: reply.answer,
    provider: error ? "builtin" : provider,
    model: error ? defaultModels.builtin : model,
    at: new Date().toISOString(),
    source: options.source ?? "chat",
    actions: reply.actions.map((action) => ({
      id: newId(),
      action,
      status: "pending",
    })),
    rejected: reply.rejected?.length ? reply.rejected : undefined,
    error,
  };
  agent.push(message);
  if ((options.autopilot ?? agent.settings.autopilot) && !agent.readOnly)
    for (const a of message.actions) decideAction(message.id, a.id, true);
  const state = useAgent.getState();
  return (
    (state.messages[state.workspace] ?? []).find((m) => m.id === message.id) ??
    message
  );
}

export function decideAction(
  messageId: string,
  actionId: string,
  approve: boolean,
) {
  const agent = useAgent.getState();
  const message = (agent.messages[agent.workspace] ?? []).find(
    (m) => m.id === messageId,
  );
  const item = message?.actions.find((a) => a.id === actionId);
  if (!item || item.status !== "pending") return;
  if (!approve) {
    agent.patchAction(messageId, actionId, { status: "rejected" });
    return;
  }
  if (agent.readOnly) {
    agent.patchAction(messageId, actionId, {
      status: "failed",
      result: "Brak uprawnień do zapisu.",
    });
    return;
  }
  try {
    agent.patchAction(messageId, actionId, {
      status: "executed",
      result: executeAction(item.action),
    });
  } catch (e) {
    agent.patchAction(messageId, actionId, {
      status: "failed",
      result: e instanceof Error ? e.message : "Nie udało się wykonać.",
    });
  }
}

export function actionLabel(action: AgentAction) {
  return describeAction(action, crmData());
}

export async function summarizeReport(markdown: string) {
  const agent = useAgent.getState();
  const { provider, model } = agent.settings;
  if (provider === "builtin") return null;
  const key =
    provider === "openrouter" || provider === "openai"
      ? agent.keys[provider]
      : undefined;
  const r = await fetch("/api/agent", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
      ...(key ? { "x-ai-key": key } : {}),
    },
    body: JSON.stringify({
      provider,
      model,
      prompt:
        "Napisz zwięzłe podsumowanie zarządcze tego raportu (maks. 8 zdań): co poszło dobrze, co wymaga uwagi i 3 konkretne działania na kolejny okres. Nie proponuj akcji.",
      context: markdown.slice(0, 60000),
    }),
  });
  const result = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw Error(result.error || "Agent nie odpowiedział.");
  return String(result.answer).slice(0, 20000);
}
