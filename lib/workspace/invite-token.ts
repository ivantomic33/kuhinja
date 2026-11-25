import { createHash, randomBytes } from "node:crypto";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Opaque invite token (base64url) — shown once in email, never stored raw. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function inviteExpiresAt(from = Date.now()): Date {
  return new Date(from + INVITE_TTL_MS);
}

export function isInviteExpired(expiresAt: string | Date, now = Date.now()): boolean {
  const ts = typeof expiresAt === "string" ? Date.parse(expiresAt) : expiresAt.getTime();
  return !Number.isFinite(ts) || ts <= now;
}

export const INVITE_GENERIC_ERROR =
  "Pozivnica nije važeća ili je istekla.";

export { INVITE_TTL_MS };
