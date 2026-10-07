# Interfejs i obsługa · 0.9

Zmiany powstały z wykorzystaniem AI Evolution UI Designer i AI Evolution Shader Design. Zachowano istniejące komponenty aplikacji i Radix/shadcn; nie przeprowadzano migracji do Coss UI.

## Pulpit

- Centrum dowodzenia prowadzi do najbliższych działań i agenta. Niżej znajdują się statystyki firmy i wyniki marketingu. Powtarzające się szczegóły sprzedaży są w rozwijanej sekcji; wyszukiwanie w CRM nadal je otwiera.
- Przełącznik **6 / 12 miesięcy** pokazuje odpowiednią historię oraz następny miesiąc. Kliknięcie słupka zachowuje wybrany miesiąc także po odsunięciu kursora. Dostępne są przyciski obsługiwane klawiaturą i tabela danych.
- W trybie CRM wykres uwzględnia szanse sprzedaży, w trybie usług — realizacje. Wygrane lub zakończone rekordy są oddzielone od prognozy. Wartość CRM nie jest zaksięgowanym wpływem.
- Priorytety wynikają z reguł i zapisanych danych, bez obowiązkowego płatnego wywołania AI.

## Konektory

**Odśwież statystyki** pobiera kolejno dane aktywnych, skonfigurowanych GA4, Search Console, Google Ads, PostHog i Stripe. Obejmuje źródła ze statusem poprawnego odczytu albo błędu, aby można było ponowić żądanie. Pomija źródła odłączone, nieskonfigurowane oraz WordPress, którego import dokumentów pozostaje osobną akcją.

Podczas pracy widać aktualne źródło i postęp. Błąd jednego API nie zatrzymuje pozostałych. Podsumowanie podaje liczbę sukcesów i wskazuje źródła wymagające uwagi; poprzedni raport Google pozostaje dostępny z oznaczeniem błędu. Ta akcja nie ustawia harmonogramu automatycznej synchronizacji.

Najpierw skonfiguruj źródło, wybierz usługę i użyj **Sprawdź odczyt**. Google nadal wymaga własnej konfiguracji OAuth oraz uprawnień do wybranych usług. Instrukcja: [GOOGLE-INTEGRATIONS.md](GOOGLE-INTEGRATIONS.md).

## Agent i mikrofon

**Dyktuj wiadomość** działa w głównym agencie CRM i w rozwijanym agencie Company Brain. Przeglądarka rozpoznaje mowę po polsku i dopisuje tekst do szkicu. Dopiero użytkownik wysyła wiadomość. Nie jest to rozmowa głosowa ani odczytywanie odpowiedzi na głos.

Wymagana jest obsługa SpeechRecognition/WebkitSpeechRecognition, zgoda na mikrofon i ewentualnie internet do usługi przeglądarki. Błędy uprawnień, urządzenia i sieci mają komunikaty. Bez obsługi mowy przycisk jest nieaktywny, ale czat działa. Ukrycie karty lub wyjście z widoku zatrzymuje dyktowanie. Szkic pozostaje dostępny po odmowie dostępu lub błędzie wysłania.

Czat ma ograniczoną wysokość i osobne przewijanie. Czytanie starszych odpowiedzi nie powoduje wymuszonego przewijania na koniec. Zmiana firmy otwiera osobny widok czatu i konektorów. Blokada trwającego żądania zapobiega przypadkowym podwójnym analizom i odczytom.

## Shader, wydajność i dostępność

Jedna dekoracyjna powierzchnia Swirl z `shaders@4.0.0` znajduje się w nagłówku pulpitu. Biblioteka jest ładowana w osobnym komponencie klienta dopiero dla widocznego nagłówka, WebGPU i braku preferencji ograniczenia ruchu/przezroczystości. Canvas ma obszar do 400 × 280 pikseli CSS; na telefonie 280 × 240. Telemetria biblioteki jest wyłączona.

Zmiana preferencji ograniczenia ruchu, ukrycie karty lub przewinięcie nagłówka poza ekran usuwa komponent shaderu. Brak adaptera GPU lub błąd inicjalizacji pozostawia gradient CSS; przyciski i treść nie zależą od canvasu. Formularze, raporty i wykresy pozostają statycznymi powierzchniami.

## Weryfikacja

Polecenia dla lokalnej edycji:

```bash
npm run lint
npm test
npm run build:localdb
CRM_CHROMIUM_PATH=/usr/bin/chromium CRM_LOCAL_TEST_PRODUCTION=1 npm run test:localdb
```

Testy obejmują sekwencyjne odczyty, częściowy błąd, brak aktywnych źródeł, blokadę podwójnego kliknięcia, wybór okresu i miesiąca, tabelę, dyktowanie i odmowę mikrofonu oraz szerokości 1440, 768, 390 i 320 px. API konektorów i rozpoznawanie mowy są w tych scenariuszach jawnie mockowane; SQLite oraz obsługa wbudowanego agenta są rzeczywiste. Testy nie potwierdzają dostępu do kont użytkownika, działania fizycznego mikrofonu ani wydajności GPU na rzeczywistym telefonie.

Wynik weryfikacji: **69 testów jednostkowych, 19 scenariuszy SQLite i 5 scenariuszy chmurowych przeszło**, podobnie lint, TypeScript i build lokalny. Sprawdzono także odmowę adaptera GPU, długie odpowiedzi oraz zachowanie szkicu po błędzie dostawcy AI. Scenariusze przeglądarkowe były uruchamiane etapami podczas poprawek.

Screenshoty z końca README pokazują rzeczywistą aplikację z demonstracyjnymi rekordami i mockiem odczytów API. Statyczne tło widoczne na zrzutach jest poprawnym wariantem interfejsu bez ruchu.
