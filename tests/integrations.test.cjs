const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { load } = require("./helpers/load-ts.cjs");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { generateKeyPairSync, verify } = require("node:crypto");
const model = load("lib/integrations/model.ts");
function env(values) {
  const before = {};
  for (const [k, v] of Object.entries(values)) {
    before[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}
const oauth = {
  GOOGLE_SERVICE_ACCOUNT_FILE: undefined,
  GOOGLE_OAUTH_CLIENT_ID: "client-demo",
  GOOGLE_OAUTH_CLIENT_SECRET: "secret-demo",
  GOOGLE_OAUTH_REFRESH_TOKEN: "refresh-demo",
};
function day(offset) {
  const d = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" }) +
      "T12:00:00Z",
  );
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
const metrics = [
  "sessions",
  "totalUsers",
  "screenPageViews",
  "keyEvents",
  "totalRevenue",
];
function report(dimensions, values) {
  return {
    metricHeaders: metrics.map((name) => ({ name })),
    dimensionHeaders: dimensions.map((name) => ({ name })),
    metadata: { currencyCode: "EUR" },
    rows: values.map(([dims, nums]) => ({
      dimensionValues: dims.map((value) => ({ value })),
      metricValues: nums.map((value) => ({ value: String(value) })),
    })),
  };
}
test("Google: walidacja właściwej usługi, scope i bezpiecznej konfiguracji", () => {
  assert.equal(
    model.validateResource("ga4", { propertyId: "12345" }).propertyId,
    "12345",
  );
  for (const value of ["G-ABCD", "../123", "0", "123?key=x"])
    assert.throws(() => model.validateResource("ga4", { propertyId: value }));
  for (const siteUrl of [
    "sc-domain:example.pl",
    "https://example.pl/podfolder/",
  ])
    assert.equal(
      model.validateResource("search_console", { siteUrl }).siteUrl,
      siteUrl,
    );
  for (const siteUrl of [
    "sc-domain:x/abc",
    "https://user:pass@example.pl/",
    "http://example.pl/",
    "https://example.pl/?token=secret",
  ])
    assert.throws(() => model.validateResource("search_console", { siteUrl }));
  const reset = env({
    GOOGLE_SERVICE_ACCOUNT_FILE: undefined,
    GOOGLE_OAUTH_CLIENT_ID: undefined,
    GOOGLE_OAUTH_CLIENT_SECRET: undefined,
    GOOGLE_OAUTH_REFRESH_TOKEN: undefined,
    GOOGLE_APPLICATION_CREDENTIALS: "/unrelated/platform-identity.json",
  });
  try {
    assert.equal(
      load("lib/integrations/google-auth.ts").googleAuthConfigured(),
      false,
    );
  } finally {
    reset();
  }
});
test("Google OAuth + GA4: prawdziwy kontrakt REST, raporty dzienne i niezsumowani użytkownicy", async () => {
  const reset = env(oauth),
    before = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/token"))
      return Response.json({ access_token: "access-demo" });
    return Response.json({
      reports: [
        report(
          ["date"],
          [
            [[day(-2).replaceAll("-", "")], [12, 8, 20, 2, 30]],
            [[day(-1).replaceAll("-", "")], [7, 8, 10, 1, 20]],
          ],
        ),
        report(
          ["sessionDefaultChannelGroup"],
          [[["Organic Search"], [19, 9, 30, 3, 50]]],
        ),
        report([], [[[], [19, 9, 30, 3, 50]]]),
      ],
    });
  };
  try {
    const result = await load("lib/integrations/google.ts").readGoogle("ga4", {
      propertyId: "12345",
    });
    assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
    assert.equal(calls[0].init.body.get("refresh_token"), "refresh-demo");
    assert.equal(
      calls[1].url,
      "https://analyticsdata.googleapis.com/v1beta/properties/12345:batchRunReports",
    );
    assert.equal(calls[1].init.headers.Authorization, "Bearer access-demo");
    assert.equal(JSON.parse(calls[1].init.body).requests.length, 3);
    assert.equal(result.report.totals.totalUsers, 9);
    assert.equal(result.report.currency, "EUR");
    assert.equal(result.report.daily.length, 2);
    assert.equal(result.report.totals.sessions, 19);
    assert.equal(result.report.breakdown[0].label, "Organic Search");
    assert.equal(JSON.stringify(result).includes("access-demo"), false);
  } finally {
    globalThis.fetch = before;
    reset();
  }
});
test("Search Console: zakodowana witryna, opóźnienie, totals i osobne zapytania", async () => {
  const reset = env(oauth),
    before = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/token"))
      return Response.json({ access_token: "access-demo" });
    const req = JSON.parse(init.body);
    return Response.json({
      rows: [
        {
          ...(req.dimensions
            ? {
                keys: [
                  req.dimensions[0] === "date" ? day(-3) : "usługi Warszawa",
                ],
              }
            : {}),
          clicks: req.dimensions ? 5 : 20,
          impressions: 100,
          ctr: req.dimensions ? 0.05 : 0.2,
          position: 3.25,
        },
      ],
    });
  };
  try {
    const result = await load("lib/integrations/google.ts").readGoogle(
      "search_console",
      { siteUrl: "https://example.pl/" },
    );
    assert.equal(result.report.totals.clicks, 20);
    assert.equal(result.report.breakdown[0].values.clicks, 5);
    assert.equal(result.report.to, day(-3));
    assert.equal(result.report.daily[0].date, day(-3));
    for (const c of calls.slice(1)) {
      assert.match(
        c.url,
        /sites\/https%3A%2F%2Fexample.pl%2F\/searchAnalytics\/query/,
      );
      const b = JSON.parse(c.init.body);
      assert.equal(b.dataState, "final");
      assert.equal(b.type, "web");
      assert.equal(c.init.method, "POST");
    }
  } finally {
    globalThis.fetch = before;
    reset();
  }
});
test("Konto usługi Google: podpis JWT, minimalne scope i serwerowy token", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "google-auth-")),
    file = path.join(dir, "service.json");
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  fs.writeFileSync(
    file,
    JSON.stringify({
      type: "service_account",
      client_email: "readonly@example.iam.gserviceaccount.com",
      private_key: keys.privateKey.export({ format: "pem", type: "pkcs8" }),
    }),
  );
  const reset = env({ GOOGLE_SERVICE_ACCOUNT_FILE: file }),
    before = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://oauth2.googleapis.com/token");
    const parts = init.body.get("assertion").split(".");
    const claims = JSON.parse(Buffer.from(parts[1], "base64url"));
    assert.equal(
      verify(
        "RSA-SHA256",
        Buffer.from(parts.slice(0, 2).join(".")),
        keys.publicKey,
        Buffer.from(parts[2], "base64url"),
      ),
      true,
    );
    assert.match(claims.scope, /analytics\.readonly/);
    assert.match(claims.scope, /webmasters\.readonly/);
    assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
    assert.equal(claims.exp - claims.iat, 3600);
    return Response.json({ access_token: "access-demo" });
  };
  try {
    assert.equal(
      await load("lib/integrations/google-auth.ts").googleToken(),
      "access-demo",
    );
  } finally {
    globalThis.fetch = before;
    reset();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("API: błędy uprawnień bez sekretów, retry 429, błędny JSON i timeout", async () => {
  const before = globalThis.fetch;
  try {
    const http = {
      apiJson: (...args) => load("lib/integrations/http.ts").apiJson(...args),
    };
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? Response.json({}, { status: 429 })
        : Response.json({ ok: true });
    };
    assert.equal((await http.apiJson("https://example.com")).ok, true);
    assert.equal(calls, 2);
    globalThis.fetch = async () =>
      Response.json({ error: { message: "secret-demo" } }, { status: 403 });
    await assert.rejects(
      http.apiJson("https://example.com", {}, true),
      (e) =>
        e.message.includes("HTTP 403") && !e.message.includes("secret-demo"),
    );
    globalThis.fetch = async () => new Response("invalid");
    await assert.rejects(http.apiJson("https://example.com"), /JSON/);
    globalThis.fetch = async () => {
      throw new Error("timeout-with-secret");
    };
    await assert.rejects(
      http.apiJson("https://example.com"),
      (e) =>
        e.message.includes("sieć") &&
        !e.message.includes("timeout-with-secret"),
    );
  } finally {
    globalThis.fetch = before;
  }
});
test("Integracje SQLite: zasób per workspace, check/sync, błędy, wyłączenie i zmiana usługi", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-db-")),
    reset = env({ ...oauth, CRM_DATABASE_PATH: path.join(dir, "db.sqlite") });
  const db = load("lib/local/database.ts"),
    repo = load("lib/integrations/repository.ts", { "../local/database": db });
  let fail = false;
  let amount = 10;
  const providers = {
    providerConfig: (_p, r) => ({
      configured: Boolean(r.propertyId || r.siteUrl),
    }),
    adapter: () => ({
      read: async () => {
        if (fail) throw new Error("secret-demo");
        return {
          summary: "Raport testowy",
          report: {
            provider: "ga4",
            resource: "properties/123",
            totals: { sessions: amount },
          },
        };
      },
    }),
  };
  const service = load("lib/integrations/service.ts", {
    "../local/database": db,
    "./repository": repo,
    "./providers": providers,
    "../knowledge/repository": { listDocuments: () => [] },
  });
  try {
    const a = db.createWorkspace("A"),
      b = db.createWorkspace("B");
    await service.integrationAction(a, {
      provider: "ga4",
      action: "configure",
      resource: { propertyId: "123" },
    });
    assert.equal(repo.integrationSettings(b, "ga4").propertyId, undefined);
    await service.integrationAction(a, { provider: "ga4", action: "check" });
    assert.equal(service.integrations(a).snapshots.length, 0);
    await service.integrationAction(a, { provider: "ga4", action: "sync" });
    assert.equal(
      service.integrations(a).snapshots[0].payload.report.totals.sessions,
      10,
    );
    const last = repo.connectionRows(a)[0].last_sync;
    fail = true;
    await assert.rejects(
      service.integrationAction(a, { provider: "ga4", action: "sync" }),
      (e) => !e.message.includes("secret-demo"),
    );
    assert.equal(repo.connectionRows(a)[0].last_sync, last);
    assert.equal(repo.connectionRows(a)[0].status, "error");
    assert.equal(
      service.integrations(a).snapshots[0].payload.report.totals.sessions,
      10,
    );
    await service.integrationAction(a, {
      provider: "ga4",
      action: "disconnect",
    });
    await assert.rejects(
      service.integrationAction(a, { provider: "ga4", action: "sync" }),
      /ponownie/,
    );
    fail = false;
    amount = 22;
    await service.integrationAction(a, { provider: "ga4", action: "check" });
    await service.integrationAction(a, { provider: "ga4", action: "sync" });
    assert.equal(
      service.integrations(a).snapshots[0].payload.report.totals.sessions,
      22,
    );
    await service.integrationAction(a, {
      provider: "ga4",
      action: "configure",
      resource: { propertyId: "456" },
    });
    assert.equal(service.integrations(a).snapshots.length, 0);
    assert.equal(repo.connectionRows(a)[0].status, "configured");
    assert.equal(service.integrations(b).snapshots.length, 0);
    await assert.rejects(
      service.integrationAction(a, { provider: "unknown", action: "sync" }),
    );
  } finally {
    db.database().close();
    reset();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("GA4: ujemny przychód, próbkowanie i odrzucenie błędnej metryki — mock API", async () => {
  const reset = env(oauth),
    before = globalThis.fetch;
  let malformed = false;
  globalThis.fetch = async (url) =>
    String(url).endsWith("/token")
      ? Response.json({ access_token: "access-demo" })
      : Response.json({
          reports: [
            report(
              ["date"],
              [[[day(-1).replaceAll("-", "")], [1, 1, 2, 0, -5]]],
            ),
            report(["sessionDefaultChannelGroup"], []),
            {
              ...report([], [[[], [malformed ? "NaN" : 1, 1, 2, 0, -5]]]),
              metadata: { currencyCode: "EUR", subjectToThresholding: true },
            },
          ],
        });
  try {
    const good = await load("lib/integrations/google.ts").readGoogle("ga4", {
      propertyId: "123",
    });
    assert.equal(good.report.totals.totalRevenue, -5);
    assert.ok(good.report.warnings.some((x) => x.includes("progowanie")));
    malformed = true;
    await assert.rejects(
      load("lib/integrations/google.ts").readGoogle("ga4", {
        propertyId: "123",
      }),
      /metryki/,
    );
  } finally {
    globalThis.fetch = before;
    reset();
  }
});
test("Meta Ads: zmiana konta usuwa jego kampanie, a synchronizacja zastępuje okno dat", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meta-db-")),
    reset = env({ CRM_DATABASE_PATH: path.join(dir, "db.sqlite") });
  const db = load("lib/local/database.ts"),
    repo = load("lib/integrations/repository.ts", { "../local/database": db });
  try {
    const a = db.createWorkspace("A"),
      b = db.createWorkspace("B");
    const row = (campaign) => ({
      date: "2026-10-01",
      source: "meta_ads",
      campaign,
      spend: 10,
      impressions: 100,
      clicks: 5,
      leads: 1,
      qualified: 0,
      revenue: 0,
    });
    repo.saveMarketingRows(a, [row("Import CSV")]);
    repo.saveMarketingRows(b, [row("Inna przestrzeń")]);
    repo.saveIntegrationSettings(a, "meta_ads", {
      adAccountId: "act_1111111111",
    });
    assert.equal(repo.marketingRows(a).length, 1);
    repo.saveMarketingRows(a, [row("Konto A")]);
    repo.saveIntegrationSettings(a, "meta_ads", {
      adAccountId: "act_1111111111",
    });
    assert.equal(repo.marketingRows(a).length, 2);
    repo.saveIntegrationSettings(a, "meta_ads", {
      adAccountId: "act_2222222222",
    });
    assert.equal(repo.marketingRows(a).length, 0);
    assert.equal(repo.marketingRows(b).length, 1);
    repo.saveMarketingRows(a, [
      { ...row("Stara nazwa"), date: "2026-09-01" },
      { ...row("Stara nazwa"), date: "2026-10-02" },
    ]);
    repo.replaceMarketingWindow(a, "meta_ads", "2026-09-15", [
      { ...row("Nowa nazwa"), date: "2026-10-02" },
    ]);
    assert.deepEqual(
      repo
        .marketingRows(a)
        .map((r) => `${r.date}:${r.campaign}`)
        .sort(),
      ["2026-09-01:Stara nazwa", "2026-10-02:Nowa nazwa"],
    );
    assert.equal(repo.marketingRows(b).length, 1);
  } finally {
    reset();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
