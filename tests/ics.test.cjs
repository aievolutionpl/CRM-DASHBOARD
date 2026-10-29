const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-ts.cjs");
const ics = load("lib/crm/ics.ts");

test("kalendarz .ics: zadania całodniowe, zlecenia w czasie Warszawy, escaping i zawijanie", () => {
  const data = {
    firms: [{ id: "f1", name: "Studio, Forma; Sp. z o.o." }],
    tasks: [
      {
        id: "t1",
        companyId: "f1",
        title: "Zadzwoń, potwierdź; ofertę",
        date: "2026-10-31",
        done: false,
      },
      {
        id: "t2",
        companyId: "",
        title: "Zrobione",
        date: "2026-10-30",
        done: true,
      },
    ],
    deals: [
      {
        id: "d1",
        companyId: "f1",
        name: "Montaż kuchni",
        value: 1000,
        probability: 100,
        stage: "Nowa",
        closeDate: "2026-11-02",
        service: {
          status: "booked",
          start: "2026-11-02T09:30",
          end: "2026-11-02T13:00",
          resource: "Ekipa A",
          location: "Kraków",
          notes: "Wejście od podwórza\nKod 12",
          history: [],
        },
      },
      {
        id: "d2",
        companyId: "f1",
        name: "Anulowane",
        value: 1,
        probability: 0,
        stage: "Nowa",
        closeDate: "2026-11-02",
        service: {
          status: "cancelled",
          start: "2026-11-03T09:30",
          end: "2026-11-03T10:00",
          resource: "",
          location: "",
          notes: "",
          history: [],
        },
      },
    ],
  };
  const out = ics.crmCalendar(
    data,
    "Róża · Growth OS",
    new Date("2026-10-29T12:00:00Z"),
  );
  assert.ok(out.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(out.endsWith("END:VCALENDAR\r\n"));
  assert.equal((out.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(out, /DTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101/);
  assert.ok(out.includes("SUMMARY:Zadzwoń\\, potwierdź\\; ofertę"));
  assert.match(out, /DTSTART;TZID=Europe\/Warsaw:20261102T093000/);
  assert.match(out, /DTEND;TZID=Europe\/Warsaw:20261102T130000/);
  assert.match(out, /Wejście od podwórza\\nKod 12/);
  assert.match(out, /DTSTAMP:20261029T120000Z/);
  assert.doesNotMatch(out, /Zrobione|Anulowane/);
  for (const line of out.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.deepEqual(
    { ...ics.dueSummary(data.tasks, "2026-11-01") },
    { overdue: 1, today: 0 },
  );
});
