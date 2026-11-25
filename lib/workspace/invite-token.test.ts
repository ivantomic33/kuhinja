import { describe, expect, it } from "vitest";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
  isInviteExpired,
  INVITE_TTL_MS,
} from "./invite-token";

describe("invite tokens", () => {
  it("hashes differ from the raw token", () => {
    const token = generateInviteToken();
    const hash = hashInviteToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
    expect(hashInviteToken(token)).toBe(hash);
  });

  it("expires after 7 days + 1 second", () => {
    const start = Date.parse("2026-12-01T00:00:00.000Z");
    const expires = inviteExpiresAt(start);
    expect(expires.getTime()).toBe(start + INVITE_TTL_MS);
    expect(isInviteExpired(expires, start + INVITE_TTL_MS - 1)).toBe(false);
    expect(isInviteExpired(expires, start + INVITE_TTL_MS + 1000)).toBe(true);
  });

  it("generates unique base64url tokens", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
