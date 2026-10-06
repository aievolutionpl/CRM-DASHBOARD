import {
  FIRM_STATUSES,
  DEAL_STAGES,
  validEmail,
  validNip,
  safeWebsite,
  type WorkspaceData,
} from "./model";
import { validateBooking, validateSchedule } from "./services";
function text(v: unknown, max = 1000): v is string {
  return typeof v === "string" && v.length <= max;
}
function date(v: unknown): v is string {
  return (
    text(v, 10) &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
export function parseBackup(source: string): WorkspaceData {
  if (source.length > 5_000_000)
    throw Error("Kopia może mieć maksymalnie 5 MB.");
  const data = JSON.parse(source);
  if (!record(data) || data.version !== 1 || !record(data.data))
    throw Error("Nieobsługiwany format kopii CRM.");
  const d = data.data;
  for (const key of ["firms", "contacts", "deals", "tasks", "mails"])
    if (
      !Array.isArray(d[key]) ||
      d[key].length > 10000 ||
      d[key].some((v: unknown) => !record(v) || !text(v.id, 100) || !v.id)
    )
      throw Error("Nieprawidłowe rekordy w kopii.");
  const { firms, contacts, deals, tasks, mails } =
    d as unknown as WorkspaceData;
  for (const items of [firms, contacts, deals, tasks, mails])
    if (new Set(items.map((v) => v.id)).size !== items.length)
      throw Error("Kopia zawiera powielone identyfikatory.");
  const firmIds = new Set(firms.map((f) => f.id));
  for (const f of firms)
    if (
      !text(f.name, 200) ||
      !f.name.trim() ||
      !text(f.nip, 20) ||
      !validNip(f.nip) ||
      !text(f.city, 100) ||
      !text(f.industry, 100) ||
      !text(f.website, 500) ||
      (f.website && safeWebsite(f.website) !== f.website) ||
      !text(f.notes, 5000) ||
      (f.email !== undefined &&
        (!text(f.email, 254) || (f.email !== "" && !validEmail(f.email)))) ||
      (f.phone !== undefined && !text(f.phone, 50)) ||
      (f.address !== undefined && !text(f.address, 500)) ||
      (f.status !== undefined && !FIRM_STATUSES.includes(f.status)) ||
      (f.owner !== undefined && !text(f.owner, 100)) ||
      (f.source !== undefined && !text(f.source, 100)) ||
      (f.tags !== undefined &&
        (!Array.isArray(f.tags) ||
          f.tags.length > 12 ||
          f.tags.some((t) => !text(t, 40) || !t.trim()))) ||
      !date(f.created)
    )
      throw Error("Nieprawidłowe dane firmy.");
  for (const c of contacts)
    if (
      !firmIds.has(c.companyId) ||
      !text(c.name, 200) ||
      !c.name.trim() ||
      !text(c.email, 254) ||
      !validEmail(c.email) ||
      !text(c.phone, 50) ||
      !text(c.role, 100) ||
      typeof c.consent !== "boolean"
    )
      throw Error("Nieprawidłowe dane kontaktu.");
  for (const deal of deals)
    if (
      !firmIds.has(deal.companyId) ||
      !text(deal.name, 200) ||
      !deal.name.trim() ||
      !Number.isFinite(deal.value) ||
      deal.value < 0 ||
      deal.value > 1e12 ||
      !Number.isFinite(deal.probability) ||
      deal.probability < 0 ||
      deal.probability > 100 ||
      !DEAL_STAGES.includes(deal.stage) ||
      !date(deal.closeDate)
    )
      throw Error("Nieprawidłowe dane szansy.");
  for (const deal of deals)
    if (deal.service !== undefined) validateBooking(deal.service);
  validateSchedule(deals);
  for (const task of tasks)
    if (
      (task.companyId && !firmIds.has(task.companyId)) ||
      !text(task.title, 200) ||
      !task.title.trim() ||
      !date(task.date) ||
      typeof task.done !== "boolean"
    )
      throw Error("Nieprawidłowe zadanie.");
  for (const mail of mails)
    if (
      !text(mail.contactId, 100) ||
      !text(mail.to, 254) ||
      !validEmail(mail.to) ||
      !text(mail.subject, 200) ||
      !text(mail.body, 20000) ||
      !["draft", "sending", "accepted", "failed", "external"].includes(
        mail.status,
      ) ||
      !text(mail.created, 40) ||
      Number.isNaN(Date.parse(mail.created)) ||
      typeof mail.agent !== "boolean" ||
      (mail.error !== undefined && !text(mail.error, 1000)) ||
      (mail.providerId !== undefined && !text(mail.providerId, 200)) ||
      (mail.sentAt !== undefined &&
        (!text(mail.sentAt, 40) || Number.isNaN(Date.parse(mail.sentAt))))
    )
      throw Error("Nieprawidłowa wiadomość.");
  return {
    firms,
    contacts,
    deals,
    tasks,
    mails: mails.map((m) =>
      m.status === "sending" ? { ...m, status: "draft" } : m,
    ),
  };
}
export function downloadFile(
  name: string,
  contents: string,
  mime = "application/json",
) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
