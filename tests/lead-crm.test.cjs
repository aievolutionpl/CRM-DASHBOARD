const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-ts.cjs");
const plain = (v) => JSON.parse(JSON.stringify(v));
const model = load("lib/leads/model.ts"),
  domain = load("lib/leads/domain.ts", { "./model": model }),
  crm = load("lib/leads/crm.ts", { "./model": model }),
  agent = load("lib/ai/agent.ts"),
  backup = load("lib/crm/backup.ts");

const wid = "11111111-1111-4111-8111-111111111111";
const lid = "22222222-2222-4222-8222-222222222222";
function lead(patch = {}) {
  const b = domain.newLead(wid, lid, {
    first_name: "Anna",
    last_name: "Nowak",
    company_name: "Studio Forma",
    email: "anna@forma.pl",
    phone: "+48 600 100 200",
    status: "quote",
    source: "google_ads",
    campaign: "Remonty Kraków",
    medium: "cpc",
    estimated_value: 12000,
    revenue: 0,
    notes: "Pilne.",
    landing_page: "",
    keyword: "",
    utm: {},
    ...patch,
  });
  return b;
}
const empty = () => ({
  firms: [],
  contacts: [],
  deals: [],
  tasks: [],
  mails: [],
});
const ids = { firm: "f-new", contact: "c-new", deal: "d-new" };

test("lead → CRM: firma, kontakt i szansa ze źródłem i etapem", () => {
  const r = crm.convertLead(lead().lead, empty(), "2026-10-29", ids);
  assert.equal(r.firmCreated, true);
  assert.equal(r.firm.name, "Studio Forma");
  assert.match(r.firm.notes, /google_ads · kampania: Remonty Kraków/);
  assert.equal(r.contact.email, "anna@forma.pl");
  assert.equal(r.contact.name, "Anna Nowak");
  assert.equal(r.deal.stage, "Oferta");
  assert.equal(r.deal.probability, 60);
  assert.equal(r.deal.value, 12000);
  assert.equal(r.deal.source, "google_ads");
  assert.equal(r.deal.leadId, lid);
  assert.equal(r.deal.closeDate, "2026-11-28");
  assert.deepEqual(plain(r.links), {
    company_id: "f-new",
    contact_id: "c-new",
    deal_id: "d-new",
  });
  const data = {
    ...empty(),
    firms: [r.firm],
    contacts: [r.contact],
    deals: [r.deal],
  };
  assert.doesNotThrow(() =>
    backup.parseBackup(JSON.stringify({ version: 1, data })),
  );
});

test("lead → CRM: bez duplikatów, tryb usługowy i brak e-maila", () => {
  const first = crm.convertLead(lead().lead, empty(), "2026-10-29", ids);
  const data = {
    ...empty(),
    firms: [first.firm],
    contacts: [first.contact],
    deals: [first.deal],
  };
  const again = crm.convertLead(lead().lead, data, "2026-10-29", {
    firm: "x",
    contact: "y",
    deal: "z",
  });
  assert.equal(again.firmCreated, false);
  assert.equal(again.contactCreated, false);
  assert.equal(again.dealCreated, false);
  const byName = crm.convertLead(
    lead({ company_name: "studio forma ", email: "" }).lead,
    { ...empty(), firms: [first.firm] },
    "2026-10-29",
    ids,
  );
  assert.equal(byName.firm.id, "f-new");
  assert.equal(byName.contact, undefined);
  const services = crm.convertLead(
    lead({ company_name: "", status: "won", revenue: 900 }).lead,
    empty(),
    "2026-10-29",
    ids,
    true,
  );
  assert.equal(services.firm.name, "Anna Nowak");
  assert.equal(services.firm.email, "anna@forma.pl");
  assert.equal(services.deal, undefined);
  const won = crm.convertLead(
    lead({ status: "won", revenue: 900 }).lead,
    empty(),
    "2026-10-29",
    ids,
  );
  assert.equal(won.deal.stage, "Wygrana");
  assert.equal(won.deal.value, 900);
  assert.equal(won.deal.closeDate, "2026-10-29");
});

test("powiązanie leada z CRM zapisuje linki i zdarzenie", () => {
  const b = lead();
  const linked = domain.linkCrm(b, { company_id: "f1", deal_id: "d1" });
  assert.deepEqual(plain(linked.lead.crm_links), {
    company_id: "f1",
    deal_id: "d1",
  });
  assert.equal(linked.lead.revision, b.lead.revision + 1);
  const event = linked.events.at(-1);
  assert.equal(event.event_type, "lead_updated");
  assert.equal(event.metadata.crm_company_id, "f1");
  assert.deepEqual(plain(b.lead.crm_links), {});
});

test("szansa: pole źródła jest walidowane", () => {
  const data = {
    ...empty(),
    firms: [
      {
        id: "f1",
        name: "A",
        nip: "",
        city: "",
        industry: "",
        website: "",
        notes: "",
        created: "2026-10-01",
      },
    ],
    deals: [
      {
        id: "d1",
        companyId: "f1",
        name: "X",
        value: 1,
        probability: 10,
        stage: "Nowa",
        closeDate: "2026-11-01",
        source: "x".repeat(101),
      },
    ],
  };
  assert.throws(
    () => backup.parseBackup(JSON.stringify({ version: 1, data })),
    /szansy/,
  );
});

test("agent: akcja convert_lead i odpowiedź offline o leadach", () => {
  assert.deepEqual(
    plain(
      agent.validateAction({ type: "convert_lead", leadId: lid, name: "Anna" }),
    ),
    {
      type: "convert_lead",
      leadId: lid,
      name: "Anna",
    },
  );
  assert.throws(() => agent.validateAction({ type: "convert_lead" }), /lead/i);
  const digest = {
    total: 3,
    leads: [
      {
        id: "a",
        name: "Anna",
        status: "quote",
        source: "google_ads",
        estimatedValue: 1000,
        inCrm: false,
      },
      {
        id: "b",
        name: "Bartek",
        status: "lost",
        estimatedValue: 500,
        inCrm: false,
      },
      {
        id: "c",
        name: "Celina",
        status: "won",
        estimatedValue: 2000,
        inCrm: true,
      },
    ],
  };
  const summary = JSON.parse(
    agent.builtinCopilot("Pokaż leady", empty(), "2026-10-29", "crm", digest),
  );
  assert.match(summary.answer, /3 leadów/);
  assert.equal(summary.actions.length, 0);
  const convert = agent.parseCopilotReply(
    agent.builtinCopilot(
      "Przenieś leady do CRM",
      empty(),
      "2026-10-29",
      "crm",
      digest,
    ),
  );
  assert.deepEqual(plain(convert.actions), [
    { type: "convert_lead", leadId: "a", name: "Anna" },
  ]);
  assert.match(agent.describeAction(convert.actions[0], empty()).title, /Anna/);
  const ctx = JSON.parse(
    agent.copilotContext(empty(), "2026-10-29", { leads: digest }),
  );
  assert.equal(ctx.leads.total, 3);
});

test("lead firmy bez e-maila zachowuje telefon na karcie firmy", () => {
  const r = crm.convertLead(
    lead({ email: "", phone: "+48 600 700 800" }).lead,
    empty(),
    "2026-10-29",
    ids,
  );
  assert.equal(r.contact, undefined);
  assert.equal(r.firm.phone, "+48 600 700 800");
  const withEmail = crm.convertLead(lead().lead, empty(), "2026-10-29", ids);
  assert.equal(withEmail.firm.phone, "");
  assert.equal(withEmail.contact.phone, "+48 600 100 200");
});

test("konwersja wymaga aktywnej przestrzeni i potwierdzonego zapisu", async () => {
  const sync = load("stores/sync.ts");
  assert.throws(() => sync.assertWorkspace("a"), /zmieniona/);
  let flushed = 0;
  const off = sync.registerSync({
    workspace: "a",
    flush: async () => void flushed++,
  });
  assert.equal(sync.activeWorkspace(), "a");
  await sync.flushWorkspace("a");
  assert.equal(flushed, 1);
  await assert.rejects(sync.flushWorkspace("b"), /zmieniona/);
  off();
  assert.equal(sync.activeWorkspace(), null);
});
