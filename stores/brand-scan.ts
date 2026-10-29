"use client";
import {
  brandAlerts,
  toCompetitor,
  sameBrandTarget,
  validateBrand,
  withHistory,
  type BrandProfile,
} from "@/lib/brand/model";
import { useCrm } from "./crm-store";
import { authHeaders } from "./agent-store";
import { activeWorkspace } from "./sync";

export async function scanBrandProfile(
  website: string,
  github: string,
  signal?: AbortSignal,
) {
  const workspace = activeWorkspace();
  const r = await fetch("/api/brand/scan", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ website, github }),
    signal,
  });
  const result = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (activeWorkspace() !== workspace)
    throw Error(
      "Przestrzeń została zmieniona w trakcie skanu. Wynik odrzucono — powtórz skan w otwartej przestrzeni.",
    );
  if (!r.ok) throw Error(result.error || "Nie udało się przeskanować.");
  const brand = validateBrand(result.brand);
  if (!brand) throw Error("Skaner nie zwrócił profilu marki.");
  return brand;
}

export function applyScannedBrand(
  scanned: BrandProfile,
  apply = true,
  keep?: { website: string; github: string },
) {
  const previous = useCrm.getState().brand;
  const brand: BrandProfile = withHistory(
    {
      ...scanned,
      website: scanned.website || keep?.website || "",
      github: scanned.github || keep?.github || "",
      applied: apply || (previous?.applied ?? true),
    },
    previous,
  );
  brand.competitors =
    previous && sameBrandTarget(brand, previous) ? previous.competitors : [];
  if (previous?.name === brand.name) {
    brand.colors = previous.colors;
    brand.useFont = previous.useFont;
    brand.headingFont = previous.headingFont || brand.headingFont;
  }
  useCrm.getState().setBrand(brand);
  const sender = useCrm.getState().sender;
  if (brand.name && (!sender || /AI Evolution Polska|^Zespół$/i.test(sender)))
    useCrm.getState().setSender(`Zespół ${brand.name}`);
  return { brand, alerts: brandAlerts(brand.history) };
}

export async function monitorBrand() {
  const current = useCrm.getState().brand;
  if (!current || (!current.website && !current.github))
    throw Error(
      "Najpierw zeskanuj markę w Profilu firmy (strona www lub GitHub).",
    );
  const { brand, alerts } = applyScannedBrand(
    await scanBrandProfile(current.website, current.github),
    false,
    { website: current.website, github: current.github },
  );
  const last = brand.history.at(-1)!;
  const parts = [
    last.score !== null ? `strona ${last.score}/100` : "",
    last.rating !== null
      ? `ocena ${last.rating.toFixed(1)} (${last.reviews})`
      : "",
    last.stars !== null ? `GitHub ★${last.stars}` : "",
  ].filter(Boolean);
  return {
    alerts,
    message: alerts.length
      ? `Uwaga: ${alerts.join("; ")}. Teraz: ${parts.join(", ")}.`
      : `Marka bez spadków: ${parts.join(", ") || "zapisano skan"}.`,
  };
}

export async function addCompetitor(website: string) {
  const current = useCrm.getState().brand;
  if (!current) throw Error("Najpierw zeskanuj własną markę.");
  if (current.competitors.length >= 3)
    throw Error(
      "Możesz porównać do 3 konkurentów. Usuń jednego, aby dodać kolejnego.",
    );
  const scanned = await scanBrandProfile(website, "");
  if (!scanned.website)
    throw Error("Nie udało się odczytać strony konkurenta.");
  const competitor = toCompetitor(scanned);
  const latest = useCrm.getState().brand;
  if (!latest) throw Error("Profil marki został usunięty.");
  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return u;
    }
  };
  useCrm.getState().setBrand({
    ...latest,
    competitors: [
      ...latest.competitors.filter(
        (c) => host(c.website) !== host(competitor.website),
      ),
      competitor,
    ].slice(-3),
  });
  return competitor;
}
