import { expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

it("rejects an absolute https URL", () => {
  expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
});

it("rejects a protocol-relative URL", () => {
  expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
  expect(safeRedirectPath("///evil.example")).toBe("/dashboard");
});

it("rejects backslash and encoded-slash open redirects", () => {
  expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
  expect(safeRedirectPath("/%2f%2fevil.example")).toBe("/dashboard");
  expect(safeRedirectPath("/%5cevil.example")).toBe("/dashboard");
  expect(safeRedirectPath("/dashboard\n/../evil")).toBe("/dashboard");
});

it("allows a same-origin relative path", () => {
  expect(safeRedirectPath("/ingredients")).toBe("/ingredients");
});

it("keeps checkout and consent query strings", () => {
  expect(safeRedirectPath("/checkout?plan_key=pro&interval=month")).toBe(
    "/checkout?plan_key=pro&interval=month",
  );
  expect(safeRedirectPath("/login?consent=retry")).toBe("/login?consent=retry");
});
