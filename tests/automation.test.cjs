const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-ts.cjs");
const plain = (v) => JSON.parse(JSON.stringify(v));
const model = load("lib/crm/model.ts"),
  automation = load("lib/automation/model.ts"),
  reports = load("lib/reports/generate.ts"),
  agent = load("lib/ai/agent.ts"),
  growth = load("lib/growth/model.ts");

test("harmonogram liczy termin w czasie polskim, także przy zmianie czasu", () => {
  const job = { frequency: "daily", time: "08:00", weekday: 1, monthDay: 1 };
  assert.equal(
    automation.nextRun(job, new Date("2026-10-06T07:00:00Z")),
    "2026-10-07T06:00:00.000Z",
  );
  assert.equal(
    automation.nextRun(job, new Date("2026-10-24T07:00:00Z")),
    "2026-10-25T07:00:00.000Z",
  );
  assert.equal(
    automation.nextRun(
      { ...job, frequency: "weekly", weekday: 1, time: "07:30" },
      new Date("2026-10-06T10:00:00Z"),
    ),
    "2026-10-12T05:30:00.000Z",
  );
  assert.equal(
    automation.nextRun(
      { ...job, frequency: "weekdays" },
      new Date("2026-10-09T08:00:00Z"),
    ),
    "2026-10-12T06:00:00.000Z",
  );
  assert.equal(
    automation.nextRun(
      { ...job, frequency: "monthly", monthDay: 1 },
      new Date("2026-10-06T08:00:00Z"),
    ),
    "2026-11-01T07:00:00.000Z",
  );
});

test("zadania harmonogramu są walidowane i wykrywane jako zaległe", () => {
  const now = new Date("2026-10-06T07:00:00Z");
  const job = automation.newJob(
    { name: "Raport", kind: "report", time: "08:00" },
    "j1",
    now,
  );
  assert.equal(job.nextRun, "2026-10-07T06:00:00.000Z");
  assert.equal(automation.dueJobs([job], new Date(job.nextRun)).length, 1);
  assert.equal(
    automation.dueJobs([{ ...job, enabled: false }], new Date(job.nextRun))
      .length,
    0,
  );
  assert.throws(() => automation.validateJob({ ...job, time: "25:00" }));
  assert.throws(() =>
    automation.validateJob({ ...job, kind: "agent", prompt: " " }),
  );
  assert.deepEqual(plain(automation.validateAutomation(undefined)), {
    jobs: [],
    runs: [],
    reports: [],
  });
});

test("raport liczy KPI, porównanie z poprzednim okresem i eksporty", () => {
  const data = model.seedData();
  data.deals[0].closeDate = "2026-10-20";
  data.deals[4].closeDate = "2026-10-01";
  data.deals.push({
    id: "old",
    companyId: "f1",
    name: "Stara wygrana",
    value: 1000,
    probability: 100,
    stage: "Wygrana",
    closeDate: "2026-08-20",
  });
  const r = reports.generateReport(data, "sales", "30d", "2026-10-06");
  assert.equal(r.period.from, "2026-09-07");
  assert.equal(r.kpis[0].value, 6500);
  assert.equal(r.kpis[0].previous, 1000);
  assert.equal(reports.kpiDelta(r.kpis[0]), 550);
  assert.ok(r.tables.some((t) => t.title === "Do zamknięcia w 30 dni"));
  const md = reports.reportMarkdown(r, "Krótko.");
  assert.match(md, /# Raport sprzedaży/);
  assert.match(md, /Podsumowanie AI/);
  const csv = reports.reportCsv(r);
  assert.ok(csv.startsWith("﻿Raport;Raport sprzedaży"));
  const ytd = reports.generateReport(data, "executive", "ytd", "2026-10-06");
  const chart = ytd.charts.find((c) => c.title === "Wygrana sprzedaż w czasie");
  assert.equal(chart.items.length, 10);
  assert.equal(chart.items[9].value, 6500);
  assert.equal(chart.items[7].value, 1000);
  assert.deepEqual(plain(reports.periodRange("prev_month", "2026-03-15")), {
    from: "2026-02-01",
    to: "2026-02-28",
  });
});

test("odpowiedź modelu: JSON w bloku kodu, akcje walidowane, nieznane odrzucone", () => {
  const reply = agent.parseCopilotReply(
    'Oto wynik:\n```json\n{"answer":"OK","actions":[{"type":"create_deal","companyName":"Acme","name":"X","value":"1000","stage":"Oferta","closeDate":"2026-10-10"},{"type":"drop_table"},{"type":"create_task","title":"T","date":"2026-02-30"}]}\n```',
  );
  assert.equal(reply.answer, "OK");
  assert.equal(reply.actions.length, 1);
  assert.equal(reply.actions[0].value, 1000);
  assert.equal(reply.rejected.length, 2);
  assert.equal(agent.parseCopilotReply("zwykły tekst").answer, "zwykły tekst");
});

test("wbudowany agent obsługuje raporty, harmonogram, zadania i firmy", () => {
  const data = model.seedData();
  const run = (q) => JSON.parse(agent.builtinCopilot(q, data, "2026-10-06"));
  assert.deepEqual(
    plain(run("Wygeneruj raport sprzedaży za ten miesiąc").actions[0]),
    {
      type: "generate_report",
      kind: "sales",
      preset: "month",
    },
  );
  const job = run("Zaplanuj co tydzień raport o 7:30").actions[0];
  assert.equal(job.type, "schedule_job");
  assert.equal(job.kind, "report");
  assert.equal(job.frequency, "weekly");
  assert.equal(job.time, "07:30");
  assert.equal(
    run("Zaplanuj codzienny briefing o 8:00").actions[0].kind,
    "agent",
  );
  assert.deepEqual(plain(run("Dodaj firmę Acme z Poznania").actions[0]), {
    type: "create_company",
    name: "Acme",
    city: "Poznań",
  });
  const task = run("Dodaj zadanie Zadzwoń do Nova Studio jutro").actions[0];
  assert.equal(task.date, "2026-10-07");
  assert.equal(task.companyId, "f1");
  const mails = run("Przygotuj szkice follow-up").actions;
  assert.ok(mails.length > 0 && mails.every((a) => a.type === "draft_email"));
  for (const a of [...mails, job, task]) agent.validateAction(a);
});

test("kontekst agenta zawiera identyfikatory i podsumowanie", () => {
  const ctx = JSON.parse(
    agent.copilotContext(model.seedData(), "2026-10-06", {
      automation: automation.emptyAutomation(),
    }),
  );
  assert.equal(ctx.companies.length, 5);
  assert.equal(ctx.deals[0].id, "d1");
  assert.equal(ctx.summary.openDeals, 4);
});

test("zapis przestrzeni zachowuje harmonogram i raporty", () => {
  const data = model.seedData();
  const job = automation.newJob(
    { name: "Raport", kind: "report" },
    "j1",
    new Date("2026-10-06T07:00:00Z"),
  );
  const rep = {
    id: "r1",
    created: "2026-10-06T07:00:00.000Z",
    source: "manual",
    data: reports.generateReport(data, "executive", "7d", "2026-10-06"),
  };
  const snap = growth.snapshot(
    {
      ...data,
      onboarded: true,
      sender: "Zespół",
      agentEnabled: false,
      businessMode: "crm",
      automation: { jobs: [job], runs: [], reports: [rep] },
    },
    3,
  );
  const parsed = growth.validateSnapshot(JSON.parse(JSON.stringify(snap)));
  assert.equal(parsed.settings.automation.jobs[0].id, "j1");
  assert.equal(parsed.settings.automation.reports[0].id, "r1");
  const legacy = growth.validateSnapshot({
    ...snap,
    settings: { ...snap.settings, automation: undefined },
  });
  assert.equal(legacy.settings.automation.jobs.length, 0);
});

test("harmonogram: wynik zadania po zmianie przestrzeni jest odrzucany", async () => {
  const sync = load("stores/sync.ts");
  const writes = [];
  const job = {
    id: "j1",
    name: "Monitoring",
    kind: "brand",
    frequency: "weekly",
    time: "08:15",
    weekday: 1,
    monthDay: 1,
    enabled: true,
    reportKind: "executive",
    preset: "7d",
    prompt: "",
    created: "2026-10-01T00:00:00.000Z",
    nextRun: "2026-10-05T06:15:00.000Z",
  };
  const state = {
    automation: { jobs: [job] },
    saveJob: (j) => writes.push(["job", j.id]),
    addRun: (r) => writes.push(["run", r.jobId]),
  };
  const scheduler = load("stores/scheduler.ts", {
    "./crm-store": { useCrm: { getState: () => state } },
    "./agent-store": { runAgent: async () => ({ actions: [] }) },
    "./sync": sync,
    "./brand-scan": {
      monitorBrand: async () => {
        sync.registerSync({ workspace: "B", flush: async () => {} });
        throw Error("Przestrzeń została zmieniona w trakcie skanu.");
      },
    },
    react: { useEffect: () => {}, useRef: () => ({}) },
    "@/lib/automation/model": automation,
    "@/lib/reports/generate": reports,
    "@/lib/crm/model": model,
  });
  sync.registerSync({ workspace: "A", flush: async () => {} });
  const result = await scheduler.runJob(job, true);
  assert.equal(result.discarded, true);
  assert.deepEqual(writes, []);
  const ok = await scheduler.runJob({ ...job, kind: "followup" }, true);
  assert.equal(ok.discarded, false);
  assert.deepEqual(
    writes.map((w) => w[0]),
    ["job", "run"],
  );
});
