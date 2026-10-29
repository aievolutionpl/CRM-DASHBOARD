import {
  validEmail,
  type Contact,
  type Deal,
  type DealStage,
  type Firm,
  type WorkspaceData,
} from "../crm/model";
import { leadName, type Lead, type LeadStatus } from "./model";

export const STAGE_FOR_STATUS: Record<
  LeadStatus,
  { stage: DealStage; probability: number }
> = {
  new: { stage: "Nowa", probability: 10 },
  contacted: { stage: "Rozmowa", probability: 25 },
  qualified: { stage: "Rozmowa", probability: 40 },
  quote: { stage: "Oferta", probability: 60 },
  booked: { stage: "Wygrana", probability: 100 },
  won: { stage: "Wygrana", probability: 100 },
  lost: { stage: "Przegrana", probability: 0 },
};

export type LeadConversion = {
  firm: Firm;
  firmCreated: boolean;
  contact?: Contact;
  contactCreated: boolean;
  deal?: Deal;
  dealCreated: boolean;
  links: { company_id: string; contact_id?: string; deal_id?: string };
};

const same = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("pl-PL") === b.trim().toLocaleLowerCase("pl-PL");

function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function convertLead(
  lead: Lead,
  data: WorkspaceData,
  today: string,
  ids: { firm: string; contact: string; deal: string },
  serviceMode = false,
): LeadConversion {
  const person = leadName(lead) || "Nowy kontakt";
  const firmName = (lead.company_name || person).slice(0, 200);
  const linkedFirm = data.firms.find((f) => f.id === lead.crm_links.company_id);
  const existingFirm =
    linkedFirm ?? data.firms.find((f) => same(f.name, firmName));
  const email = validEmail(lead.email) ? lead.email.trim() : "";
  const firm: Firm = existingFirm ?? {
    id: ids.firm,
    name: firmName,
    nip: "",
    city: "",
    industry: "",
    website: "",
    notes: [
      `Z Lead Hub · źródło: ${lead.source || "nieznane"}${lead.campaign ? ` · kampania: ${lead.campaign}` : ""}`,
      lead.notes,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 5000),
    created: today,
    email: lead.company_name && email ? "" : email,
    phone: lead.company_name && email ? "" : lead.phone.slice(0, 50),
  };
  const linkedContact = data.contacts.find(
    (c) => c.id === lead.crm_links.contact_id,
  );
  const existingContact =
    linkedContact ??
    (email
      ? data.contacts.find(
          (c) => c.companyId === firm.id && same(c.email, email),
        )
      : undefined);
  const contact: Contact | undefined =
    existingContact ??
    (email
      ? {
          id: ids.contact,
          companyId: firm.id,
          name: person.slice(0, 200),
          role: "",
          email,
          phone: lead.phone.slice(0, 50),
          consent: false,
        }
      : undefined);
  const existingDeal = data.deals.find(
    (d) => d.id === lead.crm_links.deal_id || d.leadId === lead.id,
  );
  const mapped = STAGE_FOR_STATUS[lead.status];
  const deal: Deal | undefined =
    existingDeal ??
    (serviceMode
      ? undefined
      : {
          id: ids.deal,
          companyId: firm.id,
          name: (lead.campaign
            ? `${lead.campaign} — ${person}`
            : `Lead: ${person}`
          ).slice(0, 200),
          value: Math.max(0, lead.revenue || lead.estimated_value || 0),
          probability: mapped.probability,
          stage: mapped.stage,
          closeDate: addDays(today, mapped.stage === "Wygrana" ? 0 : 30),
          source: lead.source.slice(0, 100),
          leadId: lead.id,
        });
  return {
    firm,
    firmCreated: !existingFirm,
    contact,
    contactCreated: !!contact && !existingContact,
    deal,
    dealCreated: !!deal && !existingDeal,
    links: {
      company_id: firm.id,
      ...(contact ? { contact_id: contact.id } : {}),
      ...(deal ? { deal_id: deal.id } : {}),
    },
  };
}
