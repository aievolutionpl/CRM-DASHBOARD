"use client";
import type { BrandProfile } from "@/lib/brand/model";
import type { Section } from "@/lib/crm/model";
import { Icon } from "../crm/ui";
import { Panel } from "../insights/kit";
import { ScoreDial, Stars } from "./brand-studio";
import { BrandLogo } from "./theme";

const count = (v: number) =>
  new Intl.NumberFormat("pl-PL", {
    notation: v > 9999 ? "compact" : "standard",
  }).format(v);

export default function BrandPresence({
  brand,
  navigate,
}: {
  brand: BrandProfile;
  navigate: (s: Section) => void;
}) {
  const failed = brand.audit.checks.filter((c) => !c.ok);
  const gh = brand.githubData;
  return (
    <Panel
      eyebrow="MARKA I OBECNOŚĆ ONLINE"
      title="Jak widzą Cię klienci"
      action={
        <button className="crm-text-button" onClick={() => navigate("brand")}>
          Profil <Icon name="arrow" size={14} />
        </button>
      }
    >
      <div className="flex items-center gap-3">
        <BrandLogo brand={brand} size={40} />
        <div className="min-w-0">
          <strong className="block truncate text-sm text-slate-800">
            {brand.name}
          </strong>
          {brand.website && (
            <a
              href={brand.website}
              target="_blank"
              rel="noreferrer noopener"
              className="block truncate text-xs text-violet-700 hover:underline"
            >
              {brand.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4">
        {brand.audit.checks.length ? (
          <ScoreDial score={brand.audit.score} label="strona" size={92} />
        ) : (
          <span className="grid size-[92px] place-items-center rounded-full bg-slate-50 text-center text-[11px] text-slate-400">
            brak
            <br />
            audytu
          </span>
        )}
        <dl className="grid gap-2.5 text-sm">
          <div>
            <dt className="text-[11px] text-slate-500">Opinie klientów</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {brand.rating ? (
                <>
                  <strong className="text-slate-800 tabular-nums">
                    {brand.rating.value.toFixed(1)}
                  </strong>
                  <Stars value={brand.rating.value} size={13} />
                  <span className="text-[11px] text-slate-400">
                    ({count(brand.rating.count)})
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">brak danych</span>
              )}
            </dd>
          </div>
          {gh && (
            <div>
              <dt className="text-[11px] text-slate-500">GitHub</dt>
              <dd className="text-xs text-slate-700">
                <strong className="tabular-nums">★ {count(gh.stars)}</strong> ·{" "}
                {gh.publicRepos} repozytoriów
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[11px] text-slate-500">Pomiar ruchu</dt>
            <dd className="text-xs text-slate-700">
              {brand.trackers
                .filter((t) => !/Cookie/.test(t))
                .slice(0, 3)
                .join(", ") || "nie wykryto"}
            </dd>
          </div>
        </dl>
      </div>
      {failed.length > 0 && (
        <ul className="mt-4 grid gap-1.5 border-t border-slate-100 pt-3">
          {failed.slice(0, 3).map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 text-xs text-slate-600"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-500" />
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
