export const PROVIDERS = [
  "wordpress",
  "posthog",
  "ga4",
  "search_console",
  "google_ads",
  "stripe",
  "meta_ads",
  "plausible",
] as const;
export type Provider = (typeof PROVIDERS)[number];
export const providerLabels: Record<Provider, string> = {
  wordpress: "WordPress / Elementor",
  posthog: "PostHog",
  ga4: "Google Analytics 4",
  search_console: "Google Search Console",
  google_ads: "Google Ads",
  stripe: "Stripe",
  meta_ads: "Meta Ads",
  plausible: "Plausible Analytics",
};
export type PaymentsReport = {
  currency: string;
  from: string;
  to: string;
  gross: number;
  refunded: number;
  net: number;
  count: number;
  failed: number;
  average: number;
  available: number;
  pending: number;
  daily: { date: string; amount: number }[];
  truncated: boolean;
};
export type GoogleProvider = "ga4" | "search_console" | "google_ads";
export type ResourceProvider = GoogleProvider | "meta_ads" | "plausible";
export const RESOURCE_PROVIDERS: ResourceProvider[] = [
  "ga4",
  "search_console",
  "google_ads",
  "meta_ads",
  "plausible",
];
export type Resource = {
  propertyId?: string;
  siteUrl?: string;
  customerId?: string;
  loginCustomerId?: string;
  adAccountId?: string;
  siteId?: string;
};
export type ReportProvider = GoogleProvider | "plausible";
export type GoogleReport = {
  provider: ReportProvider;
  resource: string;
  from: string;
  to: string;
  fetched_at: string;
  totals: Record<string, number>;
  daily: { date: string; [metric: string]: number | string }[];
  breakdown: { label: string; values: Record<string, number> }[];
  currency?: string;
  warnings: string[];
};
export type IntegrationResult = {
  summary: string;
  documents?: { title: string; content: string }[];
  events?: unknown[][];
  report?: GoogleReport;
  payments?: PaymentsReport;
  campaigns?: import("./marketing").CampaignDay[];
  currency?: string;
  synced_at?: string;
};
export function validateResource(
  provider: ResourceProvider,
  value: unknown,
): Resource {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Podaj usługę do odczytu.");
  const v = value as Record<string, unknown>;
  if (provider === "google_ads") {
    const normalize = (value: unknown) =>
      typeof value === "string" ? value.trim().replaceAll("-", "") : "";
    const customerId = normalize(v.customerId),
      loginCustomerId = normalize(v.loginCustomerId);
    if (
      !/^[1-9][0-9]{9}$/.test(customerId) ||
      (loginCustomerId && !/^[1-9][0-9]{9}$/.test(loginCustomerId))
    )
      throw Error(
        "Podaj 10-cyfrowy numer konta Google Ads oraz opcjonalnie numer menedżera MCC.",
      );
    return { customerId, ...(loginCustomerId ? { loginCustomerId } : {}) };
  }
  if (provider === "meta_ads") {
    const id =
      typeof v.adAccountId === "string"
        ? v.adAccountId.trim().replace(/^act_/, "")
        : "";
    if (!/^[1-9][0-9]{4,19}$/.test(id))
      throw Error(
        "Podaj identyfikator konta reklamowego Meta, np. act_1234567890 lub 1234567890.",
      );
    return { adAccountId: `act_${id}` };
  }
  if (provider === "plausible") {
    const site =
      typeof v.siteId === "string"
        ? v.siteId
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/$/, "")
        : "";
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(site))
      throw Error("Podaj domenę witryny z Plausible, np. twoja-firma.pl.");
    return { siteId: site };
  }
  if (provider === "ga4") {
    if (
      typeof v.propertyId !== "string" ||
      !/^[1-9][0-9]{0,19}$/.test(v.propertyId.trim())
    )
      throw Error(
        "Podaj numeryczny identyfikator usługi GA4, np. 123456789. To nie identyfikator G-….",
      );
    return { propertyId: v.propertyId.trim() };
  }
  if (typeof v.siteUrl !== "string" || v.siteUrl.length > 1000)
    throw Error("Podaj adres usługi Search Console.");
  const site = v.siteUrl.trim();
  if (site.startsWith("sc-domain:")) {
    const domain = site.slice(10);
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
    )
      throw Error("Usługa domenowa ma format sc-domain:twoja-firma.pl.");
  } else {
    let url: URL;
    try {
      url = new URL(site);
    } catch {
      throw Error(
        "Podaj pełny adres HTTPS usługi, dokładnie jak w Search Console.",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw Error(
        "Adres usługi musi być HTTPS bez danych logowania i parametrów.",
      );
  }
  return { siteUrl: site };
}
