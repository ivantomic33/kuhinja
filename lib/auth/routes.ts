/**
 * Explicit allow-list for middleware (default-deny).
 * Anything not matched here requires a session.
 *
 * Canonical module for public routing. Prefer importing from here.
 */

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/checkout",
  "/premium", // The management subroute requires a session by default.
  "/kako-poceti",
  "/welcome",
  "/faq",
  "/pravila-koriscenja",
  "/privatnost",
  "/povracaj-novca",
  "/auth/callback",
  "/robots.txt",
  "/sitemap.xml",
]);

/** Logged-in users are sent to /dashboard from these entry points. */
export const AUTH_ENTRY_ROUTES = new Set(["/", "/login", "/register"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || pathname.startsWith("/r/");
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_ROUTES.has(pathname);
}

/**
 * Document navigations (HTML) should refresh/verify the session in middleware.
 * Server actions and non-document fetches authorize themselves per request.
 */
export function isHtmlNavigation(request: {
  method: string;
  headers: { get(name: string): string | null };
}): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const accept = request.headers.get("accept") ?? "";
  if (request.headers.get("rsc") === "1" || accept.includes("text/x-component")) return false;
  const destination = request.headers.get("sec-fetch-dest");
  return destination === "document" || destination === "iframe" ||
    accept.split(",").some((type) => type.split(";")[0].trim() === "text/html");
}
