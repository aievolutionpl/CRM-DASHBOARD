# Konwencje Evolution Growth OS

Zasady dla ludzi i agentów AI pracujących w tym repozytorium. Gdy `CLAUDE.md` odsyła do tego pliku, obowiązuje opis poniżej — dotyczy tej aplikacji CRM, nie szablonu strony marketingowej.

## Produkt i język

- Interfejs, komunikaty błędów, dokumentacja użytkownika i opisy PR: **po polsku**. Kwoty w PLN (`money()` z `lib/crm/model.ts`), daty i godziny w strefie `Europe/Warsaw`.
- Nie udajemy danych: brak odczytu to pusty stan z instrukcją, nie zero. Dane DEMO są jawnie oznaczone.
- Każda akcja zapisująca do zewnętrznej usługi lub wysyłająca wiadomość wymaga zatwierdzenia użytkownika (wyjątek: tryb autopilota agenta, który użytkownik włącza świadomie).

## Architektura

- `lib/**` — czysta logika i walidacja (bez Reacta), testowana w `tests/*.test.cjs` przez `tests/helpers/load-ts.cjs`. Kod serwerowy ma `import "server-only"`.
- `stores/**` — stan klienta (Zustand) i operacje, które łączą UI z API (`crm-store`, `agent-store`, `lead-crm`, `brand-scan`, `sync`, `scheduler`, `reminders`).
- `components/**` — widoki. Moduły: `crm/` (powłoka, CRM), `insights/` (wykresy pulpitu), `brand/` (Brand Studio), `leads/`, `local/` (SQLite: Brain, Konektory, Marketing, AI Brain), `integrations/`, `automation/`, `reports/`, `copilot/`.
- `app/api/**` — trasy Next.js. Dane przestrzeni: SQLite (`/api/local/...`, tylko localhost) albo Supabase (`/api/workspaces/...`, JWT + RLS). Skaner marki `/api/brand/scan` i agent `/api/agent` używają `lib/http/trust.ts` (localhost albo zalogowany użytkownik, blokada cross-site).
- Snapshot przestrzeni (`lib/growth/model.ts`) zawiera dane CRM i ustawienia (`businessMode`, `automation`, `brand`). Nowe pola ustawień: walidacja w `validateSnapshot`, `persist`/`merge`/`partialize` w `crm-store`, reset przy zmianie przestrzeni w `cloud-workspace.tsx` i migracja Supabase z testem w `tests/integration/`.
- Operacje asynchroniczne zmieniające store muszą być związane z przestrzenią: `assertWorkspace` / `flushWorkspace` z `stores/sync.ts` (wynik po zmianie przestrzeni jest odrzucany; powiązania zapisujemy po potwierdzonym zapisie CRM).

## Wygląd

- Style: istniejące klasy `crm-*` z `app/crm.css` + Tailwind 4 do układu. Karty sekcji przez `Panel` z `components/insights/kit.tsx`, przyciski `crm-button` / `crm-button secondary` / `crm-text-button`, ikony przez `Icon` z `components/crm/ui.tsx` (bez bibliotek ikon).
- Kolory marki tylko przez zmienne: `var(--primary)`, `var(--brand-50 … 950)`, `var(--brand-accent)`, `--brand-hero-a/b/c`. Klasy `violet-*` / `indigo-*` są przemalowywane przez Brand Studio — nie wpisuj nowych fioletowych hexów.
- Wykresy: własne komponenty SVG/CSS (`kit.tsx`, `crm/charts.tsx`, `brand/brand-history.tsx`), zawsze z etykietą dostępności i tabelą danych lub tekstową alternatywą; pusty stan zamiast pustych osi.
- Układ musi działać od 320 px bez poziomego przewijania; `prefers-reduced-motion` wyłącza animacje.

## Kod

- Bez komentarzy w kodzie (wyjątki już istniejące zostają). Nazwy i małe funkcje mają mówić same za siebie.
- TypeScript strict, Prettier z `prettier-plugin-tailwindcss` (formatuj zmienione pliki), ESLint `eslint-config-next`.
- Walidacja danych z zewnątrz (API, skaner, kopie, model AI) w `lib/**` przed zapisem; limity długości i rozmiaru.

## Weryfikacja

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build:localdb
npm run test:localdb   # Playwright SQLite, Node 24
npm run test:db        # migracje i RLS Supabase w Dockerze
```

CI (`.github/workflows/ci.yml`) uruchamia to samo dla każdego PR. Nowa funkcja = test jednostkowy logiki w `lib/**` i scenariusz Playwright dla przepływu w UI (API zewnętrzne mockowane przez `page.route`).
