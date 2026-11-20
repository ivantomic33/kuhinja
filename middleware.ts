import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
]);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/settings",
  "/ingredients",
  "/recipes",
  "/scaler",
  "/shift",
  "/premium",
  "/trebovanje",
  "/raspored",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Supabase session cookies, including chunked `auth-token.0` names. */
function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(
    (cookie) =>
      cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")
  );
}

function redirectWithSession(url: URL, session: NextResponse) {
  const redirect = NextResponse.redirect(url);
  session.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value);
  });
  return redirect;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/r/")) return NextResponse.next();

  // First visits and crawlers have no session. Skip the Supabase round trip.
  if (!hasSupabaseAuthCookie(request)) {
    if (!isProtectedPath(pathname)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { supabaseResponse, user } = await updateSession(request);

  if (isProtectedPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectWithSession(url, supabaseResponse);
  }

  if (user && (pathname === "/" || AUTH_ROUTES.has(pathname))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectWithSession(url, supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, images, and PWA files.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|swe-worker|manifest.json|icons/|~offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|webmanifest)$).*)",
  ],
};
