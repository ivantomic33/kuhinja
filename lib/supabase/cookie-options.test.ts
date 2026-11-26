import { afterEach, expect, it, vi } from "vitest";
import {
  getBrowserCookieOptions,
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "./cookie-options";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("keeps the session cookie readable by the browser client", () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(getSupabaseCookieOptions()).toMatchObject({
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: false,
  });
  expect(getBrowserCookieOptions()).toEqual(getSupabaseCookieOptions());
  expect(mergeSupabaseCookieOptions({ httpOnly: true }).httpOnly).toBe(false);
});

it("sets secure: true in production (NODE_ENV=production)", () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(getSupabaseCookieOptions().secure).toBe(true);
  expect(mergeSupabaseCookieOptions({ secure: false }).secure).toBe(true);
  expect(getBrowserCookieOptions().secure).toBe(true);
});

it("keeps path, maxAge, secure, and sameSite when merging a redirect cookie", () => {
  vi.stubEnv("NODE_ENV", "production");
  const original = {
    path: "/",
    maxAge: 3600,
    secure: true,
    sameSite: "lax" as const,
  };
  expect(mergeSupabaseCookieOptions(original)).toMatchObject({
    ...original,
    httpOnly: false,
  });
});
