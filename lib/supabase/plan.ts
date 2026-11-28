import type { SubscriptionStatus } from "@/supabase/functions/_shared/entitlements";
import {
  getEntitlements,
  hasProFeatures,
  isPaidPlan,
  normalizePlanId,
  type PlanEntitlements,
  type PlanId,
} from "@/lib/plan/entitlements";

/**
 * App-facing plan id.
 * Legacy DB `premium` / `pro` normalize to `pro`.
 */
export type Plan = PlanId;

export type DbPlan = string | null | undefined;

export type PlanDetails = {
  plan: Plan;
  planExpiresAt: string | null;
  billingStatus?: SubscriptionStatus | null;
  currentPeriodEnd?: string | null;
  paddleCustomerId: string | null;
  entitlements: PlanEntitlements;
};

/** Map DB / legacy values onto app plan. */
export function normalizePlan(value: DbPlan): Plan {
  return normalizePlanId(value);
}

/**
 * Pro-tier unlock (price history, multi-timer, variance, …).
 * Kept name for existing call sites; means pro / team / business.
 */
export function isPremium(plan: Plan): boolean {
  return hasProFeatures(plan);
}

export function isFree(plan: Plan): boolean {
  return plan === "free";
}

export function isStarter(plan: Plan): boolean {
  return plan === "starter";
}

export function isPaid(plan: Plan): boolean {
  return isPaidPlan(plan);
}

/**
 * If a paid plan has an expiry in the past, treat as free (defensive).
 * Webhook remains the source of truth for plan writes.
 */
export function resolvePlan(
  dbPlan: DbPlan,
  planExpiresAt?: string | null
): Plan {
  const plan = normalizePlan(dbPlan);
  if (plan === "free") return "free";
  if (!planExpiresAt) return plan;
  const expires = Date.parse(planExpiresAt);
  if (Number.isNaN(expires)) return plan;
  if (expires < Date.now()) return "free";
  return plan;
}

export function resolvePlanDetails(
  dbPlan: DbPlan,
  planExpiresAt?: string | null,
  paddleCustomerId?: string | null
): PlanDetails {
  const plan = resolvePlan(dbPlan, planExpiresAt);
  return {
    plan,
    planExpiresAt: planExpiresAt ?? null,
    paddleCustomerId: paddleCustomerId ?? null,
    entitlements: getEntitlements(plan),
  };
}
