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
