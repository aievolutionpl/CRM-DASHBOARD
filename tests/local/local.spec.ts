import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page, keepGuide = false) {
  await page.goto("/");
  const formToggle = page.getByText("Nowa przestrzeń firmy", { exact: true });
  await expect(formToggle).toHaveAttribute("aria-disabled", "false");
  if (!(await page.getByLabel("Nazwa nowej przestrzeni").isVisible()))
    await page.getByText("Nowa przestrzeń firmy", { exact: true }).click();
  await page
    .getByLabel("Nazwa nowej przestrzeni")
    .fill(`Firma lokalna ${Date.now()}`);
  await page
    .getByRole("button", { name: "Utwórz przestrzeń", exact: true })
    .click();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  const skip = page.getByRole("button", { name: "Pomiń przewodnik" });
  await expect(skip).toBeVisible();
  if (!keepGuide) await skip.click();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
}
test("SQLite zapisuje CRM, przełącza przestrzenie i pobiera spójną kopię", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Firmy", exact: true }).click();
  await page
    .getByRole("button", { name: "Dodaj firmę", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Nazwa firmy", { exact: true })
    .fill("Test dysku SQLite");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zapisz", exact: true })
    .click();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("ai-evolution-crm-v1")),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Firmy", exact: true }).click();
  await expect(
    page.getByText("Test dysku SQLite", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pobierz całą bazę SQLite" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain(".sqlite");
  const copy = new DatabaseSync((await file.path())!, { readOnly: true });
  try {
    const rows = copy.prepare("SELECT snapshot FROM workspaces").all();
    expect(
      rows.some((r) => String(r.snapshot).includes("Test dysku SQLite")),
    ).toBe(true);
  } finally {
    copy.close();
  }
});
test("Company Brain: zapis, linki, import Markdown i eksport Obsidian", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Company Brain", exact: true })
    .click();
  await page.getByRole("button", { name: "Nowa notatka", exact: true }).click();
  await page.getByLabel("Tytuł notatki").fill("Oferta firmy");
  await page
    .getByLabel("Treść Markdown", { exact: true })
    .fill("# Oferta\n\nNasze usługi. [[Proces obsługi]]");
  await page
    .getByRole("button", { name: "Zapisz notatkę", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Oferta firmy/ }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "Proces obsługi.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Proces\n\nKontakt po zapytaniu. [[Oferta firmy]]"),
  });
  await expect(
    page.getByRole("button", { name: /Proces obsługi/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Oferta firmy/ }).click();
  await page
    .getByRole("button", { name: "Proces obsługi", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Proces obsługi", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Linki przychodzące", { exact: true }),
  ).toBeVisible();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({ path: "docs/screenshots/local-brain.png" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksport do Obsidiana" }).click();
  expect((await download).suggestedFilename()).toBe("company-brain.zip");
});
test("Import kampanii zasila dashboard; konektory i AI nie udają połączenia", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  const date = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Warsaw",
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "ads.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "date;source;campaign;spend;impressions;clicks;leads;qualified;revenue\n" +
        Array.from({ length: 30 }, (_, i) => {
          const day = new Date(date + "T12:00:00Z");
          day.setUTCDate(day.getUTCDate() - 29 + i);
          const leads = 3 + (i % 7) + Math.floor(i / 5);
          return `${day.toISOString().slice(0, 10)};${i % 3 ? "google_ads" : "microsoft_ads"};${i % 3 ? "Usługi lokalne" : "Konsultacje projektowe"};${leads * 20};1000;80;${leads};${Math.floor(leads * 0.6)};${leads * 120}\n`;
        }).join(""),
    ),
  });
  await expect(page.getByText(/Zapisano 30 wierszy/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sprawdź odczyt" }).first(),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Pulpit", exact: true }).click();
  await expect(page.getByText("Usługi lokalne", { exact: true })).toBeVisible();
  await expect(page.getByText("6.00×", { exact: true }).first()).toBeVisible();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/local-dashboard.png",
      fullPage: true,
    });
  await page.getByRole("button", { name: "Agent AI", exact: true }).click();
  await page
    .getByText("Agent Company Brain (SQLite) — analiza notatek i marketingu", {
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Analizuj", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("group", { name: "Silnik AI", exact: true })
    .getByRole("button", { name: /Codex/ })
    .click();
  await expect(page.getByText(/CLI niedostępne lub wyłączone/)).toBeVisible();
});
test("lokalna baza blokuje obcy origin i obsługuje mobilną wiedzę", async ({
  page,
  request,
}) => {
  const blocked = await request.get("/api/local/workspaces", {
    headers: { Origin: "https://evil.invalid" },
  });
  expect(blocked.status()).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole("button", { name: "Otwórz nawigację" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Company Brain", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Company Brain", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("okno agenta: wybór modelu, odpowiedź i zatwierdzenie z testowym dostawcą", async ({
  page,
}) => {
  await ready(page);
  let executed = false;
  const message = () => ({
    id: "test-message",
    prompt: "Analiza firmy",
    answer:
      "To jest odpowiedź dostawcy testowego. Proponuję notatkę do zatwierdzenia.",
    provider: "openrouter",
    model: "test/wybrany-model",
    actions: [
      {
        id: "test-action",
        status: executed ? "executed" : "pending",
        payload: {
          type: "create_note",
          title: "Proces firmy",
          category: "processes",
          content: "# Proces\nTest",
        },
      },
    ],
  });
  await page.route("**/api/local/workspaces/*/ai**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/models")) {
      await route.fulfill({
        json: { models: [{ id: "test/wybrany-model", name: "Model testowy" }] },
      });
      return;
    }
    if (path.endsWith("/decision")) {
      expect(route.request().postDataJSON().approve).toBe(true);
      executed = true;
      await route.fulfill({ json: { messages: [message()] } });
      return;
    }
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON().model).toBe("test/wybrany-model");
      await route.fulfill({
        json: { messages: [message()], usage: { total_tokens: 10 } },
      });
      return;
    }
    await route.fulfill({
      json: {
        status: {
          openrouter: true,
          codex: false,
          claude: false,
          cliEnabled: false,
        },
        messages: executed ? [message()] : [],
      },
    });
  });
  await page.getByRole("button", { name: "Agent AI", exact: true }).click();
  await page
    .getByText("Agent Company Brain (SQLite) — analiza notatek i marketingu", {
      exact: true,
    })
    .click();
  await page
    .getByRole("group", { name: "Silnik AI", exact: true })
    .getByRole("button", { name: /OpenRouter/ })
    .click();
  await page.getByRole("button", { name: "Pobierz modele" }).click();
  await page.getByLabel("Model AI", { exact: true }).fill("test/wybrany-model");
  await page
    .getByLabel("Wiadomość do agenta", { exact: true })
    .last()
    .fill("Analiza firmy");
  await page.getByRole("button", { name: "Analizuj", exact: true }).click();
  await expect(page.getByText(/odpowiedź dostawcy testowego/)).toBeVisible();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/local-agent-test-provider.png",
      fullPage: true,
    });
  await page.getByRole("button", { name: "Zatwierdź i wykonaj" }).click();
  expect(executed).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Agent AI", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Wykonano po zatwierdzeniu", { exact: true }),
  ).toBeVisible();
});

test("generator strony: podgląd, zatwierdzenie, zapis wiedzy i eksport z dostawcą testowym", async ({
  page,
  request,
}) => {
  await ready(page);
  const sources = [
    {
      id: "S01",
      url: "https://firma.example",
      text: "Przykładowa treść testowa.",
      checkedAt: "2026-10-05T10:00:00Z",
    },
  ];
  const { parseBrain } = await import("../../lib/knowledge/generation-model");
  const parsed = parseBrain(
    JSON.stringify({
      companyName: "Pracownia Forma",
      summary:
        "Przykład testowy: studio projektowania wnętrz dla klientów z Krakowa. Dane demonstracyjne, nie wynik researchu rzeczywistej firmy.",
      sections: [
        {
          number: 1,
          content:
            "**Marka:** Pracownia Forma · przykład testowy\n**Branża:** projektowanie wnętrz\n**Obszar:** Kraków i okolice\n**Źródło:** CONFIRMED [S01] — dane dostawcy testowego",
        },
        {
          number: 5,
          content:
            "| Usługa | Zakres | Cena |\n|---|---|---|\n| Projekt mieszkania | Koncepcja, układ i dobór materiałów | MISSING |\n| Konsultacja | Omówienie potrzeb i rozwiązań | MISSING |",
        },
        {
          number: 9,
          content:
            "TO CONFIRM: komunikacja spokojna, konkretna, z przykładami realizacji. Bez niepotwierdzonych obietnic efektów.",
        },
        {
          number: 20,
          content:
            "### Propozycje do zatwierdzenia\n- TO CONFIRM: seria poradników o układzie małego mieszkania.\n- TO CONFIRM: post pokazujący etapy współpracy.\n- TO CONFIRM: FAQ o budżecie i terminach projektu.",
        },
      ],
      questions: [
        "Która usługa jest teraz najważniejsza?",
        "Jaki budżet ma idealny klient?",
        "Jakie realizacje można pokazać publicznie?",
      ],
    }),
    sources,
  );
  const draft = {
    id: "test-brain-draft",
    ...parsed,
    sources,
    warnings: ["Przykład dostawcy testowego — bez wywołania płatnego modelu."],
    usage: { total_tokens: 400 },
  };
  await page.route("**/api/local/workspaces/*/ai", async (route) => {
    await route.fulfill({
      json: {
        status: { openrouter: true, codex: false, claude: false },
        messages: [],
      },
    });
  });
  await page.route("**/brain/generate", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.url).toBe("https://firma.example");
    expect(body.model).toBe("test/brain-model");
    await route.fulfill({ json: draft });
  });
  await page.route("**/brain/save-generation", async (route) => {
    expect(route.request().postDataJSON().id).toBe(draft.id);
    const endpoint = route.request().url().replace("/save-generation", "");
    for (const d of draft.documents) {
      const result = await request.post(endpoint, {
        data: { ...d, revision: 0, id: "" },
      });
      expect(result.ok()).toBe(true);
    }
    await route.fulfill({ status: 201, json: { count: 4 } });
  });
  await page
    .getByRole("button", { name: "Company Brain", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Wygeneruj ze strony", exact: true })
    .click();
  await page
    .getByLabel("Adres strony firmy", { exact: true })
    .fill("https://firma.example");
  await page
    .getByLabel("Model generatora", { exact: true })
    .fill("test/brain-model");
  await page
    .getByRole("button", { name: "Wygeneruj mózg firmy", exact: true })
    .click();
  await expect(page.getByTestId("brain-draft-preview")).toContainText(
    "34. Historia zmian",
  );
  await expect(
    page.getByRole("button", { name: "Zatwierdź i zapisz 4 notatki" }),
  ).toBeVisible();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/local-brain-generator.png",
    });
  await page
    .getByRole("button", { name: "Zatwierdź i zapisz 4 notatki" })
    .click();
  await expect(
    page.getByRole("button", { name: "Pobierz do Obsidiana" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pobierz do Obsidiana" }).click();
  const file = await download;
  const fs = await import("node:fs/promises");
  const archive = await fs.readFile((await file.path())!);
  expect(
    archive.includes(Buffer.from("Pracownia Forma — COMPANY_BRAIN.md")),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Otwórz Company Brain", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Pracownia Forma — COMPANY_BRAIN/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Pracownia Forma — COMPANY_BRAIN",
      exact: true,
    }),
  ).toBeVisible();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/local-brain-generated.png",
    });
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/local-connectors.png",
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Otwórz nawigację" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Company Brain", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Wygeneruj ze strony", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Mózg firmy ze strony" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("firma usługowa: onboarding, klienci, terminy, kolizje, historia i trwały tryb", async ({
  page,
}) => {
  await ready(page, true);
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({ path: "docs/screenshots/premium-onboarding.png" });
  await page.getByRole("radio", { name: /Firma usługowa/ }).click();
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Klient. Termin. Dobrze wykonana praca.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Możesz też podpiąć e-maile i AI." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zaczynamy", exact: true }).click();
  await page.getByRole("button", { name: "Klienci", exact: true }).click();
  await page
    .getByRole("button", { name: "Dodaj klienta", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Imię i nazwisko / nazwa klienta")
    .fill("Anna Kowalska");
  await page.getByLabel("E-mail klienta").fill("anna@example.com");
  await page.getByLabel("Telefon klienta").fill("+48 500 200 300");
  await page.getByLabel("Adres klienta").fill("Warszawa, ul. Słoneczna 12");
  await page
    .getByLabel("Notatki", { exact: true })
    .fill(
      "Preferuje kontakt telefoniczny. Projekt wnętrza z naturalnymi materiałami.",
    );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zapisz", exact: true })
    .click();
  await page.getByRole("button", { name: "Zlecenia", exact: true }).click();
  const date = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Warsaw",
  });
  async function fillJob(
    name: string,
    start: string,
    end: string,
    value: string,
    resource = "Anna · projekty",
  ) {
    await page.getByLabel("Nazwa pracy").fill(name);
    await page.getByLabel("Początek pracy").fill(start);
    await page.getByLabel("Koniec pracy").fill(end);
    await page.getByLabel("Wartość zlecenia (PLN)").fill(value);
    await page.getByLabel("Osoba / stanowisko").fill(resource);
  }
  await page
    .getByRole("button", { name: "Zarezerwuj pracę", exact: true })
    .click();
  await fillJob("Projekt wnętrza", `${date}T09:00`, `${date}T11:00`, "1500");
  await page
    .getByRole("button", { name: "Zapisz zlecenie", exact: true })
    .click();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Zarezerwuj pracę", exact: true })
    .click();
  await fillJob(
    "Konsultacja materiałowa",
    `${date}T10:00`,
    `${date}T12:00`,
    "350",
  );
  await page
    .getByRole("button", { name: "Zapisz zlecenie", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Ten termin jest zajęty",
  );
  await page.getByLabel("Osoba / stanowisko").fill("Piotr · konsultacje");
  await page
    .getByRole("button", { name: "Zapisz zlecenie", exact: true })
    .click();
  const first = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Projekt wnętrza", exact: true }),
  });
  await first
    .getByRole("button", { name: "Rozpocznij pracę", exact: true })
    .click();
  await expect(first.getByText("W realizacji", { exact: true })).toBeVisible();
  await first
    .getByRole("button", { name: "Zakończ pracę", exact: true })
    .click();
  await page.getByLabel("Filtr zleceń").selectOption("all");
  await first.getByText("Historia zlecenia (3)", { exact: true }).click();
  await expect(
    first.getByText("Status: Zakończone", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pulpit", exact: true }).click();
  await page.getByLabel("Okres realizacji").selectOption("7");
  await expect(
    page.getByRole("group", { name: "Wartość zakończonych realizacji (PLN)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /wszystkich prac:.*Zakończone 1/ }),
  ).toBeVisible();
  const message = page.getByRole("button", { name: "Zamknij komunikat" });
  if (await message.isVisible()) await message.click();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/premium-services-dashboard.png",
      fullPage: true,
    });
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Tryb pracy")).toHaveValue("services");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Klienci", exact: true }).click();
  await page.getByRole("button", { name: /Anna Kowalska/ }).click();
  const profile = page.getByRole("dialog");
  await expect(
    profile.getByRole("heading", { name: "Historia współpracy" }),
  ).toBeVisible();
  await expect(
    profile.getByText("Projekt wnętrza", { exact: true }),
  ).toBeVisible();
  await expect(profile.getByText("Zakończone", { exact: true })).toBeVisible();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/premium-client-history.png",
    });
  await page.getByRole("button", { name: "Zamknij", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  const backupReady = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Pobierz kopię JSON", exact: true })
    .click();
  const file = await backupReady;
  const raw = await readFile((await file.path())!, "utf8");
  const backup = JSON.parse(raw);
  expect(backup.settings.businessMode).toBe("services");
  expect(
    backup.data.deals.find(
      (d: { name: string }) => d.name === "Projekt wnętrza",
    ).service.history,
  ).toHaveLength(3);
  await page.getByLabel("Tryb pracy").selectOption("crm");
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({
    name: "kopia.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await expect(page.getByLabel("Tryb pracy")).toHaveValue("services");
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Tryb pracy").selectOption("crm");
  await page
    .getByRole("button", { name: "Szanse sprzedaży", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projekt wnętrza", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Tryb pracy").selectOption("services");
  await page.getByRole("button", { name: "Zlecenia", exact: true }).click();
  await page.getByLabel("Filtr zleceń").selectOption("all");
  await expect(
    page.getByRole("heading", { name: "Projekt wnętrza", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Zlecenia", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Zarezerwuj pracę", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Lead Hub: tworzenie, deduplikacja, zdarzenia, atrybucja, status, revenue i izolacja", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Lead Hub", exact: true }).click();
  await page.getByRole("button", { name: "Dodaj leada", exact: true }).click();
  await page.getByLabel("Imię leada", { exact: true }).fill("Łukasz");
  await page.getByLabel("Nazwisko leada", { exact: true }).fill("Żółć");
  await page
    .getByLabel("E-mail leada", { exact: true })
    .fill("lukasz@example.com");
  await page.getByLabel("Telefon leada", { exact: true }).fill("500 100 200");
  await page.getByLabel("Źródło leada", { exact: true }).fill("Google Ads");
  await page
    .getByLabel("Kampania leada", { exact: true })
    .fill("Usługi · Warszawa");
  await page
    .getByLabel("Szacowana wartość (PLN)", { exact: true })
    .fill("280.50");
  await page.getByRole("button", { name: "Zapisz leada", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Łukasz Żółć", exact: true }),
  ).toBeVisible();
  async function addEvent(
    type: string,
    source: string,
    date: string,
    price?: string,
  ) {
    await page
      .getByRole("button", { name: "Dodaj zdarzenie", exact: true })
      .click();
    await page.getByLabel("Rodzaj zdarzenia").selectOption(type);
    await page.getByLabel("Źródło zdarzenia").fill(source);
    await page.getByLabel("Data i godzina zdarzenia").fill(date);
    if (price) await page.getByLabel("Kwota zdarzenia (PLN)").fill(price);
    await page
      .getByRole("button", { name: "Zapisz zdarzenie", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Oś kontaktu", exact: true }),
    ).toBeVisible();
  }
  await addEvent("phone_call", "Telefon", "2026-10-04T10:24");
  await addEvent("ad_click", "Google Ads", "2026-10-04T10:21");
  const attribution = page
    .getByRole("heading", { name: "Źródła i atrybucja" })
    .locator("..");
  await expect(attribution).toContainText("First touch");
  await expect(attribution).toContainText("Last touch");
  const events = page
    .getByRole("list", { name: "Historia kontaktu leada" })
    .getByRole("listitem");
  await expect(events.first()).toContainText("Kliknięcie reklamy");
  await expect(events.nth(1)).toContainText("Rozmowa telefoniczna");
  await page.getByRole("button", { name: "Edytuj leada", exact: true }).click();
  await page
    .getByLabel("Status leada", { exact: true })
    .selectOption("qualified");
  await page.getByLabel("Revenue leada (PLN)", { exact: true }).fill("100.50");
  await page
    .getByLabel("Notatki leada", { exact: true })
    .fill("Preferuje wizytę po 16:00.");
  await page.getByRole("button", { name: "Zapisz leada", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Zmiana statusu", exact: true }),
  ).toBeVisible();
  await addEvent("quote_sent", "Firma", "2026-10-04T10:42", "280.50");
  await addEvent("booking_created", "Firma", "2026-10-04T11:10");
  await addEvent("job_started", "Firma", "2026-10-04T12:00", "280.50");
  await addEvent("job_completed", "Firma", "2026-10-04T16:30", "280.50");
  await addEvent("payment_received", "Klient", "2026-10-04T16:40", "280.50");
  await expect(
    page.getByRole("heading", { name: "Wpłaty (1)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Przegląd leada" }).locator("../.."),
  ).toContainText("381,00 zł");
  await page
    .getByRole("button", { name: "Wróć do leadów", exact: true })
    .click();
  await page.getByRole("button", { name: "Dodaj leada", exact: true }).click();
  await page
    .getByLabel("E-mail leada", { exact: true })
    .fill("LUKASZ@EXAMPLE.COM");
  await page.getByRole("button", { name: "Zapisz leada", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Łukasz Żółć", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Wróć do leadów", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Otwórz leada: Łukasz Żółć",
      exact: true,
    }),
  ).toHaveCount(1);
  await page.getByLabel("Szukaj w CRM").fill("żółć");
  await expect(
    page.getByRole("button", {
      name: "Otwórz leada: Łukasz Żółć",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Szukaj w CRM").fill("Usługi · Warszawa");
  await expect(
    page.getByRole("button", {
      name: "Otwórz leada: Łukasz Żółć",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Szukaj w CRM").fill("");
  const space = await page.getByLabel("Przestrzeń robocza").inputValue();
  await page.reload();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lead Hub", exact: true }).click();
  await page
    .getByRole("button", { name: "Otwórz leada: Łukasz Żółć", exact: true })
    .click();
  const exported = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Pobierz historię JSON", exact: true })
    .click();
  const file = await exported,
    bundle = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(bundle.lead.revenue).toBe(381);
  expect(bundle.payments).toHaveLength(1);
  expect(bundle.lead.first_touch_source).toBe("Google Ads");
  expect(bundle.lead.last_touch_source).toBe("Telefon");
  await ready(page);
  await page.getByRole("button", { name: "Lead Hub", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Otwórz leada: Łukasz Żółć",
      exact: true,
    }),
  ).toHaveCount(0);
  const foreign = await page.request.get(
    `/api/local/workspaces/${await page.getByLabel("Przestrzeń robocza").inputValue()}/leads/${bundle.lead.id}`,
  );
  expect(foreign.status()).toBe(404);
  await page.getByLabel("Przestrzeń robocza").selectOption(space);
  await page.getByRole("button", { name: "Lead Hub", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Otwórz leada: Łukasz Żółć",
      exact: true,
    }),
  ).toBeVisible();
});
test("Lead Hub DEMO: pełna oś czasu, brak duplikatu i mobilna karta", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Tryb pracy").selectOption("services");
  await page.getByRole("button", { name: "Lead Hub", exact: true }).click();
  await page
    .getByRole("button", { name: "Dodaj przykład DEMO", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Anna Kowalska · DEMO", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Otrzymana płatność", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Oferty (1)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Prace (1)", exact: true }),
  ).toBeVisible();
  const message = page.getByRole("button", { name: "Zamknij komunikat" });
  if (await message.isVisible()) await message.click();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({
      path: "docs/screenshots/lead-hub-timeline.png",
      fullPage: true,
    });
  await page
    .getByRole("button", { name: "Wróć do leadów", exact: true })
    .click();
  await expect(page.getByLabel("Rodzaj danych leadów")).toHaveValue("demo");
  await expect(
    page.getByRole("button", {
      name: "Otwórz leada: Anna Kowalska · DEMO",
      exact: true,
    }),
  ).toHaveCount(1);
  if (process.env.UPDATE_LOCAL_SCREENSHOTS)
    await page.screenshot({ path: "docs/screenshots/lead-hub-list.png" });
  await page
    .getByRole("button", { name: "Dodaj przykład DEMO", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Wpłaty (1)", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Dodaj zdarzenie", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Zamknij", exact: true }).click();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS) {
    const toast = page.getByRole("button", { name: "Zamknij komunikat" });
    if (await toast.isVisible()) await toast.click();
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      document.querySelectorAll("*").forEach((el) => {
        if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: "instant" });
      });
    });
    await page.screenshot({
      path: "docs/screenshots/lead-hub-mobile.png",
      fullPage: false,
    });
  }
});

test("Google konektory: usługi zapisują się w przestrzeni; brak dostępu nie udaje połączenia", async ({
  page,
}) => {
  await ready(page);
  const first = await page.getByLabel("Przestrzeń robocza").inputValue();
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  const ga = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Google Analytics 4",
      exact: true,
    }),
  });
  const gsc = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Google Search Console",
      exact: true,
    }),
  });
  await ga
    .getByLabel("Identyfikator usługi GA4", { exact: true })
    .fill("123456789");
  await ga
    .getByRole("button", { name: "Zapisz usługę GA4", exact: true })
    .click();
  await expect(
    page.getByText(
      "Zapisano usługę dla tej przestrzeni. Teraz sprawdź odczyt API.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    ga.getByRole("button", { name: "Sprawdź odczyt", exact: true }),
  ).toBeDisabled();
  await expect(
    ga.getByText("Wymaga konfiguracji", { exact: true }),
  ).toBeVisible();
  await gsc
    .getByLabel("Usługa Search Console", { exact: true })
    .fill("https://user:secret@example.pl/");
  await gsc
    .getByRole("button", { name: "Zapisz usługę Search Console", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "HTTPS bez danych logowania" }),
  ).toBeVisible();
  await gsc
    .getByLabel("Usługa Search Console", { exact: true })
    .fill("sc-domain:example.pl");
  await gsc
    .getByRole("button", { name: "Zapisz usługę Search Console", exact: true })
    .click();
  await expect(
    page.getByText(
      "Zapisano usługę dla tej przestrzeni. Teraz sprawdź odczyt API.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  await expect(
    page.getByLabel("Identyfikator usługi GA4", { exact: true }),
  ).toHaveValue("123456789");
  await expect(
    page.getByLabel("Usługa Search Console", { exact: true }),
  ).toHaveValue("sc-domain:example.pl");
  await ready(page);
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  await expect(
    page.getByLabel("Identyfikator usługi GA4", { exact: true }),
  ).toHaveValue("");
  await page.getByLabel("Przestrzeń robocza").selectOption(first);
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  await expect(
    page.getByLabel("Identyfikator usługi GA4", { exact: true }),
  ).toHaveValue("123456789");
});

test("Google raporty: statystyki na Pulpicie, oznaczenie błędu, wyłączenie i telefon — mock API", async ({
  page,
}) => {
  await ready(page);
  const wid = await page.getByLabel("Przestrzeń robocza").inputValue();
  const from = "2026-09-04",
    to = "2026-10-03",
    fetched_at = "2026-10-05T10:00:00Z";
  const demoDate = (i: number) =>
    new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10);
  const reports = [
    {
      provider: "ga4",
      resource: "properties/123456789",
      from,
      to,
      fetched_at,
      totals: {
        sessions: 120,
        totalUsers: 80,
        screenPageViews: 240,
        keyEvents: 12,
        totalRevenue: 900,
      },
      daily: Array.from({ length: 30 }, (_, i) => ({
        date: demoDate(i),
        sessions: 3 + (i % 3),
        totalUsers: 2 + (i % 3),
        screenPageViews: 6 + 2 * (i % 3),
        keyEvents: i % 5 < 2 ? 1 : 0,
        totalRevenue: 15 * (i % 5),
      })),
      breakdown: [
        {
          label: "Organic Search",
          values: { sessions: 90, keyEvents: 9, totalRevenue: 700 },
        },
      ],
      currency: "PLN",
      warnings: ["DEMO — jawny mock API Google w teście przeglądarkowym."],
    },
    {
      provider: "search_console",
      resource: "sc-domain:example.pl",
      from,
      to,
      fetched_at,
      totals: { clicks: 55, impressions: 1100, ctr: 0.05, position: 3.5 },
      daily: Array.from({ length: 30 }, (_, i) => ({
        date: demoDate(i),
        clicks: i < 5 ? 1 : 2,
        impressions: i < 10 ? 36 : 37,
        ctr: (i < 5 ? 1 : 2) / (i < 10 ? 36 : 37),
        position: 3.5,
      })),
      breakdown: [
        {
          label: "usługi lokalne Warszawa",
          values: { clicks: 20, impressions: 400, ctr: 0.05, position: 3.5 },
        },
      ],
      warnings: ["DEMO — jawny mock API Google w teście przeglądarkowym."],
    },
  ];
  let gaStatus = "checked";
  await page.route("**/api/local/workspaces/*/integrations", async (route) => {
    if (!new URL(route.request().url()).pathname.includes(wid)) {
      await route.continue();
      return;
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      if (body.provider === "ga4" && body.action === "sync") {
        gaStatus = "error";
        await route.fulfill({
          status: 403,
          json: { error: "Google: HTTP 403. Brak uprawnień do usługi." },
        });
        return;
      }
      if (body.provider === "ga4" && body.action === "disconnect") {
        gaStatus = "disconnected";
        await route.fulfill({
          json: { message: "Wyłączono integrację w przestrzeni." },
        });
        return;
      }
    }
    const response = await route.fetch(),
      data = await response.json();
    data.states = [
      {
        provider: "ga4",
        status: gaStatus,
        last_sync: fetched_at,
        error:
          gaStatus === "error"
            ? "Google: HTTP 403. Brak uprawnień do usługi."
            : null,
      },
      { provider: "search_console", status: "checked", last_sync: fetched_at },
    ];
    data.snapshots = reports.map((report) => ({
      provider: report.provider,
      payload: { summary: "DEMO", report, synced_at: fetched_at },
    }));
    data.providers = data.providers.map((p: { provider: string }) =>
      p.provider === "ga4" || p.provider === "search_console"
        ? {
            ...p,
            configured: true,
            authConfigured: true,
            resource:
              p.provider === "ga4"
                ? { propertyId: "123456789" }
                : { siteUrl: "sc-domain:example.pl" },
          }
        : p,
    );
    await route.fulfill({ json: data });
  });
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Google Analytics 4", exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByText("Użytkownicy w okresie", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("900,00 zł", { exact: true })).toBeVisible();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: "docs/screenshots/google-connectors-demo.png",
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Pulpit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Google Analytics 4", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Google Search Console", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("5%", { exact: true }).first()).toBeVisible();
  await page
    .getByText("Zapytania w Google — do 20 pozycji", { exact: true })
    .click();
  await expect(
    page.getByText("usługi lokalne Warszawa", { exact: true }),
  ).toBeVisible();
  if (process.env.UPDATE_LOCAL_SCREENSHOTS) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: "docs/screenshots/google-dashboard-demo.png",
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  const ga = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Google Analytics 4",
      exact: true,
    }),
  });
  await ga
    .getByRole("button", { name: "Pobierz statystyki", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "HTTP 403" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Ostatnie sprawdzenie zgłosiło błąd. Poniżej pozostaje wcześniejszy zapis raportu.",
      { exact: true },
    ),
  ).toBeVisible();
  await ga
    .getByRole("button", { name: "Wyłącz w przestrzeni", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Google Analytics 4", exact: true }),
  ).toHaveCount(1);
  await expect(
    ga.getByRole("button", { name: "Połącz ponownie", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Google OAuth: adres powrotny, CSRF i zewnętrzny callback bez state nie otwierają dostępu", async ({
  page,
  request,
}) => {
  await ready(page);
  const wid = await page.getByLabel("Przestrzeń robocza").inputValue();
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  const google = page.getByRole("region", { name: "Połączenie konta Google" });
  await expect(
    google.getByRole("button", { name: "Połącz przez Google", exact: true }),
  ).toBeEnabled();
  const status = await request.get(`/api/local/workspaces/${wid}/google`);
  expect(status.ok()).toBeTruthy();
  expect((await status.json()).redirectUri).toBe(
    "http://127.0.0.1:3002/api/local/google/callback",
  );
  const rejected = await request.post(
    `/api/local/workspaces/${wid}/google/connect`,
    { headers: { Origin: "https://evil.example" }, data: { includeAds: true } },
  );
  expect(rejected.status()).toBe(403);
  const callback = await request.get(
    "/api/local/google/callback?state=bad&code=secret-demo",
    { headers: { "sec-fetch-site": "cross-site" } },
  );
  expect(callback.status()).toBe(400);
  expect(await callback.text()).not.toContain("secret-demo");
  const start = await page.request.post(
    `/api/local/workspaces/${wid}/google/connect`,
    { data: { includeAds: true } },
  );
  expect(start.ok()).toBeTruthy();
  const authorization = new URL((await start.json()).url);
  expect(authorization.origin).toBe("https://accounts.google.com");
  const callbackUrl = `/api/local/google/callback?${new URLSearchParams({ state: authorization.searchParams.get("state")!, error: "access_denied" })}`;
  const denied = await page.request.get(callbackUrl, {
    headers: { "sec-fetch-site": "cross-site" },
    maxRedirects: 0,
  });
  expect(denied.status()).toBe(303);
  expect(new URL(denied.headers().location).searchParams.get("google")).toBe(
    "denied",
  );
  expect(
    (await page.request.get(callbackUrl, { maxRedirects: 0 })).status(),
  ).toBe(400);
  expect(
    (
      await (
        await page.request.get(`/api/local/workspaces/${wid}/google`)
      ).json()
    ).connected,
  ).toBe(false);
});

test("Google OAuth i Ads: wybór usług, MCC, zapis raportu, pulpit i odłączenie — DEMO mock API", async ({
  page,
}) => {
  await ready(page);
  const wid = await page.getByLabel("Przestrzeń robocza").inputValue();
  let connected = true,
    saved = false;
  const totals = {
    clicks: 420,
    impressions: 21000,
    cost: 1250,
    conversions: 12.5,
    conversionValue: 6250,
    ctr: 0.02,
    cpc: 1250 / 420,
    cpa: 100,
    roas: 5,
  };
  const weights = Array.from({ length: 30 }, (_, i) => 5 + i / 3 + (i % 7));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let clicksLeft = totals.clicks,
    costLeft = totals.cost,
    conversionsLeft = totals.conversions;
  const daily = weights.map((w, i) => {
    const date = new Date("2026-09-06T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + i);
    const clicks =
      i === 29 ? clicksLeft : Math.floor((totals.clicks * w) / weightSum);
    const cost =
      i === 29
        ? costLeft
        : Math.round(((totals.cost * w) / weightSum) * 100) / 100;
    const conversions =
      i === 29
        ? conversionsLeft
        : Math.round(((totals.conversions * w) / weightSum) * 100) / 100;
    clicksLeft -= clicks;
    costLeft -= cost;
    conversionsLeft -= conversions;
    return {
      date: date.toISOString().slice(0, 10),
      clicks,
      impressions: clicks * 50,
      cost,
      conversions,
      conversionValue: cost * 5,
    };
  });
  const report = {
    provider: "google_ads",
    resource: "Firma DEMO · 1234567890",
    from: "2026-09-06",
    to: "2026-10-05",
    fetched_at: "2026-10-06T12:00:00Z",
    currency: "PLN",
    totals,
    daily,
    breakdown: [{ label: "DEMO · Rozwój firmy", values: totals }],
    warnings: [
      "DEMO — jawny mock Google Ads API, bez danych kont użytkownika.",
    ],
  };
  let selection = { customerId: "", loginCustomerId: "" };
  await page.route(`**/api/local/workspaces/${wid}/google*`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/resources"))
      return route.fulfill({
        json: {
          resources: [{ id: "1234567890", label: "Firma DEMO · 1234567890" }],
        },
      });
    if (url.pathname.endsWith("/disconnect")) {
      connected = false;
      saved = false;
      selection = { customerId: "", loginCustomerId: "" };
      return route.fulfill({
        json: { message: "Usunięto lokalne połączenie Google — DEMO." },
      });
    }
    return route.fulfill({
      json: {
        clientConfigured: true,
        connected,
        connectedAt: "2026-10-06T12:00:00Z",
        scopes: connected ? ["https://www.googleapis.com/auth/adwords"] : [],
        adsDeveloperConfigured: true,
        redirectUri: "http://127.0.0.1:3002/api/local/google/callback",
      },
    });
  });
  await page.route(
    `**/api/local/workspaces/${wid}/google/**`,
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/resources"))
        return route.fulfill({
          json: {
            resources: [{ id: "1234567890", label: "Firma DEMO · 1234567890" }],
          },
        });
      if (url.pathname.endsWith("/disconnect")) {
        connected = false;
        saved = false;
        selection = { customerId: "", loginCustomerId: "" };
        return route.fulfill({
          json: { message: "Usunięto lokalne połączenie Google — DEMO." },
        });
      }
      return route.fallback();
    },
  );
  await page.route(
    `**/api/local/workspaces/${wid}/integrations`,
    async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        if (body.action === "configure") {
          selection = body.resource;
          return route.fulfill({
            json: { message: "Zapisano usługę Google Ads — DEMO." },
          });
        }
        saved = true;
        return route.fulfill({
          json: { summary: "Pobrano Google Ads — DEMO.", report },
        });
      }
      return route.fulfill({
        json: {
          providers: [
            {
              provider: "ga4",
              configured: false,
              resource: {},
              required: [],
              authConfigured: connected,
            },
            {
              provider: "google_ads",
              configured: connected && !!selection.customerId,
              resource: selection,
              required: [],
              authConfigured: connected,
            },
          ],
          states: saved ? [{ provider: "google_ads", status: "checked" }] : [],
          snapshots: saved
            ? [{ provider: "google_ads", payload: { report } }]
            : [],
        },
      });
    },
  );
  // Callback landing restores the company and navigates directly to Connectors.
  await page.goto(`/?google=connected&googleWorkspace=${wid}`);
  await expect(
    page.getByText(
      "Połączono Google. Wybierz usługi poniżej i pobierz statystyki.",
    ),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/google=/);
  const ads = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Google Ads", exact: true }),
  });
  await ads.getByLabel("Numer menedżera MCC (opcjonalnie)").fill("9876543210");
  await ads
    .getByRole("button", { name: "Wczytaj konta pod menedżerem MCC" })
    .click();
  await ads
    .getByLabel("Wybierz usługę Google", { exact: true })
    .selectOption("1234567890");
  await ads
    .getByRole("button", { name: "Zapisz usługę Google Ads", exact: true })
    .click();
  expect(selection).toEqual({
    customerId: "1234567890",
    loginCustomerId: "9876543210",
  });
  await ads
    .getByRole("button", { name: "Pobierz statystyki", exact: true })
    .click();
  await expect(
    page.getByText("1250,00 zł", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("5×", { exact: true })).toBeVisible();
  await page.getByText("Kampanie Google Ads — do 20 według kosztu").click();
  await expect(
    page.getByText("DEMO · Rozwój firmy", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/google-oauth-ads-demo.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pulpit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Google Ads", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/google-ads-dashboard-demo.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("5×", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/google-ads-mobile-demo.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Konektory", exact: true }).click();
  await page
    .getByRole("button", { name: "Usuń lokalne połączenie Google" })
    .click();
  await expect(
    page.getByText("Usunięto lokalne połączenie Google — DEMO."),
  ).toBeVisible();
  await expect(
    page.getByText("Google połączone", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Pulpit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Google Ads", exact: true }),
  ).not.toBeVisible();
});
