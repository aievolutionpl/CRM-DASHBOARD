import "server-only";
import { googleAuthConfigured } from "./google-auth";
import { readGoogleAds } from "./google-ads";
import { readGoogle } from "./google";
import {
  PROVIDERS,
  type Provider,
  type Resource,
  type IntegrationResult,
} from "./model";
import { apiJson } from "./http";
import { readStripe, stripeConfigured } from "./stripe";
import { readMeta, metaConfigured } from "./meta";
import { readPlausible, plausibleConfigured } from "./plausible";
export type { Provider } from "./model";
export function providerConfig(
  provider: Provider,
  resource: Resource = {},
  wid?: string,
) {
  if (
    provider === "ga4" ||
    provider === "search_console" ||
    provider === "google_ads"
  )
    return {
      configured:
        googleAuthConfigured(wid, provider) &&
        Boolean(
          provider === "ga4"
            ? resource.propertyId
            : provider === "google_ads"
              ? resource.customerId && process.env.GOOGLE_ADS_DEVELOPER_TOKEN
              : resource.siteUrl,
        ),
      authConfigured: googleAuthConfigured(wid, provider),
      resource,
      required: [
        "lub logowanie Google w panelu powyżej",
        ...(provider === "google_ads"
          ? []
          : ["GOOGLE_SERVICE_ACCOUNT_FILE (plik JSON konta usługi)"]),
        "lub GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_OAUTH_REFRESH_TOKEN",
        provider === "ga4"
          ? "Identyfikator usługi GA4 w panelu poniżej"
          : provider === "google_ads"
            ? "GOOGLE_ADS_DEVELOPER_TOKEN i numer konta Ads w panelu poniżej"
            : "Usługa Search Console w panelu poniżej",
      ],
    };
  if (provider === "meta_ads")
    return {
      configured: metaConfigured() && Boolean(resource.adAccountId),
      authConfigured: metaConfigured(),
      resource,
      required: [
        "META_ACCESS_TOKEN (token użytkownika systemowego z uprawnieniem ads_read)",
        "Identyfikator konta reklamowego act_… w panelu poniżej",
      ],
    };
  if (provider === "plausible")
    return {
      configured: plausibleConfigured() && Boolean(resource.siteId),
      authConfigured: plausibleConfigured(),
      resource,
      required: [
        "PLAUSIBLE_API_KEY (klucz Stats API)",
        "PLAUSIBLE_HOST (opcjonalnie, dla wersji self-hosted)",
        "Domena witryny w panelu poniżej",
      ],
    };
  if (provider === "stripe")
    return {
      configured: stripeConfigured(),
      required: [
        "STRIPE_SECRET_KEY (zalecany klucz ograniczony rk_… z odczytem Balance i Charges)",
      ],
    };
  if (provider === "wordpress")
    return {
      configured:
        Boolean(process.env.WP_BASE_URL) &&
        Boolean(process.env.WP_USERNAME) ===
          Boolean(process.env.WP_APPLICATION_PASSWORD),
      required: [
        "WP_BASE_URL",
        "WP_USERNAME (opcjonalnie)",
        "WP_APPLICATION_PASSWORD (opcjonalnie)",
      ],
    };
  return {
    configured: Boolean(
      process.env.POSTHOG_PROJECT_ID && process.env.POSTHOG_PERSONAL_API_KEY,
    ),
    required: [
      "POSTHOG_PROJECT_ID",
      "POSTHOG_PERSONAL_API_KEY",
      "POSTHOG_HOST (opcjonalnie)",
    ],
  };
}
function baseUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error("Adres integracji musi być HTTPS bez danych logowania.");
  return url;
}
async function getJson<T>(url: URL, init: RequestInit): Promise<T> {
  return (await apiJson(url, init)) as T;
}
export interface IntegrationAdapter {
  provider: Provider;
  read(): Promise<IntegrationResult>;
}
export function adapter(
  provider: Provider,
  resource: Resource = {},
  wid?: string,
): IntegrationAdapter {
  if (!PROVIDERS.includes(provider))
    throw Error("Nieznany dostawca integracji.");
  if (
    provider === "ga4" ||
    provider === "search_console" ||
    provider === "google_ads"
  )
    return {
      provider,
      read: () =>
        provider === "google_ads"
          ? readGoogleAds(resource, wid)
          : readGoogle(provider, resource, wid),
    };
  if (provider === "stripe") return { provider, read: readStripe };
  if (provider === "meta_ads")
    return { provider, read: () => readMeta(resource) };
  if (provider === "plausible")
    return { provider, read: () => readPlausible(resource) };
  if (provider === "wordpress")
    return {
      provider,
      async read() {
        const base = baseUrl(process.env.WP_BASE_URL || ""),
          url = new URL(
            `${base.pathname.replace(/\/$/, "")}/wp-json/wp/v2/pages?per_page=100&status=publish`,
            base,
          );
        const user = process.env.WP_USERNAME,
          password = process.env.WP_APPLICATION_PASSWORD;
        const rows = await getJson<
          {
            id: number;
            title?: { rendered?: string };
            content?: { rendered?: string };
            link: string;
          }[]
        >(url, {
          headers:
            user && password
              ? {
                  Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
                }
              : {},
        });
        if (!Array.isArray(rows) || rows.length > 100)
          throw Error("Nieprawidłowa odpowiedź WordPress.");
        const clean = (v: unknown) =>
          String(v || "")
            .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;|&#160;/g, " ")
            .replace(/&amp;/g, "&")
            .trim();
        return {
          summary: `Odczytano ${rows.length} opublikowanych stron (pierwsza strona API, maks. 100).`,
          documents: rows.map((p) => ({
            title:
              clean(p.title?.rendered)
                .slice(0, 90)
                .replace(/[\[\]\\/\x00-\x1f]/g, "-") || `Strona ${p.id}`,
            content: `# ${clean(p.title?.rendered)}\n\nŹródło: ${p.link}\n\n${clean(p.content?.rendered).slice(0, 180000)}`,
          })),
        };
      },
    };
  return {
    provider,
    async read() {
      const host = process.env.POSTHOG_HOST || "https://eu.posthog.com",
        url = baseUrl(host);
      if (!["eu.posthog.com", "us.posthog.com"].includes(url.hostname))
        throw Error("Ta wersja obsługuje PostHog Cloud EU/US.");
      url.pathname = `/api/projects/${encodeURIComponent(process.env.POSTHOG_PROJECT_ID || "")}/query/`;
      const result = await getJson<{ results: unknown[][] }>(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query:
              "SELECT event, count() FROM events WHERE timestamp >= now() - INTERVAL 30 DAY GROUP BY event ORDER BY count() DESC LIMIT 20",
          },
        }),
      });
      if (
        !Array.isArray(result.results) ||
        result.results.length > 20 ||
        result.results.some(
          (row) =>
            !Array.isArray(row) ||
            row.length !== 2 ||
            typeof row[0] !== "string" ||
            row[0].length > 1000 ||
            typeof row[1] !== "number" ||
            !Number.isSafeInteger(row[1]) ||
            row[1] < 0,
        )
      )
        throw Error("Nieprawidłowa odpowiedź PostHog.");
      return {
        summary: `Odczytano ${result.results.length} typów zdarzeń z ostatnich 30 dni.`,
        events: result.results,
      };
    },
  };
}
