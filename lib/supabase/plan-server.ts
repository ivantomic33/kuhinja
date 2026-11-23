import { cache } from "react";
import { createClient, getServerUser } from "@/lib/supabase/server";
import {
  resolvePlanDetails,
  type Plan,
  type PlanDetails,
} from "@/lib/supabase/plan";

/**
 * Server helper: current user's plan from `profiles`.
 * Defaults to `free` when unauthenticated or missing.
 */
export async function getPlan(): Promise<Plan> {
  const details = await getPlanDetails();
  return details.plan;
}

/** Server helper: plan + billing fields for settings/billing UI. */
export const getPlanDetails = cache(async (): Promise<PlanDetails> => {
  const empty = resolvePlanDetails("free", null, null);

  const [supabase, user] = await Promise.all([createClient(), getServerUser()]);
  if (!user) return empty;

  const { data } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return empty;

  return resolvePlanDetails(
    data.plan,
    data.plan_expires_at,
    data.stripe_customer_id
  );
});
