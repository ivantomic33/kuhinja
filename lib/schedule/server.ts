import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Assignment, Employee, PublicSchedule, ScheduleWeek } from "./types";

const uuid = z.string().uuid();
const date = z.string().date();

export async function loadSchedule(location?: string, week?: string): Promise<ScheduleWeek | null> {
  const client = await createClient();
  const { data, error } = await client.rpc("schedule_load", {
    p_location: uuid.safeParse(location).data ?? null,
    p_week: date.safeParse(week).data ?? null,
  });
  if (error) throw error;
  return data as ScheduleWeek | null;
}

export async function loadPublicSchedule(token: string): Promise<PublicSchedule | null> {
  if (!uuid.safeParse(token).success) return null;
  const client = await createClient();
  const { data, error } = await client.rpc("schedule_public", { p_token: token });
  if (error) throw error;
  return data as PublicSchedule | null;
}

export async function loadMonthlyReport(venueId: string, month: string) {
  const client = await createClient();
  const { data, error } = await client.rpc("schedule_report", {
    p_location: uuid.parse(venueId),
    p_month: date.parse(month),
  });
  if (error) throw error;
  return data as { employees: Employee[]; assignments: Assignment[] };
}
