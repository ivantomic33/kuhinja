import {
  actionError,
  requireActionUser,
  type ActionUserContext,
} from "@/lib/server/action";
import { createClient, getServerUser } from "@/lib/supabase/server";
import { z } from "zod";
import { parsePublicSchedule } from "./public-payload";
import type { Assignment, Employee, PublicSchedule, ScheduleWeek } from "./types";

const uuid = z.string().uuid();
const date = z.string().date();

/**
 * Load the caller's schedule week with a verified read-session.
 * Ownership is enforced inside the security-definer RPC via auth.uid().
 */
export async function loadSchedule(
  location?: string,
  week?: string
): Promise<ScheduleWeek | null> {
  const [supabase, user] = await Promise.all([createClient(), getServerUser()]);
  if (!user) {
    throw Object.assign(new Error("Authentication required."), {
      code: "UNAUTHORIZED",
      status: 401,
    });
  }

  const { data, error } = await supabase.rpc("schedule_load", {
    p_location: uuid.safeParse(location).data ?? null,
    p_week: date.safeParse(week).data ?? null,
  });
  if (error) throw error;
  return data as ScheduleWeek | null;
}

/**
 * Public share link — no session required. Token is the only capability.
 * Payload is forced through the public whitelist (no prices/costs/venue ids).
 * Revoked or unknown tokens yield null → /r/[token] renders 404.
 */
export async function loadPublicSchedule(
  token: string
): Promise<PublicSchedule | null> {
  if (!uuid.safeParse(token).success) return null;
  const client = await createClient();
  const { data, error } = await client.rpc("schedule_public", {
    p_token: token,
  });
  if (error) throw error;
  return parsePublicSchedule(data);
}

/**
 * Monthly report for a location. Caller must already be authenticated;
 * pass ActionUserContext from a server action to avoid a second getUser.
 */
export async function loadMonthlyReport(
  venueId: string,
  month: string,
  ctx?: ActionUserContext
): Promise<{ employees: Employee[]; assignments: Assignment[] }> {
  const auth = ctx ?? (await requireActionUser());
  if ("error" in auth) {
    throw Object.assign(new Error(auth.error.message), {
      code: auth.error.code,
      status: 401,
    });
  }

  const location = uuid.safeParse(venueId);
  const monthDate = date.safeParse(month);
  if (!location.success || !monthDate.success) {
    throw Object.assign(new Error(actionError("VALIDATION_ERROR", "Invalid input.").error.message), {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const { data, error } = await auth.supabase.rpc("schedule_report", {
    p_location: location.data,
    p_month: monthDate.data,
  });
  if (error) throw error;
  return data as { employees: Employee[]; assignments: Assignment[] };
}
