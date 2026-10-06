import type { IntegrationResult } from "../integrations/model";
import type { CampaignDay } from "../integrations/marketing";

export type StatsDigest = {
  sources: { id: string; label: string; available: boolean; detail: string }[];
  marketing: {
    bySource: {
      source: string;
      spend: number;
      leads: number;
      qualified: number;
      revenue: number;
      cpa: number | null;
      roas: number | null;
    }[];
    topCampaigns: {
      campaign: string;
      source: string;
      spend: number;
      leads: number;
      revenue: number;
    }[];
    previous: { spend: number; leads: number; revenue: number };
  };
  analytics: {
    provider: string;
    resource: string;
    from: string;
    to: string;
    totals: Record<string, number>;
    top: { label: string; values: Record<string, number> }[];
  }[];
  payments: {
    currency: string;
    net: number;
    count: number;
    refunded: number;
    available: number;
  } | null;
  productEvents: { event: string; count: number }[];
  leads: {
    total: number;
    byStatus: Record<string, number>;
    bySource: { source: string; count: number; revenue: number }[];
    pipelineValue: number;
    revenue: number;
  } | null;
};

const round = (v: number) => Math.round(v * 100) / 100;

export function marketingDigest(rows: CampaignDay[], today: string) {
  const day = (offset: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const current = rows.filter((r) => r.date > day(30) && r.date <= today);
  const previous = rows.filter((r) => r.date > day(60) && r.date <= day(30));
  const group = new Map<string, StatsDigest["marketing"]["bySource"][number]>();
  for (const r of current) {
    const g = group.get(r.source) ?? {
      source: r.source,
      spend: 0,
      leads: 0,
      qualified: 0,
      revenue: 0,
      cpa: null,
      roas: null,
    };
    g.spend += r.spend;
    g.leads += r.leads;
    g.qualified += r.qualified;
    g.revenue += r.revenue;
    group.set(r.source, g);
  }
  const campaigns = new Map<
    string,
    StatsDigest["marketing"]["topCampaigns"][number]
  >();
  for (const r of current) {
    const key = `${r.source}:${r.campaign}`;
    const c = campaigns.get(key) ?? {
      campaign: r.campaign,
      source: r.source,
      spend: 0,
      leads: 0,
      revenue: 0,
    };
    c.spend += r.spend;
    c.leads += r.leads;
    c.revenue += r.revenue;
    campaigns.set(key, c);
  }
  return {
    bySource: [...group.values()]
      .map((g) => ({
        ...g,
        spend: round(g.spend),
        revenue: round(g.revenue),
        cpa: g.leads ? round(g.spend / g.leads) : null,
        roas: g.spend ? round(g.revenue / g.spend) : null,
      }))
      .sort((a, b) => b.spend - a.spend),
    topCampaigns: [...campaigns.values()]
      .map((c) => ({ ...c, spend: round(c.spend), revenue: round(c.revenue) }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8),
    previous: {
      spend: round(previous.reduce((s, r) => s + r.spend, 0)),
      leads: previous.reduce((s, r) => s + r.leads, 0),
      revenue: round(previous.reduce((s, r) => s + r.revenue, 0)),
    },
  };
}

export function integrationDigest(
  snapshots: { provider: string; payload: IntegrationResult }[],
  states: { provider: string; status: string }[],
) {
  const active = snapshots.filter(
    (s) =>
      !states.some(
        (x) => x.provider === s.provider && x.status === "disconnected",
      ),
  );
  const analytics: StatsDigest["analytics"] = active
    .filter((s) => s.payload.report)
    .map((s) => {
      const r = s.payload.report!;
      return {
        provider: r.provider,
        resource: r.resource,
        from: r.from,
        to: r.to,
        totals: Object.fromEntries(
          Object.entries(r.totals).map(([k, v]) => [k, round(v)]),
        ),
        top: r.breakdown.slice(0, 5),
      };
    });
  const stripe = active.find((s) => s.payload.payments)?.payload.payments;
  const posthog = active.find((s) => s.provider === "posthog")?.payload.events;
  return {
    analytics,
    payments: stripe
      ? {
          currency: stripe.currency,
          net: round(stripe.net),
          count: stripe.count,
          refunded: round(stripe.refunded),
          available: round(stripe.available),
        }
      : null,
    productEvents: (posthog || [])
      .slice(0, 10)
      .map((e) => ({ event: String(e[0]), count: Number(e[1]) || 0 })),
  };
}
