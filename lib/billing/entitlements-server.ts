import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "./entitlements";
import type { BillingFeature } from "./plans";

export async function hasPremium(userId: string, client?: SupabaseClient): Promise<boolean> {
  return (await getEntitlement(client ?? await createClient(), userId)).isPremium;
}

export async function hasWorkspaceFeature(
  client: SupabaseClient,
  workspaceId: string,
  feature: BillingFeature | "allergens",
): Promise<boolean> {
  const { data, error } = await client.rpc("workspace_has_feature", {
    p_workspace_id: workspaceId, p_feature: feature,
  });
  return !error && data === true;
}
