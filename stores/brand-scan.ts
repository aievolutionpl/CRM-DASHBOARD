"use client";
import {
  brandAlerts,
  validateBrand,
  withHistory,
  type BrandProfile,
} from "@/lib/brand/model";
import { useCrm } from "./crm-store";
import { authHeaders } from "./agent-store";

export async function scanBrandProfile(
  website: string,
  github: string,
  signal?: AbortSignal,
) {
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
  if (!r.ok) throw Error(result.error || "Nie udało się przeskanować.");
  const brand = validateBrand(result.brand);
  if (!brand) throw Error("Skaner nie zwrócił profilu marki.");
  return brand;
}

export function applyScannedBrand(scanned: BrandProfile, apply = true) {
  const previous = useCrm.getState().brand;
  const brand: BrandProfile = withHistory(
    { ...scanned, applied: apply || (previous?.applied ?? true) },
    previous,
  );
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
