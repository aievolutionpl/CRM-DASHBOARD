"use client";
import { useEffect, useState } from "react";
import { cloudRequest } from "@/lib/supabase/browser";
import {
  LEAD_STATUSES,
  statusLabels,
  leadName,
  type Lead,
  type LeadStatus,
  type LeadBundle,
  type LeadPage,
} from "@/lib/leads/model";
import { Badge, Empty, Icon } from "../crm/ui";
import { downloadFile } from "@/lib/crm/backup";
import { LeadForm, EventForm } from "./forms";
import LeadDetail, { eventDate, leadMoney } from "./detail";
import { useCrm } from "@/stores/crm-store";
import type { Section } from "@/lib/crm/model";
import { convertLeadToCrm } from "@/stores/lead-crm";
export default function LeadHub({
  wid,
  query,
  readOnly,
  notify,
  navigate,
}: {
  wid: string;
  query: string;
  readOnly: boolean;
  notify: (message: string) => void;
  navigate?: (section: Section) => void;
}) {
  const [status, setStatus] = useState<LeadStatus | "">(""),
    [scope, setScope] = useState("real"),
    [page, setPage] = useState(0),
    [refresh, setRefresh] = useState(0),
    [rows, setRows] = useState<LeadPage>({ leads: [], total: 0 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [bundle, setBundle] = useState<LeadBundle | null>(null),
    [detailError, setDetailError] = useState(""),
    [modal, setModal] = useState<"create" | "edit" | "event" | null>(null),
    [demoBusy, setDemoBusy] = useState(false),
    [converting, setConverting] = useState(false);
  const crm = useCrm();
  const serviceMode = crm.businessMode === "services";
  const [previousQuery, setPreviousQuery] = useState(query);
  if (previousQuery !== query) {
    setPreviousQuery(query);
    setPage(0);
  }
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
          search: query,
          status,
          scope,
          page: String(page),
        });
        cloudRequest(`/${wid}/leads?${params}`)
          .then((data) => {
            if (active) setRows(data);
          })
          .catch((e) => {
            if (active) setError(e.message);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      query ? 180 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [wid, query, status, scope, page, refresh]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const timer = setTimeout(() => {
      setDetailError("");
      cloudRequest(`/${wid}/leads/${selected}`)
        .then((data) => {
          if (active) setBundle(data);
        })
        .catch((e) => {
          if (active) setDetailError(e.message);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [wid, selected, refresh]);
  function open(id: string) {
    setBundle(null);
    setDetailError("");
    setSelected(id);
  }
  function saved(lead: Lead, duplicate = false) {
    setModal(null);
    setScope(lead.is_demo ? "demo" : "real");
    setPage(0);
    open(lead.id);
    setRefresh((n) => n + 1);
    notify(
      duplicate
        ? "Ten kontakt już istnieje. Otwarto jego historię; dane nie zostały nadpisane."
        : "Zapisano w Lead Hub.",
    );
  }
  async function demo() {
    setDemoBusy(true);
    try {
      const data = await cloudRequest(`/${wid}/leads/demo`, {
        method: "POST",
        body: "{}",
      });
      saved(data.lead);
      notify(
        data.duplicate
          ? "Otwarto istniejący przykład DEMO."
          : "Dodano przykład DEMO — bez live integracji.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się otworzyć DEMO.");
    } finally {
      setDemoBusy(false);
    }
  }
  async function toCrm() {
    if (!bundle || converting) return;
    setConverting(true);
    try {
      const result = await convertLeadToCrm(wid, bundle.lead.id, bundle);
      setBundle(result.bundle);
      setRefresh((n) => n + 1);
      notify(`${result.summary} Źródło leada zapisano przy szansie.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Nie udało się połączyć z CRM.");
    } finally {
      setConverting(false);
    }
  }
  const links = bundle?.lead.crm_links ?? {};
  const linkedFirm = crm.firms.find((f) => f.id === links.company_id);
  const linkedDeal = crm.deals.find(
    (d) => d.id === links.deal_id || (bundle && d.leadId === bundle.lead.id),
  );
  if (selected)
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            className="crm-button secondary"
            onClick={() => {
              setSelected("");
              setBundle(null);
              setDetailError("");
            }}
          >
            <Icon name="arrow" size={16} />
            Wróć do leadów
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              className="crm-button secondary"
              onClick={() => {
                setBundle(null);
                setRefresh((n) => n + 1);
              }}
            >
              Odśwież kartę
            </button>
            {bundle && (
              <button
                className="crm-text-button"
                onClick={() =>
                  downloadFile(
                    `lead-${bundle.lead.id}.json`,
                    JSON.stringify(
                      { version: 1, type: "lead-hub", ...bundle },
                      null,
                      2,
                    ),
                  )
                }
              >
                <Icon name="download" size={16} />
                Pobierz historię JSON
              </button>
            )}
          </div>
        </div>
        {detailError && (
          <p role="alert" className="crm-alert error">
            {detailError}
          </p>
        )}
        {!bundle && !detailError && (
          <p role="status" className="crm-card p-6">
            Wczytywanie historii leada…
          </p>
        )}
        {bundle && (
          <>
            <section className="crm-welcome">
              <div className="min-w-0">
                <span className="crm-eyebrow">KARTA LEADA</span>
                <h2 className="break-words">{leadName(bundle.lead)}</h2>
                <p>{bundle.lead.company_name || "Kontakt z Twoją firmą"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={bundle.lead.status === "won" ? "green" : "purple"}>
                  {statusLabels[bundle.lead.status]}
                </Badge>
                {bundle.lead.is_demo && <Badge tone="purple">DEMO</Badge>}
              </div>
            </section>
            {bundle.lead.is_demo && (
              <p className="crm-alert">
                DEMO — przykładowy klient i historia. Żadne zdarzenie nie
                pochodzi z rzeczywistego konektora.
              </p>
            )}
            <section className="crm-card flex flex-wrap items-center gap-4 border-violet-200! bg-[linear-gradient(120deg,#fff,var(--brand-50))]! p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
                <Icon name="companies" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm text-slate-800">
                  {linkedFirm
                    ? `W CRM: ${linkedFirm.name}`
                    : "Ten lead nie jest jeszcze w CRM"}
                </strong>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {linkedFirm
                    ? linkedDeal
                      ? `Szansa „${linkedDeal.name}” · ${linkedDeal.stage} · źródło: ${linkedDeal.source || bundle.lead.source || "—"}`
                      : serviceMode
                        ? "Klient i kontakt są w CRM. Zlecenie zarezerwujesz w module Zlecenia."
                        : "Firma jest w CRM. Możesz dodać szansę sprzedaży."
                    : serviceMode
                      ? "Utworzymy klienta i kontakt z danymi, źródłem i notatkami leada."
                      : "Utworzymy firmę, kontakt i szansę sprzedaży z etapem, wartością i źródłem leada — bez duplikatów."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {linkedFirm && navigate && (
                  <button
                    className="crm-button secondary"
                    onClick={() => navigate(linkedDeal ? "deals" : "companies")}
                  >
                    Otwórz w CRM <Icon name="arrow" size={15} />
                  </button>
                )}
                <button
                  className="crm-button"
                  disabled={readOnly || converting}
                  onClick={() => void toCrm()}
                >
                  {converting
                    ? "Łączenie…"
                    : linkedFirm
                      ? "Uzupełnij w CRM"
                      : "Konwertuj do CRM"}
                </button>
              </div>
            </section>
            <LeadDetail
              key={bundle.lead.id}
              bundle={bundle}
              readOnly={readOnly}
              edit={() => setModal("edit")}
              addEvent={() => setModal("event")}
            />
            {modal === "edit" && (
              <LeadForm
                wid={wid}
                lead={bundle.lead}
                close={() => setModal(null)}
                saved={saved}
              />
            )}
            {modal === "event" && (
              <EventForm
                wid={wid}
                lead={bundle.lead}
                close={() => setModal(null)}
                saved={saved}
              />
            )}
          </>
        )}
      </div>
    );
  return (
    <div className="grid gap-6">
      <section className="crm-welcome">
        <div>
          <span className="crm-eyebrow">JEDEN LEAD · PEŁNA HISTORIA</span>
          <h2>Od pierwszego kontaktu do realizacji.</h2>
          <p>Źródła, rozmowy, oferty i płatności przypisane do jednej osoby.</p>
        </div>
        <button
          disabled={readOnly}
          className="crm-button"
          onClick={() => setModal("create")}
        >
          <Icon name="plus" size={18} />
          Dodaj leada
        </button>
      </section>
      <section className="crm-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Status leadów"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as LeadStatus | "");
                setPage(0);
              }}
            >
              <option value="">Wszystkie statusy</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
            <select
              aria-label="Rodzaj danych leadów"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setPage(0);
              }}
            >
              <option value="real">Rzeczywiste leady</option>
              <option value="demo">Tylko DEMO</option>
              <option value="all">Wszystkie dane</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">{rows.total} leadów</span>
            <button
              disabled={loading}
              className="crm-text-button"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Odśwież leady
            </button>
            <button
              disabled={readOnly || demoBusy}
              className="crm-button secondary"
              onClick={demo}
            >
              {demoBusy ? "Zapisywanie DEMO…" : "Dodaj przykład DEMO"}
            </button>
          </div>
        </div>
        <p className="mt-4! text-sm leading-relaxed text-slate-500">
          Dane wpisane ręcznie i zapisane zdarzenia. CRM pozostaje obok;
          kontakty nie są automatycznie przenoszone.
        </p>
      </section>
      {error && (
        <p role="alert" className="crm-alert error">
          {error}
        </p>
      )}
      <section className="crm-card min-w-0 overflow-hidden">
        {loading ? (
          <p role="status" className="p-6 text-slate-600">
            Wczytywanie leadów…
          </p>
        ) : rows.leads.length ? (
          <>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,.95fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,.8fr)_minmax(0,.8fr)] gap-4 border-b border-slate-200/70 bg-violet-50/30 px-6 py-4 text-sm font-medium text-slate-500 lg:grid">
              {[
                "Lead",
                "Status",
                "Źródło",
                "Kampania",
                "Ostatnia aktywność",
                "Wartość",
                "Revenue",
              ].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            {rows.leads.map((l) => (
              <button
                key={l.id}
                aria-label={`Otwórz leada: ${leadName(l)}`}
                className="grid w-full min-w-0 gap-4 border-b border-slate-100 px-6 py-5 text-left transition-colors last:border-b-0 hover:bg-violet-50/50 focus-visible:outline-2 focus-visible:outline-violet-500 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,.95fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,.8fr)_minmax(0,.8fr)]"
                onClick={() => open(l.id)}
              >
                <div className="min-w-0">
                  <strong className="block text-base break-words">
                    {leadName(l)}
                  </strong>
                  <p className="mt-1! truncate text-sm text-slate-500">
                    {l.email ||
                      l.phone ||
                      l.company_name ||
                      "Kontakt do uzupełnienia"}
                  </p>
                  {l.is_demo && <Badge tone="purple">DEMO</Badge>}
                </div>
                <div className="self-start">
                  <Badge
                    tone={
                      l.status === "won"
                        ? "green"
                        : l.status === "lost"
                          ? "red"
                          : "purple"
                    }
                  >
                    {statusLabels[l.status]}
                  </Badge>
                </div>
                <div className="min-w-0 text-sm break-words">
                  <span className="block text-slate-500 lg:hidden">Źródło</span>
                  {l.source || "Nieznane"}
                </div>
                <div className="min-w-0 text-sm break-words">
                  <span className="block text-slate-500 lg:hidden">
                    Kampania
                  </span>
                  {l.campaign || "Nieprzypisana"}
                </div>
                <div className="text-sm">
                  <span className="block text-slate-500 lg:hidden">
                    Ostatnia aktywność
                  </span>
                  {eventDate(l.last_activity_at || l.updated_at)}
                </div>
                <div className="min-w-0 text-sm font-medium break-words">
                  <span className="block font-normal text-slate-500 lg:hidden">
                    Wartość
                  </span>
                  {leadMoney(l.estimated_value)}
                </div>
                <div className="min-w-0 text-sm font-semibold break-words text-emerald-700">
                  <span className="block font-normal text-slate-500 lg:hidden">
                    Revenue
                  </span>
                  {leadMoney(l.revenue)}
                </div>
              </button>
            ))}
          </>
        ) : (
          !error && (
            <Empty
              title="Miejsce na nowy kontakt"
              description="Dodaj leada i jego źródło. Kolejne rozmowy, oferty i realizacje zapiszesz na jednej osi czasu."
              action={
                <button
                  disabled={readOnly}
                  className="crm-button secondary"
                  onClick={() => setModal("create")}
                >
                  Dodaj pierwszego leada
                </button>
              }
            />
          )
        )}
      </section>
      {rows.total > 50 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            disabled={page === 0 || loading}
            className="crm-button secondary"
            onClick={() => setPage((n) => n - 1)}
          >
            Poprzednia strona
          </button>
          <p className="text-sm text-slate-600">
            Strona {page + 1} z {Math.ceil(rows.total / 50)}
          </p>
          <button
            disabled={(page + 1) * 50 >= rows.total || loading}
            className="crm-button secondary"
            onClick={() => setPage((n) => n + 1)}
          >
            Następna strona
          </button>
        </div>
      )}
      {modal === "create" && (
        <LeadForm wid={wid} close={() => setModal(null)} saved={saved} />
      )}
    </div>
  );
}
