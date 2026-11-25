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
  const grace = status === "past_due" && periodEnd !== null &&
    now >= periodEnd && now < periodEnd + 7 * 86_400_000;
  return { plan: grace ? plan : "free", grace };
}
