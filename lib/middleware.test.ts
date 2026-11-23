import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateSession = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (...args: unknown[]) => updateSession(...args),
}));

vi.mock("@/lib/security/csp", () => ({
  buildCspReportOnly: () => "csp-test",
  createCspNonce: () => "test-nonce",
  CSP_REPORT_ONLY_HEADER: "Content-Security-Policy-Report-Only",
  NONCE_HEADER: "x-nonce",
}));

import { isPublicPath } from "@/lib/auth/public-routes";
import { middleware } from "@/middleware";

function makeRequest(path: string, cookieHeader?: string) {
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

function authCookieHeader(value = "session-value") {
  return `sb-localhost-auth-token=${value}`;
}

beforeEach(() => {
  updateSession.mockReset();
});

describe("isPublicPath (default-deny allow-list)", () => {
  it("allows explicit public routes and prefixes", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/premium")).toBe(true);
    expect(isPublicPath("/opengraph-image")).toBe(true);
    expect(isPublicPath("/twitter-image")).toBe(true);
    expect(isPublicPath("/r/share-token")).toBe(true);
    expect(isPublicPath("/~offline")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("denies unknown app routes by default", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/recipes")).toBe(false);
    expect(isPublicPath("/dummy-new-page")).toBe(false);
  });
});

describe("middleware", () => {
  it("allows anonymous users on a public route", async () => {
    const response = await middleware(makeRequest("/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("redirects anonymous users on a protected route with next=", async () => {
    const response = await middleware(makeRequest("/dashboard"));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("redirects logged-in users away from /login to /dashboard", async () => {
    const session = NextResponse.next();
    session.cookies.set("sb-localhost-auth-token", "refreshed");
    updateSession.mockResolvedValue({
      supabaseResponse: session,
      user: { id: "user-1" },
    });

    const response = await middleware(
      makeRequest("/login", authCookieHeader()),
    );

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/dashboard");
    expect(location.search).toBe("");
    // Session cookies are copied onto the redirect response.
    expect(response.cookies.get("sb-localhost-auth-token")?.value).toBe(
      "refreshed",
    );
  });

  it("allows anonymous users on /r/x share links", async () => {
    const response = await middleware(makeRequest("/r/x"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("redirects anonymous users when a dummy app path is not public", async () => {
    const response = await middleware(makeRequest("/brand-new-page"));

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/brand-new-page");
  });
});
