const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-ts.cjs");
const batch = load("lib/integrations/batch.ts");

test("zbiorczy odczyt pomija import WordPress, nieskonfigurowane i odłączone źródła", () => {
  const configs = [
    "wordpress",
    "ga4",
    "stripe",
    "posthog",
    "google_ads",
    "search_console",
  ].map((provider) => ({ provider, configured: provider !== "google_ads" }));
  const states = configs.map(({ provider }) => ({
    provider,
    status:
      provider === "stripe"
        ? "disconnected"
        : provider === "posthog"
          ? "error"
          : "checked",
  }));
  assert.deepEqual(Array.from(batch.statisticsSources(configs, states)), [
    "ga4",
    "posthog",
    "search_console",
  ]);
  assert.equal(batch.statisticsSources(configs, []).length, 0);
});

test("odczyty są sekwencyjne; błąd pierwszego nie blokuje kolejnych", async () => {
  let concurrent = 0;
  const called = [],
    progress = [];
  const result = await batch.refreshStatistics(
    ["ga4", "search_console", "stripe"],
    async (provider) => {
      concurrent++;
      assert.equal(concurrent, 1);
      called.push(provider);
      await Promise.resolve();
      concurrent--;
      if (provider === "ga4") throw "Brak dostępu";
    },
    (...args) => progress.push(args),
  );
  assert.deepEqual(called, ["ga4", "search_console", "stripe"]);
  assert.deepEqual(progress, [
    ["ga4", 0, 3],
    ["search_console", 1, 3],
    ["stripe", 2, 3],
  ]);
  assert.equal(result[0].error, "Błąd odczytu.");
  assert.equal(result[1].error, undefined);
  assert.equal(result[2].error, undefined);
});

test("brak aktywnych źródeł nie wykonuje żadnego odczytu", async () => {
  const result = await batch.refreshStatistics(
    [],
    () => assert.fail("Nie powinien wywołać API"),
    () => assert.fail("Nie powinien zgłaszać postępu"),
  );
  assert.equal(result.length, 0);
});
