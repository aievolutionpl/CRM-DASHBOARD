"use client";
type Sync = { workspace: string; flush: () => Promise<void> };
let current: Sync | null = null;

export function registerSync(sync: Sync) {
  current = sync;
  return () => {
    if (current === sync) current = null;
  };
}

export function activeWorkspace() {
  return current?.workspace ?? null;
}

export function assertWorkspace(workspace: string) {
  if (activeWorkspace() !== workspace)
    throw Error(
      "Przestrzeń została zmieniona w trakcie operacji. Otwórz ją ponownie i powtórz akcję.",
    );
}

export async function flushWorkspace(workspace: string) {
  assertWorkspace(workspace);
  await current!.flush();
  assertWorkspace(workspace);
}
