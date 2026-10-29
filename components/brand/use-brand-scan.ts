"use client";
import { useEffect, useRef, useState } from "react";
import { useCrm } from "@/stores/crm-store";
import { authHeaders } from "@/stores/agent-store";
import type { BrandProfile } from "@/lib/brand/model";

export const SCAN_STEPS = [
  "Odczyt strony www",
  "Logo, kolory i czcionki",
  "Kontakt, social media i oferta",
  "GitHub: repozytoria i aktywność",
  "Opinie i audyt strony",
];

export function useBrandScan(notify: (text: string) => void) {
  const setBrand = useCrm((s) => s.setBrand);
  const setSender = useCrm((s) => s.setSender);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  async function scan(website: string, github: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStep(0);
    timer.current = setInterval(
      () => setStep((s) => Math.min(SCAN_STEPS.length - 1, s + 1)),
      1400,
    );
    try {
      const r = await fetch("/api/brand/scan", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({ website, github }),
      });
      const result = await r
        .json()
        .catch(() => ({ error: `HTTP ${r.status}` }));
      if (!r.ok) throw Error(result.error || "Nie udało się przeskanować.");
      const brand = { ...(result.brand as BrandProfile), applied: true };
      const previous = useCrm.getState().brand;
      if (previous?.name === brand.name) {
        brand.colors = previous.colors;
        brand.useFont = previous.useFont;
        brand.headingFont = previous.headingFont || brand.headingFont;
      }
      setBrand(brand);
      const sender = useCrm.getState().sender;
      if (
        brand.name &&
        (!sender || /AI Evolution Polska|^Zespół$/i.test(sender))
      )
        setSender(`Zespół ${brand.name}`);
      notify(
        `Dashboard dopasowany do marki ${brand.name}. ${brand.warnings.length ? `Uwagi: ${brand.warnings.length}.` : ""}`,
      );
      return brand;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Nie udało się przeskanować.";
      setError(message);
      notify(message);
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
    }
  }
  return { scan, busy, step, error };
}
