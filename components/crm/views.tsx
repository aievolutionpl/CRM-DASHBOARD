"use client";
import { useState, type ReactNode } from "react";
import { useCrm } from "@/stores/crm-store";
import {
  DEAL_STAGES,
  money,
  dateLabel,
  today,
  type Section,
  type Contact,
  type Deal,
} from "@/lib/crm/model";
import { Icon, Badge, Empty } from "./ui";
import { DonutChart } from "./charts";
import type { Editor } from "./forms";
export type ViewProps = {
  query: string;
  edit: (editor: Editor) => void;
  notify: (text: string) => void;
  navigate: (section: Section) => void;
  compose: (contact?: Contact) => void;
  ask?: (prompt: string) => void;
};
function Tools({ children }: { children: ReactNode }) {
  return <div className="crm-row-tools">{children}</div>;
}
function ChangeButtons({
  edit,
  remove,
  label,
}: {
  edit: () => void;
  remove: () => void;
  label: string;
}) {
  return (
    <Tools>
      <button
        className="crm-icon-button"
        aria-label={`Edytuj ${label}`}
        onClick={edit}
      >
        <Icon name="edit" size={16} />
      </button>
      <button
        className="crm-icon-button danger"
        aria-label={`Usuń ${label}`}
        onClick={remove}
      >
        <Icon name="trash" size={16} />
      </button>
    </Tools>
  );
}
export function Dashboard({ edit, navigate }: ViewProps) {
  const s = useCrm();
  const sales = s.deals.filter((d) => !d.service);
  const totalSalesValue = sales.reduce((sum, d) => sum + d.value, 0);
  const [pipelineMetric, setPipelineMetric] = useState("value");
  const active = sales.filter(
    (d) => !["Wygrana", "Przegrana"].includes(d.stage),
  );
  const won = sales.filter((d) => d.stage === "Wygrana");
  const tasks = s.tasks
    .filter((t) => !t.done)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="crm-eyebrow">SPRZEDAŻ</span>
          <h2 className="mt-1 text-xl!">Dobre relacje. Lepsza sprzedaż.</h2>
        </div>
        <button className="crm-button" onClick={() => edit({ kind: "deal" })}>
          <Icon name="plus" size={18} />
          Dodaj szansę
        </button>
      </div>
      <div className="crm-dashboard-grid growth-analytics-grid">
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h3>Proces sprzedaży</h3>
              <p>Od pierwszej rozmowy do współpracy.</p>
            </div>
            <button
              className="crm-text-button"
              onClick={() => navigate("deals")}
            >
              Zobacz tablicę <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="px-6 pb-3">
            <select
              aria-label="Wskaźnik procesu sprzedaży"
              value={pipelineMetric}
              onChange={(e) => setPipelineMetric(e.target.value)}
            >
              <option value="value">Wartość (PLN)</option>
              <option value="count">Liczba szans</option>
            </select>
          </div>
          <div className="crm-pipeline-chart">
            {DEAL_STAGES.map((stage, i) => {
              const ds = sales.filter((d) => d.stage === stage);
              const stageValue = ds.reduce((sum, d) => sum + d.value, 0);
              const share =
                pipelineMetric === "count"
                  ? sales.length
                    ? ds.length / sales.length
                    : 0
                  : totalSalesValue
                    ? stageValue / totalSalesValue
                    : 0;
              return (
                <div className="crm-chart-row" key={stage}>
                  <span>{stage}</span>
                  <div className="crm-chart-track">
                    <div
                      style={{
                        width: `${share * 100}%`,
                        background: [
                          "#c4b5fd",
                          "#a78bfa",
                          "#7c5cfc",
                          "#20b486",
                          "#e0e4ee",
                        ][i],
                      }}
                    />
                  </div>
                  <b>{money(stageValue)}</b>
                  <small>{ds.length}</small>
                </div>
              );
            })}
          </div>
          <div className="crm-card-foot">
            <span>Prognoza uwzględnia tylko otwarte szanse.</span>
            <Badge tone="purple">PLN</Badge>
          </div>
        </section>
        <section className="crm-card p-6">
          <span className="crm-eyebrow">WYNIK PROCESU SPRZEDAŻY</span>
          <h3 className="mb-5 text-xl!">Jak kończą się rozmowy?</h3>
          <DonutChart
            title="zamkniętych szans"
            items={[
              { label: "Wygrane", value: won.length, color: "#24b995" },
              {
                label: "Przegrane",
                value: sales.filter((d) => d.stage === "Przegrana").length,
                color: "#b3a0ff",
              },
            ]}
          />
          <p className="crm-muted mt-5">
            Udział w liczbie zamkniętych szans. Otwarte rozmowy są widoczne w
            procesie obok.
          </p>
        </section>
      </div>
      <section className="crm-card mb-6">
        <div className="crm-card-header">
          <div>
            <h3>Najbliższe zadania</h3>
            <p>Małe kroki, które robią różnicę.</p>
          </div>
          <button
            className="crm-text-button"
            onClick={() => edit({ kind: "task" })}
          >
            <Icon name="plus" size={16} />
            Dodaj
          </button>
        </div>
        {tasks.length ? (
          tasks.slice(0, 4).map((t) => (
            <div className="crm-task-preview" key={t.id}>
              <input
                type="checkbox"
                aria-label={`Ukończ: ${t.title}`}
                checked={t.done}
                onChange={() => s.saveTask({ ...t, done: true })}
              />
              <div>
                <strong>{t.title}</strong>
                <small>
                  {s.firms.find((f) => f.id === t.companyId)?.name ??
                    "Zadanie własne"}
                </small>
              </div>
              <Badge tone={t.date < today() ? "red" : "neutral"}>
                {t.date === today() ? "Dzisiaj" : dateLabel(t.date)}
              </Badge>
            </div>
          ))
        ) : (
          <Empty
            title="Plan na dziś jest pusty"
            description="Dodaj zadanie lub chwilę odetchnij."
          />
        )}
        <button className="crm-full-link" onClick={() => navigate("tasks")}>
          Wszystkie zadania <Icon name="arrow" size={16} />
        </button>
      </section>
      <section className="crm-agent-banner">
        <div className="crm-agent-symbol">
          <Icon name="agent" size={28} />
        </div>
        <div>
          <Badge tone="purple">AGENT FOLLOW-UP</Badge>
          <h3>Nie zgub dobrego kontaktu.</h3>
          <p>
            Przygotuj spersonalizowane wiadomości i wyślij je po zatwierdzeniu.
          </p>
        </div>
        <button
          className="crm-button secondary"
          onClick={() => navigate("agent")}
        >
          Otwórz agenta <Icon name="arrow" size={17} />
        </button>
      </section>
      <div className="crm-card">
        <div className="crm-card-header">
          <div>
            <h3>Szanse warte uwagi</h3>
            <p>Najbliższe planowane zamknięcia.</p>
          </div>
        </div>
        {active.length ? (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Projekt</th>
                  <th>Firma</th>
                  <th>Etap</th>
                  <th>Wartość</th>
                  <th>Termin</th>
                </tr>
              </thead>
              <tbody>
                {[...active]
                  .sort((a, b) => a.closeDate.localeCompare(b.closeDate))
                  .slice(0, 5)
                  .map((d) => (
                    <tr key={d.id}>
                      <td>
                        <button
                          className="crm-text-button"
                          onClick={() => edit({ kind: "deal", item: d })}
                        >
                          {d.name}
                        </button>
                      </td>
                      <td>{s.firms.find((f) => f.id === d.companyId)?.name}</td>
                      <td>
                        <Badge tone="purple">{d.stage}</Badge>
                      </td>
                      <td className="crm-numeric">{money(d.value)}</td>
                      <td>{dateLabel(d.closeDate)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Dodaj pierwszą szansę"
            description="Zacznij od projektu, firmy i szacowanej wartości."
          />
        )}
      </div>
    </>
  );
}
export function Deals({ query, edit, notify }: ViewProps) {
  const s = useCrm();
  const [drag, setDrag] = useState<string | null>(null);
  const visible = s.deals.filter(
    (d) =>
      !d.service &&
      `${d.name} ${s.firms.find((f) => f.id === d.companyId)?.name ?? ""}`
        .toLocaleLowerCase("pl")
        .includes(query.toLocaleLowerCase("pl")),
  );
  function move(d: Deal, stage: Deal["stage"]) {
    s.saveDeal({
      ...d,
      stage,
      probability:
        stage === "Wygrana" ? 100 : stage === "Przegrana" ? 0 : d.probability,
    });
    notify(`Szansa przeniesiona do etapu: ${stage}.`);
  }
  return (
    <>
      <div className="crm-toolbar">
        <p className="crm-muted">
          Przeciągnij kartę lub zmień etap w jej menu.
        </p>
        <button className="crm-button" onClick={() => edit({ kind: "deal" })}>
          <Icon name="plus" size={18} />
          Dodaj szansę
        </button>
      </div>
      <div className="crm-kanban">
        {DEAL_STAGES.map((stage) => {
          const ds = visible.filter((d) => d.stage === stage);
          return (
            <section
              key={stage}
              className="crm-kanban-column"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const deal = s.deals.find((d) => d.id === drag);
                if (deal) move(deal, stage);
                setDrag(null);
              }}
            >
              <div className="crm-kanban-header">
                <h3>
                  <span
                    className={`crm-stage-dot ${stage === "Wygrana" ? "green" : stage === "Przegrana" ? "gray" : ""}`}
                  />
                  {stage}
                  <span>{ds.length}</span>
                </h3>
                <strong>
                  {money(ds.reduce((sum, d) => sum + d.value, 0))}
                </strong>
              </div>
              {ds.map((d) => (
                <article
                  className="crm-deal-card"
                  key={d.id}
                  draggable
                  onDragStart={() => setDrag(d.id)}
                  onDragEnd={() => setDrag(null)}
                >
                  <small>
                    {s.firms.find((f) => f.id === d.companyId)?.name}
                  </small>
                  <button
                    className="crm-deal-title"
                    onClick={() => edit({ kind: "deal", item: d })}
                  >
                    {d.name}
                  </button>
                  <strong>{money(d.value)}</strong>
                  <div className="crm-probability">
                    <span style={{ width: `${d.probability}%` }} />
                  </div>
                  <div className="crm-deal-footer">
                    <small>{d.probability}% szans</small>
                    <small>{dateLabel(d.closeDate)}</small>
                  </div>
                  <select
                    aria-label={`Etap: ${d.name}`}
                    value={d.stage}
                    onChange={(e) => move(d, e.target.value as Deal["stage"])}
                  >
                    {DEAL_STAGES.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <ChangeButtons
                    label={d.name}
                    edit={() => edit({ kind: "deal", item: d })}
                    remove={() => {
                      if (confirm("Usunąć tę szansę?")) s.deleteDeal(d.id);
                    }}
                  />
                </article>
              ))}
              {ds.length === 0 && (
                <p className="crm-kanban-empty">Brak szans</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
export function Contacts({ query, edit, compose }: ViewProps) {
  const s = useCrm();
  const visible = s.contacts.filter((c) =>
    `${c.name} ${c.email} ${s.firms.find((f) => f.id === c.companyId)?.name ?? ""}`
      .toLocaleLowerCase("pl")
      .includes(query.toLocaleLowerCase("pl")),
  );
  return (
    <>
      <div className="crm-toolbar">
        <span className="crm-muted">Relacje zaczynają się od ludzi.</span>
        <button
          className="crm-button"
          onClick={() => edit({ kind: "contact" })}
        >
          <Icon name="plus" size={18} />
          Dodaj kontakt
        </button>
      </div>
      <div className="crm-contact-grid">
        {visible.map((c, i) => (
          <article className="crm-card crm-contact-card" key={c.id}>
            <div className="crm-inline">
              <span className={`crm-avatar large tone-${i % 4}`}>
                {c.name
                  .split(" ")
                  .map((v) => v[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div>
                <h3>{c.name}</h3>
                <small>{c.role || "Kontakt"}</small>
              </div>
            </div>
            <p className="crm-contact-company">
              {s.firms.find((f) => f.id === c.companyId)?.name}
            </p>
            <a href={`mailto:${c.email}`} className="crm-contact-link">
              <Icon name="mail" size={16} />
              {c.email}
            </a>
            {c.phone && (
              <a
                className="crm-contact-link"
                href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
              >
                {c.phone}
              </a>
            )}
            <Badge tone={c.consent ? "green" : "neutral"}>
              {c.consent ? "Wysyłka potwierdzona" : "Sprawdź podstawę kontaktu"}
            </Badge>
            <div className="crm-contact-actions">
              <button
                className="crm-button secondary"
                onClick={() => compose(c)}
              >
                Napisz wiadomość
              </button>
              <ChangeButtons
                label={c.name}
                edit={() => edit({ kind: "contact", item: c })}
                remove={() => {
                  if (confirm("Usunąć ten kontakt?")) s.deleteContact(c.id);
                }}
              />
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <Empty
          title="Brak kontaktów"
          description="Dodaj osobę i przypisz ją do firmy."
          action={
            <button
              className="crm-button"
              onClick={() => edit({ kind: "contact" })}
            >
              Dodaj kontakt
            </button>
          }
        />
      )}
    </>
  );
}
export function Tasks({ query, edit }: ViewProps) {
  const s = useCrm();
  const [filter, setFilter] = useState("open");
  const visible = s.tasks
    .filter(
      (t) =>
        (filter === "all" ||
          (filter === "done" && t.done) ||
          (filter === "open" && !t.done)) &&
        `${t.title} ${s.firms.find((f) => f.id === t.companyId)?.name ?? ""}`
          .toLocaleLowerCase("pl")
          .includes(query.toLocaleLowerCase("pl")),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <div className="crm-toolbar">
        <div className="crm-segmented">
          {[
            ["open", "Do zrobienia"],
            ["done", "Ukończone"],
            ["all", "Wszystkie"],
          ].map(([v, label]) => (
            <button
              key={v}
              aria-pressed={filter === v}
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="crm-button" onClick={() => edit({ kind: "task" })}>
          <Icon name="plus" size={18} />
          Dodaj zadanie
        </button>
      </div>
      <section className="crm-card">
        {visible.map((t) => (
          <div className={`crm-task-item ${t.done ? "done" : ""}`} key={t.id}>
            <input
              type="checkbox"
              aria-label={`Ukończ: ${t.title}`}
              checked={t.done}
              onChange={() => s.saveTask({ ...t, done: !t.done })}
            />
            <div>
              <strong>{t.title}</strong>
              <small>
                {s.firms.find((f) => f.id === t.companyId)?.name ??
                  "Zadanie własne"}
              </small>
            </div>
            <Badge
              tone={
                !t.done && t.date < today()
                  ? "red"
                  : t.date === today()
                    ? "purple"
                    : "neutral"
              }
            >
              {t.date === today() ? "Dzisiaj" : dateLabel(t.date)}
            </Badge>
            <ChangeButtons
              label={t.title}
              edit={() => edit({ kind: "task", item: t })}
              remove={() => {
                if (confirm("Usunąć zadanie?")) s.deleteTask(t.id);
              }}
            />
          </div>
        ))}
        {!visible.length && (
          <Empty
            title="Brak zadań w tym widoku"
            description="Dodaj kolejny krok lub sprawdź ukończone zadania."
          />
        )}
      </section>
    </>
  );
}
