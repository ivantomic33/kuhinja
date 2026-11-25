/**
 * Analytics gate — no third-party analytics ship by default.
 * When enabled later, the banner must collect consent before any load.
 */

export const ANALYTICS_ENABLED = false;

export const ANALYTICS_CONSENT_STORAGE_KEY = "treuplate.analytics-consent";

export type AnalyticsConsent = "accepted" | "rejected" | null;

export function readAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (value === "accepted" || value === "rejected") return value;
  } catch {
    // private mode / blocked storage
  }
  return null;
}

export function writeAnalyticsConsent(value: "accepted" | "rejected"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

/** Call sites must no-op unless analytics is enabled and consent is accepted. */
export function canLoadAnalytics(): boolean {
  if (!ANALYTICS_ENABLED) return false;
  return readAnalyticsConsent() === "accepted";
}
