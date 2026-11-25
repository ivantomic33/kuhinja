import type { PlanKey } from "@/supabase/functions/_shared/entitlements";
import { PLANS } from "./plans";

/** Seat caps: Free 1, Starter 3, Pro 10 (Advanced inherits Pro). */
export const MEMBER_LIMITS = {
  free: 1,
  starter: 3,
  pro: 10,
  advanced: 10,
} as const satisfies Record<PlanKey, number>;

export function getMemberLimitForPlan(plan: PlanKey | string | null | undefined): number {
  if (plan === "starter") return MEMBER_LIMITS.starter;
  if (plan === "pro" || plan === "advanced") return MEMBER_LIMITS.pro;
  return MEMBER_LIMITS.free;
}

export function memberLimitFromEntitlements(
  limits: { members?: number | null } | null | undefined,
  plan?: PlanKey | string | null,
): number {
  if (typeof limits?.members === "number" && Number.isFinite(limits.members)) {
    return limits.members;
  }
  return getMemberLimitForPlan(plan ?? "free");
}

/** Ensure plans.limits exposes members from the same source. */
export function plansMemberLimit(plan: keyof typeof PLANS): number {
  const limit = PLANS[plan].limits.members;
  if (typeof limit === "number") return limit;
  return getMemberLimitForPlan(plan);
}
