"use server";

import { revalidatePath } from "next/cache";
import { APP_NAME } from "@/lib/config/app";
import { requireFeature } from "@/lib/billing/guard";
import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  requireScheduleLocationAccess,
  type ActionResult,
} from "@/lib/server/action";
import {
  loadScheduleReportInputSchema,
  scheduleActionSchema,
  updateScheduleInputSchema,
  type ScheduleAction,
} from "@/lib/schemas/schedule";
import { loadMonthlyReport } from "./server";
import type { Assignment, Employee, PublicSchedule } from "./types";

type ScheduleMutationData = {
  id?: string;
  token?: string;
  notified?: number;
  preview?: PublicSchedule;
};

type ScheduleReportData = {
  employees: Employee[];
  assignments: Assignment[];
};

function mapScheduleRpcError(error: {
  message?: string;
  code?: string;
}): ReturnType<typeof actionError> {
  if (error.message === "SCHEDULE_LOGIN_MISSING") {
    return actionError(
      "VALIDATION_ERROR",
      `Nema potvrđenog ${APP_NAME} naloga za ovaj imejl.`
    );
  }
  if (error.message === "SCHEDULE_STALE") {
    return actionError(
      "VALIDATION_ERROR",
      "Raspored je u međuvremenu izmenjen."
    );
  }
  if (error.code === "42501" || error.message === "SCHEDULE_FORBIDDEN") {
    return actionError("FORBIDDEN", "Ova akcija nije dostupna.");
  }
  if (error.code === "23505") {
    return actionError("VALIDATION_ERROR", "Ovaj unos već postoji.");
  }
  return actionError(
    "INTERNAL_ERROR",
    "Promena nije sačuvana. Pokušaj ponovo."
  );
}

/**
 * Mutate schedule state via security-definer RPC.
 * Auth: getUser(). Ownership: schedule location membership (never trust body user ids).
 */
export async function updateSchedule(
  location: string,
  week: string,
  command: ScheduleAction
): Promise<ActionResult<ScheduleMutationData>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(updateScheduleInputSchema, {
    location,
    week,
    command,
  });
  if ("error" in parsed) {
    return actionError("VALIDATION_ERROR", "Proveri unete podatke.");
  }

  // Re-validate command alone so unknown fields on nested objects are rejected.
  const commandParsed = scheduleActionSchema.safeParse(parsed.data.command);
  if (!commandParsed.success) {
    return actionError("VALIDATION_ERROR", "Proveri unete podatke.");
  }

  const access = await requireScheduleLocationAccess(
    auth,
    parsed.data.location
  );
  if ("error" in access) return access;

  if (!access.isEmployee) {
    const feature = await requireFeature("schedule", auth);
    if ("error" in feature) return feature;
  }

  const { type, ...fields } = commandParsed.data;
  const payload =
    commandParsed.data.type === "request"
      ? { ...fields, type: commandParsed.data.requestType }
      : fields;

  // Location comes only from validated input + membership check — not from payload user ids.
  const { data, error } = await auth.supabase.rpc("schedule_command", {
    p_action: type,
    p_location: access.locationId,
    p_week: parsed.data.week,
    p_payload: payload,
  });

  if (error) {
    return mapScheduleRpcError(error);
  }

  if (type !== "share") {
    revalidatePath("/raspored");
  }

  return actionData((data ?? {}) as ScheduleMutationData);
}

/**
 * Monthly hours report for a location the current user owns (business plan RPC).
 */
export async function loadScheduleReport(
  location: string,
  month: string
): Promise<ActionResult<ScheduleReportData>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(loadScheduleReportInputSchema, {
    location,
    month,
  });
  if ("error" in parsed) {
    return actionError("VALIDATION_ERROR", "Proveri unete podatke.");
  }

  const access = await requireScheduleLocationAccess(
    auth,
    parsed.data.location
  );
  if ("error" in access) return access;

  const feature = await requireFeature("schedule", auth);
  if ("error" in feature) return feature;

  try {
    const data = await loadMonthlyReport(
      access.locationId,
      parsed.data.month,
      auth
    );
    return actionData(data);
  } catch (error) {
    const err = error as { message?: string; code?: string };
    if (err?.code === "42501" || err?.message === "SCHEDULE_FORBIDDEN") {
      return actionError("FORBIDDEN", "Ova akcija nije dostupna.");
    }
    return actionError("INTERNAL_ERROR", "Izveštaj nije učitan.");
  }
}
