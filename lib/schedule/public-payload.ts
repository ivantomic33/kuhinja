import { z } from "zod";
import type { PublicSchedule } from "./types";

/**
 * Fields allowed on the anonymous /r/[token] payload.
 * Anything else (prices, rates, venue/location ids, notes, supplier, margin…)
 * must never appear in HTML or JSON for a public share page.
 */
export const PUBLIC_SCHEDULE_ROOT_KEYS = [
  "venueName",
  "monday",
  "employees",
  "assignments",
] as const;

export const PUBLIC_EMPLOYEE_KEYS = ["id", "full_name"] as const;
export const PUBLIC_ASSIGNMENT_KEYS = [
  "employee_id",
  "date",
  "code",
  "custom_start",
  "custom_end",
] as const;

/** Substrings that must never appear as keys in a public share payload. */
export const PUBLIC_SHARE_FORBIDDEN_KEY_PATTERN =
  /(price|cost|margin|supplier|note|hourly|rate|venue_id|location_id|login_email|role|owner)/i;

const shiftCode = z.enum(["J", "P", "N", "D", "X", "O", "B", "G"]);

const publicEmployeeSchema = z
  .object({
    id: z.string().min(1).max(80),
    full_name: z.string().min(1).max(120),
  })
  .strict();

const publicAssignmentSchema = z
  .object({
    employee_id: z.string().min(1).max(80),
    date: z.string().date(),
    code: shiftCode,
    custom_start: z.string().nullable(),
    custom_end: z.string().nullable(),
  })
  .strict();

export const publicScheduleSchema = z
  .object({
    venueName: z.string().min(1).max(120),
    monday: z.string().date(),
    employees: z.array(publicEmployeeSchema),
    assignments: z.array(publicAssignmentSchema),
  })
  .strict();

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

/** True when any object key looks like internal business / cost data. */
export function publicShareHasForbiddenKeys(value: unknown): boolean {
  for (const key of collectKeys(value)) {
    if (PUBLIC_SHARE_FORBIDDEN_KEY_PATTERN.test(key)) return true;
  }
  return false;
}

/**
 * Parse RPC JSON into the public whitelist. Returns null when the payload is
 * missing, malformed, or contains forbidden business fields.
 */
export function parsePublicSchedule(data: unknown): PublicSchedule | null {
  if (data == null) return null;
  if (publicShareHasForbiddenKeys(data)) return null;
  const parsed = publicScheduleSchema.safeParse(data);
  if (!parsed.success) return null;
  return parsed.data;
}

/** Stable JSON used by tests and defense-in-depth checks on rendered output. */
export function publicScheduleJson(schedule: PublicSchedule): string {
  return JSON.stringify(schedule);
}
