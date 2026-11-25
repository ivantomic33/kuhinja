"use server";

import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  type ActionResult,
} from "@/lib/server/action";
import { markAlertReadSchema } from "./schemas";

/**
 * Mark a food-cost (or other) alert as read. Idempotent when already read.
 */
export async function markAlertRead(
  input: unknown,
): Promise<ActionResult<{ alertId: string; marked: boolean }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(markAlertReadSchema, input);
  if ("error" in parsed) return parsed;

  const { data, error } = await auth.supabase.rpc("mark_alert_read", {
    p_alert_id: parsed.data.alertId,
  });

  if (error) {
    const message = error.message ?? "";
    if (error.code === "42501" || message.toLowerCase().includes("access denied")) {
      return actionError("FORBIDDEN", "Nemate dozvolu za ovo upozorenje.");
    }
    if (message.includes("INVALID_ALERT_ID") || error.code === "22023") {
      return actionError("VALIDATION_ERROR", "Neispravan identifikator upozorenja.");
    }
    return actionError("INTERNAL_ERROR", "Upozorenje nije ažurirano.");
  }

  return actionData({
    alertId: parsed.data.alertId,
    marked: Boolean(data),
  });
}
