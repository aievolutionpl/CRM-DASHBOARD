import type { WorkspaceData } from "./model";

const escape = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/[,;]/g, (m) => `\\${m}`);
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 74) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}
const day = (d: string) => d.replace(/-/g, "");
const local = (d: string) => `${d.replace(/[-:]/g, "")}00`;
function nextDay(d: string) {
  const date = new Date(`${d}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
const stamp = (now: Date) =>
  now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const WARSAW = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Warsaw",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function crmCalendar(
  data: Pick<WorkspaceData, "tasks" | "deals" | "firms">,
  calendarName: string,
  now = new Date(),
) {
  const firm = (id: string) => data.firms.find((f) => f.id === id)?.name ?? "";
  const events: string[][] = [];
  for (const t of data.tasks)
    if (!t.done)
      events.push([
        "BEGIN:VEVENT",
        `UID:task-${t.id}@growth-os`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART;VALUE=DATE:${day(t.date)}`,
        `DTEND;VALUE=DATE:${day(nextDay(t.date))}`,
        `SUMMARY:${escape(t.title)}`,
        ...(firm(t.companyId)
          ? [`DESCRIPTION:${escape(`Zadanie CRM · ${firm(t.companyId)}`)}`]
          : []),
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escape(t.title)}`,
        "TRIGGER:PT9H",
        "END:VALARM",
        "END:VEVENT",
      ]);
  for (const d of data.deals)
    if (d.service && ["booked", "in_progress"].includes(d.service.status))
      events.push([
        "BEGIN:VEVENT",
        `UID:job-${d.id}@growth-os`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART;TZID=Europe/Warsaw:${local(d.service.start)}`,
        `DTEND;TZID=Europe/Warsaw:${local(d.service.end)}`,
        `SUMMARY:${escape(`${d.name} · ${firm(d.companyId)}`)}`,
        ...(d.service.location
          ? [`LOCATION:${escape(d.service.location)}`]
          : []),
        `DESCRIPTION:${escape(
          [
            d.service.resource && `Osoba/stanowisko: ${d.service.resource}`,
            d.service.notes,
          ]
            .filter(Boolean)
            .join("\n") || "Zlecenie z Growth OS",
        )}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escape(d.name)}`,
        "TRIGGER:-PT1H",
        "END:VALARM",
        "END:VEVENT",
      ]);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI Evolution Polska//Growth OS//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Warsaw",
    ...WARSAW,
    ...events.flat(),
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}

export function dueSummary(
  tasks: WorkspaceData["tasks"],
  today: string,
): { overdue: number; today: number } {
  const open = tasks.filter((t) => !t.done);
  return {
    overdue: open.filter((t) => t.date < today).length,
    today: open.filter((t) => t.date === today).length,
  };
}
