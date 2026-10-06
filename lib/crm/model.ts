export const DEAL_STAGES = [
  "Nowa",
  "Rozmowa",
  "Oferta",
  "Wygrana",
  "Przegrana",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const SECTIONS = [
  "dashboard",
  "leads",
  "companies",
  "deals",
  "contacts",
  "tasks",
  "mail",
  "agent",
  "settings",
  "brain",
  "connectors",
  "ai",
] as const;
export type Section = (typeof SECTIONS)[number];
export const FIRM_STATUSES = [
  "lead",
  "active",
  "vip",
  "paused",
  "lost",
] as const;
export type FirmStatus = (typeof FIRM_STATUSES)[number];
export const firmStatusLabels: Record<FirmStatus, string> = {
  lead: "Potencjalny",
  active: "Aktywny klient",
  vip: "Kluczowy (VIP)",
  paused: "Wstrzymany",
  lost: "Utracony",
};
export type Firm = {
  id: string;
  name: string;
  nip: string;
  city: string;
  industry: string;
  website: string;
  notes: string;
  created: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: FirmStatus;
  owner?: string;
  source?: string;
  tags?: string[];
};
export type Contact = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  consent: boolean;
};
export type Deal = {
  id: string;
  companyId: string;
  name: string;
  value: number;
  probability: number;
  stage: DealStage;
  closeDate: string;
  service?: ServiceBooking;
};
export const SERVICE_STATUSES = [
  "booked",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
export type BusinessMode = "crm" | "services";
export type ServiceBooking = {
  status: ServiceStatus;
  start: string;
  end: string;
  resource: string;
  location: string;
  notes: string;
  history: { at: string; message: string }[];
};
export const serviceLabels: Record<ServiceStatus, string> = {
  booked: "Zarezerwowane",
  in_progress: "W realizacji",
  completed: "Zakończone",
  cancelled: "Anulowane",
};
export type Task = {
  id: string;
  companyId: string;
  title: string;
  date: string;
  done: boolean;
};
export type Mail = {
  id: string;
  contactId: string;
  to: string;
  subject: string;
  body: string;
  status: "draft" | "sending" | "accepted" | "failed" | "external";
  error?: string;
  providerId?: string;
  created: string;
  sentAt?: string;
  agent: boolean;
};
export type WorkspaceData = {
  firms: Firm[];
  contacts: Contact[];
  deals: Deal[];
  tasks: Task[];
  mails: Mail[];
};
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function offsetDate(days: number) {
  const date = new Date(`${today()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function money(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}
export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
export function validNip(input: string) {
  const nip = input.replace(/[\s-]/g, "");
  if (!nip) return true;
  if (!/^\d{10}$/.test(nip)) return false;
  const sum = [6, 5, 7, 2, 3, 4, 5, 6, 7].reduce(
    (s, w, i) => s + w * Number(nip[i]),
    0,
  );
  return sum % 11 === Number(nip[9]);
}
export function id() {
  return crypto.randomUUID();
}
export function safeWebsite(input: string) {
  if (!input.trim()) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    return ["http:", "https:"].includes(u.protocol) ? u.toString() : "";
  } catch {
    return "";
  }
}
export function seedData(): WorkspaceData {
  const firms: Firm[] = [
    {
      id: "f1",
      name: "Nova Studio",
      city: "Warszawa",
      industry: "Marketing",
      website: "",
      notes: "Dane demonstracyjne. Warsztat automatyzacji obsługi klienta.",
      nip: "",
      created: today(),
    },
    {
      id: "f2",
      name: "Baltic Commerce",
      city: "Gdańsk",
      industry: "E-commerce",
      website: "",
      notes: "Dane demonstracyjne. Obsługa zapytań i rekomendacje produktów.",
      nip: "",
      created: today(),
    },
    {
      id: "f3",
      name: "Pracownia Forma",
      city: "Kraków",
      industry: "Usługi",
      website: "",
      notes: "Dane demonstracyjne. Asystent do organizacji pracy.",
      nip: "",
      created: today(),
    },
    {
      id: "f4",
      name: "Green Logistics",
      city: "Poznań",
      industry: "Logistyka",
      website: "",
      notes: "Dane demonstracyjne. Automatyzacja dokumentów.",
      nip: "",
      created: today(),
    },
    {
      id: "f5",
      name: "EduLab",
      city: "Wrocław",
      industry: "Edukacja",
      website: "",
      notes: "Dane demonstracyjne. Warsztaty AI dla zespołu.",
      nip: "",
      created: today(),
    },
  ];
  const contacts: Contact[] = firms.map((f, i) => ({
    id: `c${i + 1}`,
    companyId: f.id,
    name: [
      "Anna Kowalska",
      "Michał Nowak",
      "Karolina Wiśniewska",
      "Piotr Zieliński",
      "Ewa Wójcik",
    ][i],
    role: [
      "Marketing",
      "Właściciel",
      "Właścicielka",
      "Operacje",
      "Koordynatorka",
    ][i],
    email: `kontakt${i + 1}@example.com`,
    phone: `+48 500 100 ${200 + i}`,
    consent: false,
  }));
  const deals: Deal[] = [
    {
      id: "d1",
      companyId: "f1",
      name: "Automatyzacja obsługi klienta",
      value: 24500,
      probability: 65,
      stage: "Oferta",
      closeDate: offsetDate(10),
    },
    {
      id: "d2",
      companyId: "f2",
      name: "Asystent sklepu internetowego",
      value: 18000,
      probability: 40,
      stage: "Rozmowa",
      closeDate: offsetDate(18),
    },
    {
      id: "d3",
      companyId: "f3",
      name: "Audyt procesów i wdrożenie AI",
      value: 8500,
      probability: 20,
      stage: "Nowa",
      closeDate: offsetDate(25),
    },
    {
      id: "d4",
      companyId: "f4",
      name: "Automatyzacja dokumentów",
      value: 32000,
      probability: 55,
      stage: "Oferta",
      closeDate: offsetDate(14),
    },
    {
      id: "d5",
      companyId: "f5",
      name: "Warsztaty AI dla zespołu",
      value: 6500,
      probability: 100,
      stage: "Wygrana",
      closeDate: offsetDate(-3),
    },
  ];
  const tasks: Task[] = [
    {
      id: "t1",
      companyId: "f1",
      title: "Wyślij podsumowanie spotkania",
      date: today(),
      done: false,
    },
    {
      id: "t2",
      companyId: "f2",
      title: "Omów zakres asystenta",
      date: offsetDate(1),
      done: false,
    },
    {
      id: "t3",
      companyId: "f4",
      title: "Przygotuj ofertę wdrożenia",
      date: offsetDate(2),
      done: false,
    },
  ];
  return { firms, contacts, deals, tasks, mails: [] };
}
export function draftFollowup(
  contact: Contact,
  firm: Firm,
  deal: Deal | undefined,
  sender: string,
) {
  return {
    subject: `${firm.name} — kolejny krok we współpracy`,
    body: `Dzień dobry,\n\nwracam do naszej rozmowy${deal ? ` o projekcie „${deal.name}”` : " o współpracy"}. Chętnie doprecyzuję zakres i odpowiem na pytania.\n\nCzy możemy ustalić dogodny termin krótkiej rozmowy w tym tygodniu?\n\nPozdrawiam,\n${sender}\nAI Evolution Polska`,
  };
}
