"use client";
import { useMemo, useState } from "react";
import { useCrm } from "@/stores/crm-store";
import {
  FIRM_STATUSES,
  firmStatusLabels,
  money,
  dateLabel,
  today,
  type Firm,
  type FirmStatus,
} from "@/lib/crm/model";
import { downloadCsv } from "@/lib/csv";
import { Icon, Badge, Empty } from "./ui";
import FirmDetail from "./firm-detail";
import type { ViewProps } from "./views";

const CLOSED = ["Wygrana", "Przegrana"];
export const statusTone: Record<FirmStatus, string> = {
  lead: "purple",
  active: "green",
  vip: "amber",
  paused: "gray",
  lost: "red",
};
type Sort = "name" | "value" | "next" | "created";
const SORTS: { id: Sort; label: string }[] = [
  { id: "name", label: "Nazwa A–Z" },
  { id: "value", label: "Wartość szans" },
  { id: "next", label: "Najbliższy krok" },
  { id: "created", label: "Najnowsze" },
];

export function firmStatus(f: Firm): FirmStatus {
  return f.status ?? "lead";
}

export function useFirmStats() {
  const s = useCrm();
  return useMemo(() => {
    const day = today();
    const map = new Map<
      string,
      {
        openValue: number;
        openCount: number;
        forecast: number;
        won: number;
        contacts: number;
        nextTask?: { title: string; date: string };
        overdue: number;
        health: "red" | "amber" | "green";
      }
    >();
    for (const f of s.firms) {
      const deals = s.deals.filter((d) => d.companyId === f.id && !d.service);
      const open = deals.filter((d) => !CLOSED.includes(d.stage));
      const tasks = s.tasks
        .filter((t) => t.companyId === f.id && !t.done)
        .sort((a, b) => a.date.localeCompare(b.date));
      const overdue = tasks.filter((t) => t.date < day).length;
      map.set(f.id, {
        openValue: open.reduce((x, d) => x + d.value, 0),
        openCount: open.length,
        forecast: open.reduce((x, d) => x + (d.value * d.probability) / 100, 0),
        won: deals
          .filter((d) => d.stage === "Wygrana")
          .reduce((x, d) => x + d.value, 0),
        contacts: s.contacts.filter((c) => c.companyId === f.id).length,
        nextTask: tasks[0],
        overdue,
        health: overdue
          ? "red"
          : open.length && !tasks.length
            ? "amber"
            : "green",
      });
    }
    return map;
  }, [s.firms, s.deals, s.tasks, s.contacts]);
}

const healthLabel = {
  red: "Zaległe zadania",
  amber: "Brak kolejnego kroku",
  green: "W porządku",
};
const healthDot = {
  red: "bg-rose-500",
  amber: "bg-amber-400",
  green: "bg-emerald-500",
};

export default function Firms({
  query,
  edit,
  notify,
  compose,
  ask,
}: ViewProps) {
  const s = useCrm();
  const stats = useFirmStats();
  const [status, setStatus] = useState<FirmStatus | "all">("all");
  const [industry, setIndustry] = useState("");
  const [owner, setOwner] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [view, setView] = useState<"table" | "cards">("table");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const owners = [
    ...new Set(s.firms.map((f) => f.owner).filter(Boolean)),
  ] as string[];
  const tags = [...new Set(s.firms.flatMap((f) => f.tags ?? []))].sort((a, b) =>
    a.localeCompare(b, "pl"),
  );
  const q = query.toLocaleLowerCase("pl");
  const visible = s.firms
    .filter(
      (f) =>
        (status === "all" || firmStatus(f) === status) &&
        (!industry || f.industry === industry) &&
        (!owner || f.owner === owner) &&
        (!tag || f.tags?.includes(tag)) &&
        `${f.name} ${f.nip} ${f.city} ${f.owner ?? ""} ${(f.tags ?? []).join(" ")}`
          .toLocaleLowerCase("pl")
          .includes(q),
    )
    .sort((a, b) => {
      const A = stats.get(a.id)!,
        B = stats.get(b.id)!;
      if (sort === "value") return B.openValue - A.openValue;
      if (sort === "created") return b.created.localeCompare(a.created);
      if (sort === "next")
        return (A.nextTask?.date ?? "9999").localeCompare(
          B.nextTask?.date ?? "9999",
        );
      return a.name.localeCompare(b.name, "pl");
    });
  const totals = [...stats.values()];
  const kpis = [
    {
      label: "Firmy w bazie",
      value: String(s.firms.length),
      caption: `${s.firms.filter((f) => ["active", "vip"].includes(firmStatus(f))).length} aktywnych klientów`,
      icon: "building",
    },
    {
      label: "Otwarte szanse",
      value: money(totals.reduce((x, t) => x + t.openValue, 0)),
      caption: `prognoza ${money(totals.reduce((x, t) => x + t.forecast, 0))}`,
      icon: "deals",
    },
    {
      label: "Wygrana sprzedaż",
      value: money(totals.reduce((x, t) => x + t.won, 0)),
      caption: "suma wygranych szans",
      icon: "check",
    },
    {
      label: "Wymaga uwagi",
      value: String(totals.filter((t) => t.health !== "green").length),
      caption: "zaległe lub bez kolejnego kroku",
      icon: "clock",
    },
  ];
  function remove(ids: string[]) {
    const names = s.firms.filter((f) => ids.includes(f.id)).map((f) => f.name);
    if (
      confirm(
        ids.length === 1
          ? `Usunąć firmę „${names[0]}” wraz z kontaktami, zadaniami i szansami?`
          : `Usunąć ${ids.length} firm wraz z kontaktami, zadaniami i szansami?`,
      )
    ) {
      for (const id of ids) s.deleteFirm(id);
      setSelected([]);
      setOpenId(null);
      notify(
        ids.length === 1
          ? "Firma została usunięta."
          : `Usunięto ${ids.length} firm.`,
      );
    }
  }
  function exportCsv(list: Firm[], name: string) {
    downloadCsv(name, [
      [
        "Firma",
        "NIP",
        "Miasto",
        "Branża",
        "Wartość otwartych szans (PLN)",
        "Status",
        "Opiekun",
        "Źródło",
        "Tagi",
        "Kontakty",
        "Najbliższe zadanie",
      ],
      ...list.map((f) => {
        const st = stats.get(f.id)!;
        return [
          f.name,
          f.nip,
          f.city,
          f.industry,
          st.openValue,
          firmStatusLabels[firmStatus(f)],
          f.owner ?? "",
          f.source ?? "",
          (f.tags ?? []).join(", "),
          st.contacts,
          st.nextTask ? `${st.nextTask.date} ${st.nextTask.title}` : "",
        ];
      }),
    ]);
  }
  const allSelected =
    visible.length > 0 && visible.every((f) => selected.includes(f.id));
  const toggle = (id: string) =>
    setSelected((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  const open = s.firms.find((f) => f.id === openId);
  return (
    <>
      <div className="crm-metrics">
        {kpis.map((k) => (
          <div className="crm-metric" key={k.label}>
            <div className="crm-metric-top">
              <span>{k.label}</span>
              <span className="crm-metric-icon">
                <Icon name={k.icon} size={18} />
              </span>
            </div>
            <strong>{k.value}</strong>
            <small>{k.caption}</small>
          </div>
        ))}
      </div>
      <div
        className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white/70 p-1 shadow-sm"
        role="tablist"
        aria-label="Status firm"
      >
        {(["all", ...FIRM_STATUSES] as const).map((st) => {
          const count =
            st === "all"
              ? s.firms.length
              : s.firms.filter((f) => firmStatus(f) === st).length;
          return (
            <button
              key={st}
              role="tab"
              aria-selected={status === st}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${status === st ? "bg-violet-600 text-white shadow" : "text-slate-600 hover:bg-violet-50"}`}
              onClick={() => {
                setStatus(st);
                setSelected([]);
              }}
            >
              {st === "all" ? "Wszystkie" : firmStatusLabels[st]}
              <span
                className={`rounded-md px-1.5 text-[10px] ${status === st ? "bg-white/20" : "bg-slate-100"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="crm-toolbar">
        <div className="crm-inline flex-wrap">
          <select
            aria-label="Filtr branży"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="">Wszystkie branże</option>
            {[...new Set(s.firms.map((f) => f.industry))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          {owners.length > 0 && (
            <select
              aria-label="Filtr opiekuna"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">Każdy opiekun</option>
              {owners.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          )}
          {tags.length > 0 && (
            <select
              aria-label="Filtr tagu"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">Wszystkie tagi</option>
              {tags.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          )}
          <select
            aria-label="Sortowanie firm"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            {SORTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="crm-muted">{visible.length} firm</span>
        </div>
        <div className="crm-inline">
          <div
            className="flex rounded-xl border border-slate-200 bg-white p-0.5"
            role="group"
            aria-label="Widok"
          >
            {(
              [
                ["table", "list", "Tabela"],
                ["cards", "grid", "Karty"],
              ] as const
            ).map(([id, icon, label]) => (
              <button
                key={id}
                aria-label={`Widok: ${label}`}
                aria-pressed={view === id}
                className={`grid size-9 place-items-center rounded-lg ${view === id ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:bg-slate-50"}`}
                onClick={() => setView(id)}
              >
                <Icon name={icon} size={16} />
              </button>
            ))}
          </div>
          <button
            className="crm-button secondary"
            onClick={() => exportCsv(visible, `firmy-${today()}.csv`)}
          >
            <Icon name="download" size={16} />
            Eksportuj CSV
          </button>
          <button className="crm-button" onClick={() => edit({ kind: "firm" })}>
            <Icon name="plus" size={18} />
            Dodaj firmę
          </button>
        </div>
      </div>
      {selected.length > 0 && (
        <div
          className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm"
          role="region"
          aria-label="Akcje zbiorcze"
        >
          <strong className="text-violet-800">
            Zaznaczono: {selected.length}
          </strong>
          <select
            aria-label="Zmień status zaznaczonych"
            value=""
            onChange={(e) => {
              const next = e.target.value as FirmStatus;
              if (!next) return;
              for (const f of s.firms.filter((x) => selected.includes(x.id)))
                s.saveFirm({ ...f, status: next });
              notify(
                `Zmieniono status ${selected.length} firm na „${firmStatusLabels[next]}”.`,
              );
            }}
          >
            <option value="">Zmień status…</option>
            {FIRM_STATUSES.map((v) => (
              <option key={v} value={v}>
                {firmStatusLabels[v]}
              </option>
            ))}
          </select>
          <button
            className="crm-button secondary"
            onClick={() =>
              exportCsv(
                s.firms.filter((f) => selected.includes(f.id)),
                `firmy-zaznaczone-${today()}.csv`,
              )
            }
          >
            Eksportuj zaznaczone
          </button>
          <button
            className="crm-button secondary danger"
            onClick={() => remove(selected)}
          >
            Usuń zaznaczone
          </button>
          <button
            className="crm-text-button ml-auto"
            onClick={() => setSelected([])}
          >
            Odznacz
          </button>
        </div>
      )}
      {!visible.length ? (
        <section className="crm-card">
          <Empty
            title="Brak firm w tym widoku"
            description="Zmień filtry lub wyszukiwanie albo dodaj pierwszą firmę."
            action={
              !s.firms.length ? (
                <button
                  className="crm-button"
                  onClick={() => edit({ kind: "firm" })}
                >
                  Dodaj firmę
                </button>
              ) : undefined
            }
          />
        </section>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((f, i) => {
            const st = stats.get(f.id)!;
            return (
              <article
                key={f.id}
                className="crm-card crm-connector grid content-start gap-4 p-5"
              >
                <div className="flex items-start gap-3">
                  <span className={`crm-avatar tone-${i % 4}`}>
                    {f.name.slice(0, 2).toUpperCase()}
                  </span>
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenId(f.id)}
                  >
                    <strong className="block truncate text-slate-800">
                      {f.name}
                    </strong>
                    <small className="block truncate">
                      {[f.industry, f.city].filter(Boolean).join(" · ")}
                    </small>
                  </button>
                  <Badge tone={statusTone[firmStatus(f)]}>
                    {firmStatusLabels[firmStatus(f)]}
                  </Badge>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Szanse", money(st.openValue)],
                    ["Kontakty", String(st.contacts)],
                    ["Wygrane", money(st.won)],
                  ].map(([l, v]) => (
                    <div
                      key={l}
                      className="rounded-xl bg-slate-50/80 px-2 py-2"
                    >
                      <dt className="text-[10px] text-slate-500">{l}</dt>
                      <dd className="truncate text-sm font-bold text-slate-800 tabular-nums">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span
                    className={`size-2 shrink-0 rounded-full ${healthDot[st.health]}`}
                  />
                  <span className="min-w-0 truncate">
                    {st.nextTask
                      ? `${dateLabel(st.nextTask.date)} · ${st.nextTask.title}`
                      : healthLabel[st.health]}
                  </span>
                </div>
                {!!f.tags?.length && (
                  <div className="flex flex-wrap gap-1">
                    {f.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <section className="crm-card">
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Zaznacz wszystkie firmy"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? [] : visible.map((f) => f.id))
                      }
                    />
                  </th>
                  <th>Firma</th>
                  <th>Status</th>
                  <th>Branża</th>
                  <th>Opiekun</th>
                  <th>Kontakty</th>
                  <th>Otwarte szanse</th>
                  <th>Następny krok</th>
                  <th>Działania</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((f, i) => {
                  const st = stats.get(f.id)!;
                  return (
                    <tr
                      key={f.id}
                      className={
                        selected.includes(f.id) ? "bg-violet-50/50" : ""
                      }
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Zaznacz ${f.name}`}
                          checked={selected.includes(f.id)}
                          onChange={() => toggle(f.id)}
                        />
                      </td>
                      <td>
                        <button
                          className="crm-firm-name"
                          onClick={() => setOpenId(f.id)}
                        >
                          <span className={`crm-avatar tone-${i % 4}`}>
                            {f.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong>{f.name}</strong>
                            <small>
                              {f.nip
                                ? `NIP ${f.nip}`
                                : f.city || "NIP nieuzupełniony"}
                            </small>
                          </div>
                        </button>
                      </td>
                      <td>
                        <Badge tone={statusTone[firmStatus(f)]}>
                          {firmStatusLabels[firmStatus(f)]}
                        </Badge>
                      </td>
                      <td>
                        <Badge>{f.industry}</Badge>
                      </td>
                      <td>{f.owner || "—"}</td>
                      <td>{st.contacts}</td>
                      <td className="crm-numeric">
                        {money(st.openValue)}
                        <small className="block">
                          {st.openCount} w procesie
                        </small>
                      </td>
                      <td>
                        <span className="flex items-center gap-2 text-xs">
                          <span
                            className={`size-2 shrink-0 rounded-full ${healthDot[st.health]}`}
                            title={healthLabel[st.health]}
                          />
                          <span className="max-w-[180px] truncate">
                            {st.nextTask
                              ? `${dateLabel(st.nextTask.date)} · ${st.nextTask.title}`
                              : healthLabel[st.health]}
                          </span>
                        </span>
                      </td>
                      <td>
                        <div className="crm-row-tools">
                          <button
                            className="crm-icon-button"
                            aria-label={`Edytuj ${f.name}`}
                            onClick={() => edit({ kind: "firm", item: f })}
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            className="crm-icon-button danger"
                            aria-label={`Usuń ${f.name}`}
                            onClick={() => remove([f.id])}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {open && (
        <FirmDetail
          firm={open}
          onClose={() => setOpenId(null)}
          edit={edit}
          compose={compose}
          remove={() => remove([open.id])}
          ask={ask}
        />
      )}
    </>
  );
}
