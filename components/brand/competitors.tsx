"use client";
import { useState } from "react";
import { useCrm } from "@/stores/crm-store";
import { addCompetitor } from "@/stores/brand-scan";
import { isSqlite } from "@/lib/growth/model";
import { localRequest } from "@/lib/local/client";
import {
  competitorGaps,
  toCompetitor,
  type Competitor,
} from "@/lib/brand/model";
import { competitorsMarkdown } from "@/lib/brand/markdown";
import { Icon } from "../crm/ui";
import { Panel } from "../insights/kit";
import { BrandLogo } from "./theme";

type Row = {
  label: string;
  value: (c: Competitor) => number | null;
  show: (c: Competitor) => string;
};
const ROWS: Row[] = [
  {
    label: "Wynik strony",
    value: (c) => c.score,
    show: (c) => (c.score === null ? "—" : `${c.score}/100`),
  },
  {
    label: "Ocena klientów",
    value: (c) => c.rating,
    show: (c) => (c.rating === null ? "—" : c.rating.toFixed(1)),
  },
  {
    label: "Liczba opinii",
    value: (c) => c.reviews,
    show: (c) => String(c.reviews),
  },
  {
    label: "Kanały social media",
    value: (c) => c.socials,
    show: (c) => String(c.socials),
  },
  {
    label: "Pomiar ruchu",
    value: (c) => c.trackers.filter((t) => !/Cookie/.test(t)).length,
    show: (c) =>
      c.trackers
        .filter((t) => !/Cookie/.test(t))
        .slice(0, 2)
        .join(", ") || "brak",
  },
  {
    label: "Odpowiedź serwera",
    value: (c) => (c.responseMs === null ? null : -c.responseMs),
    show: (c) =>
      c.responseMs === null ? "—" : `${(c.responseMs / 1000).toFixed(2)} s`,
  },
  {
    label: "Platforma",
    value: () => null,
    show: (c) => c.technologies.slice(0, 2).join(", ") || "—",
  },
];

export default function Competitors({
  notify,
  readOnly,
  workspace,
}: {
  notify: (text: string) => void;
  readOnly: boolean;
  workspace?: string;
}) {
  const brand = useCrm((s) => s.brand);
  const setBrand = useCrm((s) => s.setBrand);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!brand) return null;
  const own = { ...toCompetitor(brand), name: brand.name || "Twoja firma" };
  const all = [own, ...brand.competitors];
  const gaps = competitorGaps(brand);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      const c = await addCompetitor(url.trim());
      setUrl("");
      notify(`Dodano konkurenta ${c.name} do porównania.`);
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Nie udało się dodać konkurenta.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toBrain() {
    if (!workspace || !brand) return;
    setSaving(true);
    try {
      const title = `Konkurencja — ${brand.name || "Moja firma"}`
        .replace(/[\[\]<>:"|?*\\/\x00-\x1f]/g, " ")
        .slice(0, 100)
        .replace(/\.+$/, "");
      const { documents } = (await localRequest(workspace, "brain")) as {
        documents: {
          id: string;
          title: string;
          category: string;
          revision: number;
        }[];
      };
      const existing = documents.find(
        (d) => d.title === title && d.category === "competitors",
      );
      await localRequest(workspace, "brain", {
        method: "POST",
        body: JSON.stringify({
          id: existing?.id,
          title,
          category: "competitors",
          content: competitorsMarkdown(brand),
          revision: existing?.revision ?? 0,
        }),
      });
      notify("Porównanie zapisane w Company Brain (Konkurencja).");
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Nie udało się zapisać notatki.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Panel
      eyebrow="KONKURENCJA"
      title="Jak wypadasz na tle konkurentów"
      action={
        isSqlite() && workspace && brand.competitors.length > 0 ? (
          <button
            className="crm-button secondary"
            disabled={saving}
            onClick={() => void toBrain()}
          >
            <Icon name="file" size={15} />
            {saving ? "Zapisywanie…" : "Zapisz w Company Brain"}
          </button>
        ) : undefined
      }
    >
      <form className="mb-5 flex flex-wrap gap-2" onSubmit={(e) => void add(e)}>
        <label className="sr-only" htmlFor="competitor-url">
          Strona konkurenta
        </label>
        <input
          id="competitor-url"
          className="min-w-[14em] flex-1"
          inputMode="url"
          placeholder="https://konkurent.pl"
          value={url}
          maxLength={2048}
          disabled={readOnly || busy || brand.competitors.length >= 3}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="crm-button"
          disabled={
            readOnly || busy || !url.trim() || brand.competitors.length >= 3
          }
        >
          <Icon name="plus" size={15} />
          {busy ? "Skanuję…" : "Dodaj konkurenta"}
        </button>
      </form>
      {brand.competitors.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34em] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs font-semibold text-slate-500">
                    Wskaźnik
                  </th>
                  {all.map((c, i) => (
                    <th
                      key={c.website || c.name}
                      className="p-2 text-left align-bottom"
                    >
                      <span className="flex items-center gap-2">
                        <BrandLogo
                          brand={{ logo: c.logo, icon: "", name: c.name }}
                          size={28}
                        />
                        <span className="min-w-0">
                          <strong className="block max-w-[10em] truncate text-xs text-slate-800">
                            {c.name}
                          </strong>
                          <span className="text-[10px] font-normal text-slate-400">
                            {i === 0 ? "Twoja firma" : c.scannedAt.slice(0, 10)}
                          </span>
                        </span>
                        {i > 0 && !readOnly && (
                          <button
                            type="button"
                            className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                            aria-label={`Usuń ${c.name} z porównania`}
                            onClick={() =>
                              setBrand({
                                ...brand,
                                competitors: brand.competitors.filter(
                                  (x) => x !== c,
                                ),
                              })
                            }
                          >
                            <Icon name="close" size={14} />
                          </button>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const values = all.map(row.value);
                  const best = Math.max(
                    ...values.filter((v): v is number => v !== null),
                  );
                  return (
                    <tr key={row.label} className="border-t border-slate-100">
                      <th
                        scope="row"
                        className="p-2 text-left text-xs font-medium text-slate-500"
                      >
                        {row.label}
                      </th>
                      {all.map((c, i) => {
                        const v = values[i];
                        const leader =
                          v !== null &&
                          Number.isFinite(best) &&
                          v === best &&
                          values.filter((x) => x !== null).length > 1;
                        return (
                          <td
                            key={c.website || c.name}
                            className={`p-2 tabular-nums ${leader ? "font-semibold text-emerald-700" : i === 0 && v !== null && Number.isFinite(best) && v < best ? "text-rose-600" : "text-slate-700"}`}
                          >
                            {row.show(c)}
                            {leader && (
                              <span className="sr-only">
                                {" "}
                                (najlepszy wynik)
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold text-slate-500">
                Gdzie konkurencja wygrywa
              </h4>
              {gaps.length ? (
                <ul className="grid gap-1.5 text-sm text-slate-700">
                  {gaps.map((g) => (
                    <li key={g} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-500" />
                      {g}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-700">
                  W mierzonych obszarach nie przegrywasz z dodanymi
                  konkurentami.
                </p>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold text-slate-500">
                Oferta konkurentów (nagłówki stron)
              </h4>
              <ul className="grid gap-2 text-xs text-slate-600">
                {brand.competitors.map((c) => (
                  <li key={c.website}>
                    <strong className="text-slate-800">{c.name}:</strong>{" "}
                    {c.services.slice(0, 4).join(" · ") || "brak danych"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Dodaj do 3 stron konkurentów. Zeskanujemy je tak samo jak Twoją stronę
          i porównamy wynik strony, opinie, analitykę, social media i szybkość.
        </p>
      )}
    </Panel>
  );
}
