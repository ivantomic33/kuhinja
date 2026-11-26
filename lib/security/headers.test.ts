import { afterEach, expect, it, vi } from "vitest";
import { applySecurityHeaders, getSecurityHeaders, isProductionEnv } from "./headers";

afterEach(() => {
  vi.unstubAllEnvs();
});

const required = [
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
];

it("includes all hardening headers plus HSTS in production", () => {
  const headers = getSecurityHeaders(true);
  for (const key of required) {
    expect(headers.some((header) => header.key === key)).toBe(true);
  }
  expect(headers.find((header) => header.key === "Strict-Transport-Security")?.value)
    .toContain("max-age=63072000");
  expect(headers.find((header) => header.key === "X-Frame-Options")?.value).toBe("DENY");
  expect(headers.find((header) => header.key === "X-Content-Type-Options")?.value).toBe("nosniff");
  expect(headers.find((header) => header.key === "Referrer-Policy")?.value)
    .toBe("strict-origin-when-cross-origin");
  expect(headers.find((header) => header.key === "Permissions-Policy")?.value)
    .toBe("camera=(), microphone=(), geolocation=()");
});

it("omits HSTS in development", () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(isProductionEnv()).toBe(false);
  expect(getSecurityHeaders(false).some((header) => header.key === "Strict-Transport-Security")).toBe(false);

  const response = new Headers();
  applySecurityHeaders(response, "default-src 'self'", false);
  expect(response.get("content-security-policy")).toBe("default-src 'self'");
  expect(response.get("strict-transport-security")).toBeNull();
  expect(response.get("x-frame-options")).toBe("DENY");
  expect(response.get("x-content-type-options")).toBe("nosniff");
  expect(response.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(response.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
});

it("sets CSP in enforce mode and HSTS when production is true", () => {
  const response = new Headers();
  applySecurityHeaders(response, "default-src 'self'", true);
  expect(response.get("content-security-policy")).toBe("default-src 'self'");
  expect(response.has("content-security-policy-report-only")).toBe(false);
  expect(response.get("strict-transport-security")).toContain("max-age=");
});
