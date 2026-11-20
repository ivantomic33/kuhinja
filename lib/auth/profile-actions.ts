"use server";

import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  type ActionResult,
} from "@/lib/server/action";
import { profileUpdateSchema } from "@/lib/schemas/domain";

/**
 * Update the current user's display name.
 * Never accepts a user_id from the client — always scopes to getUser().
 */
export async function updateProfileAction(
  input: unknown
): Promise<ActionResult<{ full_name: string }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(profileUpdateSchema, input);
  if ("error" in parsed) return parsed;

  const fullName = parsed.data.full_name;

  const { error: profileError } = await auth.supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", auth.user.id);

  if (profileError) {
    return actionError("INTERNAL_ERROR", "Profile could not be updated.");
  }

  const { error: metaError } = await auth.supabase.auth.updateUser({
    data: { full_name: fullName },
  });

  if (metaError) {
    return actionError("INTERNAL_ERROR", "Profile could not be updated.");
  }

  return actionData({ full_name: fullName });
}
