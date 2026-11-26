import { afterEach, beforeEach, expect, it, vi } from "vitest";
import robots from "@/app/robots";

const origin = "https://treuplate.example";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin));
afterEach(() => vi.unstubAllEnvs());

it("disallows private app, api, and auth paths", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  const disallow = rules?.disallow;
  const blocked = Array.isArray(disallow) ? disallow : disallow ? [disallow] : [];

  for (const path of ["/dashboard", "/ingredients", "/recipes", "/settings", "/api/", "/auth/"]) {
    expect(blocked).toContain(path);
  }
});

it("allows the site root", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  expect(rules?.allow).toBe("/");
});

it("points the sitemap entry at sitemap.xml under the site origin", () => {
  const result = robots();
  expect(result.sitemap).toBe(`${origin}/sitemap.xml`);
  expect(String(result.sitemap).endsWith("/sitemap.xml")).toBe(true);
});
