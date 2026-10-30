"use client";
import { useState } from "react";
import { useCrm } from "@/stores/crm-store";
import {
  FIRM_STATUSES,
  firmStatusLabels,
  money,
  dateLabel,
  today,
  type Firm,
  type FirmStatus,
  type Contact,
} from "@/lib/crm/model";
import { Icon, Badge, Modal } from "./ui";
import type { Editor } from "./forms";

const TABS = [
  ["overview", "Przegląd"],
  ["contacts", "Kontakty"],
  ["deals", "Szanse"],
  ["tasks", "Zadania"],
  ["activity", "Aktywność"],
] as const;
type Tab = (typeof TABS)[number][0];
const CLOSED = ["Wygrana", "Przegrana"];

export default function FirmDetail({
  firm,
  onClose,
  edit,
  compose,
  remove,
  ask,
}: {
  firm: Firm;
  onClose: () => void;
  edit: (editor: Editor) => void;
  compose: (contact?: Contact) => void;
  remove: () => void;
  ask?: (prompt: string) => void;
}) {
  const s = useCrm();
  const [tab, setTab] = useState<Tab>("overview");
  const [notes, setNotes] = useState(firm.notes);
  const status: FirmStatus = firm.status ?? "lead";
  const contacts = s.contacts.filter((c) => c.companyId === firm.id);
  const deals = s.deals.filter((d) => d.companyId === firm.id);
  const sales = deals.filter((d) => !d.service);
  const open = sales.filter((d) => !CLOSED.includes(d.stage));
  const tasks = s.tasks
    .filter((t) => t.companyId === firm.id)
    .sort(
      (a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date),
    );
  const mails = s.mails
    .filter((m) => contacts.some((c) => c.id === m.contactId))
    .sort((a, b) => b.created.localeCompare(a.created));
  const phone =
    firm.phone || contacts.find((c) => c.phone.trim().length > 4)?.phone;
  const day = today();
  const close = (then: () => void) => {
    onClose();
    then();
  };
  const counts: Record<Tab, number | null> = {
    overview: null,
    contacts: contacts.length,
    deals: deals.length,
    tasks: tasks.filter((t) => !t.done).length,
    activity: mails.length,
  };
  return (
    <Modal title={firm.name} wide onClose={onClose}>
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            Status
            <select
              aria-label="Status firmy"
              value={status}
              onChange={(e) =>
                s.saveFirm({ ...firm, status: e.target.value as FirmStatus })
              }
            >
              {FIRM_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {firmStatusLabels[v]}
                </option>
              ))}
            </select>
          </label>
          <Badge tone="purple">{firm.industry}</Badge>
          {firm.city && (
            <span className="text-sm text-slate-500">{firm.city}</span>
          )}
          {(firm.tags ?? []).map((t) => (
            <span
              key={t}
              className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700"
            >
              #{t}
            </span>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            {phone && (
              <a
                className="crm-button secondary"
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              >
                <Icon name="phone" size={15} />
                Zadzwoń
              </a>
            )}
            {firm.website && (
              <a
                className="crm-button secondary"
                href={firm.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="globe" size={15} />
                Strona
              </a>
            )}
            {ask && (
              <button
                className="crm-button"
                onClick={() =>
                  close(() =>
                    ask(
                      `Przeanalizuj firmę ${firm.name}: szanse, zadania, ryzyka i zaproponuj kolejny krok.`,
                    ),
                  )
                }
              >
                <Icon name="sparkles" size={15} />
                Zapytaj agenta
              </button>
            )}
          </div>
        </div>
        <div
          className="flex max-w-full gap-1 overflow-x-auto border-b border-slate-100"
          role="tablist"
          aria-label="Sekcje firmy"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition ${tab === id ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-violet-700"}`}
              onClick={() => setTab(id)}
            >
              {label}
              {counts[id] !== null && (
                <span className="ml-1.5 rounded-md bg-slate-100 px-1.5 text-[10px] text-slate-600">
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab === "overview" && (
          <div className="grid gap-5">
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [
                  "Otwarte szanse",
                  money(open.reduce((x, d) => x + d.value, 0)),
                ],
                [
                  "Prognoza ważona",
                  money(
                    open.reduce(
                      (x, d) => x + (d.value * d.probability) / 100,
                      0,
                    ),
                  ),
                ],
                [
                  "Wygrane",
                  money(
                    sales
                      .filter((d) => d.stage === "Wygrana")
                      .reduce((x, d) => x + d.value, 0),
                  ),
                ],
                [
                  "Otwarte zadania",
                  String(tasks.filter((t) => !t.done).length),
                ],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="rounded-2xl border border-violet-100 bg-violet-50/40 p-3"
                >
                  <dt className="text-xs text-slate-500">{l}</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-800 tabular-nums">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["NIP", firm.nip || "—"],
                ["Opiekun", firm.owner || "—"],
                ["Źródło pozyskania", firm.source || "—"],
                ["E-mail", firm.email || "—"],
                ["Telefon", firm.phone || "—"],
                ["Adres", firm.address || "—"],
                ["W CRM od", dateLabel(firm.created)],
                ["Strona", firm.website || "—"],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="flex justify-between gap-3 border-b border-slate-50 pb-2"
                >
                  <dt className="text-slate-500">{l}</dt>
                  <dd className="min-w-0 truncate text-right font-medium text-slate-800">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-2">
              <label
                htmlFor={`notes-${firm.id}`}
                className="text-sm font-semibold text-slate-700"
              >
                Notatki
              </label>
              <textarea
                id={`notes-${firm.id}`}
                rows={4}
                maxLength={5000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="crm-button secondary"
                  disabled={notes === firm.notes}
                  onClick={() => s.saveFirm({ ...firm, notes })}
                >
                  Zapisz notatki
                </button>
                <button
                  className="crm-text-button"
                  onClick={() =>
                    close(() => edit({ kind: "firm", item: firm }))
                  }
                >
                  Edytuj firmę
                </button>
                <button
                  className="crm-text-button text-rose-600!"
                  onClick={remove}
                >
                  Usuń firmę
                </button>
              </div>
            </div>
          </div>
        )}
        {tab === "contacts" && (
          <div className="grid gap-2">
            {contacts.map((c) => (
              <div
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-3"
                key={c.id}
              >
                <span className="crm-avatar tone-1">
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm">{c.name}</strong>
                  <small className="block truncate">
                    {[c.role, c.email, c.phone.trim().length > 4 ? c.phone : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
                <button
                  className="crm-button secondary"
                  onClick={() => close(() => compose(c))}
                >
                  Napisz e-mail
                </button>
              </div>
            ))}
            {!contacts.length && (
              <p className="crm-muted text-sm">Brak osób kontaktowych.</p>
            )}
            <button
              className="crm-button secondary justify-self-start"
              onClick={() =>
                close(() => edit({ kind: "contact", companyId: firm.id }))
              }
            >
              <Icon name="plus" size={15} />
              Dodaj kontakt
            </button>
          </div>
        )}
        {tab === "deals" && (
          <div className="grid gap-2">
            {deals.map((d) => (
              <div
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-3"
                key={d.id}
              >
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm">{d.name}</strong>
                  <small>
                    {d.service
                      ? `Zlecenie · ${d.service.start.slice(0, 10)}`
                      : `${d.stage} · ${d.probability}% · zamknięcie ${dateLabel(d.closeDate)}`}
                  </small>
                </div>
                <b className="tabular-nums">{money(d.value)}</b>
                {!d.service && (
                  <button
                    className="crm-icon-button"
                    aria-label={`Edytuj ${d.name}`}
                    onClick={() => close(() => edit({ kind: "deal", item: d }))}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                )}
              </div>
            ))}
            {!deals.length && (
              <p className="crm-muted text-sm">Brak szans sprzedaży.</p>
            )}
            <button
              className="crm-button justify-self-start"
              onClick={() =>
                close(() => edit({ kind: "deal", companyId: firm.id }))
              }
            >
              <Icon name="plus" size={15} />
              Dodaj szansę
            </button>
          </div>
        )}
        {tab === "tasks" && (
          <div className="grid gap-2">
            {tasks.map((t) => (
              <label
                key={t.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-sm ${!t.done && t.date < day ? "border-rose-200 bg-rose-50/50" : "border-slate-100"}`}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => s.saveTask({ ...t, done: !t.done })}
                />
                <span
                  className={`min-w-0 flex-1 ${t.done ? "text-slate-400 line-through" : ""}`}
                >
                  {t.title}
                </span>
                <small
                  className={
                    !t.done && t.date < day
                      ? "font-semibold text-rose-600!"
                      : ""
                  }
                >
                  {dateLabel(t.date)}
                </small>
              </label>
            ))}
            {!tasks.length && (
              <p className="crm-muted text-sm">
                Brak zadań — zaplanuj kolejny krok.
              </p>
            )}
            <button
              className="crm-button secondary justify-self-start"
              onClick={() =>
                close(() => edit({ kind: "task", companyId: firm.id }))
              }
            >
              <Icon name="plus" size={15} />
              Dodaj zadanie
            </button>
          </div>
        )}
        {tab === "activity" && (
          <ol className="grid gap-3 border-l-2 border-violet-100 pl-4">
            {mails.map((m) => (
              <li key={m.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[23px] size-3 rounded-full border-2 border-white bg-violet-500" />
                <strong className="block">{m.subject}</strong>
                <small>
                  {new Date(m.sentAt || m.created).toLocaleString("pl-PL", {
                    timeZone: "Europe/Warsaw",
                  })}{" "}
                  · {m.to} ·{" "}
                  {m.status === "accepted"
                    ? "wysłano"
                    : m.status === "external"
                      ? "w programie pocztowym"
                      : m.status === "failed"
                        ? "błąd wysyłki"
                        : "szkic"}
                  {m.agent ? " · agent" : ""}
                </small>
              </li>
            ))}
            {!mails.length && (
              <li className="crm-muted text-sm">
                Brak wiadomości do kontaktów tej firmy.
              </li>
            )}
          </ol>
        )}
      </div>
    </Modal>
  );
}
