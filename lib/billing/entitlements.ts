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
});

export type Entitlements = z.infer<typeof entitlementSchema>;
