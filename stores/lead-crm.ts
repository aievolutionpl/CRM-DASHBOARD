"use client";
import { cloudRequest } from "@/lib/supabase/browser";
import { id as newId, today } from "@/lib/crm/model";
import { convertLead } from "@/lib/leads/crm";
import { leadName, type LeadBundle, type LeadPage } from "@/lib/leads/model";
import { useCrm } from "./crm-store";
import { assertWorkspace, flushWorkspace } from "./sync";

export async function convertLeadToCrm(
  wid: string,
  leadId: string,
  loaded?: LeadBundle,
) {
  assertWorkspace(wid);
  const bundle: LeadBundle =
    loaded ?? (await cloudRequest(`/${wid}/leads/${leadId}`));
  assertWorkspace(wid);
  const state = useCrm.getState();
  const serviceMode = state.businessMode === "services";
  const result = convertLead(
    bundle.lead,
    state,
    today(),
    { firm: newId(), contact: newId(), deal: newId() },
    serviceMode,
  );
  if (result.firmCreated) state.saveFirm(result.firm);
  if (result.contactCreated && result.contact)
    state.saveContact(result.contact);
  if (result.dealCreated && result.deal) state.saveDeal(result.deal);
  await flushWorkspace(wid);
  const next: LeadBundle = await cloudRequest(`/${wid}/leads/${leadId}/crm`, {
    method: "POST",
    body: JSON.stringify({
      revision: bundle.lead.revision,
      links: result.links,
    }),
  });
  const summary =
    [
      result.firmCreated
        ? `Dodano ${serviceMode ? "klienta" : "firmę"} „${result.firm.name}”`
        : `Połączono z istniejącą firmą „${result.firm.name}”`,
      result.contactCreated ? "kontakt" : "",
      result.dealCreated ? `szansę (${result.deal!.stage})` : "",
    ]
      .filter(Boolean)
      .join(", ") + ` dla leada ${leadName(bundle.lead)}.`;
  return { bundle: next, summary };
}

export async function leadSummary(wid: string) {
  const page: LeadPage = await cloudRequest(
    `/${wid}/leads?${new URLSearchParams({ scope: "real", page: "0" })}`,
  );
  return {
    total: page.total,
    leads: page.leads.slice(0, 30).map((l) => ({
      id: l.id,
      name: leadName(l),
      company: l.company_name || undefined,
      status: l.status,
      source: l.source || undefined,
      campaign: l.campaign || undefined,
      estimatedValue: l.estimated_value,
      revenue: l.revenue,
      inCrm: Boolean(l.crm_links.company_id),
      lastActivity: (l.last_activity_at ?? l.updated_at).slice(0, 10),
    })),
  };
}
