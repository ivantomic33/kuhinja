import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("SITE_URL has no trailing slash when NEXT_PUBLIC_SITE_URL ends with /", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://treuplate.example/");
  vi.resetModules();
  const { SITE_URL } = await import("./site");
  expect(SITE_URL).toBe("https://treuplate.example");
  expect(SITE_URL.endsWith("/")).toBe(false);
});

it("SITE_URL falls back to http://https://dlztt72p-3000.euw.devtunnels.ms0 when the variable is unset", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
  vi.resetModules();
  const { SITE_URL } = await import("./site");
  expect(SITE_URL).toBe("http://https://dlztt72p-3000.euw.devtunnels.ms0");
});
