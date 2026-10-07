import type { Provider } from "./model";

const STATISTICS = new Set<Provider>([
  "ga4",
  "search_console",
  "google_ads",
  "posthog",
  "stripe",
]);

export function statisticsSources(
  configs: { provider: Provider; configured: boolean }[],
  states: { provider: string; status: string }[],
) {
  return configs
    .filter(
      (config) =>
        config.configured &&
        STATISTICS.has(config.provider) &&
        states.some(
          (state) =>
            state.provider === config.provider &&
            ["checked", "error"].includes(state.status),
        ),
    )
    .map((config) => config.provider);
}

/** Read sources in sequence; a failure never prevents refreshing the next source. */
export async function refreshStatistics(
  providers: Provider[],
  sync: (provider: Provider) => Promise<unknown>,
  progress: (provider: Provider, completed: number, total: number) => void,
) {
  const results: { provider: Provider; error?: string }[] = [];
  for (const provider of providers) {
    progress(provider, results.length, providers.length);
    try {
      await sync(provider);
      results.push({ provider });
    } catch (error) {
      results.push({
        provider,
        error: error instanceof Error ? error.message : "Błąd odczytu.",
      });
    }
  }
  return results;
}
