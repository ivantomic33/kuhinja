export type PlanKey = "free" | "starter" | "pro" | "advanced";
export const subscriptionStatuses = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;
export type SubscriptionStatus = typeof subscriptionStatuses[number];

export function effectivePlan(
  plan: PlanKey | null,
  status: SubscriptionStatus | null,
  periodEnd: number | null,
  now = Date.now(),
): { plan: PlanKey; grace: boolean } {
  if (!plan || plan === "free") return { plan: "free", grace: false };
  if (status === "active" || status === "trialing") {
    return { plan, grace: false };
  }
  const allowed = accessAt(status, periodEnd, now);
  return { plan: allowed ? plan : "free", grace: allowed && status === "past_due" };
}

function accessAt(status: string | null, periodEnd: number | null, now: number) {
  if (status === "active" || status === "trialing") return true;
  if (periodEnd === null || !Number.isFinite(periodEnd)) return false;
  if (status === "past_due") return now < periodEnd + 3 * 86_400_000;
  return status === "canceled" && now < periodEnd;
}

export function hasAccess(sub: { status: string | null; current_period_end: string | null } | null, now = new Date()) {
  return sub !== null && accessAt(sub.status, sub.current_period_end ? Date.parse(sub.current_period_end) : null, now.getTime());
}
