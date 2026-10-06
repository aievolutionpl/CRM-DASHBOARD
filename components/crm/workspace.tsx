"use client";
import { isSqlite } from "@/lib/growth/model";
import LeadHub from "../leads/hub";
import Brain from "../local/brain";
import Connectors from "../local/connectors";
import Marketing from "../local/marketing";
import AiAgent from "../local/agent";
import LocalUnavailable from "../local/unavailable";
import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import { useCrm } from "@/stores/crm-store";
import { today, type Section, type Contact, type Mail } from "@/lib/crm/model";
import { Icon, Modal } from "./ui";
import EntityForm, { type Editor } from "./forms";
import Firms from "./firms";
import { Dashboard, Deals, Contacts, Tasks, type ViewProps } from "./views";
import { Mailbox, Composer, Agent, type MailStatus } from "./mail";
import Settings from "./settings";
import ServiceDashboard from "../services/dashboard";
import ServiceClients from "../services/clients";
import ServiceJobs from "../services/jobs";
import JobForm from "../services/job-form";
import type { Deal } from "@/lib/crm/model";
import Onboarding from "./onboarding";
import CommandCenter from "./command-center";
const NAV: { id: Section; title: string; description: string }[] = [
  {
    id: "dashboard",
    title: "Pulpit",
    description: "Twoja sprzedaż w jednym miejscu.",
  },
  {
    id: "leads",
    title: "Lead Hub",
    description: "Jeden kontakt, źródła i pełna historia współpracy.",
  },
  {
    id: "companies",
    title: "Firmy",
    description: "Poznaj klientów i uporządkuj współpracę.",
  },
  {
    id: "deals",
    title: "Szanse sprzedaży",
    description: "Każdy dobry kontakt ma swój kolejny krok.",
  },
  {
    id: "contacts",
    title: "Kontakty",
    description: "Ludzie, z którymi budujesz relacje.",
  },
  {
    id: "tasks",
    title: "Zadania",
    description: "Plan, który zamienia rozmowy w działanie.",
  },
  {
    id: "mail",
    title: "Poczta",
    description: "Krótkie wiadomości. Dobre rozmowy.",
  },
  {
    id: "agent",
    title: "Agent follow-up",
    description: "Asystent, który pomaga wrócić do kontaktu.",
  },
  {
    id: "brain",
    title: "Company Brain",
    description: "Wiedza firmy w notatkach Markdown i linkach.",
  },
  {
    id: "connectors",
    title: "Konektory",
    description: "Połączenia, importy i stan źródeł danych.",
  },
  {
    id: "ai",
    title: "AI Brain",
    description: "Twój agent, model i propozycje do zatwierdzenia.",
  },
  {
    id: "settings",
    title: "Ustawienia",
    description: "Poczta, podpis i kopie Twoich danych.",
  },
];
export default function Workspace({
  cloud,
  storageBusy,
  reloadDatabase,
}: {
  cloud?: {
    id?: string;
    storage?: "sqlite" | "supabase";
    name: string;
    readOnly: boolean;
  };
  storageBusy?: boolean;
  reloadDatabase?: () => void;
}) {
  const cloudName = cloud?.name;
  const readOnly = cloud?.readOnly;
  const s = useCrm();
  const serviceMode = s.businessMode === "services";
  const navigation = NAV.map((n) =>
    serviceMode && n.id === "companies"
      ? {
          ...n,
          title: "Klienci",
          description: "Kontakt, ustalenia i historia współpracy.",
        }
      : serviceMode && n.id === "deals"
        ? {
            ...n,
            title: "Zlecenia",
            description: "Zarezerwowane prace, terminy i realizacje.",
          }
        : serviceMode && n.id === "dashboard"
          ? { ...n, description: "Twoi klienci i plan pracy w jednym miejscu." }
          : n,
  );
  const [jobEditor, setJobEditor] = useState<{
    item?: Deal;
    companyId?: string;
  } | null>(null);
  const openJob = (item?: Deal, companyId?: string) =>
    setJobEditor({ item, companyId });
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState<Section>("dashboard");
  const [agentPrompt, setAgentPrompt] = useState<{
    text: string;
    at: number;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem("evolution-nav-collapsed") || "[]",
      );
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const toggleGroup = (id: string) =>
    setCollapsed((list) => {
      const next = list.includes(id)
        ? list.filter((x) => x !== id)
        : [...list, id];
      try {
        localStorage.setItem("evolution-nav-collapsed", JSON.stringify(next));
      } catch {}
      return next;
    });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [composer, setComposer] = useState<{
    contact?: Contact;
    mail?: Mail;
  } | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<MailStatus>({
    configured: false,
    verified: false,
  });
  const search = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback(
    (text: string) => {
      setNotice(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(""), 7000);
    },
    [setNotice],
  );
  useEffect(() => {
    let active = true;
    Promise.resolve(cloudName ? undefined : useCrm.persist.rehydrate())
      .then(() => {
        if (!active) return;
        const current = useCrm.getState();
        for (const m of current.mails)
          if (m.status === "sending")
            current.saveMail({
              ...m,
              status: "failed",
              error:
                "Poprzednia wysyłka nie została potwierdzona. Ponowienie wykorzysta ten sam identyfikator.",
            });
        setReady(true);
        setOnboarding(!readOnly && !current.onboarded);
      })
      .catch(() => {
        if (active) {
          setReady(true);
          notify(
            "Nie udało się odczytać zapisu. Sprawdź ustawienia pamięci przeglądarki.",
          );
        }
      });
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [notify, cloudName, readOnly]);
  useEffect(() => {
    const storage = () => {
      setStorageWarning(true);
      notify(
        "Pamięć przeglądarki jest pełna lub niedostępna. Zmiana nie została trwale zapisana — pobierz kopię w Ustawieniach.",
      );
    };
    const keyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("crm-storage-error", storage);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("crm-storage-error", storage);
      window.removeEventListener("keydown", keyboard);
    };
  }, [notify]);
  useEffect(() => {
    fetch("/api/mail/status")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((result) =>
        setStatus({ configured: result.configured === true, verified: false }),
      )
      .catch(() =>
        setStatus({
          configured: false,
          verified: false,
          error: "Nie udało się odczytać statusu poczty.",
        }),
      );
  }, []);
  const navigate = (target: Section) => {
    setSection(target);
    setQuery("");
    setNavOpen(false);
  };
  const askAgent = (text: string) => {
    if (isSqlite() && cloud?.id) {
      setAgentPrompt({ text, at: Date.now() });
      navigate("ai");
    } else {
      notify(
        "Agent AI analizuje dane w lokalnej bazie SQLite. Uruchom aplikację poleceniem npm run dev:localdb.",
      );
      navigate("agent");
    }
  };
  const compose = (contact?: Contact) => {
    setSection("mail");
    setComposer({ contact });
  };
  const props: ViewProps = {
    query,
    edit: setEditor,
    notify,
    navigate,
    compose,
    ask: askAgent,
  };
  const current = navigation.find((n) => n.id === section)!;
  const overdue = s.tasks.filter((t) => !t.done && t.date < today()).length;
  const badges: Partial<Record<Section, { text: string; tone?: string }>> = {
    companies: { text: String(s.firms.length) },
    deals: {
      text: String(
        s.deals.filter((d) =>
          d.service
            ? ["booked", "in_progress"].includes(d.service.status)
            : !["Wygrana", "Przegrana"].includes(d.stage),
        ).length,
      ),
    },
    contacts: { text: String(s.contacts.length) },
    tasks: overdue
      ? { text: String(overdue), tone: "alert" }
      : { text: String(s.tasks.filter((t) => !t.done).length) },
    ai: { text: "AI", tone: "ai" },
    agent: { text: "AGENT", tone: "mini" },
  };
  const groups: { id: string; label: string; items: Section[] }[] = [
    { id: "start", label: "START", items: ["dashboard", "leads"] },
    {
      id: "sales",
      label: serviceMode ? "KLIENCI I REALIZACJE" : "SPRZEDAŻ",
      items: ["companies", "deals", "contacts", "tasks"],
    },
    { id: "ai", label: "AI I KOMUNIKACJA", items: ["ai", "agent", "mail"] },
    { id: "data", label: "DANE I WIEDZA", items: ["connectors", "brain"] },
  ];
  const icons: Partial<Record<Section, string>> = {
    leads: "target",
    ai: "sparkles",
    agent: "message",
    brain: "brain",
    connectors: "plug",
  };
  const navButton = (id: Section) => {
    const n = navigation.find((x) => x.id === id)!;
    const badge = badges[id];
    return (
      <button
        key={id}
        aria-label={n.title}
        className={`crm-nav-item ${section === id ? "active" : ""}`}
        onClick={() => navigate(id)}
        aria-current={section === id ? "page" : undefined}
      >
        <Icon name={icons[id] ?? id} />
        <span>{n.title}</span>
        {badge &&
          (badge.tone === "mini" ? (
            <span className="crm-mini-badge">{badge.text}</span>
          ) : (
            <small className={badge.tone ? `crm-nav-${badge.tone}` : ""}>
              {badge.text}
            </small>
          ))}
      </button>
    );
  };
  const nav = (
    <>
      <div className="crm-brand">
        <Image
          src="/assets/brand/evolution-mark.png"
          alt=""
          width={40}
          height={40}
        />
        <div>
          <strong>
            Evolution
            <br />
            <span>Growth OS</span>
          </strong>
          <small>AI EVOLUTION POLSKA</small>
        </div>
      </div>
      <div className="crm-workspace-card">
        <div className="crm-workspace-label">
          <span className="crm-workspace-dot" />
          <span className="min-w-0 flex-1 truncate">
            {cloud?.name || "Mój obszar pracy"}
          </span>
          <Icon name="check" size={13} />
        </div>
        <label className="growth-mode-switch">
          Sposób pracy
          <select
            aria-label="Tryb pracy"
            value={s.businessMode}
            disabled={readOnly || storageBusy}
            onChange={(e) => {
              s.setBusinessMode(e.target.value as "crm" | "services");
              navigate("dashboard");
            }}
          >
            <option value="crm">CRM · sprzedaż B2B</option>
            <option value="services">Firma usługowa</option>
          </select>
        </label>
      </div>
      <nav aria-label="Menu główne" className="crm-nav">
        {groups.map((g) => {
          const open = !collapsed.includes(g.id);
          return (
            <div key={g.id} className="crm-nav-group">
              <button
                type="button"
                className="crm-nav-caption"
                aria-expanded={open}
                onClick={() => toggleGroup(g.id)}
              >
                {g.label}
                <Icon name="chevron" size={12} />
              </button>
              {open && g.items.map(navButton)}
            </div>
          );
        })}
      </nav>
      <div className="crm-sidebar-bottom">
        <button
          type="button"
          className="crm-sidebar-promo"
          onClick={() => navigate(isSqlite() && cloud?.id ? "ai" : "agent")}
        >
          <span className="crm-sidebar-promo-icon">
            <Icon name="sparkles" size={18} />
          </span>
          <span>
            <strong>Evolution Agent</strong>
            <span>Analiza i plan działania</span>
          </span>
          <Icon name="arrow" size={15} />
        </button>
        <button
          className={`crm-nav-item ${section === "settings" ? "active" : ""}`}
          aria-label="Ustawienia"
          onClick={() => navigate("settings")}
        >
          <Icon name="settings" />
          <span>Ustawienia</span>
        </button>
        <button
          className="crm-nav-item"
          onClick={() => {
            setNavOpen(false);
            setOnboarding(true);
          }}
        >
          <Icon name="help" />
          <span>Jak to działa?</span>
        </button>
        <div className="crm-local-label">
          <span />
          {cloud
            ? isSqlite()
              ? "Tryb lokalny · SQLite"
              : "Tryb chmurowy · Supabase"
            : "Tryb lokalny · Twoja przeglądarka"}
        </div>
      </div>
    </>
  );
  if (!ready)
    return (
      <main className="crm-loading" role="status">
        <Icon name="spark" size={32} />
        <p>Przygotowujemy Twój obszar pracy…</p>
      </main>
    );
  return (
    <div className="crm">
      <aside className="crm-sidebar">{nav}</aside>
      <div className="crm-main">
        <header className="crm-topbar">
          <div className="crm-breadcrumb">
            <button
              className="crm-icon-button crm-mobile-only"
              aria-label="Otwórz nawigację"
              onClick={() => setNavOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Obszar pracy</span>
            <span>/</span>
            <strong>{current.title}</strong>
          </div>
          <div className="crm-topbar-right">
            <span className="crm-save-status">
              <span />
              {cloud
                ? isSqlite()
                  ? "Baza SQLite"
                  : "Baza Supabase"
                : "Zapis w przeglądarce"}
            </span>
            <button
              className="crm-icon-button"
              aria-label="Otwórz przewodnik"
              onClick={() => setOnboarding(true)}
            >
              <Icon name="help" />
            </button>
            <button
              className="crm-user"
              onClick={() => navigate("settings")}
              aria-label="Ustawienia mojego obszaru"
            >
              AE
            </button>
          </div>
        </header>
        <main className="crm-content" inert={readOnly && section !== "leads"}>
          <div className="crm-page-heading">
            <div>
              <span className="crm-eyebrow">EVOLUTION GROWTH OS</span>
              <h1>{current.title}</h1>
              <p>{current.description}</p>
            </div>
            <div className="crm-search">
              <Icon name="search" size={18} />
              <input
                ref={search}
                aria-label="Szukaj w CRM"
                placeholder={
                  section === "leads"
                    ? "Szukaj leadów, źródeł i kampanii…"
                    : serviceMode
                      ? "Szukaj klientów i prac…"
                      : "Szukaj w CRM…"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>
          </div>
          {storageWarning && (
            <div className="crm-alert error" role="alert">
              Zapis lokalny wymaga uwagi: nie udało się odczytać lub zapisać
              danych. Pobierz kopię JSON w Ustawieniach przed zamknięciem
              aplikacji.
            </div>
          )}
          {query && ["dashboard", "agent", "settings"].includes(section) && (
            <div className="crm-card crm-search-results">
              <h3>Wyniki wyszukiwania</h3>
              {[
                ...s.firms
                  .filter((f) =>
                    f.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((f) => ({
                    id: f.id,
                    name: f.name,
                    label: serviceMode ? "Klient" : "Firma",
                    open: () => setEditor({ kind: "firm", item: f }),
                  })),
                ...s.contacts
                  .filter((c) =>
                    `${c.name} ${c.email}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((c) => ({
                    id: c.id,
                    name: c.name,
                    label: "Kontakt",
                    open: () => setEditor({ kind: "contact", item: c }),
                  })),
                ...s.deals
                  .filter((d) =>
                    d.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((d) => ({
                    id: d.id,
                    name: d.name,
                    label: d.service ? "Zlecenie" : "Szansa",
                    open: () =>
                      d.service
                        ? openJob(d)
                        : setEditor({ kind: "deal", item: d }),
                  })),
              ]
                .slice(0, 10)
                .map((item) => (
                  <button key={item.id} onClick={item.open}>
                    {item.name}
                    <small>{item.label}</small>
                  </button>
                ))}
              <p className="crm-muted">
                Wyświetlamy do 10 wyników. Pełne filtrowanie znajdziesz w
                odpowiednim module.
              </p>
            </div>
          )}
          {section === "leads" &&
            (cloud?.id ? (
              <LeadHub
                wid={cloud.id}
                query={query}
                readOnly={!!readOnly}
                notify={notify}
              />
            ) : (
              <section className="crm-card p-6">
                <h2>Lead Hub potrzebuje bazy</h2>
                <p className="mt-4! text-sm leading-relaxed">
                  Uruchom lokalną edycję SQLite lub skonfiguruj Supabase, aby
                  zapisywać leady i ich historię. Dotychczasowy CRM pozostaje w
                  tej przeglądarce.
                </p>
                <p className="mt-4! text-sm">
                  <code>npm run dev:localdb</code> · Instrukcja w README
                  repozytorium.
                </p>
              </section>
            ))}
          {section === "dashboard" && !query && (
            <CommandCenter
              navigate={navigate}
              askAgent={askAgent}
              serviceMode={serviceMode}
            />
          )}
          {section === "dashboard" && !serviceMode && (
            <>
              {isSqlite() && cloud?.id && (
                <Marketing
                  wid={cloud.id}
                  openConnectors={() => navigate("connectors")}
                />
              )}
              <Dashboard {...props} />
            </>
          )}{" "}
          {section === "dashboard" && serviceMode && (
            <>
              <ServiceDashboard openJob={openJob} navigate={navigate} />
              {isSqlite() && cloud?.id && (
                <details className="crm-card mt-6 p-6">
                  <summary className="cursor-pointer font-semibold">
                    Wyniki marketingu, Google i kampanii
                  </summary>
                  <div className="mt-5">
                    <Marketing
                      wid={cloud.id}
                      openConnectors={() => navigate("connectors")}
                    />
                  </div>
                </details>
              )}
            </>
          )}
          {["brain", "connectors", "ai"].includes(section) &&
            (!isSqlite() || !cloud?.id) && <LocalUnavailable />}
          {section === "brain" && isSqlite() && cloud?.id && (
            <Brain wid={cloud.id} openAi={() => navigate("ai")} />
          )}
          {section === "connectors" && isSqlite() && cloud?.id && (
            <Connectors
              wid={cloud.id}
              mailSettings={() => navigate("settings")}
              openAi={() => navigate("ai")}
              openBrain={() => navigate("brain")}
            />
          )}
          {section === "ai" && isSqlite() && cloud?.id && (
            <AiAgent
              wid={cloud.id}
              request={agentPrompt}
              storageBusy={storageBusy}
              onApplied={() => reloadDatabase?.()}
            />
          )}
          {section === "companies" &&
            (serviceMode ? (
              <ServiceClients
                query={query}
                edit={(item) => setEditor({ kind: "firm", item })}
                openJob={openJob}
                notify={notify}
              />
            ) : (
              <Firms {...props} />
            ))}{" "}
          {section === "deals" &&
            (serviceMode ? (
              <ServiceJobs
                query={query}
                openJob={openJob}
                notify={notify}
                openClients={() => navigate("companies")}
              />
            ) : (
              <Deals {...props} />
            ))}{" "}
          {section === "contacts" && <Contacts {...props} />}{" "}
          {section === "tasks" && <Tasks {...props} />}{" "}
          {section === "mail" && (
            <Mailbox
              query={query}
              compose={compose}
              edit={(mail) => setComposer({ mail })}
              notify={notify}
              token={token}
              status={status}
            />
          )}{" "}
          {section === "agent" && (
            <Agent notify={notify} navigate={() => navigate("mail")} />
          )}{" "}
          {section === "settings" && (
            <Settings
              token={token}
              setToken={setToken}
              status={status}
              setStatus={setStatus}
              notify={notify}
              showOnboarding={() => setOnboarding(true)}
            />
          )}
          <footer className="crm-footer">
            <span>Stworzone dla dobrych relacji.</span>
            <span>AI Evolution Polska · PLN · Europe/Warsaw</span>
          </footer>
        </main>
      </div>
      {navOpen && (
        <Modal title="Nawigacja" onClose={() => setNavOpen(false)}>
          <div className="crm-mobile-nav">{nav}</div>
        </Modal>
      )}
      {editor && (
        <EntityForm
          editor={editor}
          serviceMode={serviceMode}
          onClose={() => setEditor(null)}
          onSaved={() =>
            notify(
              cloud
                ? "Zmiany wprowadzone. Sprawdź stan synchronizacji."
                : "Zmiany zapisane w CRM.",
            )
          }
        />
      )}{" "}
      {jobEditor && (
        <JobForm
          {...jobEditor}
          close={() => setJobEditor(null)}
          saved={() =>
            notify("Zlecenie zapisane. Sprawdź stan synchronizacji.")
          }
        />
      )}
      {composer && (
        <Composer
          {...composer}
          onClose={() => setComposer(null)}
          notify={notify}
        />
      )}{" "}
      {onboarding && (
        <Onboarding
          finish={(target) => {
            s.setOnboarded(true);
            setOnboarding(false);
            if (target) navigate(target);
          }}
        />
      )}
      {notice && (
        <div className="crm-toast" role="status">
          <Icon name="help" size={18} />
          <span>{notice}</span>
          <button
            className="crm-icon-button"
            aria-label="Zamknij komunikat"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
