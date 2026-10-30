import "server-only";
import { apiJson, IntegrationError } from "./http";
import {
  validateResource,
  type IntegrationResult,
  type Resource,
} from "./model";
import type { CampaignDay } from "./marketing";

const VERSION = "v21.0";
const LEAD_ACTIONS = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_web_lead",
];
const PURCHASE_ACTIONS = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
];

type Action = { action_type?: string; value?: string };
export type MetaInsight = {
  date_start?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Action[];
  action_values?: Action[];
};

export function metaConfigured() {
  return /^[A-Za-z0-9_-]{20,500}$/.test(process.env.META_ACCESS_TOKEN || "");
}

function sum(list: Action[] | undefined, types: string[]) {
  const found = (list || []).filter((a) =>
    types.includes(String(a.action_type)),
  );
  const best = types
    .map((t) => found.find((a) => a.action_type === t))
    .find(Boolean);
  const n = Number(best?.value ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function metaRows(rows: MetaInsight[]): CampaignDay[] {
  const result = new Map<string, CampaignDay>();
  for (const r of rows) {
    const date = String(r.date_start || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new IntegrationError("Nieprawidłowa data w odpowiedzi Meta.");
    const campaign =
      String(r.campaign_name || "Kampania bez nazwy")
        .replace(/[\x00-\x1f]/g, " ")
        .trim()
        .slice(0, 200) || "Kampania bez nazwy";
    const num = (v: unknown) => {
      const n = Number(v ?? 0);
      return Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : 0;
    };
    const leads = Math.round(sum(r.actions, LEAD_ACTIONS));
    const key = `${date}:${campaign}`;
    const prev = result.get(key);
    const row: CampaignDay = {
      date,
      source: "meta_ads",
      campaign,
      spend: Math.round((num(r.spend) + (prev?.spend ?? 0)) * 100) / 100,
      impressions: Math.round(num(r.impressions)) + (prev?.impressions ?? 0),
      clicks: Math.round(num(r.clicks)) + (prev?.clicks ?? 0),
      leads: leads + (prev?.leads ?? 0),
      qualified: prev?.qualified ?? 0,
      revenue:
        Math.round(
          (sum(r.action_values, PURCHASE_ACTIONS) + (prev?.revenue ?? 0)) * 100,
        ) / 100,
    };
    result.set(key, row);
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function readMeta(settings: Resource): Promise<IntegrationResult> {
  if (!metaConfigured())
    throw new IntegrationError("Ustaw META_ACCESS_TOKEN w .env.local.", 400);
  const { adAccountId } = validateResource("meta_ads", settings);
  const headers = { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` };
  const account = (await apiJson(
    `https://graph.facebook.com/${VERSION}/${adAccountId}?fields=currency,name`,
    { headers },
  )) as { currency?: string; name?: string };
  let url: string | null =
    `https://graph.facebook.com/${VERSION}/${adAccountId}/insights?level=campaign&time_increment=1&date_preset=last_30d&limit=500&fields=campaign_name,spend,impressions,clicks,actions,action_values`;
  const all: MetaInsight[] = [];
  for (let page = 0; url && page < 10; page++) {
    const result = (await apiJson(url, { headers })) as {
      data?: MetaInsight[];
      paging?: { next?: string };
    };
    if (!Array.isArray(result.data))
      throw new IntegrationError("Nieprawidłowa odpowiedź Meta Ads.");
    all.push(...result.data);
    const next = result.paging?.next;
    url = next && new URL(next).hostname === "graph.facebook.com" ? next : null;
  }
  const rows = metaRows(all);
  const currency = String(account.currency || "").toUpperCase();
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  return {
    summary: `Meta Ads: ${rows.length} dni kampanii z 30 dni, wydatki ${spend.toFixed(2)} ${currency || "(waluta konta)"}.${currency && currency !== "PLN" ? " Uwaga: konto rozlicza się w innej walucie niż PLN — kwoty zapisano bez przeliczenia." : ""}`,
    campaigns: rows,
    currency,
  };
}
