import "server-only";
import { randomUUID } from "node:crypto";
import { database, readWorkspace, transaction, audit } from "../local/database";
import { listDocuments } from "../knowledge/repository";
import { marketingRows } from "../integrations/repository";
import { metrics } from "../integrations/marketing";
import { today } from "../crm/model";
import { validateSnapshot } from "../growth/model";
import { parseAnswer, type AgentProvider, type Proposal } from "./model";
import { builtinAnswer } from "./builtin";
import { integrations } from "../integrations/service";
import { leadDatabase } from "../leads/sqlite";
import { insights, monthlyRevenue, pipelineStats } from "../crm/insights";
import { integrationDigest, marketingDigest, type StatsDigest } from "./stats";
import { sourceLabels, type Source } from "../integrations/marketing";
import { providerLabels, type Provider } from "../integrations/model";
import { generate } from "./providers";
function ensure() {
  database().exec(
    "CREATE TABLE IF NOT EXISTS agent_messages(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),prompt TEXT NOT NULL,answer TEXT NOT NULL,provider TEXT NOT NULL,model TEXT NOT NULL,created_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS agent_actions(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),message_id TEXT NOT NULL REFERENCES agent_messages(id),payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',base_revision INTEGER NOT NULL);",
  );
  const columns = database()
    .prepare("PRAGMA table_info(agent_messages)")
    .all()
    .map((c) => String(c.name));
  if (!columns.includes("hidden"))
    database().exec(
      "ALTER TABLE agent_messages ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0",
    );
}
export function clearConversation(wid: string) {
  ensure();
  transaction(() => {
    database()
      .prepare(
        "UPDATE agent_actions SET status='rejected' WHERE workspace_id=? AND status='pending'",
      )
      .run(wid);
    database()
      .prepare("UPDATE agent_messages SET hidden=1 WHERE workspace_id=?")
      .run(wid);
    audit(wid, "agent.cleared");
  });
}
function leadSummary(wid: string): StatsDigest["leads"] {
  try {
    const rows = leadDatabase()
      .prepare(
        "SELECT status,source,estimated_value,revenue FROM leads WHERE workspace_id=? AND is_demo=0",
      )
      .all(wid);
    if (!rows.length) return null;
    const byStatus: Record<string, number> = {};
    const bySource = new Map<string, { count: number; revenue: number }>();
    let pipelineValue = 0,
      revenue = 0;
    for (const r of rows) {
      const status = String(r.status),
        source = String(r.source || "brak");
      byStatus[status] = (byStatus[status] || 0) + 1;
      const s = bySource.get(source) ?? { count: 0, revenue: 0 };
      s.count++;
      s.revenue += Number(r.revenue) || 0;
      bySource.set(source, s);
      if (!["won", "lost"].includes(status))
        pipelineValue += Number(r.estimated_value) || 0;
      revenue += Number(r.revenue) || 0;
    }
    return {
      total: rows.length,
      byStatus,
      bySource: [...bySource.entries()]
        .map(([source, v]) => ({ source, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      pipelineValue,
      revenue,
    };
  } catch {
    return null;
  }
}
export function statsDigest(wid: string): StatsDigest {
  const s = readWorkspace(wid);
  const rows = marketingRows(wid);
  const marketing = marketingDigest(rows, today());
  let extra: ReturnType<typeof integrationDigest> = {
    analytics: [],
    payments: null,
    productEvents: [],
  };
  try {
    const connected = integrations(wid);
    extra = integrationDigest(
      connected.snapshots,
      connected.states.map((x) => ({
        provider: String(x.provider),
        status: String(x.status),
      })),
    );
  } catch {}
  const leads = leadSummary(wid);
  const notes = listDocuments(wid).length;
  const sales = s.data.deals.filter((d) => !d.service).length;
  return {
    sources: [
      {
        id: "crm",
        label: "CRM",
        available: true,
        detail: `${s.data.firms.length} firm, ${sales} szans, ${s.data.tasks.filter((t) => !t.done).length} otwartych zadań`,
      },
      {
        id: "campaigns",
        label: "Kampanie (CSV, Meta Ads)",
        available: marketing.bySource.length > 0,
        detail: marketing.bySource.length
          ? marketing.bySource
              .map((m) => sourceLabels[m.source as Source] ?? m.source)
              .join(", ")
          : "brak danych z 30 dni",
      },
      ...(extra.analytics.length
        ? []
        : [
            {
              id: "analytics",
              label: "Analityka (GA4, Search Console, Plausible)",
              available: false,
              detail: "nie podłączono",
            },
          ]),
      ...extra.analytics.map((a) => ({
        id: a.provider,
        label: providerLabels[a.provider as Provider] ?? a.provider,
        available: true,
        detail: `${a.from} – ${a.to}`,
      })),
      {
        id: "stripe",
        label: "Stripe",
        available: !!extra.payments,
        detail: extra.payments
          ? `${extra.payments.count} płatności`
          : "nie pobrano",
      },
      {
        id: "posthog",
        label: "PostHog",
        available: extra.productEvents.length > 0,
        detail: extra.productEvents.length
          ? `${extra.productEvents.length} typów zdarzeń`
          : "nie pobrano",
      },
      {
        id: "leads",
        label: "Lead Hub",
        available: !!leads,
        detail: leads ? `${leads.total} leadów` : "brak leadów",
      },
      {
        id: "brain",
        label: "Company Brain",
        available: notes > 0,
        detail: `${notes} notatek`,
      },
    ],
    marketing,
    ...extra,
    leads,
  };
}
export function history(wid: string) {
  ensure();
  return database()
    .prepare(
      "SELECT * FROM agent_messages WHERE workspace_id=? AND hidden=0 ORDER BY rowid DESC LIMIT 30",
    )
    .all(wid)
    .reverse()
    .map((m) => ({
      id: String(m.id),
      prompt: String(m.prompt),
      answer: String(m.answer),
      provider: String(m.provider),
      model: String(m.model),
      created_at: String(m.created_at),
      actions: database()
        .prepare(
          "SELECT id,payload,status FROM agent_actions WHERE message_id=? AND workspace_id=?",
        )
        .all(String(m.id), wid)
        .map((a) => ({
          id: String(a.id),
          status: String(a.status),
          payload: JSON.parse(String(a.payload)) as Proposal,
        })),
    }));
}
export function buildContext(wid: string, prompt: string) {
  const s = readWorkspace(wid);
  const terms = prompt
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);
  const score = (d: { title: string; content: string }) =>
    terms.reduce(
      (sum, t) =>
        sum + ((d.title + " " + d.content).toLowerCase().includes(t) ? 1 : 0),
      0,
    );
  const notes = listDocuments(wid)
    .sort(
      (a, b) =>
        Number(b.title.endsWith("COMPANY_BRAIN")) -
          Number(a.title.endsWith("COMPANY_BRAIN")) || score(b) - score(a),
    )
    .slice(0, 5)
    .map((d) => ({
      title: d.title,
      content: d.content.slice(
        0,
        d.title.endsWith("COMPANY_BRAIN") ? 12000 : 2500,
      ),
    }));
  const rows = marketingRows(wid).filter(
    (r) =>
      r.date >=
        new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) &&
      r.date <= today(),
  );
  const stats = statsDigest(wid);
  return {
    revision: s.revision,
    text: JSON.stringify({
      date: today(),
      businessMode: s.settings.businessMode ?? "crm",
      scope:
        "CRM, Lead Hub, importy i odczyty API z ostatnich 30 dni (kampanie, analityka, płatności, zdarzenia) oraz wybrane notatki. Dane z importu nie potwierdzają poprawności trackingu.",
      marketing: metrics(rows),
      crm: {
        pipeline: pipelineStats(s.data),
        monthly: monthlyRevenue(s.data, today()),
        insights: insights(s.data, today()).map((i) => ({
          title: i.title,
          detail: i.detail,
          tone: i.tone,
        })),
      },
      stats: {
        marketing: stats.marketing,
        analytics: stats.analytics,
        payments: stats.payments,
        productEvents: stats.productEvents,
        leads: stats.leads,
        sources: stats.sources.filter((x) => x.available).map((x) => x.label),
      },
      companies: s.data.firms.slice(0, 40).map((f) => ({
        id: f.id,
        name: f.name,
        industry: f.industry,
        status: f.status ?? "lead",
        owner: f.owner || undefined,
        tags: f.tags?.length ? f.tags : undefined,
      })),
      deals: s.data.deals.slice(0, 20).map((d) =>
        d.service
          ? {
              ...d,
              service: { ...d.service, history: d.service.history.slice(-3) },
            }
          : d,
      ),
      tasks: s.data.tasks.filter((t) => !t.done).slice(0, 20),
      notes,
      recentConversation: history(wid)
        .slice(-6)
        .map((m) => ({
          question: String(m.prompt).slice(0, 800),
          answer: String(m.answer).slice(0, 1200),
        })),
    }),
  };
}
export async function ask(
  wid: string,
  provider: AgentProvider,
  model: string,
  prompt: string,
) {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 2000)
    throw Error("Pytanie może mieć 1–2000 znaków.");
  ensure();
  const context = buildContext(wid, prompt),
    result =
      provider === "builtin"
        ? { text: builtinAnswer(prompt, context.text), usage: null }
        : await generate(wid, provider, model, prompt, context.text, {
            history: history(wid)
              .slice(-6)
              .map((m) => ({ question: m.prompt, answer: m.answer })),
          }),
    parsed = parseAnswer(result.text),
    messageId = randomUUID();
  transaction(() => {
    database()
      .prepare(
        "INSERT INTO agent_messages(id,workspace_id,prompt,answer,provider,model,created_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        messageId,
        wid,
        prompt,
        parsed.answer,
        provider,
        model,
        new Date().toISOString(),
      );
    for (const action of parsed.actions) {
      if (
        action.type === "create_task" &&
        !readWorkspace(wid).data.firms.some((f) => f.id === action.companyId)
      )
        throw Error("Model wskazał nieistniejącą firmę.");
      database()
        .prepare(
          "INSERT INTO agent_actions(id,workspace_id,message_id,payload,base_revision) VALUES(?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          wid,
          messageId,
          JSON.stringify(action),
          context.revision,
        );
    }
    audit(wid, "agent.analyzed");
  });
  return { messages: history(wid), usage: result.usage };
}
export function decide(wid: string, id: string, approve: boolean) {
  ensure();
  transaction(() => {
    const row = database()
      .prepare("SELECT * FROM agent_actions WHERE id=? AND workspace_id=?")
      .get(id, wid);
    if (!row || row.status !== "pending")
      throw Error("Propozycja nie jest już oczekująca.");
    if (approve) {
      const current = readWorkspace(wid);
      if (current.revision !== row.base_revision)
        throw Error(
          "Konflikt wersji: CRM zmienił się od analizy. Poproś agenta o nową propozycję.",
        );
      const action = JSON.parse(String(row.payload)) as Proposal;
      if (action.type === "create_task") {
        current.data.tasks.unshift({
          id: randomUUID(),
          companyId: action.companyId,
          title: action.title,
          date: action.date,
          done: false,
        });
        validateSnapshot(current);
        database()
          .prepare(
            "UPDATE workspaces SET snapshot=?,revision=revision+1 WHERE id=?",
          )
          .run(JSON.stringify(current), wid);
        database()
          .prepare(
            "UPDATE agent_actions SET base_revision=? WHERE workspace_id=? AND message_id=? AND status='pending' AND base_revision=?",
          )
          .run(
            current.revision + 1,
            wid,
            String(row.message_id),
            current.revision,
          );
      } else
        database()
          .prepare(
            "INSERT INTO documents(id,workspace_id,title,category,content,updated_at) VALUES(?,?,?,?,?,?)",
          )
          .run(
            randomUUID(),
            wid,
            action.title,
            action.category,
            action.content,
            new Date().toISOString(),
          );
    }
    database()
      .prepare("UPDATE agent_actions SET status=? WHERE id=?")
      .run(approve ? "executed" : "rejected", id);
    audit(wid, approve ? "agent.approved" : "agent.rejected");
  });
}
