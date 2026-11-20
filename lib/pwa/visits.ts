const VISIT_KEY = "mise.pwa.visitCount";
const DISMISS_KEY = "mise.pwa.installHintDismissed";

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Increment and return visit count (once per browser session tab load). */
export function bumpVisitCount(): number {
  const storage = safeStorage();
  if (!storage) return 0;
  const current = Number(storage.getItem(VISIT_KEY) ?? "0") || 0;
  const next = current + 1;
  storage.setItem(VISIT_KEY, String(next));
  return next;
}

export function getVisitCount(): number {
  const storage = safeStorage();
  if (!storage) return 0;
  return Number(storage.getItem(VISIT_KEY) ?? "0") || 0;
}

export function isInstallHintDismissed(): boolean {
  const storage = safeStorage();
  if (!storage) return true;
  return storage.getItem(DISMISS_KEY) === "1";
}

export function dismissInstallHint(): void {
  const storage = safeStorage();
  if (!storage) return;
  storage.setItem(DISMISS_KEY, "1");
}
