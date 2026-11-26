"use server";

import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  type ActionResult,
} from "@/lib/server/action";
import {
  listNotificationsSchema,
  markNotificationReadSchema,
} from "./schemas";

export type NotificationItem = {
  id: string;
  kind: "ingredient_price_change" | "recipe_cost_change";
  title: string;
  message: string;
  data: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

export async function listNotifications(
  input: unknown,
): Promise<ActionResult<{ notifications: NotificationItem[] }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(listNotificationsSchema, input);
  if ("error" in parsed) return parsed;

  const { data, error } = await auth.supabase
    .from("notifications")
    .select("id, kind, title, message, data, created_at, read_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (error) {
    return actionError("INTERNAL_ERROR", "Obaveštenja nisu učitana.");
  }

  return actionData({
    notifications: (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as NotificationItem["kind"],
      title: row.title,
      message: row.message,
      data:
        row.data && typeof row.data === "object" && !Array.isArray(row.data)
          ? row.data
          : {},
      createdAt: row.created_at,
      readAt: row.read_at,
    })),
  });
}

export async function markNotificationRead(
  input: unknown,
): Promise<ActionResult<{ notificationId: string; readAt: string }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(markNotificationReadSchema, input);
  if ("error" in parsed) return parsed;

  const readAt = new Date().toISOString();
  const { data, error } = await auth.supabase
    .from("notifications")
    .update({ read_at: readAt })
    .eq("id", parsed.data.notificationId)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return actionError("INTERNAL_ERROR", "Obaveštenje nije označeno kao pročitano.");
  }
  if (!data) {
    return actionError("NOT_FOUND", "Obaveštenje nije pronađeno.");
  }

  return actionData({
    notificationId: data.id,
    readAt,
  });
}
