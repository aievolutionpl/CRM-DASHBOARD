import { isDatabase } from "@/lib/growth/model";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { parseBackup } from "@/lib/crm/backup";
import {
  emptyAutomation,
  validateAutomation,
  MAX_REPORTS,
  MAX_RUNS,
  type Automation,
  type Job,
  type JobRun,
  type ReportRecord,
} from "@/lib/automation/model";
import { validateBrand, type BrandProfile } from "@/lib/brand/model";
import {
  seedData,
  type WorkspaceData,
  type Firm,
  type Contact,
  type Deal,
  type Task,
  type Mail,
} from "@/lib/crm/model";
type State = WorkspaceData & {
  onboarded: boolean;
  sender: string;
  agentEnabled: boolean;
  businessMode: "crm" | "services";
  automation: Automation;
  brand?: BrandProfile;
  setBrand: (brand: BrandProfile | undefined) => void;
  saveJob: (job: Job) => void;
  deleteJob: (id: string) => void;
  addRun: (run: JobRun) => void;
  saveReport: (report: ReportRecord) => void;
  deleteReport: (id: string) => void;
  setBusinessMode: (mode: "crm" | "services") => void;
  saveFirm: (item: Firm) => void;
  saveContact: (item: Contact) => void;
  saveDeal: (item: Deal) => void;
  saveTask: (item: Task) => void;
  saveMail: (item: Mail) => void;
  deleteFirm: (id: string) => void;
  deleteContact: (id: string) => void;
  deleteDeal: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteMail: (id: string) => void;
  setOnboarded: (v: boolean) => void;
  setSender: (v: string) => void;
  setAgent: (v: boolean) => void;
  restore: (data: WorkspaceData) => void;
  empty: () => void;
};
function upsert<T extends { id: string }>(items: T[], item: T) {
  return items.some((v) => v.id === item.id)
    ? items.map((v) => (v.id === item.id ? item : v))
    : [item, ...items];
}
export const useCrm = create<State>()(
  persist(
    (set) => ({
      ...seedData(),
      onboarded: false,
      sender: "Zespół AI Evolution Polska",
      agentEnabled: false,
      businessMode: "crm",
      automation: emptyAutomation(),
      brand: undefined,
      setBrand: (brand) => set({ brand }),
      saveJob: (job) =>
        set((s) => ({
          automation: { ...s.automation, jobs: upsert(s.automation.jobs, job) },
        })),
      deleteJob: (key) =>
        set((s) => ({
          automation: {
            ...s.automation,
            jobs: s.automation.jobs.filter((j) => j.id !== key),
          },
        })),
      addRun: (run) =>
        set((s) => ({
          automation: {
            ...s.automation,
            runs: [run, ...s.automation.runs].slice(0, MAX_RUNS),
          },
        })),
      saveReport: (report) =>
        set((s) => ({
          automation: {
            ...s.automation,
            reports: upsert(s.automation.reports, report).slice(0, MAX_REPORTS),
          },
        })),
      deleteReport: (key) =>
        set((s) => ({
          automation: {
            ...s.automation,
            reports: s.automation.reports.filter((r) => r.id !== key),
          },
        })),
      setBusinessMode: (businessMode) => set({ businessMode }),
      saveFirm: (item) => set((s) => ({ firms: upsert(s.firms, item) })),
      saveContact: (item) =>
        set((s) => ({ contacts: upsert(s.contacts, item) })),
      saveDeal: (item) => set((s) => ({ deals: upsert(s.deals, item) })),
      saveTask: (item) => set((s) => ({ tasks: upsert(s.tasks, item) })),
      saveMail: (item) => set((s) => ({ mails: upsert(s.mails, item) })),
      deleteFirm: (key) =>
        set((s) => ({
          firms: s.firms.filter((v) => v.id !== key),
          contacts: s.contacts.filter((v) => v.companyId !== key),
          deals: s.deals.filter((v) => v.companyId !== key),
          tasks: s.tasks.filter((v) => v.companyId !== key),
        })),
      deleteContact: (key) =>
        set((s) => ({ contacts: s.contacts.filter((v) => v.id !== key) })),
      deleteDeal: (key) =>
        set((s) => ({ deals: s.deals.filter((v) => v.id !== key) })),
      deleteTask: (key) =>
        set((s) => ({ tasks: s.tasks.filter((v) => v.id !== key) })),
      deleteMail: (key) =>
        set((s) => ({ mails: s.mails.filter((v) => v.id !== key) })),
      setOnboarded: (onboarded) => set({ onboarded }),
      setSender: (sender) => set({ sender }),
      setAgent: (agentEnabled) => set({ agentEnabled }),
      restore: (data) => set({ ...data }),
      empty: () =>
        set({ firms: [], contacts: [], deals: [], tasks: [], mails: [] }),
    }),
    {
      name: "ai-evolution-crm-v1",
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (key) => (isDatabase() ? null : localStorage.getItem(key)),
        setItem: (key, value) => {
          if (isDatabase()) return;
          try {
            localStorage.setItem(key, value);
          } catch {
            window.dispatchEvent(new Event("crm-storage-error"));
          }
        },
        removeItem: (key) => {
          if (!isDatabase()) localStorage.removeItem(key);
        },
      })),
      skipHydration: true,
      merge: (persisted, current) => {
        if (!persisted) return current;
        const saved = persisted as Record<string, unknown>;
        const data = parseBackup(JSON.stringify({ version: 1, data: saved }));
        return {
          ...current,
          ...data,
          onboarded: saved.onboarded === true,
          sender:
            typeof saved.sender === "string" && saved.sender.length <= 200
              ? saved.sender
              : current.sender,
          agentEnabled: saved.agentEnabled === true,
          businessMode: saved.businessMode === "services" ? "services" : "crm",
          automation: (() => {
            try {
              return validateAutomation(saved.automation);
            } catch {
              return emptyAutomation();
            }
          })(),
          brand: (() => {
            try {
              return validateBrand(saved.brand);
            } catch {
              return undefined;
            }
          })(),
        };
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error)
          queueMicrotask(() =>
            window.dispatchEvent(new Event("crm-storage-error")),
          );
      },
      partialize: (s) => ({
        firms: s.firms,
        contacts: s.contacts,
        deals: s.deals,
        tasks: s.tasks,
        mails: s.mails,
        onboarded: s.onboarded,
        sender: s.sender,
        agentEnabled: s.agentEnabled,
        businessMode: s.businessMode,
        automation: s.automation,
        brand: s.brand,
      }),
    },
  ),
);
