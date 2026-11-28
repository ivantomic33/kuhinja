import { cache } from "react";
import { getEntitlement } from "@/lib/billing/entitlements";
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
  const [billing, { data: profile }] = await Promise.all([
    getEntitlement(supabase, userId).catch(() => null),
    supabase.from("profiles")
      .select("plan_expires_at, paddle_customer_id")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const plan = billing?.plan ?? "free";
  return {
    ...resolvePlanDetails(plan, null, billing?.paddleCustomerId ?? profile?.paddle_customer_id),
    planExpiresAt: plan === "free" ? null : profile?.plan_expires_at ?? null,
    billingStatus: billing?.status ?? null,
    currentPeriodEnd: billing?.currentPeriodEnd ?? null,
  };
}
