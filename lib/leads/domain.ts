import { randomUUID } from "node:crypto";
import {
  chronological,
  amount,
  emailKey,
  phoneKey,
  LeadError,
  type Lead,
  type LeadInput,
  type LeadBundle,
  type LeadEvent,
  type Json,
} from "./model";
export function newLead(
  wid: string,
  id: string,
  input: LeadInput,
  isDemo = false,
): LeadBundle {
  const now = new Date().toISOString();
  return {
    lead: {
      ...input,
      id,
      workspace_id: wid,
      email_key: emailKey(input.email),
      phone_key: phoneKey(input.phone),
      first_touch_source: input.source,
      last_touch_source: input.source,
      created_at: now,
      updated_at: now,
      revision: 1,
      is_demo: isDemo,
      crm_links: {},
    },
    events: [],
    touchpoints: [],
    conversions: [],
    appointments: [],
    quotes: [],
    jobs: [],
    payments: [],
  };
}
export function addEvent(original: LeadBundle, event: LeadEvent): LeadBundle {
  if (
    event.workspace_id !== original.lead.workspace_id ||
    event.lead_id !== original.lead.id
  )
    throw new LeadError(
      "Zdarzenie nie należy do tej przestrzeni i leada.",
      403,
    );
  if (original.events.some((e) => e.id === event.id)) return original;
  if (original.events.length >= 5000)
    throw new LeadError(
      "Limit 5000 zdarzeń leada. Wykonaj kopię bazy przed archiwizacją.",
    );
  const b: LeadBundle = structuredClone(original);
  b.events = chronological([...b.events, event]);
  b.lead.revenue -= b.payments.reduce((sum, p) => sum + p.amount, 0);
  b.touchpoints = [];
  b.conversions = [];
  b.appointments = [];
  b.quotes = [];
  b.jobs = [];
  b.payments = [];
  for (const event of b.events) {
    const m = event.metadata;
    const common = {
      id: event.id,
      workspace_id: event.workspace_id,
      lead_id: event.lead_id,
      event_id: event.id,
    };
    const str = (key: string, fallback = "") =>
      typeof m[key] === "string" ? String(m[key]).slice(0, 1000) : fallback;
    if (
      [
        "ad_click",
        "page_view",
        "form_submit",
        "phone_call",
        "whatsapp",
        "email",
        "meeting",
      ].includes(event.event_type)
    ) {
      const utm: Record<string, string> = {};
      for (const k of [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
      ])
        if (typeof m[k] === "string") utm[k] = String(m[k]).slice(0, 500);
      b.touchpoints.push({
        ...common,
        source: event.source,
        campaign: str("campaign", b.lead.campaign),
        medium: str("medium", b.lead.medium),
        keyword: str("keyword"),
        landing_page: str("landing_page"),
        utm,
        timestamp: event.timestamp,
      });
      b.lead.first_touch_source = b.touchpoints[0].source;
      b.lead.last_touch_source = b.touchpoints.at(-1)!.source;
    }
    const price = amount(m.amount ?? m.job_value ?? b.lead.estimated_value);
    if (event.event_type === "quote_sent")
      b.quotes.push({
        ...common,
        status: "sent",
        amount: price,
        currency: "PLN",
        created_at: event.timestamp,
        updated_at: event.timestamp,
      });
    if (event.event_type === "quote_accepted") {
      const q = [...b.quotes].reverse().find((q) => q.status === "sent");
      if (q) {
        q.status = "accepted";
        q.updated_at = event.timestamp;
      } else
        b.quotes.push({
          ...common,
          status: "accepted",
          amount: price,
          currency: "PLN",
          created_at: event.timestamp,
          updated_at: event.timestamp,
        });
    }
    if (event.event_type === "booking_created")
      b.appointments.push({
        ...common,
        status: "booked",
        scheduled_at:
          typeof m.scheduled_at === "string"
            ? new Date(m.scheduled_at).toISOString()
            : null,
        created_at: event.timestamp,
      });
    if (
      event.event_type === "job_started" ||
      event.event_type === "job_completed"
    ) {
      const job = [...b.jobs].reverse().find((j) => j.status === "in_progress");
      const status =
        event.event_type === "job_completed" ? "completed" : "in_progress";
      if (job && status === "completed") {
        job.status = status;
        job.amount = price;
        job.updated_at = event.timestamp;
      } else
        b.jobs.push({
          ...common,
          status,
          amount: price,
          currency: "PLN",
          created_at: event.timestamp,
          updated_at: event.timestamp,
        });
    }
    if (event.event_type === "payment_received") {
      b.payments.push({
        ...common,
        amount: amount(m.amount),
        currency: "PLN",
        status: "received",
        timestamp: event.timestamp,
      });
      b.lead.revenue += amount(m.amount);
    }
    const kind =
      (
        {
          form_submit: "lead",
          quote_accepted: "quote",
          booking_created: "booking",
          job_completed: "job",
          payment_received: "payment",
        } as Record<string, string>
      )[event.event_type] ||
      (event.event_type === "status_change" && m.status === "qualified"
        ? "qualified"
        : "");
    if (kind)
      b.conversions.push({
        ...common,
        kind,
        value: ["job", "payment", "quote"].includes(kind) ? price : 0,
        currency: "PLN",
        timestamp: event.timestamp,
      });
  }
  b.lead.revenue = amount(b.lead.revenue, "Revenue po wpłacie");
  b.lead.updated_at = new Date().toISOString();
  return b;
}
export function updateLead(original: LeadBundle, input: LeadInput): LeadBundle {
  let b: LeadBundle = {
    ...structuredClone(original),
    lead: {
      ...original.lead,
      ...input,
      email_key: emailKey(input.email),
      phone_key: phoneKey(input.phone),
      updated_at: new Date().toISOString(),
      revision: original.lead.revision + 1,
    },
  };
  const changed = Object.keys(input).filter(
    (k) =>
      JSON.stringify(input[k as keyof LeadInput]) !==
      JSON.stringify(original.lead[k as keyof LeadInput]),
  );
  if (!b.touchpoints.length) {
    b.lead.first_touch_source = input.source;
    b.lead.last_touch_source = input.source;
  }
  if (changed.length)
    b = addEvent(b, {
      id: randomUUID(),
      workspace_id: b.lead.workspace_id,
      lead_id: b.lead.id,
      event_type:
        input.status !== original.lead.status
          ? "status_change"
          : "lead_updated",
      source: "CRM",
      timestamp: b.lead.updated_at,
      metadata: {
        previous_status: original.lead.status,
        status: input.status,
        changed: changed as Json,
      },
    });
  return b;
}
export function linkCrm(
  original: LeadBundle,
  links: Lead["crm_links"],
): LeadBundle {
  const b: LeadBundle = structuredClone(original);
  b.lead.crm_links = { ...b.lead.crm_links, ...links };
  b.lead.updated_at = new Date().toISOString();
  b.lead.revision = original.lead.revision + 1;
  return addEvent(b, {
    id: randomUUID(),
    workspace_id: b.lead.workspace_id,
    lead_id: b.lead.id,
    event_type: "lead_updated",
    source: "CRM",
    timestamp: b.lead.updated_at,
    metadata: {
      note: "Połączono z CRM: firma, kontakt i szansa sprzedaży.",
      ...Object.fromEntries(
        Object.entries(links).map(([k, v]) => [`crm_${k}`, v ?? ""]),
      ),
    },
  });
}
