import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { classifyRoute, isHtmlNavigation } from "@/lib/auth/routes";
import {
  buildCsp,
  createCspNonce,
  CSP_HEADER,
  NONCE_HEADER,
} from "@/lib/security/csp";
import { applySecurityHeaders } from "@/lib/security/headers";
import { updateSession } from "@/lib/supabase/middleware";

/** Supabase session cookies, including chunked `auth-token.0` names. */
function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(
    (cookie) =>
      /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name),
  );
}

function copySessionCookies(
  response: NextResponse,
  session: NextResponse,
) {
  session.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

function loginRedirectUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  const next = safeRedirectPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", next);
  return url;
}

function routeAccess(pathname: string) {
  const access = classifyRoute(pathname);
  if (access) return access;
  if (process.env.NODE_ENV === "development") {
    console.warn(`[middleware] Unclassified route "${pathname}"; treating as auth`);
  }
  return "auth" as const;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const access = routeAccess(pathname);

  // Per-request nonce for Next.js inline scripts (see lib/security/csp.ts).
  const nonce = createCspNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  const cspValue = buildCsp(nonce);
  requestHeaders.set(CSP_HEADER, cspValue);

  const finish = (response: NextResponse) => {
    applySecurityHeaders(response.headers, cspValue);
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
    if (access === "public" || access === "guest") return next();
    return finish(NextResponse.redirect(loginRedirectUrl(request)));
  }

  // Premium has separate guest and account trees for both HTML and Flight.
  const premiumOffer = pathname === "/premium";
  const htmlNavigation = isHtmlNavigation(request);
  // Public HTML, APIs, and Flight requests authorize themselves per request.
  if (
    pathname.startsWith("/api/") ||
    (access === "public" && !premiumOffer) ||
    (!premiumOffer && !htmlNavigation)
  ) {
    return next();
  }

  const { supabaseResponse, user } = await updateSession(
    request,
    requestHeaders,
    htmlNavigation ? "user" : "claims",
  );

  // Default-deny: unclassified and auth HTML routes need a verified session.
  if (!user && access === "auth") {
    return finish(copySessionCookies(NextResponse.redirect(loginRedirectUrl(request)), supabaseResponse));
  }

  if (user && access === "guest") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return finish(copySessionCookies(NextResponse.redirect(url), supabaseResponse));
  }

  if (user && premiumOffer) {
    const url = request.nextUrl.clone();
    url.pathname = "/premium/ponuda";
    const rewrite = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    return finish(copySessionCookies(rewrite, supabaseResponse));
  }

  return finish(supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, images, and PWA files.
     * sw.js, swe-worker.js, swe-worker-*.js, manifest.json, and icons stay
     * excluded so they load without a session check.
     */
    "/((?!_next/(?:static|image)(?:/|$)|(?:favicon\\.ico|sw\\.js|swe-worker(?:-[^/]+)?\\.js|manifest\\.json|~offline|opengraph-image|twitter-image)$|icons/|landing/).*)",
  ],
};
