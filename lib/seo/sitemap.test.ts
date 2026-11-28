import { afterEach, beforeEach, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { SITEMAP_PATHS } from "@/lib/auth/routes";

const origin = "https://treuplate.example";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin));
afterEach(() => vi.unstubAllEnvs());

it("lists public marketing, FAQ, and legal pages as absolute site URLs", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  expect(urls.some((url) => url === `${origin}/` || url === origin)).toBe(true);
  for (const path of SITEMAP_PATHS) {
    expect(urls).toContain(`${origin}${path}`);
  }
  expect(entries).toHaveLength(SITEMAP_PATHS.length);

  for (const url of urls) {
    expect(url.startsWith(origin)).toBe(true);
  }
});

it("gives every sitemap entry a Date lastModified", () => {
  const entries = sitemap();
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(entry.lastModified).toBeInstanceOf(Date);
  }
});
