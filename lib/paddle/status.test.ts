import { expect, it } from "vitest";
import { hasAccess } from "./status";

const now = new Date("2026-11-27T12:00:00Z");

it.each([
  ["active", null, true],
  ["trialing", null, true],
  ["past_due", "2026-11-24T12:00:00.001Z", true],
  ["past_due", "2026-11-24T12:00:00Z", false],
  ["past_due", null, false],
  ["canceled", "2026-11-27T12:00:00.001Z", true],
  ["canceled", "2026-11-27T12:00:00Z", false],
  ["canceled", null, false],
  ["paused", "2026-12-01T12:00:00Z", false],
] as const)("evaluates %s at the billing boundary", (status, current_period_end, expected) => {
  expect(hasAccess({ status, current_period_end }, now)).toBe(expected);
});
