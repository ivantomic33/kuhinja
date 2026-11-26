import { afterEach, beforeEach, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";

const origin = "https://treuplate.example";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin));
afterEach(() => vi.unstubAllEnvs());

it("lists home, premium, and kako-poceti as absolute site URLs", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  expect(urls.some((url) => url === `${origin}/` || url === origin)).toBe(true);
  expect(urls).toContain(`${origin}/premium`);
  expect(urls).toContain(`${origin}/kako-poceti`);

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
