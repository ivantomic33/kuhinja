import type { CookieOptions } from "@supabase/ssr";

/**
 * Session cookie attributes for `createServerClient` (middleware + server).
 *
 * httpOnly must stay off. `@supabase/ssr` `createBrowserClient` reads and
 * refreshes the session through `document.cookie`. An httpOnly auth cookie
 * hides the JWT from that client and breaks realtime plus browser mutations.
 * XSS exposure is limited by the enforcing CSP, SameSite=Lax, and Secure in
 * production — not by hiding a cookie the browser client is required to read.
 */
export function getSupabaseCookieOptions(): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Same attributes as the server so browser writes do not fight a refresh. */
export function getBrowserCookieOptions(): CookieOptions {
  return getSupabaseCookieOptions();
}

/** Merge Supabase-provided options with the required session attributes. */
export function mergeSupabaseCookieOptions(options?: CookieOptions): CookieOptions {
  const defaults = getSupabaseCookieOptions();
  return {
    ...options,
    path: options?.path ?? defaults.path,
    sameSite: options?.sameSite ?? defaults.sameSite,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production" ? true : Boolean(options?.secure),
  };
}
