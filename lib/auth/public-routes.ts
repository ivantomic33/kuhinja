/**
 * Explicit allow-list for middleware (default-deny).
 * Anything not matched here requires a session.
 */
const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/premium",
  "/opengraph-image",
  "/twitter-image",
  "/~offline",
]);

/** Logged-in users are sent to /dashboard from these entry points. */
export const AUTH_ENTRY_ROUTES = new Set(["/", "/login", "/register"]);

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Public paths: marketing, auth forms, premium pricing, share links,
 * offline fallback, and Supabase auth callback.
 */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (matchesPrefix(pathname, "/premium")) return true;
  if (matchesPrefix(pathname, "/r")) return true;
  if (matchesPrefix(pathname, "/auth/callback")) return true;
  if (matchesPrefix(pathname, "/~offline")) return true;
  return false;
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_ROUTES.has(pathname);
}
