# Evolution Growth OS 0.6 — plan dopracowania produktu

Cel: z działającego MVP zrobić produkt, który od pierwszego ekranu pokazuje wartość — piękny pulpit ze statystykami, agent AI działający bez konfiguracji i konektory na poziomie premium SaaS.

## Plan

| #   | Obszar        | Problem w 0.5                                                                            | Rozwiązanie w 0.6                                                                                                                                                           | Status |
| --- | ------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Pulpit        | Kafelki z liczbami, brak odpowiedzi „co dalej?”                                          | **Centrum dowodzenia**: hero z kondycją firmy (0–100), KPI, pole „Zapytaj agenta”, wykres przychodu 6 mies. + prognoza, rekomendacje AI z akcjami                           | ✅     |
| 2   | Agent AI      | Działał tylko po podłączeniu OpenRouter/CLI — nowy użytkownik widział wyłączony przycisk | **Evolution Agent (wbudowany)**: działa offline od razu, analizuje CRM, zadania, marketing i Company Brain; proponuje zadania/notatki przez ten sam mechanizm zatwierdzania | ✅     |
| 3   | UI agenta     | Formularz + lista odpowiedzi                                                             | Czat z dymkami, Markdown, szybkie pytania, Enter wysyła, wskaźnik pisania, panel „Silnik AI” z kartami dostawców, liczniki decyzji                                          | ✅     |
| 4   | Konektory     | Lista kart bez hierarchii                                                                | Katalog premium: hero ze statystykami, filtry kategorii, wyszukiwarka, logotypy-monogramy, karty „Planowane” z obejściem na dziś                                            | ✅     |
| 5   | Płatności     | Brak źródła przychodu poza CSV                                                           | **Stripe** (odczyt): przychód netto, zwroty, saldo, wykres dzienny 30 dni                                                                                                   | ✅     |
| 6   | Kolejne kroki | —                                                                                        | Slack digest od agenta, Meta Ads API, migracja HubSpot, Calendly → Lead Hub, agent na danych Lead Hub, harmonogram raportów                                                 | 🔜     |

## Zasady, których się trzymamy

- Agent nie wykonuje zmian sam — każda propozycja wymaga **Zatwierdź i wykonaj**, z kontrolą wersji CRM.
- Wbudowany agent nie wysyła danych poza komputer. Dostawcy zewnętrzni dostają ograniczony kontekst.
- Brak pozorowanych połączeń: konektory „Planowane” mają opis obejścia, a nie fałszywy przycisk „Połącz”.
- Sekrety (np. `STRIPE_SECRET_KEY`) tylko w `.env.local`; zalecany klucz ograniczony `rk_…` z odczytem Balance i Charges.

## Pliki

- `lib/crm/insights.ts` — reguły rekomendacji, kondycja, przychód miesięczny, statystyki lejka.
- `lib/ai/builtin.ts` — wbudowany agent (intencje: plan dnia, ryzyka, lejek, marketing, notatki, firma po nazwie).
- `lib/integrations/stripe.ts` — adapter Stripe i podsumowanie płatności.
- `components/crm/command-center.tsx`, `components/local/agent*.tsx`, `components/local/connector-catalog.tsx` — interfejs.
- `tests/agent.test.cjs` — testy jednostkowe powyższych modułów.

![Centrum dowodzenia](screenshots/command-center.png)
![Evolution Agent](screenshots/evolution-agent.png)
![Katalog konektorów](screenshots/connectors-catalog.png)

## 0.7 — konektory statystyk, menu, firmy i agent z pełnym kontekstem

| Obszar              | Co dodano                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konektory statystyk | **Meta Ads** (Graph API, `META_ACCESS_TOKEN` + konto `act_…`): dzienne wyniki kampanii trafiają do Pulpitu obok Google Ads. **Plausible Analytics** (`PLAUSIBLE_API_KEY`, opcjonalnie `PLAUSIBLE_HOST`): odwiedzający, wizyty, odsłony, odrzucenia i źródła ruchu. Wspólny formularz zasobu dla GA4, Search Console, Meta i Plausible.                                                                                                         |
| Menu boczne         | Grupy START / SPRZEDAŻ / AI I KOMUNIKACJA / DANE I WIEDZA, zwijane (pamiętane w przeglądarce), osobne ikony, liczniki (czerwony dla zaległych zadań), znacznik aktywnej pozycji, karta przestrzeni z trybem pracy, skrót do agenta. Górny pasek przestrzeni w jednej linii z rozwijanym formularzem nowej przestrzeni.                                                                                                                         |
| Zarządzanie firmami | Status relacji (Potencjalny, Aktywny klient, VIP, Wstrzymany, Utracony), opiekun, źródło pozyskania, tagi. KPI, zakładki statusów z licznikami, filtry branży / opiekuna / tagu, sortowanie, widok tabeli i kart, akcje zbiorcze (status, eksport, usuwanie), wskaźnik „następny krok”. Karta firmy z zakładkami: Przegląd (statystyki, dane, notatki), Kontakty, Szanse, Zadania (odhaczanie), Aktywność (e-maile) i „Zapytaj agenta”.        |
| Agent AI            | Kontekst ze **wszystkich statystyk**: CRM (lejek, miesiące, rekomendacje), Lead Hub, kampanie per źródło z porównaniem do poprzednich 30 dni, GA4 / Search Console / Plausible, Stripe, PostHog. „Pełna analiza firmy” z priorytetami, panel „Co widzi agent”, prawdziwa rozmowa wieloturowa z OpenRouter, test połączenia dla OpenRouter / ChatGPT (Codex) / Claude Code, instrukcje podłączenia, zapamiętany silnik i model, „Nowa rozmowa”. |

![Menu i pulpit](screenshots/sidebar-dashboard.png)
![Firmy](screenshots/companies-table.png)
![Karta firmy](screenshots/company-detail.png)
![Pełna analiza agenta](screenshots/agent-full-analysis.png)
