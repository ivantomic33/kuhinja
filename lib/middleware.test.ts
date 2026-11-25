import { NextRequest, NextResponse } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isPublicPath } from "@/lib/auth/routes";
import { config, middleware } from "@/middleware";

const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/supabase/middleware", () => ({ updateSession }));
vi.mock("@/lib/security/csp", () => ({
  buildCspReportOnly: () => "csp-test",
  createCspNonce: () => "test-nonce",
  CSP_REPORT_ONLY_HEADER: "Content-Security-Policy-Report-Only",
  NONCE_HEADER: "x-nonce",
}));

const publicPaths = [
  "/", "/login", "/register", "/forgot-password", "/reset-password", "/auth/callback",
  "/r/", "/r/token", "/premium", "/faq", "/pravila-koriscenja", "/privatnost",
  "/povracaj-novca", "/robots.txt", "/sitemap.xml",
];

const protectedPaths = [
  "/dashboard", "/ingredients", "/recipes", "/recipes/1", "/raspored", "/trebovanje",
  "/shift", "/shift/1", "/scaler", "/scaler/1", "/settings", "/settings/billing",
  "/api/versioned-update", "/dummy-new-page", "/private.png", "/premium/upravljanje", "/faq/new",
  "/privatnost/draft", "/pravila-koriscenja/draft", "/povracaj-novca/draft",
  "/auth/callback-extra", "/auth/callback/extra", "/recipe-token", "/r-extra/one",
];

function request(path: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(new URL(path, "https://treuplate.test"), init);
}

const cookie = "sb-localhost-auth-token.0=session-value";

beforeEach(() => updateSession.mockReset());
afterEach(() => vi.unstubAllEnvs());

it.each(publicPaths)("allows %s anonymously without requesting Auth", async (path) => {
  expect(isPublicPath(path)).toBe(true);
  expect((await middleware(request(path))).headers.get("location")).toBeNull();
  expect(updateSession).not.toHaveBeenCalled();
});

it.each(protectedPaths)("requires a session for %s by default", async (path) => {
  expect(isPublicPath(path)).toBe(false);
  expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(true);
  const response = await middleware(request(path));
  const location = new URL(response.headers.get("location")!);
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.get("next")).toBe(path);
  expect(updateSession).not.toHaveBeenCalled();
});

it.each(["/~offline", "/sw.js", "/swe-worker-abc.js", "/manifest.json", "/icons/icon-v3.svg", "/opengraph-image", "/twitter-image", "/_next/static/a.js", "/_next/image"])(
  "excludes the infrastructure resource %s from session middleware",
  (path) => expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(false)
);

it("verifies HTML and preserves refreshed cookie attributes on redirects", async () => {
  const response = NextResponse.next();
  response.cookies.set("sb-localhost-auth-token.0", "refreshed", {
    path: "/", secure: true, httpOnly: true, sameSite: "lax",
  });
  updateSession.mockResolvedValue({ supabaseResponse: response, user: { id: "user-1" } });
  const redirect = await middleware(request("/login", { headers: { cookie, accept: "text/html" } }));
  expect(new URL(redirect.headers.get("location")!).pathname).toBe("/dashboard");
  expect(redirect.cookies.get("sb-localhost-auth-token.0")).toMatchObject({
    value: "refreshed", secure: true, httpOnly: true, sameSite: "lax",
  });
  expect(updateSession).toHaveBeenCalledOnce();
});

it("redirects a protected document when its session cookie fails verification", async () => {
  updateSession.mockResolvedValue({ supabaseResponse: NextResponse.next(), user: null });
  const response = await middleware(request("/dashboard", { headers: { cookie, "sec-fetch-dest": "document" } }));
  expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  expect(updateSession).toHaveBeenCalledOnce();
});

it.each([
  ["/dashboard", "POST", "text/html"],
  ["/dashboard", "GET", "text/x-component"],
  ["/dashboard", "GET", "application/json"],
  ["/api/versioned-update", "GET", "text/html"],
  ["/auth/callback", "GET", "text/html"],
  ["/robots.txt", "GET", "text/html"],
  ["/sitemap.xml", "GET", "text/html"],
])("delegates %s %s %s to the app without requesting Auth in middleware", async (path, method, accept) => {
  expect((await middleware(request(path, { method, headers: { cookie, accept } }))).headers.get("location")).toBeNull();
  expect(updateSession).not.toHaveBeenCalled();
});

it("advertises the configured Supabase project only from a staging deployment", async () => {
  const project = "abcdefghijklmnopqrst";
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${project}.supabase.co`);
  vi.stubEnv("TREUPLATE_DEPLOYMENT", "production");
  expect((await middleware(request("/login"))).headers.has("x-treuplate-environment")).toBe(false);

  vi.stubEnv("TREUPLATE_DEPLOYMENT", "staging");
  const headers = (await middleware(request("/login"))).headers;
  expect(headers.get("x-treuplate-environment")).toBe("staging");
  expect(headers.get("x-treuplate-supabase-project")).toBe(project);
});
