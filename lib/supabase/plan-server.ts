import { cache } from "react";
import { entitlementSchema } from "@/lib/billing/entitlements";
import { createClient, getServerUser } from "@/lib/supabase/server";
import {
  resolvePlanDetails,
  type Plan,
  type PlanDetails,
} from "@/lib/supabase/plan";

/**
 * Server helper: current user's effective subscription plan.
 * Defaults to `free` when unauthenticated or missing.
 */
export async function getPlan(): Promise<Plan> {
  const details = await getPlanDetails();
  return details.plan;
}

/** Server helper: plan + billing fields for settings/billing UI. */
export const getPlanDetails = cache(async (): Promise<PlanDetails> => {
  const [supabase, user] = await Promise.all([createClient(), getServerUser()]);
  return user ? readUserPlan(supabase, user.id) : resolvePlanDetails("free");
});

/** Reuse the verified identity in mutations that already called getUser(). */
export async function readUserPlan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<PlanDetails> {
  const [{ data: entitlement }, { data: profile }] = await Promise.all([
    supabase.rpc("get_entitlements", { p_user_id: userId }),
    supabase.from("profiles")
      .select("plan_expires_at, paddle_customer_id")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const billing = entitlementSchema.safeParse(entitlement).data;
  const plan = billing?.plan ?? "free";
  return {
    ...resolvePlanDetails(plan, null, profile?.paddle_customer_id),
    planExpiresAt: plan === "free" ? null : profile?.plan_expires_at ?? null,
    billingStatus: billing?.status ?? null,
  };
}
