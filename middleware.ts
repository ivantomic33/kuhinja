import { NextResponse, type NextRequest } from "next/server";
import {
  isAuthEntryPath,
  isHtmlNavigation,
  isPublicPath,
} from "@/lib/auth/routes";
import {
  buildCspReportOnly,
  createCspNonce,
  CSP_REPORT_ONLY_HEADER,
  NONCE_HEADER,
} from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/middleware";

/** Supabase session cookies, including chunked `auth-token.0` names. */
function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(
    (cookie) =>
      /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name),
  );
}

function redirectWithSession(
  url: URL,
  session: NextResponse,
  cspValue: string,
) {
  const redirect = NextResponse.redirect(url);
  session.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  redirect.headers.set(CSP_REPORT_ONLY_HEADER, cspValue);
  return redirect;
}

function loginRedirectUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicRoute = isPublicPath(pathname);

  // Per-request nonce for Next.js inline scripts (see lib/security/csp.ts).
  const nonce = createCspNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  const cspValue = buildCspReportOnly(nonce);

  const finish = (response: NextResponse) => {
    response.headers.set(CSP_REPORT_ONLY_HEADER, cspValue);
    if (pathname === "/login" && process.env.TREUPLATE_DEPLOYMENT === "staging") {
      const project = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
        /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/,
      )?.[1];
      if (project) {
        response.headers.set("X-TreuPlate-Environment", "staging");
        response.headers.set("X-TreuPlate-Supabase-Project", project);
      }
    }
    return response;
  };

  const next = () =>
    finish(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
    );

  // First visits and crawlers have no session. Skip the Supabase round trip.
  if (!hasSupabaseAuthCookie(request)) {
    if (publicRoute) return next();
    return finish(NextResponse.redirect(loginRedirectUrl(request)));
  }

  // Route handlers and Flight requests verify their own session.
  if (
    pathname.startsWith("/api/") || pathname === "/auth/callback" ||
    pathname === "/robots.txt" || pathname === "/sitemap.xml" || !isHtmlNavigation(request)
  ) {
    return next();
  }

  const { supabaseResponse, user } = await updateSession(
    request,
    requestHeaders,
  );

  // Default-deny: every non-public HTML route needs a verified session user.
  if (!user && !publicRoute) {
    return redirectWithSession(
      loginRedirectUrl(request),
      supabaseResponse,
      cspValue,
    );
  }

  if (user && isAuthEntryPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectWithSession(url, supabaseResponse, cspValue);
  }

  return finish(supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, images, and PWA files.
     * sw.js + manifest.json stay excluded so the service worker and manifest
     * keep loading without auth/CSP middleware interference.
     */
    "/((?!_next/(?:static|image)(?:/|$)|(?:favicon\\.ico|sw\\.js|swe-worker(?:-[^/]+)?\\.js|manifest\\.json|~offline|opengraph-image|twitter-image)$|icons/|landing/).*)",
  ],
};
