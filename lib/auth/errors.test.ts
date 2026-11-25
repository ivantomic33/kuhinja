import { describe, expect, it } from "vitest";
import { authErrorMessage, zodFieldErrors } from "@/lib/auth/errors";
import { sr } from "@/lib/i18n/sr";

describe("authErrorMessage", () => {
  it("maps common auth failures", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe(
      sr.auth.errors.invalidCredentials,
    );
    expect(authErrorMessage("Email not confirmed")).toBe(
      sr.auth.errors.emailNotConfirmed,
    );
    expect(authErrorMessage("User already registered")).toBe(
      sr.auth.errors.emailTaken,
    );
    expect(authErrorMessage("Database error saving new user")).toBe(
      sr.auth.errors.databaseSignup,
    );
    expect(authErrorMessage("Signups not allowed for this instance")).toBe(
      sr.auth.errors.signupsDisabled,
    );
    expect(authErrorMessage("email rate limit exceeded")).toBe(
      sr.auth.errors.rateLimited,
    );
    expect(authErrorMessage("fetch failed")).toBe(sr.auth.errors.network);
  });

  it("falls back to generic", () => {
    expect(authErrorMessage(null)).toBe(sr.auth.errors.generic);
    expect(authErrorMessage("something odd")).toBe(sr.auth.errors.generic);
  });
});

describe("zodFieldErrors", () => {
  it("keeps the first message per field", () => {
    expect(
      zodFieldErrors([
        { path: ["email"], message: "a" },
        { path: ["email"], message: "b" },
        { path: ["password"], message: "c" },
      ]),
    ).toEqual({ email: "a", password: "c" });
  });
});
