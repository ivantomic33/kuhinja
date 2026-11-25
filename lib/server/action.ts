import type { User } from "@supabase/supabase-js";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "LIMIT_REACHED"
  | "UPGRADE_REQUIRED"
  | "VERSION_CONFLICT";

export type ActionErrorBody = {
  code: ActionErrorCode;
  message: string;
  /** Present when code is LIMIT_REACHED (ingredients | recipes | …). */
  resource?: string;
  /** HTTP-ish status for clients (e.g. 409 on VERSION_CONFLICT). */
  status?: number;
};

export type ActionError = {
  error: ActionErrorBody;
};

export type ActionSuccess<T> = {
  data: T;
};

export type ActionResult<T> = ActionSuccess<T> | ActionError;

export function actionError(
  code: ActionErrorCode,
  message: string
): ActionError {
  return { error: { code, message } };
}

export function actionData<T>(data: T): ActionSuccess<T> {
  return { data };
}

export function isActionError(
  result: ActionResult<unknown>
): result is ActionError {
  return "error" in result && result.error != null;
}

/** Parse input with a Zod schema; reject unknown fields via schema.strict(). */
export function parseActionInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): { data: z.infer<T> } | ActionError {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return actionError(
      "VALIDATION_ERROR",
      first?.message ?? "Invalid input."
    );
  }
  return { data: parsed.data };
}

export type ActionUserContext = {
  user: User;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/**
 * Authenticate a server action / server loader with getUser() (not getSession()).
 * Returns UNAUTHORIZED when there is no verified user.
 */
export async function requireActionUser(): Promise<
  ActionUserContext | ActionError
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return actionError("UNAUTHORIZED", "Authentication required.");
  }

  return { user, supabase };
}

/**
 * Ensure the current user owns the venue. Never trust a client-supplied owner id —
 * scope by auth user + venue id only.
 */
export async function requireVenueOwner(
  ctx: ActionUserContext,
  venueId: string
): Promise<{ venueId: string } | ActionError> {
  const { data, error } = await ctx.supabase
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .eq("owner_id", ctx.user.id)
    .maybeSingle();

  if (error) {
    return actionError("INTERNAL_ERROR", "Could not verify venue access.");
  }
  if (!data) {
    return actionError("FORBIDDEN", "You do not have access to this venue.");
  }
  return { venueId: data.id as string };
}

/**
 * Schedule locations are only reachable via security-definer RPCs (no table grants).
 * Confirm the caller can load the location; treat missing scope as forbidden.
 */
export async function requireScheduleLocationAccess(
  ctx: ActionUserContext,
  locationId: string
): Promise<{ locationId: string; isEmployee: boolean } | ActionError> {
  const { data, error } = await ctx.supabase.rpc("schedule_load", {
    p_location: locationId,
    p_week: null,
  });

  if (error) {
    if (error.code === "42501") {
      return actionError("FORBIDDEN", "You do not have access to this schedule.");
    }
    return actionError("INTERNAL_ERROR", "Could not verify schedule access.");
  }

  const venueId =
    data &&
    typeof data === "object" &&
    "venue" in data &&
    data.venue &&
    typeof data.venue === "object" &&
    "id" in data.venue
      ? String((data.venue as { id: unknown }).id)
      : null;

  if (!venueId || venueId !== locationId) {
    return actionError("FORBIDDEN", "You do not have access to this schedule.");
  }

  return { locationId, isEmployee: data.mode === "employee" };
}
