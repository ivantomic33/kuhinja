import { getEntitlements, planDisplayName, type PlanId } from "@/lib/plan/entitlements";
import {
  configuredPrice,
  planForPrice,
  type BillingInterval,
  type PaidPlan,
} from "@/supabase/functions/_shared/billing-prices";
import type { PlanKey } from "@/supabase/functions/_shared/entitlements";
import { TIER_DEFINITIONS } from "./tiers";
import type { BillingCatalog } from "./catalog";

export type { PlanKey, PaidPlan, BillingInterval };
const readEnv = (key: string) => process.env[key];

export function planFromPriceId(priceId: string): PaidPlan | null {
  return planForPrice(readEnv, priceId);
}

export function priceIdFor(plan: PaidPlan, interval: BillingInterval) {
  const price = configuredPrice(readEnv, plan, interval);
  return price && planFromPriceId(price) === plan ? price : undefined;
}

export function trialPriceIdFor(plan: PaidPlan, interval: BillingInterval) {
  const price = configuredPrice(readEnv, plan, interval, true);
  return price && planFromPriceId(price) === plan ? price : undefined;
}

/** Map billing plan keys onto entitlement PlanIds. */
export function entitlementPlanId(plan: PlanKey | PaidPlan): PlanId {
  if (plan === "advanced") return "business";
  return plan;
}

function planDetails(plan: PlanKey) {
  const flags = getEntitlements(entitlementPlanId(plan));
  const members =
    plan === "pro" || plan === "advanced" ? 10 : plan === "starter" ? 3 : 1;
  return {
    name: plan === "advanced" ? "Advanced" : planDisplayName(entitlementPlanId(plan)),
    features: {
      manageSubscription: plan !== "free",
      schedule: plan !== "free",
      priceHistory: flags.priceHistory,
      foodCostVariance: flags.foodCostVariance,
      foodCostAlarm: flags.foodCostAlarm,
      /** Starter+: low-stock alerts + PO from alerts. */
      stockAlerts: flags.stockAlerts,
      /** Pro+: purchase orders generated from trebovanje. */
      purchaseOrders: flags.purchaseOrders,
      basicReports: flags.basicReports,
      prepListPdf: flags.prepListPdf,
      stockWriteOff: flags.stockWriteOff,
      stockRestock: flags.stockRestock,
      stockInventory: flags.stockInventory,
      /** Starter+: waste log. */
      wasteLog: flags.wasteLog,
      waste_log: flags.wasteLog,
      /** Starter+: waste CSV export. */
      wasteExportCsv: flags.wasteExportCsv,
      waste_export_csv: flags.wasteExportCsv,
      /** Pro+: waste PDF + Excel export. */
      wasteExportPdfXlsx: flags.wasteExportPdfXlsx,
      waste_export_pdf_xlsx: flags.wasteExportPdfXlsx,
      /** Invite additional seats beyond the owner (Starter+). */
      teamMembers: plan !== "free",
    },
    limits: {
      recipes: flags.maxRecipes,
      ingredients: flags.maxIngredients,
      templates: flags.maxShiftTemplates,
      timers: flags.maxTimers,
      stockItems: flags.maxStockItems,
      locations: flags.maxLocations,
      members,
    },
  };
}

export const PLANS = {
  free: { ...planDetails("free"), price: { amount: "0", label: "0 RSD", currency: "RSD" } },
  starter: {
    ...planDetails("starter"),
    priceId: (interval: BillingInterval) => priceIdFor("starter", interval),
  },
  pro: {
    ...planDetails("pro"),
    priceId: (interval: BillingInterval) => priceIdFor("pro", interval),
  },
  advanced: {
    ...planDetails("advanced"),
    priceId: (interval: BillingInterval) => priceIdFor("advanced", interval),
  },
};

export type BillingFeature = keyof typeof PLANS.free.features;

export type PlanPrice = NonNullable<BillingCatalog[PaidPlan][BillingInterval]>;
export type PricingPlan = {
  key: "free" | PaidPlan;
  name: string;
  description?: string;
  features: readonly string[];
  prices: Record<BillingInterval, PlanPrice | null>;
  checkoutAvailable: Record<BillingInterval, boolean>;
};

export function getPricingPlans(catalog: BillingCatalog): PricingPlan[] {
  const { free } = PLANS;
  return [
    {
      key: "free",
      name: free.name,
      features: [
        `${free.limits.recipes} recepata i ${free.limits.ingredients} sastojaka`,
        "Kalkulator troška po porciji",
        "Jedan šablon smene",
        "Čitanje sačuvanih recepata bez interneta",
      ],
      prices: { monthly: free.price, yearly: free.price },
      checkoutAvailable: { monthly: true, yearly: true },
    },
    ...TIER_DEFINITIONS.map((tier) => {
      const key = tier.key;
      return {
        key,
        name: PLANS[key].name,
        description: tier.description,
        features: tier.features,
        prices: catalog[key],
        // Regular catalog prices are enough to start checkout. Trial variants are optional.
        checkoutAvailable: {
          monthly: catalog[key].monthly != null,
          yearly: catalog[key].yearly != null,
        },
      };
    }),
  ];
}
