"use client";
import { useEffect, useRef, useState } from "react";
import { applyScannedBrand, scanBrandProfile } from "@/stores/brand-scan";

export const SCAN_STEPS = [
  "Odczyt strony www",
  "Logo, kolory i czcionki",
  "Kontakt, social media i oferta",
  "GitHub: repozytoria i aktywność",
  "Opinie i audyt strony",
];

export function useBrandScan(notify: (text: string) => void) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      request.current?.abort();
    },
    [],
  );
  async function scan(website: string, github: string) {
    if (busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setStep(0);
    timer.current = setInterval(
      () => setStep((s) => Math.min(SCAN_STEPS.length - 1, s + 1)),
      1400,
    );
    try {
      const scanned = await scanBrandProfile(
        website,
        github,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const { brand, alerts } = applyScannedBrand(scanned);
      notify(
        `Dashboard dopasowany do marki ${brand.name}. ${alerts.length ? `Od ostatniego skanu: ${alerts.join("; ")}. ` : ""}${brand.warnings.length ? `Uwagi: ${brand.warnings.length}.` : ""}`,
      );
      return brand;
    } catch (e) {
      if (controller.signal.aborted) return;
      const message =
        e instanceof Error ? e.message : "Nie udało się przeskanować.";
      setError(message);
      notify(message);
    } finally {
      if (timer.current) clearInterval(timer.current);
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return { scan, busy, step, error };
}
