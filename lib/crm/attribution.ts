import type { Deal } from "./model";
import type { CampaignDay } from "../integrations/marketing";

export const CHANNEL_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  microsoft_ads: "Microsoft Ads",
  meta_ads: "Meta Ads",
  organic: "SEO / organic",
  gbp: "Profil Firmy Google",
  direct: "Bezpośrednie",
  referral: "Polecenia",
  email: "E-mail",
  phone: "Telefon",
  unknown: "Bez źródła",
};
const ALIASES: [RegExp, string][] = [
  [/^(google[\s_-]*ads|adwords|gads|ppc|sem|cpc)$/, "google_ads"],
  [/^(microsoft[\s_-]*ads|bing([\s_-]*ads)?)$/, "microsoft_ads"],
  [/^(meta([\s_-]*ads)?|facebook([\s_-]*ads)?|fb|instagram|ig)$/, "meta_ads"],
  [/^(organic|seo|google|wyszukiwarka|organiczne)$/, "organic"],
  [
    /^(gbp|google[\s_-]*maps|maps|mapy|profil[\s_-]*firmy([\s_-]*google)?)$/,
    "gbp",
  ],
  [/^(direct|bezpośrednie|bezposrednie|strona|www)$/, "direct"],
  [/^(referral|polecenie|polecenia|rekomendacja)$/, "referral"],
  [/^(e-?mail|newsletter|mailing)$/, "email"],
  [/^(telefon|phone|call)$/, "phone"],
];
export function channel(source?: string) {
  const s = (source ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  return ALIASES.find(([re]) => re.test(s))?.[1] ?? s.slice(0, 40);
}
export const channelLabel = (key: string) => CHANNEL_LABELS[key] ?? key;

export type ChannelRow = {
  channel: string;
  spend: number;
  leads: number;
  customers: number;
  revenue: number;
  pipeline: number;
  cac: number | null;
  roas: number | null;
  cpl: number | null;
};

export function channelReturns(
  rows: CampaignDay[],
  deals: Deal[],
  range: { from: string; to: string },
  adsDaily: { date: string; cost: number }[] = [],
) {
  const map = new Map<string, Omit<ChannelRow, "cac" | "roas" | "cpl">>();
  const get = (key: string) => {
    if (!map.has(key))
      map.set(key, {
        channel: key,
        spend: 0,
        leads: 0,
        customers: 0,
        revenue: 0,
        pipeline: 0,
      });
    return map.get(key)!;
  };
  const inRange = (d: string) => d >= range.from && d <= range.to;
  const csvAdsDays = new Set(
    rows.filter((r) => r.source === "google_ads").map((r) => r.date),
  );
  for (const r of rows)
    if (inRange(r.date)) {
      const c = get(channel(r.source));
      c.spend += r.spend;
      c.leads += r.leads;
    }
  for (const d of adsDaily)
    if (inRange(d.date) && !csvAdsDays.has(d.date))
      get("google_ads").spend += Number(d.cost) || 0;
  for (const d of deals) {
    const won = d.service
      ? d.service.status === "completed" &&
        inRange(d.service.start.slice(0, 10))
      : d.stage === "Wygrana" && inRange(d.closeDate);
    const open = d.service
      ? ["booked", "in_progress"].includes(d.service.status)
      : !["Wygrana", "Przegrana"].includes(d.stage);
    if (won) {
      const c = get(channel(d.source));
      c.customers += 1;
      c.revenue += d.value;
    } else if (open) get(channel(d.source)).pipeline += d.value;
  }
  const finish = (r: Omit<ChannelRow, "cac" | "roas" | "cpl">): ChannelRow => ({
    ...r,
    cac: r.spend && r.customers ? r.spend / r.customers : null,
    roas: r.spend ? r.revenue / r.spend : null,
    cpl: r.spend && r.leads ? r.spend / r.leads : null,
  });
  const channels = [...map.values()]
    .map(finish)
    .sort(
      (a, b) =>
        b.revenue - a.revenue || b.spend - a.spend || b.pipeline - a.pipeline,
    );
  const total = finish(
    channels.reduce(
      (s, r) => ({
        channel: "total",
        spend: s.spend + r.spend,
        leads: s.leads + r.leads,
        customers: s.customers + r.customers,
        revenue: s.revenue + r.revenue,
        pipeline: s.pipeline + r.pipeline,
      }),
      {
        channel: "total",
        spend: 0,
        leads: 0,
        customers: 0,
        revenue: 0,
        pipeline: 0,
      },
    ),
  );
  const unattributed =
    channels.find((c) => c.channel === "unknown")?.revenue ?? 0;
  return { channels, total, unattributed };
}
