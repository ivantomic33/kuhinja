/**
 * Explicit allow-list for middleware (default-deny).
 * Anything not matched here requires a session.
 *
 * Canonical module for public routing. Prefer importing from here.
 *
 * Access classes:
 * - public — anyone (signed in or out)
 * - guest  — signed-out only (signed-in users go to /dashboard)
 * - auth   — signed-in only
 */

export type RouteAccess = "public" | "guest" | "auth";

const EXACT_ROUTES: Record<string, RouteAccess> = {
  "/": "guest",
  "/login": "guest",
  "/register": "guest",
  "/forgot-password": "guest",
  "/reset-password": "public",
  "/checkout": "public",
  "/premium": "public",
  "/kako-poceti": "public",
  "/welcome": "public",
  "/faq": "public",
  "/pravila-koriscenja": "public",
  "/privatnost": "public",
  "/povracaj-novca": "public",
  "/auth/callback": "public",
  "/auth/legal-consent": "auth",
  "/robots.txt": "public",
  "/sitemap.xml": "public",
  "/~offline": "public",
  "/dashboard": "auth",
  "/allergens/print": "auth",
  "/ingredients": "auth",
  "/notifications": "auth",
  "/otpad": "auth",
  "/premium/ponuda": "auth",
  "/premium/upravljanje": "auth",
  "/purchase-orders": "auth",
  "/raspored": "auth",
  "/recipes": "auth",
  "/scaler": "auth",
  "/settings": "auth",
  "/settings/billing": "auth",
  "/settings/tim": "auth",
  "/shift": "auth",
  "/trebovanje": "auth",
};

const PREFIX_ROUTES: Array<{ prefix: string; access: RouteAccess }> = [
  { prefix: "/r/", access: "public" },
  { prefix: "/invite/", access: "public" },
  { prefix: "/purchase-orders/", access: "auth" },
  { prefix: "/recipes/", access: "auth" },
  { prefix: "/scaler/", access: "auth" },
  { prefix: "/shift/", access: "auth" },
  { prefix: "/settings/", access: "auth" },
  { prefix: "/premium/", access: "auth" },
  { prefix: "/api/", access: "auth" },
];

function normalizePath(pathname: string): string {
  const noQuery = pathname.split("?")[0] ?? pathname;
  if (noQuery.length > 1 && noQuery.endsWith("/")) return noQuery.slice(0, -1);
  return noQuery || "/";
}

/** Classify a URL pathname or an App Router page path such as `/recipes/[id]`. */
export function classifyRoute(pathname: string): RouteAccess | null {
  const path = normalizePath(pathname);
  if (EXACT_ROUTES[path]) return EXACT_ROUTES[path];
  for (const { prefix, access } of PREFIX_ROUTES) {
    if (path.startsWith(prefix) || `${path}/` === prefix) return access;
  }
  return null;
}

/** Logged-in users are sent to /dashboard from these entry points. */
export const AUTH_ENTRY_ROUTES = new Set(
  Object.entries(EXACT_ROUTES)
    .filter(([, access]) => access === "guest")
    .map(([path]) => path),
);

export function isPublicPath(pathname: string): boolean {
  const access = classifyRoute(pathname);
  return access === "public" || access === "guest";
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_ROUTES.has(normalizePath(pathname));
}

export function isGuestPath(pathname: string): boolean {
  return classifyRoute(pathname) === "guest";
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
