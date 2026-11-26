import { afterEach, expect, it, vi } from "vitest";
import { buildCsp } from "./csp";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("allows the configured Supabase origin on connect-src", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  const csp = buildCsp("abc123", true);
  expect(csp).toContain("connect-src");
  expect(csp).toContain("https://example.supabase.co");
  expect(csp).toContain("wss://example.supabase.co");
  expect(csp).toContain("https://*.paddle.com");
});

it("does not use unsafe-inline or unsafe-eval on scripts in production", () => {
  const csp = buildCsp("n0nce", true);
  expect(csp).toContain("script-src 'self' 'nonce-n0nce' 'strict-dynamic'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).toContain("upgrade-insecure-requests");
});

it("skips upgrade-insecure-requests outside production so local HTTP Supabase works", () => {
  const csp = buildCsp("n0nce", false);
  expect(csp).not.toContain("upgrade-insecure-requests");
  expect(csp).toContain("'unsafe-eval'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(csp).toContain("worker-src 'self'");
  expect(csp).toContain("font-src 'self'");
});
