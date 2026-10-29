import { randomUUID } from "node:crypto";
import {
  sameEvent,
  parseLead,
  parseEvent,
  parseFilters,
  object,
  uuid,
  emailKey,
  phoneKey,
  resolveIdentity,
  LeadError,
} from "./model";
import { newLead, addEvent, updateLead, linkCrm } from "./domain";
import { demoLead } from "./demo";
import type { LeadRepository } from "./repository";
const response = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function leadHandler(
  request: Request,
  wid: string,
  path: string[],
  body: unknown,
  repo: LeadRepository,
) {
  try {
    if (!uuid(wid)) throw new LeadError("Nieprawidłowa przestrzeń.");
    const lid = path[0];
    if (request.method === "GET") {
      if (lid) {
        if (!uuid(lid) || path.length !== 1)
          throw new LeadError("Nieprawidłowy lead.");
        return response(await repo.read(wid, lid));
      }
      return response(
        await repo.list(wid, parseFilters(new URL(request.url).searchParams)),
      );
    }
    const v = object(body);
    if (request.method === "POST" && lid === "demo" && path.length === 1) {
      const demo = demoLead(wid),
        found = resolveIdentity(
          await repo.identity(wid, demo.lead.email_key, ""),
          demo.lead.email,
          "",
        );
      if (found && !found.is_demo)
        throw new LeadError(
          "Adres przykładu DEMO jest już używany przez rzeczywisty rekord. Nie nadpisano danych.",
          409,
        );
      const result = found
        ? { lead: found, duplicate: true }
        : await repo.write(wid, demo, 0, true);
      return response(result, result.duplicate ? 200 : 201);
    }
    if (!lid && request.method === "POST") {
      const input = parseLead(v),
        id = v.id ?? randomUUID();
      if (!uuid(id)) throw new LeadError("Nieprawidłowy identyfikator leada.");
      const match = resolveIdentity(
        await repo.identity(wid, emailKey(input.email), phoneKey(input.phone)),
        input.email,
        input.phone,
      );
      if (match) return response({ lead: match, duplicate: true });
      let b = newLead(wid, id, input);
      b = addEvent(b, {
        id: randomUUID(),
        workspace_id: wid,
        lead_id: id,
        event_type: "lead_created",
        source: "CRM",
        timestamp: b.lead.created_at,
        metadata: { status: input.status },
      });
      const result = await repo.write(wid, b, 0, true);
      return response(result, result.duplicate ? 200 : 201);
    }
    if (!uuid(lid)) throw new LeadError("Nieprawidłowy identyfikator leada.");
    const current = await repo.read(wid, lid);
    if (
      request.method === "POST" &&
      path.length === 2 &&
      path[1] === "events"
    ) {
      const event = parseEvent(v, wid, lid),
        previous = current.events.find((e) => e.id === event.id);
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
        const context = {
          campaign: current.lead.campaign,
          medium: current.lead.medium,
          keyword: current.lead.keyword,
          landing_page: current.lead.landing_page,
          ...current.lead.utm,
        };
        for (const key of [
          "campaign",
          "medium",
          "keyword",
          "landing_page",
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
        ]) {
          if (event.metadata[key] === undefined)
            event.metadata[key] =
              previous?.metadata[key] ??
              context[key as keyof typeof context] ??
              "";
        }
      }
      if (
        [
          "quote_sent",
          "quote_accepted",
          "job_started",
          "job_completed",
        ].includes(event.event_type) &&
        event.metadata.amount === undefined &&
        event.metadata.job_value === undefined
      )
        event.metadata.amount =
          previous?.metadata.amount ?? current.lead.estimated_value;
      if (previous) {
        if (!sameEvent(previous, event))
          throw new LeadError("Identyfikator zdarzenia ma już inne dane.", 409);
        return response(current);
      }
      if (v.revision !== current.lead.revision)
        throw new LeadError(
          "Konflikt wersji leada. Odśwież szczegóły przed ponownym zapisem.",
          409,
        );
      const next = addEvent(current, event);
      next.lead.revision = current.lead.revision + 1;
      await repo.write(wid, next, current.lead.revision, false);
      return response(await repo.read(wid, lid));
    }
    if (request.method === "POST" && path.length === 2 && path[1] === "crm") {
      if (v.revision !== current.lead.revision)
        throw new LeadError(
          "Konflikt wersji leada. Odśwież szczegóły przed ponownym zapisem.",
          409,
        );
      const raw = object(v.links);
      const links: Record<string, string> = {};
      for (const key of ["company_id", "contact_id", "deal_id"])
        if (raw[key] !== undefined) {
          if (
            typeof raw[key] !== "string" ||
            !/^[\w-]{1,100}$/.test(raw[key] as string)
          )
            throw new LeadError("Nieprawidłowe powiązanie z CRM.");
          links[key] = raw[key] as string;
        }
      if (!links.company_id)
        throw new LeadError("Powiązanie z CRM wymaga firmy lub klienta.");
      await repo.write(
        wid,
        linkCrm(current, links),
        current.lead.revision,
        false,
      );
      return response(await repo.read(wid, lid));
    }
    if (request.method === "PUT" && path.length === 1) {
      if (v.revision !== current.lead.revision)
        throw new LeadError(
          "Konflikt wersji leada. Odśwież szczegóły przed ponownym zapisem.",
          409,
        );
      const input = parseLead(v),
        match = resolveIdentity(
          await repo.identity(
            wid,
            emailKey(input.email),
            phoneKey(input.phone),
          ),
          input.email,
          input.phone,
          lid,
        );
      if (match)
        throw new LeadError(
          "Ten e-mail lub telefon należy do innego leada. Nie połączono rekordów.",
          409,
        );
      await repo.write(
        wid,
        updateLead(current, input),
        current.lead.revision,
        false,
      );
      return response(await repo.read(wid, lid));
    }
    return response({ error: "Nieobsługiwana operacja Lead Hub." }, 405);
  } catch (e) {
    return response(
      { error: e instanceof Error ? e.message : "Błąd Lead Hub." },
      e instanceof LeadError ? e.status : 400,
    );
  }
}
