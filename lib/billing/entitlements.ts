import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { subscriptionStatuses } from "@/supabase/functions/_shared/entitlements";
import { PLANS, type BillingFeature } from "./plans";

const features = Object.keys(PLANS.free.features) as BillingFeature[];
const featureSchema = z.object(
  Object.fromEntries(features.map((feature) => [feature, z.boolean()])) as Record<BillingFeature, z.ZodBoolean>,
);
const limits = PLANS.free.limits;
type Limit = keyof typeof limits;
const nullableLimit = z.number().int().nonnegative().nullable();
const limitSchema = z.object(
  Object.fromEntries(Object.keys(limits).map((key) => [key, nullableLimit])) as Record<Limit, typeof nullableLimit>,
);

export const entitlementSchema = z.object({
  plan: z.enum(["free", "starter", "pro", "advanced"]),
  status: z.enum(subscriptionStatuses).nullable(),
  features: featureSchema,
  limits: limitSchema,
  trial_ends_at: z.string().nullable(),
  grace: z.boolean(),
  current_period_end: z.string().nullable().default(null),
  paddle_customer_id: z.string().nullable().default(null),
});

export type Entitlements = z.infer<typeof entitlementSchema>;

export async function getEntitlement(supabase: SupabaseClient, verifiedUserId?: string) {
  const userId = verifiedUserId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!userId) {
    return {
      plan: "free" as const, status: null, isPremium: false, currentPeriodEnd: null,
      paddleCustomerId: null, grace: false, features: PLANS.free.features, limits: PLANS.free.limits,
      trial_ends_at: null, current_period_end: null, paddle_customer_id: null,
    };
  }

  const { data, error } = await supabase.rpc("get_entitlements", { p_user_id: userId });
  const entitlement = entitlementSchema.safeParse(data);
  if (error || !entitlement.success) throw new Error("Pretplata nije dostupna.");
  return {
    ...entitlement.data,
    isPremium: entitlement.data.plan !== "free",
    currentPeriodEnd: entitlement.data.current_period_end,
    paddleCustomerId: entitlement.data.paddle_customer_id,
  };
}
