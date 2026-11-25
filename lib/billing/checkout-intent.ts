import { z } from "zod";
import { billingIntervals, paidPlans } from "@/supabase/functions/_shared/billing-prices";

export const checkoutIntent = z.object({
  plan_key: z.enum(paidPlans),
  interval: z.enum(billingIntervals),
});

export function checkoutHref(plan: (typeof paidPlans)[number], interval: (typeof billingIntervals)[number]) {
  return `/checkout?plan_key=${plan}&interval=${interval}`;
}

export function checkoutReturnPath(value: unknown) {
  const match = typeof value === "string" && /^\/checkout\?plan_key=([a-z]+)&interval=([a-z]+)$/.exec(value);
  const parsed = match && checkoutIntent.safeParse({ plan_key: match[1], interval: match[2] });
  return parsed && parsed.success ? checkoutHref(parsed.data.plan_key, parsed.data.interval) : undefined;
}
