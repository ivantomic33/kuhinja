"use client";

import { useQuery } from "@tanstack/react-query";
import {
  isFree,
  isPaid,
  isPremium,
  isStarter,
  resolvePlanDetails,
  type Plan,
  type PlanDetails,
} from "@/lib/supabase/plan";
import { getEntitlements } from "@/lib/plan/entitlements";

export const PLAN_QUERY_KEY = ["profile", "plan"] as const;

export type PlanQueryResult = PlanDetails & {
  accountName: string | null;
  email: string | null;
};

export async function fetchPlanDetails(): Promise<PlanQueryResult> {
  const empty: PlanQueryResult = {
    ...resolvePlanDetails("free", null, null),
    accountName: null,
    email: null,
  };

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return empty;

  const { data, error } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at, stripe_customer_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      ...empty,
      email: user.email ?? null,
      accountName:
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        null,
    };
  }

  const metaName = user.user_metadata?.full_name as string | undefined;
  const accountName =
    (data.full_name && data.full_name.trim()) ||
    metaName ||
    user.email ||
    null;

  return {
    ...resolvePlanDetails(
      data.plan,
      data.plan_expires_at,
      data.stripe_customer_id
    ),
    accountName,
    email: user.email ?? null,
  };
}

/**
 * Client hook for `profiles.plan` (+ billing fields).
 * Returns normalized PlanId (`free` | `starter` | `pro` | `team` | `business`).
 * `isPremium` = pro-tier features (pro+).
 *
 * When AppShell seeds PLAN_QUERY_KEY from the server, the first paint skips a
 * client round-trip (cache hit + staleTime).
 */
export function usePlan() {
  const query = useQuery({
    queryKey: PLAN_QUERY_KEY,
    queryFn: fetchPlanDetails,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const plan: Plan = query.data?.plan ?? "free";
  const entitlements = query.data?.entitlements ?? getEntitlements(plan);

  return {
    plan,
    planId: plan,
    planExpiresAt: query.data?.planExpiresAt ?? null,
    stripeCustomerId: query.data?.stripeCustomerId ?? null,
    accountName: query.data?.accountName ?? null,
    email: query.data?.email ?? null,
    entitlements,
    isPremium: isPremium(plan),
    isFree: isFree(plan),
    isStarter: isStarter(plan),
    isPaid: isPaid(plan),
    isLoading: query.isLoading && !query.data,
    isError: query.isError,
    refetch: query.refetch,
  };
}
