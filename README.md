<p align="center">
  <img src="public/assets/brand/evolution-mark.png" width="88" alt="Logo AI Evolution Polska">
</p>

# Evolution Growth OS · AI Evolution Polska

**Klienci, sprzedaż, wiedza firmy i AI w jednym miejscu — po polsku, na Twoim komputerze.**

Evolution Growth OS to narzędzie dla lokalnych firm usługowych, małych zespołów sprzedaży i właścicieli, którzy chcą uporządkować codzienną pracę. Zapisujesz zapytanie klienta, historię rozmów i ustalenia, planujesz realizację, a później sprawdzasz wyniki. W tej samej aplikacji przechowujesz wiedzę o firmie i korzystasz z wybranego modelu AI.

**Przykład:** klient trafia z reklamy, zostawia formularz i dzwoni. W Lead Hub zapisujesz te kontakty przy jednej osobie, dodajesz ofertę, rezerwację, wykonanie pracy i wpłatę. W Company Brain zbierasz ofertę i zasady komunikacji marki. AI Brain pomaga analizować kontekst oraz proponuje zadania i notatki, które zatwierdzasz przed wykonaniem.

Jasny interfejs ze szkłem i miękkimi gradientami, widok mobilny, kwoty w PLN, walidacja NIP oraz polskie daty. **AI Evolution Polska · wersja 0.9.0.** Zalecana edycja lokalna zapisuje dane w SQLite i nie wymaga konta Supabase. Podłączenie AI jest opcjonalne.

**W 0.9:** czytelniejszy pulpit z wyborem **6 / 12 miesięcy**, dotykowym wyborem miesiąca i tabelą danych; **zbiorcze odświeżanie statystyk** w Konektorach; **dyktowanie po polsku** w obu czatach agenta. Delikatny shader ożywia wyłącznie nagłówek, a przy ograniczeniu ruchu lub braku WebGPU pozostaje statyczny gradient. Opis zachowania i weryfikacji: [docs/UI-0.9.md](docs/UI-0.9.md). [Nowe screenshoty](#interfejs-09--nowe-screenshoty).

![Centrum dowodzenia Evolution Growth OS](docs/screenshots/command-center.png)

**W 0.8:** **Agent AI, który sam obsługuje CRM** — w każdym trybie (przeglądarka, SQLite, Supabase), z modelem przez OpenRouter, OpenAI API, lokalną Ollamą/LM Studio, subskrypcją ChatGPT (Codex CLI) albo Claude Code; tryb **autopilota**. Nowy pulpit ze **statystykami i porównaniem okresów**, **Raporty** z eksportem PDF/Markdown/CSV oraz **Harmonogram** cyklicznych raportów, follow-upów i zadań agenta. Szczegóły: [docs/AUDIT-0.8.md](docs/AUDIT-0.8.md).

![Pulpit 0.8 — statystyki, harmonogram i raporty](docs/screenshots/dashboard-stats.png)

**W 0.7:** logowanie Google, wybór usług i statystyki Ads bez CSV. Aplikacja zawiera również Centrum dowodzenia, wbudowanego **Evolution Agenta** bez klucza API, katalog konektorów i odczyt płatności **Stripe**. Plan i szczegóły: [docs/PRODUCT-POLISH.md](docs/PRODUCT-POLISH.md).

![Pulpit Evolution Growth OS z wynikami kampanii DEMO](docs/screenshots/local-dashboard.png)

_Działająca aplikacja, lokalny zapis SQLite i zaimportowane dane demonstracyjne. Więcej ekranów znajdziesz w [galerii na końcu README](#screenshoty-aplikacji)._

[Uruchom lokalnie](#szybki-start-na-twoim-komputerze) · [Poznaj moduły](#co-możesz-zrobić-w-aplikacji) · [Podłącz AI](#ai-brain-własny-dostawca-i-model) · [Zobacz screenshoty](#screenshoty-aplikacji) · [Dokumentacja](docs/PRODUCT.md)

## Co możesz zrobić w aplikacji

| Moduł                     | Do czego służy                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lead Hub**              | Jedna karta potencjalnego klienta: kontakt, status, źródła, kampanie, UTM, rozmowy, oferty, rezerwacje, realizacje i wpłaty.                                                                        |
| **CRM i sprzedaż**        | Firmy, kontakty, szanse sprzedaży, etapy, zadania, wyszukiwanie i eksporty.                                                                                                                         |
| **Firma usługowa**        | Klienci, rezerwacje prac, terminy, przypisanie osoby lub stanowiska, kontrola kolizji i historia realizacji.                                                                                        |
| **Pulpit**                | Wykresy sprzedaży i usług; po imporcie CSV także wyniki marketingu, koszty, leady i wskaźniki kampanii.                                                                                             |
| **Company Brain**         | Wiedza firmy w Markdown: oferta, marka, marketing, foldery, wikilinki, wersje notatek i eksport do Obsidiana.                                                                                       |
| **Generator mózgu firmy** | Publiczna strona firmy → szkic wiedzy ze źródłami i pytaniami o braki → podgląd → zatwierdzenie zapisu.                                                                                             |
| **Agent AI**              | Czat, który obsługuje CRM: dodaje firmy, kontakty, szanse i zadania, zmienia etapy, pisze szkice maili, tworzy raporty i automatyzacje. Offline albo OpenRouter / OpenAI / Ollama / Codex / Claude. |
| **Raporty**               | Raport zarządczy, sprzedaży, aktywności i usług za wybrany okres, z porównaniem do poprzedniego okresu, wykresami, rekomendacjami i podsumowaniem AI; eksport PDF, Markdown, CSV.                   |
| **Harmonogram**           | Cykliczne zadania (codziennie, w dni robocze, co tydzień, co miesiąc): raporty, automatyczne follow-upy i polecenia dla agenta AI, z historią uruchomień.                                           |
| **AI Brain (SQLite)**     | Agent Company Brain z notatkami i marketingiem; propozycje zadań i notatek z kontrolą wersji po stronie serwera.                                                                                    |
| **Konektory i poczta**    | Katalog z filtrami; logowanie Google i odczyty Ads, GA4, Search Console, WordPress, PostHog i Stripe, import wyników kampanii, zatwierdzana wysyłka przez Resend lub szkic w programie pocztowym.   |

**Dwa sposoby pracy:** CRM i sprzedaż albo Firma usługowa. Przełączenie zmienia widoki i zachowuje dane. Lead Hub działa obok dotychczasowego CRM; nie przenosi automatycznie kontaktów ani zleceń między modułami.

**Lokalny zapis nie oznacza, że każde działanie odbywa się offline.** CRM, historia leadów i notatki korzystają z lokalnej bazy. Analiza AI, odczyt strony firmy, konektory i wysyłka przez dostawcę wymagają połączenia oraz odpowiedniej konfiguracji. Zakres funkcji zależy od trybu przechowywania opisanego poniżej.

## Szybki start na Twoim komputerze

Wymagany **Node.js 24 LTS** i npm. Pobierz repozytorium, otwórz terminal w jego folderze:

```bash
git clone https://github.com/aievolutionpl/CRM-DASHBOARD.git
cd CRM-DASHBOARD
npm ci
npm run dev:localdb
```

Na **tym samym komputerze** otwórz `http://localhost:3000`. Windows: możesz uruchomić `URUCHOM-BAZA.bat`; macOS/Linux: `bash uruchom-baza.sh`. Skrypty instalują zależności i uruchamiają aplikację. Wariant Windows nie był wykonywany w środowisku Linux.

1. Utwórz przestrzeń swojej firmy. Nowy CRM jest pusty.
2. W trzech krokach onboardingu wybierz **CRM i sprzedaż** lub **Firma usługowa**.
3. Otwórz **Lead Hub → Dodaj przykład DEMO**, aby zobaczyć historię od reklamy do płatności. DEMO jest wyraźnie oznaczone i oddzielone filtrem od rzeczywistych danych.
4. Dodaj własnego leada, klienta lub firmę. Zapisz kontakt i ustalenia; zaplanuj zadanie albo realizację.
5. Opcjonalnie wybierz dostawcę i model w **Agent AI**. Agent wiedzy jest w rozwijanej sekcji **Agent Company Brain (SQLite)**. Przygotuj wiedzę w **Company Brain → Wygeneruj ze strony**; notatki możesz też dodać ręcznie lub zaimportować z Markdown.
6. Zaimportuj wyniki kampanii w **Konektorach** i sprawdź je na **Pulpicie**. Dostępne wskaźniki wynikają z zapisanych danych.

Serwer uruchamia się tylko na `127.0.0.1`. Zostaw terminal otwarty; `Ctrl+C` zatrzymuje aplikację. Możesz ustawić `CRM_LOCAL_PORT`, gdy port 3000 jest zajęty. `localhost` oznacza komputer przeglądarki: serwer uruchomiony w Codex nie działa na Twoim laptopie. Lokalna edycja nie wymaga Supabase ani konta.

Do codziennego używania bez serwera developerskiego możesz wykonać zoptymalizowany build lokalny:

```bash
npm run build:localdb
npm run start:localdb
```

Oba polecenia ustawiają tryb SQLite. Po zmianie kodu lub publicznych env ponów build. Wspólny katalog `.next` mieści ostatni build: nie uruchamiaj `start:localdb` po buildzie innego trybu.

## Wybierz miejsce przechowywania danych

| Tryb                                    | Uruchomienie                                       | Dane i funkcje                                                                                       |
| --------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **SQLite — zalecany do lokalnej pracy** | `npm run dev:localdb`                              | Plik na komputerze serwera; CRM, Lead Hub, Company Brain, generator, konektory, marketing i AI Brain |
| **Przeglądarka**                        | `NEXT_PUBLIC_CRM_MODE=local`, `npm run dev`        | Zachowany CRM z localStorage, pocztą i agentem follow-up                                             |
| **Supabase**                            | Konfiguracja poniżej, `NEXT_PUBLIC_CRM_MODE=cloud` | Konta, przestrzenie, role, wspólny CRM i Lead Hub                                                    |

Nowe moduły wiedzy, konektorów i modeli AI działają obecnie w **SQLite**. Supabase obejmuje CRM i Lead Hub; migracja pozostałych modułów jest w roadmapie. SQLite jest przeznaczone do lokalnej instalacji, bez kont i logowania. Oddzielne przestrzenie porządkują dane firm; nie stanowią ochrony przed innym użytkownikiem tego samego komputera.

## Lead Hub: jedna osoba, źródła i historia współpracy

W menu **Lead Hub** zapiszesz potencjalnego klienta od pierwszego kontaktu do realizacji i wpłaty. Moduł działa w **SQLite i Supabase**, obok istniejącego CRM, w obu sposobach pracy.

1. Kliknij **Dodaj leada**. Wpisz kontakt, źródło, kampanię i szacowaną wartość. Opcjonalnie dodaj UTM, landing page i słowo kluczowe.
2. Otwórz kartę i wybierz **Dodaj zdarzenie**: rozmowę, formularz, ofertę, rezerwację, realizację albo wpłatę. Podaj rzeczywisty czas i szczegóły.
3. W **Edytuj leada** aktualizuj status, notatki i dane. Wpłaty zwiększają revenue; pozostałe wartości nie są ponownie liczone jako przychód. Status zmieniasz świadomie, osobno od zdarzeń.
4. Przeglądaj oś kontaktu, first/last touch, źródła i podstawowe rekordy sprzedaży. Lista ma wyszukiwanie, filtry i strony po 50 pozycji.
5. **Dodaj przykład DEMO** pokazuje pełny przebieg: reklama → strona → formularz → telefon → kwalifikacja → oferta → rezerwacja → praca → płatność. Jest oznaczony i domyślnie oddzielony od rzeczywistych leadów. Ponowne kliknięcie otwiera ten sam przykład.

E-mail lub telefon rozpoznają istniejący kontakt w danej przestrzeni. Jeśli wskazują dwie różne osoby, zapis zgłasza konflikt zamiast łączyć je automatycznie. Viewer może czytać i filtrować, ale nie zmieniać danych. **Pobierz historię JSON** pobiera JSON karty i historii; pełna kopia SQLite obejmuje cały moduł. Kopia JSON starego CRM nie obejmuje Lead Hub.

To zapisane zdarzenia i fundament sprzedaży: brak automatycznego pobierania z Ads/telefonii, faktur, synchronizacji z kalendarzem zleceń oraz połączenia kosztów kampanii z ROAS. Agent AI nie operuje jeszcze na Lead Hub. [Dane, API, uprawnienia i ograniczenia](docs/LEAD-HUB.md).

## Dwa sposoby pracy: sprzedaż albo usługi

W lewym menu **Sposób pracy → Firma usługowa** przełączysz aplikację na klientów i realizacje. Ten sam wybór jest w pierwszym kroku onboardingu. Tryb jest zapamiętywany dla przestrzeni firmy w SQLite / Supabase lub dla lokalnego CRM w przeglądarce. Przełączenie zachowuje dane.

| CRM i sprzedaż                              | Firma usługowa                                                |
| ------------------------------------------- | ------------------------------------------------------------- |
| Firmy, osoby kontaktowe i szanse sprzedaży  | Klienci prywatni lub firmy, dane kontaktowe, adres i notatki  |
| Etapy sprzedaży, prognoza i wygrane rozmowy | Zarezerwowane prace, osoba/stanowisko, termin i status        |
| Wykres etapów: wartość lub liczba szans     | Trend wartości wykonanych usług, statusy i najbliższe terminy |
| Zadania, e-maile, wiedza i AI               | Zadania, e-maile, wiedza i AI                                 |

**Pierwsza realizacja:** otwórz **Klienci → Dodaj klienta**, wpisz nazwę, kontakt i ustalenia. W **Zleceniach → Zarezerwuj pracę** wybierz klienta, nazwę usługi, początek i koniec, wartość w PLN oraz osobę/stanowisko. Statusy to **Zarezerwowane → W realizacji → Zakończone**, z opcją anulowania. Edycja pozwala zmienić termin, przypisanie i ponownie otworzyć pracę. Dane firmowe klienta są opcjonalne i schowane w rozwijanym bloku.

Dwie aktywne rezerwacje nie mogą nakładać się dla tej samej osoby/stanowiska. Wielkość liter i spacje w nazwie zasobu są ignorowane. Sąsiadujące terminy są dozwolone, a różne zasoby mogą pracować równolegle. Anulowane i zakończone prace nie blokują kalendarza; wznowienie ponownie sprawdza dostępność. Walidacja działa także przy zapisie w bazie i imporcie kopii.

Na karcie klienta znajdziesz wszystkie jego rezerwacje i realizacje. W zleceniu rozwiń **Historię zlecenia**, aby zobaczyć utworzenie, zmiany i statusy (do 200 ostatnich wpisów). Wyszukiwarka otwiera właściwy formularz pracy. Usługi nie są liczone jako szanse w pulpicie B2B. Przełączenie nie zamienia starych szans w rezerwacje.

Terminy wpisujesz jako czas miejscowy **Europe/Warsaw**. To terminarz rezerwacji, bez synchronizacji Google/Outlook i automatycznych przypomnień. Wartość zlecenia oznacza ustaloną wartość usługi; nie potwierdza płatności ani wystawienia faktury.

## Pulpit: statystyki, które można sprawdzić

- **Marketing:** trend leadów, wydatków lub przychodu z CSV; wybór okresu i źródła oraz udział kanałów. Brak importu tworzy lukę zamiast wymyślonego zera. Dłuższe zakresy mają do 30 sumowanych przedziałów.
- **Sprzedaż:** wykres etapów przełączany między PLN i liczbą szans, prognoza ważona oraz udział wygranych i przegranych w zamkniętych rozmowach.
- **Usługi:** klienci, aktywne rezerwacje, ich wartość, zakończone realizacje, statusy i plan pracy. Trend 7/30/90 dni liczy aktualnie zakończone prace według daty ich rozpoczęcia. Dni bez realizacji mają wartość zero.

Wskaż punkt wykresu kursorem, dotknięciem lub klawiaturą, aby zobaczyć dokładną wartość. **Dane wykresu** otwierają tabelę liczb. Puste dane pozostają puste. Interfejs działa na telefonie, a efekty szkła mają warianty dla ograniczonej przezroczystości i ruchu.

## Company Brain: mózg firmy ze strony

Generator korzysta ze struktury przesłanego [COMPANY BRAIN TEMPLATE](docs/templates/COMPANY_BRAIN_TEMPLATE.md). Szablon jest materiałem odniesienia; aplikacja zachowuje własne zasady zatwierdzania działań.

1. Podłącz AI w **AI Brain**.
2. Otwórz **Company Brain → Wygeneruj ze strony**.
3. Podaj publiczny, docelowy adres HTTPS firmy; wybierz dostawcę i model.
4. Kliknij **Wygeneruj mózg firmy**. Odczytany tekst strony i do 4 podstron tej samej domeny trafi do wybranego modelu.
5. Przeczytaj podgląd, źródła oraz maksymalnie 8 pytań o braki.
6. Wybierz **Zatwierdź i zapisz 4 notatki**. Zapis odbywa się w jednej transakcji.
7. Uzupełnij odpowiedzi właściciela przez **Edytuj notatkę** i pobierz wiedzę do Obsidiana.

| Dokument                  | Zawartość                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Firma — COMPANY_BRAIN** | Główny dokument: 34 sekcje, od kontekstu i kontaktu przez ofertę, klientów, markę, SEO i marketing po źródła, aktualność danych oraz historię zmian |
| **Firma — Oferta**        | Usługi, klient, pozycjonowanie i twierdzenia wymagające dowodów                                                                                     |
| **Firma — Marka**         | Ton komunikacji, identyfikacja wizualna i ograniczenia komunikacji                                                                                  |
| **Firma — Marketing**     | Propozycje SEO, treści, reklam, KPI i automatyzacji                                                                                                 |

**CONFIRMED** oznacza informację znalezioną w odczytanym źródle, a nie akceptację właściciela. **TO CONFIRM** to interpretacja, hipoteza lub propozycja. **MISSING** oznacza brak danych w zebranych stronach. Dynamiczne dane, np. ceny i godziny, trzeba ponownie sprawdzić przed publikacją. Model może się pomylić; podgląd i źródła służą weryfikacji.

Generator zbiera publiczny HTML, bez logowania i wykonywania JavaScript. Wybiera podstrony typu oferta, o nas, kontakt, cennik lub FAQ; nie przegląda całej witryny. Nie wyszukuje zewnętrznych opinii, konkurentów ani statystyk SEO. Nieznane sekcje pozostają oznaczone. Nie podawaj linków zawierających tokeny, login lub parametry. Przekierowania są odrzucane: użyj końcowego adresu widocznego w przeglądarce. Limit strony: 2 MB i 20 sekund; do modelu trafia do 14 tys. znaków tekstu z każdej strony.

Odczyt blokuje prywatne adresy sieciowe i przypina zweryfikowany DNS do połączenia TLS. Przy wykrytym proxy HTTPS informuje o ograniczeniu i nie omija proxy. Strony blokujące automatyczny odczyt lub wymagające JavaScript mogą nie dostarczyć treści — wtedy skorzystaj z importu Markdown.

Szkic jest zachowany w SQLite i wraca po ponownym otwarciu generatora. Przed zatwierdzeniem nie trafia do notatek używanych przez agenta. Zapis nie nadpisuje istniejących notatek o tej samej nazwie; konflikt zatrzymuje całą transakcję. Możesz edytować dotychczasową wiedzę albo zmienić jej tytuł przed zapisem kolejnego szkicu. Notatki skrótowe są kopiami sekcji z dnia generowania: po zmianach aktualizuj je razem z dokumentem głównym.

## Wiedza i Obsidian

Company Brain obsługuje foldery, wyszukiwanie, edycję, usuwanie, wersje notatek i linki przychodzące. Markdown ma podgląd nagłówków, list, tabel, pogrubień, kodu i linków HTTPS; surowy HTML nie jest wykonywany.

- `[[Tytuł]]` łączy notatki.
- `[[services/Tytuł]]` wskazuje konkretny folder przy powtarzających się tytułach.
- `[[Tytuł|opis]]` dodaje czytelną nazwę linku.
- **Importuj .md:** do 100 plików naraz, 200 KB na plik, do wybranego folderu. Import plików jest kolejny: przy błędzie wcześniejsze poprawne pliki pozostają zapisane.
- **Eksport do Obsidiana / Pobierz do Obsidiana:** pobiera ZIP z oryginalnym Markdown i folderami.

Rozpakuj ZIP, a w Obsidianie wybierz **Otwórz folder jako skarbiec**. To import i eksport; edycja w Obsidianie nie synchronizuje się automatycznie z aplikacją. Eksport obejmuje notatki bieżącej przestrzeni, bez kampanii i CRM.

## Agent AI: model, autopilot i obsługa CRM

Wpisz wiadomość w oknie czatu albo wybierz **Dyktuj wiadomość**. Dyktowanie ustawia język `pl-PL`, dopisuje rozpoznany tekst do szkicu i **nie wysyła go automatycznie**. Sprawdź treść i kliknij **Wyślij** (w agencie Company Brain: **Analizuj**). Enter wysyła, Shift+Enter dodaje nową linię. Funkcja zależy od obsługi rozpoznawania mowy i zgody na mikrofon w przeglądarce; jej usługa może przetwarzać dźwięk online. Odmowa dostępu nie usuwa szkicu. To dyktowanie wiadomości, bez rozmowy audio i odczytywania odpowiedzi na głos.

Długa rozmowa przewija się wewnątrz czatu. Gdy czytasz wcześniejsze odpowiedzi, nowa odpowiedź nie przenosi Cię automatycznie na koniec. Nieudane wysłanie zachowuje tekst do poprawienia lub ponowienia; dodatkowe kliknięcie podczas trwającego żądania nie uruchamia drugiej analizy.

Sekcja **Agent AI** działa w każdym trybie przechowywania. Agent dostaje aktualny stan CRM (firmy, kontakty, szanse, otwarte zadania, harmonogram i ostatnie raporty) i odpowiada w Markdown wraz z listą **akcji**. Każdą akcję wykonujesz przyciskiem **Wykonaj** (lub **Wykonaj wszystkie**), a po włączeniu **Autopilota** agent wykonuje je sam. Akcje są walidowane przed zapisem; nieznane lub błędne propozycje są odrzucane i pokazywane w czacie.

| Akcja agenta                        | Co robi                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `create_company` / `create_contact` | Dodaje firmę (bez duplikatów po nazwie) i osobę kontaktową  |
| `create_deal` / `update_deal`       | Dodaje szansę lub zmienia etap, wartość, prawdopodobieństwo |
| `create_task` / `complete_task`     | Planuje lub zamyka zadanie                                  |
| `draft_email`                       | Zapisuje **szkic** w Poczcie — nic nie jest wysyłane        |
| `generate_report` / `schedule_job`  | Tworzy raport lub automatyzację w Harmonogramie             |

| Silnik                              | Konfiguracja                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Evolution Agent · offline**       | Działa od razu. Rozumie m.in. „Dodaj firmę Acme z Poznania”, „Dodaj zadanie … jutro”, raporty i harmonogram.       |
| **OpenRouter API**                  | Klucz `sk-or-…` w panelu albo `OPENROUTER_API_KEY` w `.env.local`; **Pobierz listę modeli** i wybierz model.       |
| **OpenAI API (ChatGPT)**            | Klucz `sk-…` w panelu albo `OPENAI_API_KEY`; np. `gpt-4o-mini`.                                                    |
| **Lokalny model**                   | `LOCAL_AI_BASE_URL=http://127.0.0.1:11434/v1` (Ollama) lub `:1234/v1` (LM Studio). Dane nie opuszczają komputera.  |
| **Subskrypcja ChatGPT · Codex CLI** | `npm i -g @openai/codex`, `codex login` kontem ChatGPT, `LOCAL_AI_CLI_ENABLED=1`. Model `default` = model z konta. |
| **Claude Code CLI**                 | `npm i -g @anthropic-ai/claude-code`, zaloguj `claude`, `LOCAL_AI_CLI_ENABLED=1`; model np. `sonnet`.              |

**Bezpieczeństwo kluczy:** klucze serwera (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, lokalny model) są używane tylko dla żądań z `localhost` albo zalogowanych użytkowników Supabase — publiczna instancja w trybie przeglądarki wymaga własnego klucza użytkownika. Klucz wpisany w panelu trzyma się w pamięci karty, a w `localStorage` tylko po zaznaczeniu **Zapamiętaj klucz na tym urządzeniu**. CLI działają wyłącznie na `localhost`. Gdy zewnętrzny dostawca nie odpowie, odpowiada agent offline z ostrzeżeniem w czacie.

## Raporty i Harmonogram

**Raporty** liczą KPI za okres (7/30 dni, bieżący/poprzedni miesiąc, kwartał, rok) i porównują je z poprzednim okresem tej samej długości. Raport zawiera wykresy, tabele (wygrane, szanse do zamknięcia, zaległości, zlecenia) i rekomendacje. Z wybranym modelem AI agent dopisze **podsumowanie zarządcze**. Eksport: **PDF** (druk raportu bez interfejsu), **Markdown** i **CSV** (Excel, średnik, ochrona formuł). Historia przechowuje 24 ostatnie raporty.

**Harmonogram** uruchamia zadania o wskazanej godzinie czasu polskiego: raport, automatyczne follow-upy (zadania dla szans bez kolejnego kroku) albo polecenie dla agenta AI. Zadania działają, gdy aplikacja jest otwarta w przeglądarce; pominięte terminy są nadrabiane po jej otwarciu, a blokada zapobiega podwójnemu uruchomieniu w kilku kartach. Harmonogram, historia uruchomień i raporty zapisują się razem z przestrzenią: w przeglądarce, w SQLite oraz w Supabase (migracja `202610060001_automation_reports.sql`).

## AI Brain: własny dostawca i model

| Dostawca                    | Jak podłączyć                                                                                                            | Rozliczenie                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **OpenRouter API**          | Klucz w panelu AI Brain → Podłącz API → Pobierz modele; wybierz lub wpisz identyfikator                                  | Środki i stawka modelu na koncie OpenRouter       |
| **ChatGPT przez Codex CLI** | Zainstaluj Codex CLI, wykonaj `codex login` i zaloguj własne konto; ustaw `LOCAL_AI_CLI_ENABLED=1`, zrestartuj aplikację | Dostęp i limity Twojego planu ChatGPT / konta CLI |
| **Claude Code CLI**         | Zainstaluj Claude Code, zaloguj CLI przez `claude`; ustaw `LOCAL_AI_CLI_ENABLED=1`, zrestartuj aplikację                 | Plan lub rozliczenie skonfigurowane w Claude Code |

Subskrypcja ChatGPT nie jest kluczem OpenRouter ani OpenAI API. Aplikacja korzysta z oficjalnie zalogowanego CLI użytkownika; nie pobiera cookies z przeglądarki. Dostępność konkretnego modelu zależy od konta. Dla Codex wpisz obsługiwany identyfikator; dla Claude możesz użyć np. `sonnet`. Aplikacja wymaga wersji CLI obsługującej flagi opisane w [architekturze lokalnej](docs/LOCAL-EDITION.md).

Klucz wpisany w panelu OpenRouter jest przechowywany w pamięci serwera przez 30 minut. Nie trafia do SQLite ani localStorage. **Usuń klucz sesji** usuwa ten wpis. Alternatywnie ustaw `OPENROUTER_API_KEY` w `.env.local`; klucz z pliku pozostaje aktywny po usunięciu klucza sesyjnego. Status dostępności klucza lub wykrycia CLI nie potwierdza logowania, środków ani dostępu do modelu — sprawdza je rzeczywiste wywołanie.

Agent otrzymuje kontekst wybranej przestrzeni: marketing z 30 dni, do 20 firm, szans i otwartych zadań, do 5 notatek oraz fragmenty 3 ostatnich rozmów. Główny COMPANY_BRAIN jest priorytetem, do 12 tys. znaków; pozostałe notatki są dobierane do pytania, do 2,5 tys. znaków każda. Większa wiedza jest skracana. Dane trafiają do dostawcy po kliknięciu **Analizuj**; klucze integracji nie są częścią kontekstu.

Agent może zaproponować **zadanie** lub **notatkę**. Sprawdź podgląd i wybierz **Zatwierdź i wykonaj** albo **Odrzuć**. Serwer kontroluje przestrzeń, wersję CRM i stan propozycji; ponowienie decyzji nie tworzy duplikatu. Zmiana CRM po analizie wymaga nowej propozycji. Agent nie ma dowolnego SQL, poleceń systemowych, publikacji stron, zmian reklam ani wysyłki e-maili. Poczta ma własne zatwierdzenie.

CLI działa w folderze tymczasowym: Codex z `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, sandbox read-only, wyłączonym shell/unified_exec, MCP i web search; Claude z `--tools ""` i pustą, ścisłą konfiguracją MCP. Narzędzia biznesowe wykonuje aplikacja po zatwierdzeniu. Generator strony jest osobnym przepływem: zbiera publiczną treść i proponuje zestaw wiedzy.

**Koszt:** analiza dopuszcza do 3000 tokenów odpowiedzi, generator do 8000; kontekst wejściowy też podlega rozliczeniu. Zużycie pokazujemy, jeśli dostawca je zwróci. AI Brain (SQLite) nie działa w tle; cykliczne zadania agenta konfigurujesz w Harmonogramie.

## Google OAuth, Analytics 4, Search Console i Ads

W **Konektorach → Połącz przez Google** zalogujesz się na własne konto. Wybór usług i połączenie są osobne dla każdej firmy. Google Ads pobiera wyniki **bez CSV**, przez oficjalne API; import CSV nadal jest dostępny jako niezależne źródło.

1. Jednorazowo utwórz klienta OAuth typu **Web** w Google Cloud i włącz Analytics Data API, Analytics Admin API oraz Search Console API. Dodaj dokładny URI przekierowania widoczny w Konektorach, np. `http://localhost:3000/api/local/google/callback`.
2. W `.env.local` wpisz `GOOGLE_OAUTH_CLIENT_ID` i `GOOGLE_OAUTH_CLIENT_SECRET`. Do Ads włącz także Google Ads API i dodaj `GOOGLE_ADS_DEVELOPER_TOKEN` z centrum API swojego konta menedżera MCC. Zrestartuj aplikację.
3. Kliknij **Połącz przez Google**; opcjonalnie zaznacz Google Ads. W Google zaakceptuj wszystkie żądane usługi. Po powrocie kliknij **Wczytaj dostępne usługi**, wybierz usługę i zapisz. Dostępny jest też ręczny wpis identyfikatora.
4. Dla agencji wpisz MCC i kliknij **Wczytaj konta pod menedżerem MCC**. Wybierz konto reklamowe; menedżer nie jest kontem z wynikami kampanii.
5. Kliknij **Sprawdź odczyt**, potem **Pobierz statystyki**. Raport pozostaje lokalnie i pojawia się również na **Pulpicie**.

| Źródło             | Raport                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GA4**            | Sesje, użytkownicy za okres, odsłony, kluczowe zdarzenia, przychód w walucie usługi i kanały.                                                              |
| **Search Console** | Kliknięcia, wyświetlenia, CTR, pozycja i zapytania; 30 dni kończące się 3 dni temu.                                                                        |
| **Google Ads**     | Koszt, kliknięcia, wyświetlenia, konwersje, wartość konwersji, CTR, CPC, CPA i ROAS. Wykresy oraz do 20 kampanii według kosztu, w walucie i strefie konta. |

Działa w **lokalnej edycji SQLite**. Odczyt jest ręczny i nie zmienia kampanii. Google Ads wymaga scope `adwords`, który pozwala także na zarządzanie reklamami; aplikacja wykonuje wyłącznie zapytania odczytu. Dane Google nie są dodawane do CSV ani wpłat Lead Hub. Nie ma automatycznego trackingu ani harmonogramu. Nadal działają zaawansowane konfiguracje konta usługi GA4/GSC i tokenu OAuth w `.env.local`.

Tokeny odświeżania z logowania są szyfrowane osobno dla firm, poza SQLite i repozytorium. **Pełna kopia SQLite nie zawiera tokenów Google**; po odtworzeniu na innym komputerze zaloguj się ponownie. Zmiana konta czyści wybór usług i raporty Google tej firmy. **Usuń lokalne połączenie Google** usuwa lokalny token i raporty; zgodę Google cofniesz w ustawieniach swojego konta.

[Pełna instrukcja Google: OAuth, uprawnienia, konta MCC, token deweloperski, kopie i diagnostyka](docs/GOOGLE-INTEGRATIONS.md).

## Konektory i pulpit marketingowy

Konektory pokazują brak konfiguracji, udany odczyt, datę sprawdzenia, błąd i wyłączenie w przestrzeni. Odczyt jest ręczny. Po zmianie `.env.local` zrestartuj aplikację; plik dotyczy całej instalacji, a zapisane dane są oddzielne dla firm. „Odczyt API sprawdzony” potwierdza żądanie do API, nie poprawność trackingu.

| Integracja                                        | Konfiguracja                                                                                | Działające operacje                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **WordPress / Elementor**                         | `WP_BASE_URL=https://twoja-strona.pl`; opcjonalnie `WP_USERNAME`, `WP_APPLICATION_PASSWORD` | Sprawdzenie API i import pierwszych 100 opublikowanych stron do folderu `web`; bez publikacji i zmian w Elementorze |
| **Google Analytics 4**                            | Logowanie Google lub konto usługi; wybór GA4 z listy albo ręcznie                           | Odczyt danych za 30 dni, kanały, lokalny zapis i wykresy na Pulpicie                                                |
| **Google Search Console**                         | Logowanie Google lub konto usługi; wybór witryny z listy albo ręcznie                       | Dane skuteczności Web, trend dzienny, CTR, pozycja i do 20 zapytań                                                  |
| **PostHog Cloud EU/US**                           | `POSTHOG_HOST`, `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`                            | Liczba zdarzeń według typu z ostatnich 30 dni; ręczny odczyt zapisuje wynik lokalnie                                |
| **Google Ads API**                                | Google OAuth z adwords, token deweloperski, konto Ads i opcjonalnie MCC                     | Koszt, konwersje, CPC, CPA, ROAS, wykresy i kampanie; ręczny odczyt, bez zmian reklam                               |
| **CSV: Google Ads / Microsoft Ads i inne kanały** | Plik CSV według szablonu z Konektorów                                                       | Import dziennych wyników i aktualizacja tych samych dat, kampanii oraz źródeł; import niezależny od API             |
| **Resend**                                        | `RESEND_API_KEY`, `CRM_MAIL_FROM`, `CRM_MAIL_ACCESS_TOKEN`                                  | Test odczytu domen i wysyłka zatwierdzonych szkiców                                                                 |
| **OpenRouter / Codex / Claude Code**              | Panel AI Brain lub konfiguracja powyżej                                                     | Wybór modelu, analiza, generator wiedzy i propozycje działań                                                        |

CSV wymaga kolumn `date, source, campaign, spend, impressions, clicks, leads, qualified, revenue`. Daty: `YYYY-MM-DD`; kwoty w PLN; źródła: `google_ads`, `microsoft_ads`, `organic`, `gbp`, `direct`. Obsługuje separator średnik/przecinek, cudzysłowy i polskie znaki. Wartości nie mogą być ujemne, kwalifikowane leady nie mogą przekraczać leadów. Limit: 2 MB / 10 tys. wierszy. Pobierany szablon z zerami jest przykładem do uzupełnienia.

**Pulpit** wylicza wydatki, leady, leady kwalifikowane, CPA, CPQL, przychód, CVR i ROAS z importowanych danych. Możesz wybrać 7/30/90 dni, własne daty i źródło, porównać poprzedni okres oraz zobaczyć kampanie. Brak mianownika daje „—”. Pod marketingiem pozostaje pulpit sprzedaży: firmy, wartości szans i zadania.

## CRM i poczta

Dodawaj firmy z NIP, kontakty, szanse z wartością w PLN i zadania. Tablica szans pozwala przesuwać etap; wykresy i wartości wynikają z aktualnych danych. CRM ma wyszukiwanie, eksporty CSV i kopię JSON.

**Resend:** zweryfikuj domenę nadawcy, skopiuj `.env.example` do `.env.local` i uzupełnij zmienne poczty. W **Ustawieniach** wpisz własny token dostępu na czas sesji i sprawdź połączenie. Klucz Resend jest tylko na serwerze. Przed wysyłką sprawdź odbiorcę, treść i podstawę kontaktu. Wiadomości demonstracyjne do example.com/.org/.net są blokowane. „Przyjęta przez Resend” nie oznacza potwierdzonego doręczenia; brak webhooków i synchronizacji odpowiedzi. Test odczytu domen może wymagać szerszych uprawnień niż klucz tylko do wysyłki.

**Program pocztowy:** otwiera szkic przez `mailto:` w skonfigurowanym Gmailu, Outlooku lub innej aplikacji. Wysyłkę kończysz w tym programie. To nie OAuth ani synchronizacja skrzynki.

**Agent follow-up:** osobny asystent regułowy. Po kliknięciu przygotowuje polskie szkice na podstawie otwartych szans i kontaktów z potwierdzoną podstawą kontaktu. Unika kolejnego oczekującego szkicu dla tej samej osoby. Treść edytujesz i zatwierdzasz w Poczcie. Nie działa w tle i nie korzysta z modelu AI.

## Kopie, przenoszenie i aktualizacja

- **Cała baza SQLite:** w Ustawieniach kliknij **Pobierz całą bazę SQLite**. Spójna kopia zawiera wszystkie przestrzenie, CRM, Lead Hub, wiedzę, szkice generatora, kampanie, odczyty i historię agenta. Bez kluczy dostawców.
- **JSON CRM:** obejmuje tylko dane i ustawienia CRM jednej przestrzeni. Umożliwia przeniesienie zachowanego CRM między przeglądarką, SQLite i Supabase.
- **ZIP Obsidian:** obejmuje zapisane notatki jednej przestrzeni.

Domyślny plik: `data/evolution.sqlite`; zmień go przez `CRM_DATABASE_PATH` w `.env.local`. Pliki bazy są wyłączone z Git. Aby odtworzyć kopię, zatrzymaj serwer, zachowaj obecny plik, zastąp go kopią, usuń stare pliki `-wal`/`-shm` **po zatrzymaniu**, a następnie uruchom aplikację. Baza jest na komputerze serwera. Aktualizacja kodu: zachowaj kopię, wykonaj `git pull` i `npm ci`, uruchom ponownie. Schematy lokalne tworzą się przy starcie/użyciu modułów.

Przy konflikcie wersji CRM aplikacja zatrzymuje edycję. Pobierz kopię zmian i wczytaj aktualne dane z bazy. Poczekaj na stan **Zapisano w SQLite / Supabase** przed zamknięciem karty.

## Opcjonalny tryb Supabase

1. Utwórz projekt Supabase i wykonaj kolejno [fundament CRM](supabase/migrations/202610050001_growth_foundation.sql), [tryb usługowy](supabase/migrations/202610050002_service_mode.sql) oraz [Lead Hub](supabase/migrations/202610050003_lead_hub.sql) w nowej/testowej bazie. W istniejącej instalacji z fundamentem zastosuj brakujące migracje 002 i 003 w tej kolejności. Sprawdź nazwy tabel przed użyciem istniejącego projektu; migracja nie wykonuje się automatycznie.
2. W `.env.local` ustaw:

```dotenv
NEXT_PUBLIC_CRM_MODE=cloud
NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=publiczny-klucz-anon-lub-publishable
```

3. W Auth włącz e-mail/hasło oraz potwierdzanie adresów; ustaw Site URL i Redirect URLs aplikacji. Nigdy nie używaj `service_role` jako publicznego klucza.
4. Uruchom `npm run dev`, utwórz i potwierdź konto, zaloguj się, utwórz przestrzeń. Publiczne env ustaw przed produkcyjnym `npm run build`.
5. Właściciel dodaje istniejących użytkowników po UUID z panelu „Moje konto”. Zaproszenia e-mail nie są wdrożone.

Role: owner zarządza członkami; admin i marketer zapisują CRM; viewer ma odczyt. RLS oraz funkcje SQL weryfikują uprawnienia. Zapis snapshotu jest transakcyjny i wersjonowany. Szczegóły: [Faza 1](docs/PHASE-1.md), [architektura](docs/ARCHITECTURE.md), [model danych](docs/DATA-MODEL.md).

Cloud zachowuje szkice i program pocztowy. Wysyłka przez globalny Resend jest wyłączona do wdrożenia konfiguracji per workspace. SQLite i lokalnego CLI nie wystawiaj jako publicznego SaaS. Vercel jest opcją dla trybu Supabase, po konfiguracji env i Auth; nie dla lokalnego pliku SQLite i CLI.

## Gdy coś nie działa

| Objaw                            | Co sprawdzić                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------- |
| localhost nie odpowiada          | Uruchom serwer na komputerze przeglądarki; sprawdź terminal i port           |
| Błąd node:sqlite                 | Zainstaluj Node.js 24 lub nowszy i uruchom `npm ci`                          |
| Brak nowych modułów              | Użyj `npm run dev:localdb`, zamiast trybu przeglądarkowego/cloud             |
| CLI niedostępne                  | Instalacja w PATH, własne logowanie, `LOCAL_AI_CLI_ENABLED=1` i restart      |
| OpenRouter odrzuca analizę       | Klucz, środki, uprawnienia i dokładny identyfikator modelu                   |
| Model nie zwraca poprawnego JSON | Wybierz model obsługujący dłuższe odpowiedzi strukturalne; spróbuj ponownie  |
| Generator nie czyta strony       | Docelowy HTTPS, HTML bez JS, blokady robotów/proxy; alternatywnie import .md |
| Notatka już istnieje             | Edytuj dotychczasową lub zmień jej tytuł; zapis szkicu nie nadpisuje wiedzy  |
| Konektor wymaga konfiguracji     | Uzupełnij serwerowy `.env.local`, zrestartuj, użyj „Sprawdź odczyt”          |
| Poczta nie wysyła                | Domena Resend, nadawca, token, uprawnienia, podstawa kontaktu                |

## Rozwój i weryfikacja

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, natywne `node:sqlite`. Czytaj [AGENTS.md](AGENTS.md) i dokumentację zainstalowanego Next.js przed zmianami. W Codex korzystaj z istniejącego checkoutu `/workspace/CRM-DASHBOARD`, bez dodatkowego worktree.

```bash
npm test
npm run lint
npx --no-install next typegen
npx --no-install tsc --noEmit --incremental false
npm run build
npm run test:e2e
npm run test:cloud
npm run test:localdb
```

Playwright wymaga Chromium: `npx playwright install chromium` lub `CRM_CHROMIUM_PATH=/ścieżka/do/chromium`. Testy uruchamiają serwery na portach 3000 (CRM), 3001 (cloud UI) i 3002 (SQLite). Nie uruchamiaj kilku instancji Next dev z tym samym `.next/dev` równocześnie. `npm run test:db` dodatkowo wymaga Docker i sprawdza migrację/RLS w jednorazowym Postgres; bootstrap Auth nie jest testem rzeczywistej usługi Supabase Auth.

Testy obejmują rezerwacje i kolizje terminów, historię klienta, przełączanie trybu, onboarding, agregację wykresów, walidację, izolację przestrzeni, konflikty, SQLite, kopie, wikilinki, ZIP, import/KPI, adaptery, wybór modelu, zatwierdzanie i generator. Testy obejmują także OAuth z PKCE, szyfrowanie i konta MCC. Dostawcy API/AI są jawnie mockowani w testach; SQLite i eksporty są rzeczywiste. Generator UI używa dostawcy testowego, a jego atomowy zapis jest sprawdzany osobno na SQLite. Nie wykonano płatnych wywołań AI ani logowania do rzeczywistych kont Supabase, WordPress, PostHog czy Resend w tym środowisku. Live smoke test wymaga własnej konfiguracji użytkownika.

| Katalog                                                                          | Odpowiedzialność                                          |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `components/crm`, `components/services`, `components/growth`, `components/local` | Interfejs, tryby, formularze, wiedza, konektory i AI      |
| `components/leads`, `lib/leads`                                                  | Interfejs, domena, zdarzenia i repozytoria Lead Hub       |
| `lib/local`, `app/api/local`                                                     | SQLite i lokalne endpointy                                |
| `lib/knowledge`                                                                  | Notatki, bezpieczny odczyt strony, generator, eksport ZIP |
| `lib/ai`                                                                         | Dostawcy, kontekst i zatwierdzane działania               |
| `lib/integrations`                                                               | Adaptery, CSV i metryki                                   |
| `lib/supabase`, `supabase/migrations`                                            | Auth, wspólny CRM i RLS                                   |
| `tests`                                                                          | Testy logiki, bazy i przeglądarki                         |
| `public/assets/brand`                                                            | Logo AI Evolution Polska                                  |

## Screenshoty aplikacji

Zrzuty pochodzą z działającej aplikacji. Dane są demonstracyjne. Ekrany AI i generatora pokazują **dostawcę testowego**, a nie odpowiedź z płatnego modelu ani research rzeczywistej firmy. Formularze pokazują przykładowe dane; screenshot nie oznacza wysłania wiadomości lub uruchomienia zewnętrznej integracji.

### Agent AI, Raporty i Harmonogram (0.8)

Agent offline dodaje firmę po zatwierdzeniu i przygotowuje szkice follow-up; panel po prawej wybiera silnik (OpenRouter, OpenAI, Ollama, ChatGPT przez Codex, Claude Code) i autopilota.

![Agent AI — akcje do zatwierdzenia i wybór silnika](docs/screenshots/agent-ai.png)

![Raport sprzedaży z porównaniem okresów i eksportem](docs/screenshots/reports.png)

![Harmonogram — szablony, automatyzacje i historia uruchomień](docs/screenshots/automations.png)

### Lead Hub — od zapytania do płatności

Na liście widzisz status, źródło, kampanię, ostatnią aktywność, szacowaną wartość i revenue. Filtry oddzielają DEMO od rzeczywistych leadów.

![Lead Hub — lista leadów i dane kampanii](docs/screenshots/lead-hub-list.png)

<details>
<summary><strong>Zobacz formularze i pełną historię leada</strong></summary>

**Dodawanie leada:** kontakt, status, źródło, kampania i wartości w PLN. Dodatkowe pola atrybucji są dostępne po rozwinięciu.

![Lead Hub — dodawanie kontaktu DEMO](docs/screenshots/lead-hub-create.png)

**Zapisywanie rozmowy:** rodzaj zdarzenia, źródło, czas, długość rozmowy i ustalenia. Zdarzenie trafia do historii danej osoby.

![Lead Hub — formularz zdarzenia rozmowy](docs/screenshots/lead-hub-event.png)

**Karta leada:** dane kontaktowe, first/last touch, oferta, realizacja, wpłata i chronologiczna oś kontaktu.

![Lead Hub — pełna historia klienta DEMO](docs/screenshots/lead-hub-timeline.png)

</details>

### Firma usługowa — plan pracy i historia klienta

Pulpit pokazuje stan realizacji, rezerwacje i wartości usług. Karta klienta przechowuje kontakt i historię współpracy.

![Firma usługowa — pulpit rezerwacji i realizacji](docs/screenshots/premium-services-dashboard.png)

<details>
<summary><strong>Zobacz kartę klienta</strong></summary>

![Firma usługowa — kontakt, ustalenia i historia realizacji](docs/screenshots/premium-client-history.png)

</details>

### Konektory — stan konfiguracji i ręczne odczyty

Panel zbiera integracje AI, strony firmy, GA4, Search Console, WordPress, PostHog, importy kampanii i pocztę. Rozróżnia brak konfiguracji, udany odczyt i błąd.

![Konektory Evolution Growth OS](docs/screenshots/local-connectors.png)

### Raporty Google — GA4 i Search Console

Konektory mają osobny wybór usługi i stan odczytu. Pulpit pokazuje metryki i wykresy dwóch źródeł. **Poniższe screenshoty używają jawnego mocka API Google i danych DEMO**, nie raportów z konta użytkownika.

![Konektory Google — konfiguracja i raporty testowe](docs/screenshots/google-connectors-demo.png)

<details>
<summary><strong>Zobacz pulpit z raportami Google</strong></summary>

![Pulpit — GA4 i Search Console, dane testowe](docs/screenshots/google-dashboard-demo.png)

</details>

### Company Brain i AI Brain — wiedza z podglądem przed zapisem

Generator przygotowuje szkic wiedzy firmy, źródła i pytania o braki. Po zatwierdzeniu notatki są dostępne w aplikacji i w eksporcie do Obsidiana.

![Company Brain — podgląd generowanej wiedzy, dostawca testowy](docs/screenshots/local-brain-generator.png)

<details>
<summary><strong>Zobacz zapisane notatki i okno agenta</strong></summary>

**Zapisana wiedza:** główny dokument, powiązane notatki, foldery i eksport Markdown.

![Company Brain — zapisany dokument i notatki](docs/screenshots/local-brain-generated.png)

**AI Brain:** wybór modelu, odpowiedź oraz konkretna propozycja działania do zatwierdzenia.

![AI Brain — analiza i propozycja, dostawca testowy](docs/screenshots/local-agent-test-provider.png)

</details>

### Onboarding i telefon

Trzy kroki wprowadzają w sposób pracy i opcjonalne integracje. Na telefonie dostępna jest nawigacja, karta leada i formularze.

![Onboarding — wybór sposobu pracy](docs/screenshots/premium-onboarding.png)

<p align="center">
  <img src="docs/screenshots/lead-hub-mobile.png" width="390" alt="Lead Hub na telefonie — karta klienta DEMO">
</p>

### Google OAuth i bezpośrednie raporty Ads · 0.7.0

Logowanie firmy, wybór konta z MCC i raport reklam bez CSV. **Screenshoty używają jawnych mocków API i danych DEMO; nie pokazują wyników użytkownika.**

![Google OAuth, konfiguracja konta Ads i raport kampanii DEMO](docs/screenshots/google-oauth-ads-demo.png)

![Pulpit z kosztami, konwersjami i ROAS Google Ads — DEMO](docs/screenshots/google-ads-dashboard-demo.png)

<p align="center">
  <img src="docs/screenshots/google-ads-mobile-demo.png" width="390" alt="Raport Google Ads na telefonie — DEMO">
</p>

## Interfejs 0.9 — nowe screenshoty

Zrzuty przedstawiają działającą edycję SQLite. Rekordy CRM są demonstracyjne; test konektorów używa jawnego mocka API, a dyktowanie — mocka usługi mowy. Nie są to wyniki kont użytkownika.

**Pulpit:** wybór 6 / 12 miesięcy, trwały wybór miesiąca, tabela danych i priorytety. Szczegóły starszego podsumowania sprzedaży rozwijasz pod statystykami.

![Pulpit 0.9 — 12 miesięcy, dane CRM DEMO](docs/screenshots/ui-dashboard-1440-demo.png)

**Konektory:** odświeżanie wielu aktywnych źródeł jednym przyciskiem. Przykład pokazuje częściowy błąd GA4; odczyt Search Console nadal kończy się poprawnie.

![Konektory 0.9 — zbiorcze odświeżanie, mock API DEMO](docs/screenshots/ui-connectors-demo.png)

**Agent AI:** model, czat i dyktowanie po polsku. Tekst rozpoznany przez mikrofon wymaga ręcznego wysłania. Odpowiedź na zrzucie pochodzi z wbudowanego agenta offline.

![Agent AI 0.9 — działający czat i przycisk dyktowania, DEMO](docs/screenshots/ui-agent-demo.png)

<p align="center">
  <img src="docs/screenshots/ui-dashboard-390-demo.png" width="390" alt="Pulpit 0.9 na telefonie — rekordy CRM DEMO">
</p>
