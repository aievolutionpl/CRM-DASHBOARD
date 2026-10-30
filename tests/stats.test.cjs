const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-ts.cjs");
const http = { apiJson: async () => ({}), IntegrationError: Error };
const meta = load("lib/integrations/meta.ts", { "./http": http }),
  plausible = load("lib/integrations/plausible.ts", { "./http": http }),
  model = load("lib/integrations/model.ts"),
  stats = load("lib/ai/stats.ts"),
  builtin = load("lib/ai/builtin.ts"),
  ai = load("lib/ai/model.ts"),
  crm = load("lib/crm/model.ts"),
  backup = load("lib/crm/backup.ts");

test("Meta Ads: insighty kampanii zamieniają się w dni kampanii z leadami i przychodem", () => {
  const rows = meta.metaRows([
    {
      date_start: "2026-10-01",
      campaign_name: "Lead gen",
      spend: "120.50",
      impressions: "5000",
      clicks: "80",
      actions: [
        { action_type: "lead", value: "6" },
        { action_type: "onsite_conversion.lead_grouped", value: "6" },
        { action_type: "link_click", value: "80" },
      ],
      action_values: [{ action_type: "purchase", value: "900" }],
    },
    {
      date_start: "2026-10-02",
      campaign_name: "",
      spend: "10",
      impressions: "1",
      clicks: "0",
    },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    { ...rows[0] },
    {
      date: "2026-10-01",
      source: "meta_ads",
      campaign: "Lead gen",
      spend: 120.5,
      impressions: 5000,
      clicks: 80,
      leads: 6,
      qualified: 0,
      revenue: 900,
    },
  );
  assert.equal(rows[1].campaign, "Kampania bez nazwy");
  assert.throws(() => meta.metaRows([{ date_start: "jutro" }]));
});

test("walidacja zasobów Meta Ads i Plausible", () => {
  assert.equal(
    model.validateResource("meta_ads", { adAccountId: "act_1234567890" })
      .adAccountId,
    "act_1234567890",
  );
  assert.equal(
    model.validateResource("meta_ads", { adAccountId: "1234567890" })
      .adAccountId,
    "act_1234567890",
  );
  assert.throws(() =>
    model.validateResource("meta_ads", { adAccountId: "act_abc" }),
  );
  assert.equal(
    model.validateResource("plausible", { siteId: "https://Firma.PL/" }).siteId,
    "firma.pl",
  );
  assert.throws(() =>
    model.validateResource("plausible", { siteId: "javascript:alert(1)" }),
  );
});

test("Plausible: raport z sumami, dziennym trendem i źródłami", () => {
  const r = plausible.plausibleReport(
    "firma.pl",
    {
      visitors: { value: 120 },
      visits: { value: 150 },
      pageviews: { value: 400 },
      bounce_rate: { value: 41 },
      visit_duration: { value: 95 },
    },
    [
      { date: "2026-10-01", visitors: 10, pageviews: 30 },
      { date: "zła", visitors: 1 },
    ],
    [{ source: "Google", visitors: 70, visits: 80 }, { visitors: 5 }],
    "2026-09-07",
    "2026-10-06",
  );
  assert.equal(r.provider, "plausible");
  assert.equal(r.totals.visitors, 120);
  assert.equal(r.daily.length, 1);
  assert.equal(r.breakdown[1].label, "Direct / None");
});

test("digest statystyk porównuje okresy i pomija wyłączone integracje", () => {
  const row = (date, source, spend, leads, revenue) => ({
    date,
    source,
    campaign: "K",
    spend,
    impressions: 0,
    clicks: 0,
    leads,
    qualified: 0,
    revenue,
  });
  const m = stats.marketingDigest(
    [
      row("2026-10-05", "google_ads", 100, 10, 300),
      row("2026-10-04", "meta_ads", 50, 1, 0),
      row("2026-08-20", "google_ads", 80, 8, 100),
    ],
    "2026-10-06",
  );
  assert.equal(m.bySource[0].source, "google_ads");
  assert.equal(m.bySource[0].cpa, 10);
  assert.equal(m.bySource[1].cpa, 50);
  assert.equal(m.previous.spend, 80);
  const d = stats.integrationDigest(
    [
      {
        provider: "ga4",
        payload: {
          summary: "",
          report: {
            provider: "ga4",
            resource: "p/1",
            from: "a",
            to: "b",
            totals: { sessions: 5 },
            breakdown: [],
            daily: [],
            warnings: [],
          },
        },
      },
      {
        provider: "stripe",
        payload: {
          summary: "",
          payments: {
            currency: "PLN",
            net: 10,
            count: 1,
            refunded: 0,
            available: 5,
          },
        },
      },
      {
        provider: "posthog",
        payload: { summary: "", events: [["$pageview", 9]] },
      },
    ],
    [{ provider: "stripe", status: "disconnected" }],
  );
  assert.equal(d.analytics.length, 1);
  assert.equal(d.payments, null);
  assert.equal(d.productEvents[0].count, 9);
});

test("wbudowany agent: pełna analiza łączy wszystkie źródła i daje priorytety", () => {
  const d = crm.seedData();
  const ctx = {
    date: "2026-10-06",
    companies: d.firms.map((f) => ({ id: f.id, name: f.name })),
    deals: d.deals,
    tasks: [
      { id: "x", companyId: "f1", title: "Stary telefon", date: "2026-09-01" },
    ],
    notes: [],
    crm: {
      pipeline: {
        open: 4,
        openValue: 83000,
        forecast: 40000,
        wonValue: 6500,
        winRate: 100,
      },
      monthly: [
        { key: "2026-09", won: 100, forecast: 0 },
        { key: "2026-10", won: 200, forecast: 50 },
        { key: "2026-11", won: 0, forecast: 10 },
      ],
      insights: [{ title: "1 zaległe zadanie", detail: "x", tone: "red" }],
    },
    stats: {
      marketing: {
        bySource: [
          {
            source: "google_ads",
            spend: 100,
            leads: 10,
            qualified: 4,
            revenue: 300,
            cpa: 10,
            roas: 3,
          },
          {
            source: "meta_ads",
            spend: 100,
            leads: 2,
            qualified: 0,
            revenue: 0,
            cpa: 50,
            roas: 0,
          },
        ],
        topCampaigns: [],
        previous: { spend: 150, leads: 20, revenue: 100 },
      },
      analytics: [
        {
          provider: "plausible",
          resource: "firma.pl",
          from: "a",
          to: "b",
          totals: { visitors: 100 },
          top: [{ label: "Google", values: {} }],
        },
      ],
      payments: {
        currency: "PLN",
        net: 1000,
        count: 3,
        refunded: 0,
        available: 500,
      },
      productEvents: [{ event: "signup", count: 4 }],
      leads: {
        total: 3,
        byStatus: { new: 2, won: 1 },
        bySource: [{ source: "google", count: 2, revenue: 0 }],
        pipelineValue: 5000,
        revenue: 1000,
      },
      sources: ["CRM", "Plausible", "Stripe"],
    },
  };
  const r = ai.parseAnswer(
    builtin.builtinAnswer(
      "Przeanalizuj wszystkie statystyki firmy",
      JSON.stringify(ctx),
    ),
  );
  for (const part of [
    "Sprzedaż (CRM)",
    "Leady (Lead Hub)",
    "Kampanie",
    "Plausible",
    "Stripe",
    "PostHog",
    "Priorytety",
  ])
    assert.match(r.answer, new RegExp(part.replace(/[()]/g, "\\$&")));
  assert.match(r.answer, /Przesuń część budżetu z meta_ads/);
  assert.match(r.answer, /Leady spadły o 40%/);
});

test("firma: status, opiekun i tagi przechodzą walidację; błędne wartości są odrzucane", () => {
  const archive = (change) => {
    const data = crm.seedData();
    change(data);
    return JSON.stringify({ version: 1, data });
  };
  const ok = backup.parseBackup(
    archive((d) =>
      Object.assign(d.firms[0], {
        status: "vip",
        owner: "Anna",
        source: "Polecenie",
        tags: ["B2B", "AI"],
      }),
    ),
  );
  assert.equal(ok.firms[0].status, "vip");
  assert.throws(() =>
    backup.parseBackup(archive((d) => (d.firms[0].status = "boss"))),
  );
  assert.throws(() =>
    backup.parseBackup(archive((d) => (d.firms[0].tags = ["ok", ""]))),
  );
  assert.throws(() =>
    backup.parseBackup(archive((d) => (d.firms[0].tags = Array(13).fill("x")))),
  );
});
