"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadMonthlyReport } from "./server";
import type { PublicSchedule } from "./types";

const id = z.string().uuid();
const date = z.string().date();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|30)$/);
const code = z.enum(["J", "P", "N", "D", "X", "O", "B", "G"]);
const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("employee"), id: id.optional(), full_name: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(100), hourly_rate_rsd: z.number().min(0).max(99999999).nullable(),
    login_email: z.string().trim().email().max(254).nullable() }),
  z.object({ type: z.literal("location"), name: z.string().trim().min(1).max(120) }),
  z.object({ type: z.literal("assignment"), employee_id: id, date, code: code.nullable(),
    custom_start: time.nullable(), custom_end: time.nullable() }),
  z.object({ type: z.literal("publish") }),
  z.object({ type: z.literal("copy") }),
  z.object({ type: z.literal("undo"), token: id }),
  z.object({ type: z.literal("share") }),
  z.object({ type: z.literal("request"), requestType: z.enum(["slobodan", "zamena"]), date,
    with_employee_id: id.nullable(), note: z.string().trim().max(500) }),
  z.object({ type: z.literal("decide"), id, status: z.enum(["odobreno", "odbijeno"]) }),
]);

export type ScheduleAction = z.input<typeof action>;

type ActionResult = { ok: true; data: { id?: string; token?: string; notified?: number; preview?: PublicSchedule } }
  | { ok: false; error: string };

export async function updateSchedule(location: string, week: string, command: ScheduleAction): Promise<ActionResult> {
  const parsed = action.safeParse(command);
  if (!parsed.success || !id.safeParse(location).success || !date.safeParse(week).success) {
    return { ok: false, error: "Proveri unete podatke." };
  }
  const { type, ...fields } = parsed.data;
  const payload = parsed.data.type === "request" ? { ...fields, type: parsed.data.requestType } : fields;
  const client = await createClient();
  const { data, error } = await client.rpc("schedule_command", {
    p_action: type, p_location: location, p_week: week, p_payload: payload,
  });
  if (error) {
    const message = error.message === "SCHEDULE_LOGIN_MISSING" ? "Nema potvrđenog Mise naloga za ovaj imejl."
      : error.message === "SCHEDULE_STALE" ? "Raspored je u međuvremenu izmenjen."
        : error.code === "42501" ? "Ova akcija nije dostupna."
          : error.code === "23505" ? "Ovaj unos već postoji."
            : "Promena nije sačuvana. Pokušaj ponovo.";
    return { ok: false, error: message };
  }
  if (type !== "share") revalidatePath("/raspored");
  return { ok: true, data };
}

export async function loadScheduleReport(location: string, month: string) {
  return loadMonthlyReport(location, month);
}
