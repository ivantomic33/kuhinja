/**
 * Only same-origin relative paths — block open redirects.
 * Rejects protocol-relative (`//evil`), backslash, and encoded-slash tricks.
 * Query strings stay allowed so checkout return paths keep working.
 */
const BASE = "https://treuplate.invalid";
const UNSAFE = /[\u0000-\u001F\u007F\\]|%2f|%5c|[\u2215\u2044\uFF0F\uFF3C]/i;

export function safeRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 500) return fallback;
  if (next !== next.trim() || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (UNSAFE.test(next) || next.includes("://")) return fallback;

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE || url.username || url.password) return fallback;

  const safe = `${url.pathname}${url.search}${url.hash}`;
  if (!safe.startsWith("/") || safe.startsWith("//") || UNSAFE.test(safe) || safe.includes("://")) {
    return fallback;
  }
  return safe;
}
