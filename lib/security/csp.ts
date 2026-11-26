/**
 * Content-Security-Policy helpers.
 *
 * Trade-off (Next.js inline scripts):
 * Next.js injects small inline bootstrap/hydration scripts. A static
 * `script-src 'self'` policy would flag or block them. Options:
 * 1. `'unsafe-inline'` — simple, but weakens XSS protection for scripts.
 * 2. Per-request nonce + `'strict-dynamic'` (chosen) — keeps scripts locked
 *    down; nonce must be generated in middleware (not next.config headers),
 *    because a fixed nonce in config would be reusable by attackers.
 *
 * Enforcing `Content-Security-Policy` (not Report-Only). Next.js applies the
 * request nonce to its own inline scripts when the CSP header is forwarded
 * on the request.
 *
 * Styles: `style-src` uses the same nonce for `<style>` tags (next/font).
 * React `style={...}` attributes use `style-src-attr 'unsafe-inline'` only —
 * never on script-src.
 *
 * Fonts: `next/font/google` self-hosts Inter under `/_next/static/media`,
 * so `font-src 'self'` is enough (no fonts.googleapis.com).
 *
 * PWA: `worker-src` / `manifest-src` `'self'` keep `/sw.js` and
 * `/manifest.json` allowed. Middleware matcher already skips those files so
 * they are not gated by auth.
 */

import { getSecurityHeaders } from "./headers";

/** @deprecated Use getSecurityHeaders() — HSTS is production-only. */
export const SECURITY_HEADERS = getSecurityHeaders();

export function createCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function supabaseConnectSources(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  if (!raw) return [];

  try {
    const httpsUrl = new URL(raw);
    const wsUrl = new URL(raw);
    wsUrl.protocol = httpsUrl.protocol === "https:" ? "wss:" : "ws:";
    return [httpsUrl.origin, wsUrl.origin];
  } catch {
    return [raw];
  }
}

/** Build an enforcing CSP value with a per-request script nonce. */
export function buildCsp(
  nonce: string,
  production = process.env.NODE_ENV === "production",
): string {
  const connectSrc = ["'self'", ...supabaseConnectSources(), "https://*.paddle.com"].join(" ");

  const directives = [
    "default-src 'self'",
    // Nonce + strict-dynamic. No 'unsafe-inline'. 'unsafe-eval' is dev-only
    // so Turbopack / React Refresh can run; production scripts stay locked.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://*.paddle.com",
    // Service worker + any same-origin workers (Serwist).
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (production) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** @deprecated Use buildCsp — CSP is now enforcing. */
export function buildCspReportOnly(nonce: string): string {
  return buildCsp(nonce);
}

export const CSP_HEADER = "Content-Security-Policy";
export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";
export const NONCE_HEADER = "x-nonce";
