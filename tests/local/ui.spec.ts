import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function ready(page: Page) {
  await page.goto("/");
  const create = page.getByText("Nowa przestrzeń firmy", { exact: true });
  await expect(create).toHaveAttribute("aria-disabled", "false");
  if (!(await page.getByLabel("Nazwa nowej przestrzeni").isVisible()))
    await create.click();
  await page.getByLabel("Nazwa nowej przestrzeni").fill("Studio Forma · DEMO");
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/local/workspaces") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Utwórz przestrzeń", exact: true })
    .click();
  const { id } = await (await created).json();
  await page.getByRole("button", { name: "Pomiń przewodnik" }).click();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  return id as string;
}

async function navigate(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1440) < 900) {
    await page.getByRole("button", { name: "Otwórz nawigację" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name, exact: true })
      .click();
  } else await page.getByRole("button", { name, exact: true }).click();
}

async function noOverflow(page: Page) {
  const measure = await page.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
    elements: Array.from(document.querySelectorAll("body *"))
      .filter(
        (element) => element.getBoundingClientRect().right > innerWidth + 1,
      )
      .slice(0, 8)
      .map((element) => element.className),
  }));
  expect(measure.width, JSON.stringify(measure)).toBeLessThanOrEqual(
    measure.viewport,
  );
}

test("pulpit: 12 miesięcy, wybór słupka, tabela i układ 1440/768/390/320", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await ready(page);
  const path = `/api/local/workspaces/${id}/data`;
  const snapshot = await (await page.request.get(path)).json();
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Warsaw",
  });
  const companyId = randomUUID();
  snapshot.data.firms = [
    {
      id: companyId,
      name: "Studio Forma · DEMO",
      city: "Warszawa",
      industry: "Projektowanie",
      website: "",
      nip: "",
      notes: "Dane demonstracyjne do testu UI.",
      created: day,
    },
  ];
  snapshot.data.deals = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - i);
    return {
      id: randomUUID(),
      companyId,
      name: `Projekt ${i + 1} · DEMO`,
      value: 4200 + i * 950,
      probability: i === 0 ? 65 : 100,
      stage: i === 0 ? "Oferta" : "Wygrana",
      closeDate: date.toISOString().slice(0, 10),
    };
  });
  expect((await page.request.put(path, { data: snapshot })).ok()).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "12 miesięcy", exact: true }),
  ).toBeVisible();
  const effect = page.locator(".crm-brand-atmosphere");
  await expect(effect).toHaveAttribute("data-effect", "static");
  await expect(effect.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "12 miesięcy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "12 miesięcy", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const bars = page.getByRole("button", { name: /: zrealizowane/ });
  await expect(bars).toHaveCount(13);
  await bars.nth(1).click();
  await page.mouse.move(0, 0);
  await expect(bars.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page
    .getByText("Dane wykresu i sposób obliczania", { exact: true })
    .click();
  await expect(page.locator(".crm-revenue-table tbody tr")).toHaveCount(13);
  await page
    .getByText("Dane wykresu i sposób obliczania", { exact: true })
    .click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(page);
    if (process.env.UPDATE_UI_SCREENSHOTS && [1440, 390].includes(width)) {
      // Capture the phone overview in a tall viewport so Chromium paints glass
      // surfaces directly, rather than stitching offscreen compositing tiles.
      if (width === 390) await page.setViewportSize({ width, height: 2100 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `docs/screenshots/ui-dashboard-${width}-demo.png`,
        fullPage: width !== 390,
      });
    }
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(effect.locator("canvas")).toHaveCount(0);
  await expect(effect).toHaveAttribute("data-effect", "static");
  await page.getByRole("button", { name: "6 miesięcy", exact: true }).click();
  await expect(bars).toHaveCount(7);
});

test("konektory: jeden odczyt na źródło, częściowy błąd, kontynuacja i pominięcie WordPress", async ({
  page,
}) => {
  await ready(page);
  const calls: string[] = [];
  await page.route("**/api/local/workspaces/*/integrations", async (route) => {
    if (route.request().method() === "POST") {
      const { provider, action } = route.request().postDataJSON();
      expect(action).toBe("sync");
      calls.push(provider);
      await route.fulfill(
        provider === "ga4"
          ? { status: 403, json: { error: "DEMO: brak uprawnień GA4" } }
          : { json: { summary: "DEMO: zapisano raport" } },
      );
      return;
    }
    const data = await (await route.fetch()).json();
    data.providers = data.providers.map((config: { provider: string }) => ({
      ...config,
      configured: ["ga4", "search_console", "wordpress", "stripe"].includes(
        config.provider,
      ),
    }));
    data.states = [
      { provider: "ga4", status: "error" },
      { provider: "search_console", status: "checked" },
      { provider: "wordpress", status: "checked" },
      { provider: "stripe", status: "disconnected" },
    ];
    await route.fulfill({ json: data });
  });
  await navigate(page, "Konektory");
  const refresh = page.getByRole("button", {
    name: "Odśwież statystyki (2)",
    exact: true,
  });
  await expect(refresh).toBeEnabled();
  await refresh.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Odświeżono 1 z 2" }),
  ).toBeVisible();
  expect(calls).toEqual(["ga4", "search_console"]);
  await expect(
    page.getByRole("alert").filter({ hasText: "DEMO: brak uprawnień GA4" }),
  ).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(page);
  }
  if (process.env.UPDATE_UI_SCREENSHOTS) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "docs/screenshots/ui-connectors-demo.png",
      fullPage: true,
    });
  }
});

test("agent: dyktowanie PL zachowuje szkic, wymaga wysłania i obsługuje odmowę mikrofonu — mock mowy", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        Object.assign(window, { testRecognition: this });
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition });
  });
  await ready(page);
  await navigate(page, "Agent AI");
  const field = page.getByLabel("Wiadomość do agenta", { exact: true }).first();
  await field.fill("Plan dnia.");
  await page
    .getByRole("button", { name: "Dyktuj wiadomość", exact: true })
    .first()
    .click();
  await page.evaluate(() => {
    const r = (
      window as unknown as Window & {
        testRecognition: {
          lang: string;
          onresult: (e: unknown) => void;
          stop: () => void;
        };
      }
    ).testRecognition;
    if (r.lang !== "pl-PL") throw Error("Nie ustawiono polskiego języka");
    r.onresult({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: "Co powinienem zrobić dzisiaj?" } },
      ],
    });
    r.stop();
  });
  await expect(field).toHaveValue("Plan dnia. Co powinienem zrobić dzisiaj?");
  const log = page.getByRole("log", {
    name: "Rozmowa z Evolution Agent",
    exact: true,
  });
  await expect(log.locator("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Wyślij", exact: true }).click();
  await expect(log.locator("article")).toHaveCount(1);
  await expect(field).toHaveValue("");
  if (process.env.UPDATE_UI_SCREENSHOTS) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "docs/screenshots/ui-agent-demo.png",
      fullPage: true,
    });
  }
  await field.fill("Plan dnia. Co powinienem zrobić dzisiaj?");
  await page
    .getByRole("button", { name: "Dyktuj wiadomość", exact: true })
    .first()
    .click();
  await page.evaluate(() => {
    const r = (
      window as unknown as Window & {
        testRecognition: {
          onerror: (e: { error: string }) => void;
          stop: () => void;
        };
      }
    ).testRecognition;
    r.onerror({ error: "not-allowed" });
    r.stop();
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Brak zgody na mikrofon" }),
  ).toBeVisible();
  await expect(field).toHaveValue("Plan dnia. Co powinienem zrobić dzisiaj?");
  await page.getByRole("button", { name: "Wyślij", exact: true }).click();
  await expect(log.locator("article")).toHaveCount(2);
  await expect(field).toHaveValue("");
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(page);
  }
});

test("agent: brak obsługi mowy nie blokuje czatu, Enter wysyła tylko raz", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
    });
  });
  await ready(page);
  await navigate(page, "Agent AI");
  await expect(
    page.getByRole("button", { name: "Dyktuj wiadomość", exact: true }).first(),
  ).toBeDisabled();
  const field = page.getByLabel("Wiadomość do agenta", { exact: true }).first();
  await field.fill("Co powinienem zrobić dzisiaj?");
  await field.press("Enter");
  await expect(
    page
      .getByRole("log", { name: "Rozmowa z Evolution Agent", exact: true })
      .locator("article"),
  ).toHaveCount(1);
  await expect(field).toHaveValue("");
});

test("shader: odmowa adaptera GPU zachowuje statyczny nagłówek i działające przyciski", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { adapterCalls: 0 });
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {
        requestAdapter: async () => {
          const state = window as unknown as { adapterCalls: number };
          state.adapterCalls++;
          return null;
        },
      },
    });
  });
  await ready(page);
  const effect = page.locator(".crm-brand-atmosphere");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { adapterCalls: number }).adapterCalls,
      ),
    )
    .toBeGreaterThan(0);
  await expect(effect).toHaveAttribute("data-effect", "static");
  await expect(effect.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "12 miesięcy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /: zrealizowane/ }),
  ).toHaveCount(13);
});

test("agent: długa odpowiedź ma własne przewijanie; błąd API zachowuje szkic — mock AI", async ({
  page,
}) => {
  await ready(page);
  await navigate(page, "Agent AI");
  await page
    .getByRole("group", { name: "Dostawca AI", exact: true })
    .getByRole("button", { name: /OpenAI API/ })
    .click();
  let fail = false;
  await page.route("**/api/agent", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill(
      fail
        ? { status: 503, json: { error: "DEMO: dostawca niedostępny" } }
        : {
            json: {
              answer:
                "# DEMO — odpowiedź testowa\n\n" +
                Array.from(
                  { length: 40 },
                  (_, i) =>
                    `Akapit ${i + 1}: analiza przykładowa do testu przewijania.\n\n`,
                ).join(""),
              actions: [],
              rejected: [],
            },
          },
    );
  });
  const field = page.getByLabel("Wiadomość do agenta", { exact: true }).first();
  await field.fill("Analiza DEMO");
  await field.press("Enter");
  const log = page.getByRole("log", {
    name: "Rozmowa z Evolution Agent",
    exact: true,
  });
  await expect(log.locator("article")).toHaveCount(1);
  await expect(field).toHaveValue("");
  expect(
    await log.evaluate(
      (element) =>
        element.clientHeight < element.scrollHeight &&
        element.clientHeight <= 640,
    ),
  ).toBe(true);
  fail = true;
  await field.fill("Zachowaj tę wiadomość po błędzie");
  await field.press("Enter");
  await expect(log.locator("article")).toHaveCount(2);
  await expect(log.getByText(/DEMO: dostawca niedostępny/)).toBeVisible();
  await expect(field).toHaveValue("Zachowaj tę wiadomość po błędzie");
  expect(await log.evaluate((element) => element.clientHeight <= 640)).toBe(
    true,
  );
});

test("Brand Studio: strona + GitHub dopasowują dashboard, zapis w SQLite i Company Brain — mock skanu", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await ready(page);
  const requests: unknown[] = [];
  await page.route("**/api/brand/scan", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        brand: {
          name: "Kwiaciarnia Róża · DEMO",
          tagline: "Kwiaty, które mówią za Ciebie",
          description: "Bukiety i dekoracje ślubne w Krakowie.",
          website: "https://roza.example.pl/",
          github: "https://github.com/roza-demo",
          logo: "",
          icon: "",
          image: "",
          colors: {
            primary: "#e11d48",
            accent: "#16a34a",
            palette: ["#e11d48", "#16a34a"],
          },
          fonts: ["Playfair Display"],
          headingFont: "Playfair Display",
          useFont: false,
          language: "pl",
          contact: {
            emails: ["biuro@roza.example.pl"],
            phones: ["+48 600 100 200"],
            address: "ul. Floriańska 1, Kraków",
            nip: "6761234567",
            city: "Kraków",
          },
          socials: [
            { network: "Facebook", url: "https://www.facebook.com/roza-demo" },
          ],
          keywords: ["Wesela"],
          services: ["Bukiety okolicznościowe"],
          technologies: ["WordPress"],
          trackers: ["Google Analytics 4"],
          rating: { value: 4.8, count: 127, source: "Google", url: "" },
          reviews: [
            {
              author: "Anna",
              rating: 5,
              text: "Piękny bukiet!",
              source: "Google",
            },
          ],
          audit: {
            score: 82,
            responseMs: 410,
            checks: [
              {
                id: "https",
                label: "Strona działa po HTTPS",
                ok: true,
                weight: 2,
                hint: "",
              },
              {
                id: "sitemap",
                label: "Mapa witryny sitemap.xml",
                ok: false,
                weight: 1,
                hint: "Dodaj /sitemap.xml.",
              },
            ],
          },
          githubData: {
            login: "roza-demo",
            name: "Róża DEMO",
            url: "https://github.com/roza-demo",
            avatar: "",
            bio: "",
            location: "Kraków",
            followers: 3,
            publicRepos: 2,
            stars: 38,
            forks: 6,
            openIssues: 1,
            lastPush: "2026-10-20",
            languages: [
              { name: "PHP", share: 70 },
              { name: "CSS", share: 30 },
            ],
            topics: [],
            repos: [
              {
                name: "sklep-roza",
                description: "Sklep",
                stars: 30,
                forks: 5,
                language: "PHP",
                url: "https://github.com/roza-demo/sklep-roza",
                pushed: "2026-10-20",
              },
            ],
          },
          warnings: [],
          scannedAt: "2026-10-29T10:00:00.000Z",
          applied: false,
        },
      },
    });
  });
  await page
    .getByPlaceholder("https://twoja-firma.pl")
    .first()
    .fill("https://roza.example.pl");
  await page
    .getByPlaceholder("https://github.com/twoja-firma")
    .first()
    .fill("https://github.com/roza-demo");
  await page.getByRole("button", { name: "Dopasuj dashboard" }).click();
  await expect(
    page.getByRole("button", { name: "Profil firmy Kwiaciarnia Róża · DEMO" }),
  ).toBeVisible();
  expect(requests).toEqual([
    {
      website: "https://roza.example.pl",
      github: "https://github.com/roza-demo",
    },
  ]);
  await expect(page.getByText("Dobry", { exact: false }).first()).toBeVisible();
  const primary = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim(),
    );
  expect(await primary()).toBe("#e11d48");
  await expect(page.getByText("Jak widzą Cię klienci")).toBeVisible();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  const saved = await (
    await page.request.get(`/api/local/workspaces/${id}/data`)
  ).json();
  expect(saved.settings.brand.name).toBe("Kwiaciarnia Róża · DEMO");
  expect(saved.settings.brand.applied).toBe(true);
  await page.getByRole("button", { name: "Profil firmy", exact: true }).click();
  await expect(page.getByText("Reputacja klientów")).toBeVisible();
  await expect(page.getByText("127 opinii · Google")).toBeVisible();
  await page.getByRole("button", { name: "Zapisz w Company Brain" }).click();
  await expect(
    page.getByText("Profil marki zapisany w Company Brain", { exact: false }),
  ).toBeVisible();
  const brain = await (
    await page.request.get(`/api/local/workspaces/${id}/brain`)
  ).json();
  const note = brain.documents.find(
    (d: { title: string }) =>
      d.title === "Profil marki — Kwiaciarnia Róża · DEMO",
  );
  expect(note.content).toContain("Ocena 4.8/5");
  await page.getByRole("button", { name: "Zapisz w Company Brain" }).click();
  await expect(
    page.getByText("Zaktualizowano notatkę profilu marki", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Przywróć domyślny wygląd" }).click();
  expect(await primary()).toBe("#6842ff");
  await expect(
    page.getByRole("button", { name: "Zastosuj branding" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await noOverflow(page);
});

test("Lead Hub → CRM: konwersja tworzy firmę, kontakt i szansę ze źródłem, bez duplikatów", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await ready(page);
  await navigate(page, "Lead Hub");
  await page.getByRole("button", { name: "Dodaj leada", exact: true }).click();
  await page.getByLabel("Imię leada", { exact: true }).fill("Anna");
  await page.getByLabel("Nazwisko leada", { exact: true }).fill("Nowak");
  await page
    .getByLabel("E-mail leada", { exact: true })
    .fill("anna.nowak@example.com");
  await page.getByLabel("Źródło leada", { exact: true }).fill("google_ads");
  await page
    .getByLabel("Kampania leada", { exact: true })
    .fill("Remonty · Kraków");
  await page
    .getByLabel("Szacowana wartość (PLN)", { exact: true })
    .fill("12000");
  await page.getByRole("button", { name: "Zapisz leada", exact: true }).click();
  await expect(page.getByText("Ten lead nie jest jeszcze w CRM")).toBeVisible();
  await page
    .getByRole("button", { name: "Konwertuj do CRM", exact: true })
    .click();
  await expect(page.getByText("W CRM: Anna Nowak")).toBeVisible();
  await expect(page.getByText("źródło: google_ads")).toBeVisible();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  const saved = await (
    await page.request.get(`/api/local/workspaces/${id}/data`)
  ).json();
  expect(saved.data.firms).toHaveLength(1);
  expect(saved.data.contacts[0].email).toBe("anna.nowak@example.com");
  expect(saved.data.deals[0]).toMatchObject({
    name: "Remonty · Kraków — Anna Nowak",
    value: 12000,
    stage: "Nowa",
    source: "google_ads",
  });
  await page
    .getByRole("button", { name: "Uzupełnij w CRM", exact: true })
    .click();
  await expect(
    page.getByText("Połączono z istniejącą firmą", { exact: false }),
  ).toBeVisible();
  const again = await (
    await page.request.get(`/api/local/workspaces/${id}/data`)
  ).json();
  expect(again.data.firms).toHaveLength(1);
  expect(again.data.deals).toHaveLength(1);
  await page.getByRole("button", { name: "Otwórz w CRM" }).click();
  await expect(
    page.getByRole("heading", { name: "Szanse sprzedaży", exact: true }),
  ).toBeVisible();
});

test("Monitoring marki: historia skanów, alert spadku i cotygodniowe zadanie — mock skanu", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await ready(page);
  let score = 90;
  await page.route("**/api/brand/scan", async (route) => {
    const value = score;
    score = 70;
    await route.fulfill({
      json: {
        brand: {
          name: "Monitoring · DEMO",
          website: "https://monitoring.example.pl/",
          colors: { primary: "#0ea5e9", accent: "#f59e0b", palette: [] },
          rating: {
            value: value === 90 ? 4.7 : 4.4,
            count: 40,
            source: "Google",
            url: "",
          },
          audit: {
            score: value,
            responseMs: 300,
            checks: [
              {
                id: "title",
                label: "Tytuł strony",
                ok: value === 90,
                weight: 1,
                hint: "",
              },
            ],
          },
          scannedAt:
            value === 90
              ? "2026-10-01T08:00:00.000Z"
              : "2026-10-08T08:00:00.000Z",
          applied: true,
        },
      },
    });
  });
  await page
    .getByPlaceholder("https://twoja-firma.pl")
    .first()
    .fill("https://monitoring.example.pl");
  await page.getByRole("button", { name: "Dopasuj dashboard" }).click();
  await expect(
    page.getByRole("button", { name: "Profil firmy Monitoring · DEMO" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Profil firmy", exact: true }).click();
  await expect(
    page.getByText("Jak zmienia się Twoja obecność online"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Monitoruj co tydzień" }).click();
  await expect(
    page.getByRole("button", { name: "Monitoruj co tydzień" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Skanuj teraz" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "wynik strony spadł z 90 do 70" }),
  ).toBeVisible();
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  const saved = await (
    await page.request.get(`/api/local/workspaces/${id}/data`)
  ).json();
  expect(
    saved.settings.brand.history.map((h: { score: number }) => h.score),
  ).toEqual([90, 70]);
  expect(
    saved.settings.automation.jobs.some(
      (j: { kind: string }) => j.kind === "brand",
    ),
  ).toBe(true);
});

test("Konkurencja: skan konkurenta, tabela porównania, przewagi i Company Brain — mock skanu", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await ready(page);
  await page.route("**/api/brand/scan", async (route) => {
    const own = !route.request().postDataJSON().website.includes("rywal");
    await route.fulfill({
      json: {
        brand: {
          name: own ? "Moja Firma · DEMO" : "Rywal · DEMO",
          website: own
            ? "https://moja.example.pl/"
            : "https://rywal.example.pl/",
          rating: {
            value: own ? 4.1 : 4.8,
            count: own ? 5 : 90,
            source: "Google",
            url: "",
          },
          audit: {
            score: own ? 60 : 85,
            responseMs: 500,
            checks: [{ id: "a", label: "A", ok: true, weight: 1, hint: "" }],
          },
          trackers: own ? [] : ["Google Analytics 4"],
          services: own ? [] : ["Remonty łazienek"],
          scannedAt: "2026-10-20T08:00:00.000Z",
          applied: true,
        },
      },
    });
  });
  await page
    .getByPlaceholder("https://twoja-firma.pl")
    .first()
    .fill("https://moja.example.pl");
  await page.getByRole("button", { name: "Dopasuj dashboard" }).click();
  await expect(
    page.getByRole("button", { name: "Profil firmy Moja Firma · DEMO" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Profil firmy", exact: true }).click();
  await page.getByLabel("Strona konkurenta").fill("https://rywal.example.pl");
  await page.getByRole("button", { name: "Dodaj konkurenta" }).click();
  await expect(
    page.getByText("Rywal · DEMO ma lepszą stronę (85 vs 60/100)"),
  ).toBeVisible();
  await expect(page.getByText("Remonty łazienek")).toBeVisible();
  await page
    .getByRole("button", { name: "Zapisz w Company Brain" })
    .nth(1)
    .click();
  await expect(
    page.getByText("Porównanie zapisane w Company Brain"),
  ).toBeVisible();
  const brain = await (
    await page.request.get(`/api/local/workspaces/${id}/brain`)
  ).json();
  const note = brain.documents.find(
    (d: { category: string }) => d.category === "competitors",
  );
  expect(note.content).toContain("| Rywal · DEMO |");
  await expect(
    page.getByText("Zapisano w SQLite", { exact: true }),
  ).toBeVisible();
  const saved = await (
    await page.request.get(`/api/local/workspaces/${id}/data`)
  ).json();
  expect(saved.settings.brand.competitors[0].name).toBe("Rywal · DEMO");
  await page
    .getByRole("button", { name: "Usuń Rywal · DEMO z porównania" })
    .click();
  await expect(
    page.getByText("Dodaj do 3 stron konkurentów", { exact: false }),
  ).toBeVisible();
});
