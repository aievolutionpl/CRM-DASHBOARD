const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-ts.cjs");
const attribution = load("lib/crm/attribution.ts");

const day = (date, source, spend, leads) => ({
  date,
  source,
  campaign: "K",
  spend,
  impressions: 0,
  clicks: 0,
  leads,
  qualified: 0,
  revenue: 0,
});
const deal = (stage, value, closeDate, source) => ({
  id: `${stage}${value}${source}`,
  companyId: "f",
  name: "x",
  stage,
  value,
  probability: 50,
  closeDate,
  source,
});

test("kanały: normalizacja źródeł", () => {
  assert.equal(attribution.channel("Google Ads"), "google_ads");
  assert.equal(attribution.channel("facebook"), "meta_ads");
  assert.equal(attribution.channel("Polecenie"), "referral");
  assert.equal(attribution.channel(""), "unknown");
  assert.equal(attribution.channel("Targi Budma"), "targi budma");
  assert.equal(attribution.channelLabel("gbp"), "Profil Firmy Google");
});

test("CAC, ROAS i koszt leada z wydatków i wygranych szans", () => {
  const range = { from: "2026-10-01", to: "2026-10-31" };
  const rows = [
    day("2026-10-02", "google_ads", 1000, 10),
    day("2026-10-03", "organic", 0, 4),
    day("2026-09-30", "google_ads", 5000, 50),
  ];
  const deals = [
    deal("Wygrana", 6000, "2026-10-10", "google_ads"),
    deal("Wygrana", 2000, "2026-10-11", "Google Ads"),
    deal("Wygrana", 3000, "2026-10-12", ""),
    deal("Oferta", 9000, "2026-11-20", "polecenie"),
    deal("Wygrana", 9999, "2026-09-01", "google_ads"),
  ];
  const ads = [
    { date: "2026-10-02", cost: 999 },
    { date: "2026-10-05", cost: 500 },
  ];
  const r = attribution.channelReturns(rows, deals, range, ads);
  const g = r.channels.find((c) => c.channel === "google_ads");
  assert.equal(g.spend, 1500);
  assert.equal(g.leads, 10);
  assert.equal(g.customers, 2);
  assert.equal(g.revenue, 8000);
  assert.equal(g.cac, 750);
  assert.equal(g.cpl, 150);
  assert.ok(Math.abs(g.roas - 5.3333) < 0.001);
  assert.equal(r.channels.find((c) => c.channel === "organic").roas, null);
  assert.equal(r.channels.find((c) => c.channel === "referral").pipeline, 9000);
  assert.equal(r.unattributed, 3000);
  assert.equal(r.total.spend, 1500);
  assert.equal(r.total.customers, 3);
  assert.equal(r.total.revenue, 11000);
  assert.equal(r.total.cac, 500);
  assert.equal(r.channels[0].channel, "google_ads");
});

test("zlecenia usługowe liczą się według daty rozpoczęcia i statusu", () => {
  const service = (status, start) => ({
    ...deal("Nowa", 700, "2026-10-01", "gbp"),
    id: status,
    service: {
      status,
      start,
      end: start,
      resource: "",
      location: "",
      notes: "",
      history: [],
    },
  });
  const r = attribution.channelReturns(
    [],
    [
      service("completed", "2026-10-03T10:00"),
      service("booked", "2026-11-03T10:00"),
      service("cancelled", "2026-10-03T10:00"),
    ],
    { from: "2026-10-01", to: "2026-10-31" },
  );
  const gbp = r.channels.find((c) => c.channel === "gbp");
  assert.equal(gbp.customers, 1);
  assert.equal(gbp.revenue, 700);
  assert.equal(gbp.pipeline, 700);
  assert.equal(gbp.cac, null);
});
