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
 * We ship `Content-Security-Policy-Report-Only` first so violations show in
 * DevTools/reporting without breaking the app. Flip to enforcing
 * `Content-Security-Policy` after the report noise is clean.
 *
 * Styles: Report-Only allows `'self'` only. React `style={...}` attributes may
 * report; if needed later, prefer hashes or a narrow `'unsafe-inline'` on
 * style-src only (never on script-src).
 *
 * PWA: `worker-src` / `manifest-src` `'self'` keep `/sw.js` and
 * `/manifest.json` allowed. Middleware matcher already skips those files so
 * they are not gated by auth.
 */

export const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
] as const;

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

/** Build a Report-Only CSP value with a per-request script nonce. */
export function buildCspReportOnly(nonce: string): string {
  const connectSrc = ["'self'", ...supabaseConnectSources(), "https://*.paddle.com"].join(" ");

  return [
    "default-src 'self'",
    // Nonce + strict-dynamic: no 'unsafe-inline' on scripts.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://*.paddle.com",
    // Service worker + any same-origin workers (Serwist).
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";
export const NONCE_HEADER = "x-nonce";
