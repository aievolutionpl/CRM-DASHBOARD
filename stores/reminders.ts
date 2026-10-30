"use client";
import { useEffect, useState } from "react";
import { useCrm } from "./crm-store";
import { dueSummary } from "@/lib/crm/ics";
import { today } from "@/lib/crm/model";

const KEY = "growth-os-reminders";
const SHOWN = "growth-os-reminders-shown";
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
export const remindersSupported = () =>
  typeof window !== "undefined" && "Notification" in window;

export function useReminderSetting() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    queueMicrotask(() =>
      setEnabled(
        read(KEY) === "on" &&
          remindersSupported() &&
          Notification.permission === "granted",
      ),
    );
  }, []);
  async function toggle() {
    if (!remindersSupported())
      throw Error("Ta przeglądarka nie obsługuje powiadomień.");
    if (enabled) {
      write(KEY, "off");
      setEnabled(false);
      return false;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw Error(
        "Przeglądarka nie zezwoliła na powiadomienia. Zmień to w ustawieniach witryny.",
      );
    write(KEY, "on");
    setEnabled(true);
    return true;
  }
  return { enabled, toggle };
}

export function useReminders(
  active: boolean,
  label: string,
  workspace: string,
) {
  useEffect(() => {
    if (!active || !remindersSupported()) return;
    const check = () => {
      if (read(KEY) !== "on" || Notification.permission !== "granted") return;
      const day = today();
      const hour = Number(
        new Intl.DateTimeFormat("pl-PL", {
          hour: "numeric",
          hour12: false,
          timeZone: "Europe/Warsaw",
        }).format(new Date()),
      );
      const shown = `${SHOWN}:${workspace}`;
      if (hour < 8 || read(shown) === day) return;
      const due = dueSummary(useCrm.getState().tasks, day);
      if (!due.today && !due.overdue) return;
      new Notification(`${label}: plan na dziś`, {
        body: [
          due.today ? `Zadania na dziś: ${due.today}` : "",
          due.overdue ? `Zaległe: ${due.overdue}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        tag: `growth-os-${workspace}-${day}`,
      });
      write(shown, day);
    };
    const first = setTimeout(check, 4000);
    const timer = setInterval(check, 15 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active, label, workspace]);
}
