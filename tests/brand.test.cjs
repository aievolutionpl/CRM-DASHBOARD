const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-ts.cjs");
const plain = (v) => JSON.parse(JSON.stringify(v));
const brand = load("lib/brand/model.ts"),
  extract = load("lib/brand/extract.ts"),
  github = load("lib/brand/github.ts"),
  markdown = load("lib/brand/markdown.ts"),
  growth = load("lib/growth/model.ts"),
  insights = load("lib/crm/insights.ts"),
  agent = load("lib/ai/agent.ts");

const HTML = `<!doctype html><html lang="pl"><head>
<title>Kwiaciarnia Róża | Kwiaty z dostawą w Krakowie</title>
<meta name="description" content="Świeże bukiety, kwiaty na wesela i dostawa tego samego dnia w całym Krakowie. Zamów online lub zadzwoń.">
<meta name="viewport" content="width=device-width">
<meta name="theme-color" content="#e11d48">
<meta property="og:title" content="Kwiaciarnia Róża"><meta property="og:image" content="/og.jpg">
<link rel="canonical" href="https://roza.pl/">
<link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
<link rel="icon" href="/favicon.png">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato&display=swap">
<style>:root{--brand-primary:#e11d48;--accent-color:#16a34a}body{color:#333;background:#fff}.cta{background:#e11d48}</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC1234567"></script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Florist","name":"Kwiaciarnia Róża","logo":"https://roza.pl/logo.svg","telephone":"+48 600 100 200","email":"kontakt@roza.pl","sameAs":["https://www.facebook.com/roza.krakow","https://www.instagram.com/roza.krakow/"],"address":{"@type":"PostalAddress","streetAddress":"ul. Floriańska 1","postalCode":"31-019","addressLocality":"Kraków"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"127"},"review":[{"@type":"Review","author":{"@type":"Person","name":"Anna"},"reviewRating":{"ratingValue":"5"},"reviewBody":"Piękny bukiet i szybka dostawa!","datePublished":"2026-09-01"}]}</script>
</head><body class="wp-content">
<nav><a href="/oferta">Oferta</a><a href="/wesela">Kwiaty na wesela</a><a href="/kontakt">Kontakt</a></nav>
<img class="site-logo" src="/logo.png" alt="Róża">
<h1>Kwiaty, które mówią za Ciebie</h1>
<h2>Bukiety okolicznościowe</h2><h2>Dekoracje ślubne</h2>
<p>NIP: 676-123-45-67 · <a href="mailto:biuro@roza.pl">biuro@roza.pl</a> · <a href="tel:+48600100200">600 100 200</a></p>
<a href="https://www.linkedin.com/company/roza/">LinkedIn</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">Udostępnij</a>
</body></html>`;

test("parser strony wyciąga markę, kontakt, kolory, opinie i audyt", () => {
  const f = extract.extractSite(
    HTML,
    "https://roza.pl/",
    ".btn{color:#e11d48}h1{font-family:'Playfair Display',serif}",
  );
  assert.equal(f.name, "Kwiaciarnia Róża");
  assert.equal(f.tagline, "Kwiaty, które mówią za Ciebie");
  assert.equal(f.logo, "https://roza.pl/logo.svg");
  assert.equal(f.icon, "https://roza.pl/apple.png");
  assert.equal(f.image, "https://roza.pl/og.jpg");
  assert.equal(f.colors[0], "#e11d48");
  assert.ok(f.colors.includes("#16a34a"));
  assert.ok(!f.colors.includes("#333333") && !f.colors.includes("#ffffff"));
  assert.ok(f.fonts.includes("Playfair Display"));
  assert.equal(f.language, "pl");
  assert.deepEqual(plain(f.emails).sort(), [
    "biuro@roza.pl",
    "kontakt@roza.pl",
  ]);
  assert.ok(f.phones.some((p) => p.includes("600")));
  assert.equal(f.address, "ul. Floriańska 1, 31-019, Kraków");
  assert.equal(f.city, "Kraków");
  assert.equal(f.nip, "6761234567");
  assert.deepEqual(plain(f.socials.map((s) => s.network)), [
    "Facebook",
    "Instagram",
    "LinkedIn",
  ]);
  assert.ok(!f.socials.some((s) => s.url.includes("sharer")));
  assert.deepEqual(plain(f.rating), { value: 4.8, count: 127 });
  assert.equal(f.reviews[0].author, "Anna");
  assert.equal(f.reviews[0].rating, 5);
  assert.ok(f.technologies.includes("WordPress"));
  assert.ok(f.trackers.includes("Google Analytics 4"));
  assert.deepEqual(plain(f.stylesheets), ["https://roza.pl/assets/site.css"]);
  assert.ok(f.services.includes("Dekoracje ślubne"));
  assert.ok(f.keywords.includes("Kwiaty na wesela"));
  const ids = Object.fromEntries(f.checks.map((c) => [c.id, c.ok]));
  assert.equal(ids.title, true);
  assert.equal(ids.description, true);
  assert.equal(ids.h1, true);
  assert.equal(ids.schema, true);
  assert.equal(ids.analytics, true);
  assert.equal(extract.auditScore(f.checks), 100);
});

test("parser obsługuje stronę bez danych strukturalnych i błędny JSON-LD", () => {
  const f = extract.extractSite(
    `<html><head><title>Start</title><script type="application/ld+json">{bad</script><meta name="robots" content="noindex"></head><body><h1>A</h1><h1>B</h1><img src="a.png"></body></html>`,
    "https://przyklad.pl/o-nas",
  );
  assert.equal(f.name, "Start");
  assert.equal(f.rating, null);
  assert.deepEqual(plain(f.colors), []);
  const failed = f.checks.filter((c) => !c.ok).map((c) => c.id);
  for (const id of [
    "description",
    "h1",
    "lang",
    "viewport",
    "schema",
    "indexable",
    "contact",
    "analytics",
    "alt",
  ])
    assert.ok(failed.includes(id), id);
  assert.ok(extract.auditScore(f.checks) < 40);
  assert.equal(extract.normalizeColor("#ABC"), "#aabbcc");
  assert.equal(extract.normalizeColor("rgb(225, 29, 72)"), "#e11d48");
  assert.equal(extract.normalizeColor("red"), null);
  assert.equal(
    extract.decode("Caf&eacute; &amp; &#x41;&#66;"),
    "Caf&eacute; & AB",
  );
});

test("GitHub: rozpoznanie linku i podsumowanie repozytoriów", () => {
  assert.deepEqual(
    plain(github.githubTarget("https://github.com/vercel/next.js")),
    {
      owner: "vercel",
      repo: "next.js",
      url: "https://github.com/vercel/next.js",
    },
  );
  assert.equal(
    github.githubTarget("aievolutionpl").url,
    "https://github.com/aievolutionpl",
  );
  assert.equal(github.githubTarget("   "), null);
  assert.throws(
    () => github.githubTarget("https://gitlab.com/x"),
    /github\.com/,
  );
  assert.throws(
    () => github.githubTarget("http://github.com/x"),
    /github\.com/,
  );
  const repos = [
    {
      full_name: "a/one",
      name: "one",
      stargazers_count: 5,
      forks_count: 1,
      language: "TypeScript",
      html_url: "https://github.com/a/one",
      pushed_at: "2026-10-01T00:00:00Z",
      topics: ["crm"],
    },
    {
      full_name: "a/two",
      name: "two",
      stargazers_count: 50,
      forks_count: 4,
      language: "Python",
      html_url: "https://github.com/a/two",
      pushed_at: "2026-10-20T00:00:00Z",
      topics: ["ai"],
    },
    {
      full_name: "a/fork",
      name: "fork",
      fork: true,
      stargazers_count: 900,
      language: "Go",
    },
  ];
  repos.push({
    full_name: "a/secret",
    name: "secret",
    private: true,
    visibility: "private",
    stargazers_count: 1000,
    language: "Rust",
  });
  assert.equal(github.publicRepo(repos[3]), false);
  assert.equal(github.publicRepo(repos[0]), true);
  const g = github.summarizeGithub(
    {
      login: "a",
      name: "Firma A",
      html_url: "https://github.com/a",
      avatar_url: "https://avatars/a",
      followers: 7,
      public_repos: 3,
      blog: "https://a.pl",
    },
    repos,
  );
  assert.equal(g.stars, 55);
  assert.equal(g.forks, 5);
  assert.equal(g.repos[0].name, "two");
  assert.equal(g.lastPush, "2026-10-20");
  assert.ok(!g.languages.some((l) => l.name === "Go"));
  assert.deepEqual(plain(g.topics).sort(), ["ai", "crm"]);
  assert.equal(github.githubWebsite({ blog: "https://a.pl" }), "https://a.pl");
  const r = github.summarizeGithub({ login: "a" }, repos, repos[0], {
    TypeScript: 300,
    CSS: 100,
  });
  assert.equal(r.repos[0].name, "one");
  assert.equal(r.stars, 5);
  assert.deepEqual(plain(r.languages), [
    { name: "TypeScript", share: 75 },
    { name: "CSS", share: 25 },
  ]);
});

test("paleta marki: skala, czytelny kolor główny i zmienne motywu", () => {
  const s = brand.scale("#e11d48");
  assert.equal(Object.keys(s).length, 11);
  assert.ok(brand.luminance(s[50]) > brand.luminance(s[500]));
  assert.ok(brand.luminance(s[500]) > brand.luminance(s[900]));
  const light = brand.readablePrimary("#fde047");
  assert.ok(brand.contrast(light, "#ffffff") >= 4.5);
  assert.equal(brand.readablePrimary("#1d4ed8"), "#1d4ed8");
  const vars = brand.brandTheme({
    colors: { primary: "#16a34a", accent: "#f59e0b", palette: [] },
  });
  assert.ok(brand.contrast(vars["--primary"], "#ffffff") >= 4.5);
  assert.equal(vars["--color-violet-600"], vars["--brand-600"]);
  assert.equal(vars["--brand-accent"], "#f59e0b");
  assert.match(vars["--brand-hero-a"], /^#[0-9a-f]{6}$/);
  assert.equal(brand.initials("Kwiaciarnia Róża"), "KR");
  assert.equal(brand.initials(""), "AE");
});

test("walidacja profilu marki i zapis w ustawieniach przestrzeni", () => {
  const v = brand.validateBrand({
    name: "X".repeat(300),
    website: "javascript:alert(1)",
    logo: "https://x.pl/logo.png",
    colors: { primary: "red", accent: "#00FF00", palette: ["#123456", "zly"] },
    rating: { value: 9, count: -2, source: "Google" },
    reviews: [{ author: "A", rating: "5", text: "ok" }],
    socials: [{ network: "Facebook", url: "ftp://x" }],
  });
  assert.equal(v.name.length, 120);
  assert.equal(v.website, "");
  assert.equal(v.logo, "https://x.pl/logo.png");
  assert.equal(v.colors.primary, "#6842ff");
  assert.equal(v.colors.accent, "#00ff00");
  assert.deepEqual(plain(v.colors.palette), ["#123456"]);
  assert.deepEqual(plain(v.rating), {
    value: 5,
    count: 0,
    source: "Google",
    url: "",
  });
  assert.equal(v.reviews[0].rating, null);
  assert.deepEqual(plain(v.socials), []);
  assert.equal(brand.validateBrand(undefined), undefined);
  assert.throws(() => brand.validateBrand("x"), /profil/i);
  assert.throws(
    () => brand.validateBrand({ description: "a".repeat(130000) }),
    /rozmiar/,
  );
  const snap = growth.validateSnapshot({
    revision: 1,
    data: { firms: [], contacts: [], deals: [], tasks: [], mails: [] },
    settings: {
      onboarded: true,
      sender: "A",
      agentEnabled: false,
      brand: { name: "Róża", applied: true },
    },
  });
  assert.equal(snap.settings.brand.name, "Róża");
  assert.equal(snap.settings.brand.applied, true);
  const out = growth.snapshot(
    {
      firms: [],
      contacts: [],
      deals: [],
      tasks: [],
      mails: [],
      onboarded: true,
      sender: "A",
      agentEnabled: false,
      brand: snap.settings.brand,
    },
    2,
  );
  assert.equal(out.settings.brand.name, "Róża");
});

test("notatka Company Brain i kontekst agenta zawierają profil marki", () => {
  const f = extract.extractSite(HTML, "https://roza.pl/");
  const b = brand.validateBrand({
    ...brand.emptyBrand(),
    name: f.name,
    website: f.url,
    services: f.services,
    rating: { ...f.rating, source: "Strona", url: "" },
    reviews: f.reviews,
    audit: {
      score: 82,
      checks: [
        {
          id: "x",
          label: "Opis meta",
          ok: false,
          weight: 1,
          hint: "Dodaj opis.",
        },
      ],
      responseMs: 300,
    },
    githubData: {
      login: "roza",
      name: "Róża",
      url: "https://github.com/roza",
      stars: 3,
      forks: 0,
      publicRepos: 2,
      followers: 1,
      languages: [{ name: "PHP", share: 100 }],
      repos: [],
      topics: [],
    },
  });
  assert.equal(markdown.brandNoteTitle(b), "Profil marki — Kwiaciarnia Róża");
  assert.equal(
    markdown.brandNoteTitle({ name: "A/B: test." }),
    "Profil marki — A B  test",
  );
  const md = markdown.brandMarkdown(b);
  assert.match(md, /# Kwiaciarnia Róża/);
  assert.match(md, /Ocena 4\.8\/5 \(127 opinii/);
  assert.match(md, /- \[ \] Opis meta — Dodaj opis\./);
  assert.match(md, /## GitHub/);
  assert.doesNotMatch(md, /\n\n\n/);
  const ctx = JSON.parse(
    agent.copilotContext(
      { firms: [], contacts: [], deals: [], tasks: [], mails: [] },
      "2026-10-29",
      { brand: b },
    ),
  );
  assert.equal(ctx.ownCompany.name, "Kwiaciarnia Róża");
  assert.equal(ctx.ownCompany.websiteScore, 82);
  assert.deepEqual(ctx.ownCompany.websiteIssues, ["Opis meta"]);
  assert.equal(
    JSON.parse(
      agent.copilotContext(
        { firms: [], contacts: [], deals: [], tasks: [], mails: [] },
        "2026-10-29",
      ),
    ).ownCompany,
    undefined,
  );
});

test("lejek konwersji i harmonogram zamknięć", () => {
  const deal = (stage, value, closeDate, probability = 50) => ({
    id: `${stage}${value}`,
    companyId: "f",
    name: "x",
    stage,
    value,
    probability,
    closeDate,
  });
  const data = {
    firms: [],
    contacts: [],
    tasks: [],
    mails: [],
    deals: [
      deal("Nowa", 100, "2026-10-01"),
      deal("Rozmowa", 200, "2026-11-10"),
      deal("Oferta", 300, "2026-12-15", 80),
      deal("Wygrana", 400, "2026-10-01", 100),
      deal("Przegrana", 500, "2026-10-01", 0),
      deal("Nowa", 999, "2027-06-01"),
    ],
  };
  const f = insights.funnelConversion(data);
  assert.deepEqual(plain(f.map((s) => s.count)), [6, 3, 2, 1]);
  assert.deepEqual(plain(f.map((s) => s.rate)), [100, 50, 67, 50]);
  const c = insights.closingSchedule(data, "2026-10-29");
  assert.deepEqual(plain(c.map((b) => b.count)), [1, 1, 1, 0, 1]);
  assert.equal(c[0].overdue, true);
  assert.equal(c[2].weighted, 240);
});

test("odczyt strony podąża za przekierowaniem i zwraca końcowy adres", async () => {
  const { EventEmitter } = require("node:events");
  const visited = [];
  const https = {
    request(url, _options, onResponse) {
      visited.push(url.href);
      const task = new EventEmitter();
      task.destroy = () => {};
      task.end = () => {
        const response = new EventEmitter();
        response.resume = () => {};
        if (url.pathname === "/") {
          response.statusCode = 301;
          response.headers = { location: "/firma/" };
          onResponse(response);
        } else {
          response.statusCode = 200;
          response.headers = { "content-type": "text/html; charset=utf-8" };
          onResponse(response);
          response.emit("data", Buffer.from("<html>ok</html>"));
          response.emit("end");
        }
      };
      return task;
    },
  };
  const dns = { lookup: async () => [{ address: "93.184.216.34", family: 4 }] };
  const research = load("lib/knowledge/research.ts", {
    "node:https": https,
    "node:dns/promises": dns,
  });
  const saved = { a: process.env.HTTPS_PROXY, b: process.env.https_proxy };
  delete process.env.HTTPS_PROXY;
  delete process.env.https_proxy;
  try {
    const page = await research.fetchPage(new URL("https://firma.example.pl/"));
    assert.equal(page.html, "<html>ok</html>");
    assert.equal(page.url.href, "https://firma.example.pl/firma/");
    assert.deepEqual(visited, [
      "https://firma.example.pl/",
      "https://firma.example.pl/firma/",
    ]);
    const facts = extract.extractSite(
      '<img class="logo" src="logo.png">',
      page.url.href,
    );
    assert.equal(facts.logo, "https://firma.example.pl/firma/logo.png");
  } finally {
    if (saved.a !== undefined) process.env.HTTPS_PROXY = saved.a;
    if (saved.b !== undefined) process.env.https_proxy = saved.b;
  }
});

test("historia marki: punkty, jeden skan dziennie, alerty spadków i harmonogram", () => {
  const automation = load("lib/automation/model.ts");
  const base = brand.validateBrand({
    ...brand.emptyBrand(),
    name: "Róża",
    website: "https://roza.example.pl/",
    rating: { value: 4.8, count: 120, source: "Google", url: "" },
    audit: {
      score: 90,
      responseMs: 100,
      checks: [{ id: "a", label: "A", ok: true, weight: 1, hint: "" }],
    },
    scannedAt: "2026-10-01T08:00:00.000Z",
  });
  const first = brand.withHistory(base);
  assert.deepEqual(plain(first.history), [
    {
      at: "2026-10-01T08:00:00.000Z",
      score: 90,
      rating: 4.8,
      reviews: 120,
      stars: null,
      issues: 0,
    },
  ]);
  const sameDay = brand.withHistory(
    { ...base, scannedAt: "2026-10-01T18:00:00.000Z" },
    first,
  );
  assert.equal(sameDay.history.length, 1);
  assert.deepEqual(plain(brand.brandAlerts(sameDay.history)), []);
  const worse = brand.withHistory(
    {
      ...base,
      scannedAt: "2026-10-08T08:00:00.000Z",
      rating: { ...base.rating, value: 4.6 },
      audit: {
        score: 80,
        responseMs: 100,
        checks: [{ id: "a", label: "A", ok: false, weight: 1, hint: "" }],
      },
    },
    sameDay,
  );
  assert.equal(worse.history.length, 2);
  const alerts = brand.brandAlerts(worse.history);
  assert.equal(alerts.length, 3);
  assert.match(alerts[0], /90 do 80/);
  assert.match(alerts[1], /4\.8 do 4\.6/);
  const many = {
    ...worse,
    history: Array.from({ length: 60 }, (_, i) => ({
      at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z${i}`,
      score: 150,
      rating: 9,
      reviews: -1,
      stars: 3,
      issues: 1,
    })),
  };
  const valid = brand.validateBrand(many);
  assert.equal(valid.history.length, 52);
  assert.equal(valid.history[0].score, 100);
  assert.equal(valid.history[0].rating, 5);
  assert.equal(valid.history[0].reviews, 0);
  const job = automation.newJob(
    {
      name: "Monitoring",
      kind: "brand",
      frequency: "weekly",
      weekday: 1,
      time: "08:15",
    },
    "j1",
    new Date("2026-10-29T10:00:00Z"),
  );
  assert.equal(job.kind, "brand");
  assert.equal(automation.jobKindLabels.brand, "Monitoruj markę");
  assert.ok(automation.JOB_TEMPLATES.some((t) => t.kind === "brand"));
});

test("konkurencja: zapis, przewagi konkurentów, notatka i kontekst agenta", () => {
  const own = brand.validateBrand({
    ...brand.emptyBrand(),
    name: "Róża",
    website: "https://roza.example.pl/",
    rating: { value: 4.2, count: 10, source: "Google", url: "" },
    audit: {
      score: 70,
      responseMs: 900,
      checks: [{ id: "a", label: "Opis meta", ok: false, weight: 1, hint: "" }],
    },
    socials: [{ network: "Facebook", url: "https://facebook.com/roza" }],
  });
  const rival = brand.toCompetitor(
    brand.validateBrand({
      ...brand.emptyBrand(),
      name: "Kwiatek",
      website: "https://kwiatek.example.pl/",
      rating: { value: 4.9, count: 300, source: "Google", url: "" },
      audit: {
        score: 88,
        responseMs: 400,
        checks: [{ id: "a", label: "A", ok: true, weight: 1, hint: "" }],
      },
      trackers: ["Google Analytics 4"],
      socials: [1, 2, 3, 4].map((i) => ({
        network: `N${i}`,
        url: `https://x${i}.pl`,
      })),
      services: ["Bukiety", "Wesela"],
      colors: { primary: "#16a34a", accent: "#000000", palette: [] },
    }),
  );
  assert.equal(rival.score, 88);
  assert.equal(rival.socials, 4);
  const withRival = brand.validateBrand({
    ...own,
    competitors: [rival, rival, rival, rival],
  });
  assert.equal(withRival.competitors.length, 3);
  const gaps = brand.competitorGaps({ ...own, competitors: [rival] });
  assert.equal(gaps.length, 5);
  assert.match(gaps[0], /88 vs 70/);
  const md = markdown.competitorsMarkdown({ ...own, competitors: [rival] });
  assert.match(md, /\| Róża \(my\) \|/);
  assert.match(
    md,
    /\| Kwiatek \| https:\/\/kwiatek\.example\.pl\/ \| 88 \| 4\.9 \| 300 \|/,
  );
  assert.match(md, /## Gdzie konkurencja wygrywa/);
  const ctx = JSON.parse(
    agent.copilotContext(
      { firms: [], contacts: [], deals: [], tasks: [], mails: [] },
      "2026-10-29",
      {
        brand: { ...own, competitors: [rival] },
      },
    ),
  );
  assert.equal(ctx.ownCompany.competitors[0].name, "Kwiatek");
  assert.equal(ctx.ownCompany.competitorGaps.length, 5);
});
