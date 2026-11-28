export type PaidPlan = "starter" | "pro" | "advanced";
export type BillingInterval = "monthly" | "yearly";
export const paidPlans = ["starter", "pro", "advanced"] as const;
export const billingIntervals = ["monthly", "yearly"] as const;
type ReadEnv = (key: string) => string | undefined;

export function configuredPrice(
  readEnv: ReadEnv,
  plan: PaidPlan,
  interval: BillingInterval,
  trial = false,
) {
  const publicPrice = plan === "pro" && !trial
    ? readEnv(`NEXT_PUBLIC_PADDLE_PRICE_${interval.toUpperCase()}`)?.trim() : undefined;
  const value = publicPrice || readEnv(
    `PADDLE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}${trial ? "_TRIAL" : ""}_ID`,
  )?.trim();
  return value && /^pri_[a-z\d]{26}$/.test(value) ? value : undefined;
}

/**
 * Map a Paddle price id to a paid plan.
 * Advanced has no trial variants yet; starter/pro keep optional trial ids.
 */
export function planForPrice(readEnv: ReadEnv, priceId: string): PaidPlan | null {
  const matches = paidPlans.flatMap((plan) =>
    billingIntervals.flatMap((interval) => {
      const trials = plan === "advanced" ? [false] : [false, true];
      return trials
        .filter((trial) => configuredPrice(readEnv, plan, interval, trial) === priceId)
        .map(() => plan);
    }),
  );
  return matches.length === 1 ? matches[0] : null;
}
