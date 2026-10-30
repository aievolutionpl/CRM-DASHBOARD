"use client";
import { useEffect, useState } from "react";

export default function PlacesSetup() {
  const [status, setStatus] = useState<{
    places: boolean;
    githubToken: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/brand/scan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (active && s) setStatus(s);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
      <p>
        Nie znaleziono oceny. Dodaj dane AggregateRating na stronie albo pobierz
        opinie z Map Google.
      </p>
      {status?.places ? (
        <p className="mt-2 text-xs text-emerald-700">
          Klucz Google Places jest ustawiony — sprawdź, czy nazwa firmy i miasto
          w profilu odpowiadają wizytówce w Mapach, i zeskanuj ponownie.
        </p>
      ) : (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-semibold text-violet-700">
            Jak włączyć opinie z Google (5 minut)
          </summary>
          <ol className="mt-2 grid list-decimal gap-1 pl-5 leading-relaxed">
            <li>
              Otwórz{" "}
              <a
                className="text-violet-700 underline"
                href="https://console.cloud.google.com/apis/library/places.googleapis.com"
                target="_blank"
                rel="noreferrer noopener"
              >
                Places API (New) w Google Cloud
              </a>{" "}
              i kliknij <strong>Włącz</strong> (wymaga projektu z płatnościami;
              Google daje miesięczny darmowy limit).
            </li>
            <li>
              W <strong>Interfejsy API → Dane logowania</strong> utwórz klucz
              API i ogranicz go do <strong>Places API (New)</strong>.
            </li>
            <li>
              Dopisz do pliku <code>.env.local</code> w folderze aplikacji:{" "}
              <code>GOOGLE_PLACES_API_KEY=twój_klucz</code>
            </li>
            <li>Zrestartuj aplikację i kliknij „Skanuj teraz”.</li>
          </ol>
          <p className="mt-2 text-slate-500">
            Klucz zostaje na serwerze; szukamy wizytówki po nazwie firmy i
            mieście, pobieramy ocenę, liczbę opinii i do 5 recenzji.
            {status && !status.githubToken
              ? " Opcjonalnie GITHUB_TOKEN (tylko odczyt) podnosi limit GitHub z 60 do 5000 zapytań/h."
              : ""}
          </p>
        </details>
      )}
    </div>
  );
}
