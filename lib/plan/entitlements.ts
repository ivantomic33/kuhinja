/**
 * Plan entitlements — single source of truth for limits and feature gates.
 * Aligns with Premium compare table / pricing design.
 */

export type PlanId = "free" | "starter" | "pro" | "team" | "business";

export type BillingPeriod = "monthly" | "yearly";

export type DbPlanValue = string | null | undefined;

/** Fixed list prices (RSD). Annual = 10× monthly (≈2 months free). */
export const PLAN_PRICES = {
  free: { monthly: 0, yearly: 0 },
  starter: { monthly: 990, yearly: 9900 },
  pro: { monthly: 1990, yearly: 19900 },
  team: { monthly: 3990, yearly: 39900 },
  business: { monthly: 5990, yearly: 59900 },
} as const;

export const PLAN_YEARLY_NOTES = {
  starter: "~825 din/mes · Uštedi ~1.980 din/god",
  pro: "~1.658 din/mes · Uštedi ~3.980 din/god",
  team: "~3.325 din/mes · Uštedi ~7.980 din/god",
  business: "~4.992 din/mes · Uštedi ~11.980 din/god",
} as const;

export const TRIAL_DAYS_PRO = 14;

/** Free hard caps (also mirrored by DB triggers). */
export const FREE_MAX_RECIPES = 5;
export const FREE_MAX_INGREDIENTS = 20;
export const FREE_MAX_TEMPLATES = 1;
export const FREE_MAX_PARALLEL_TIMERS = 2;
/** Free: stock_levels rows (stavke na stanju). */
export const FREE_MAX_STOCK_ITEMS = 10;

/** Starter: “more” templates — product default 3. */
export const STARTER_MAX_TEMPLATES = 3;

/** Starter keeps free timer cap. */
export const STARTER_MAX_PARALLEL_TIMERS = 2;

/** Starter: stock_levels rows (stavke na stanju). */
export const STARTER_MAX_STOCK_ITEMS = 40;

const UNLIMITED = Number.POSITIVE_INFINITY;

export type PlanEntitlements = {
  planId: PlanId;
  maxRecipes: number;
  maxIngredients: number;
  maxShiftTemplates: number;
  maxTimers: number;
  maxLocations: number;
  /** Cap on stock_levels rows (stavke sa stanjem). */
  maxStockItems: number;
  multiUser: boolean;
  roles: boolean;
  foodCostCalculator: boolean;
  priceHistory: boolean;
  foodCostVariance: boolean;
  basicReports: boolean;
  prepListPdf: boolean;
  pdfExcelReports: boolean;
  offlineCachedRecipes: boolean;
  trialEligible: boolean;
  /** Stanje + prodaja (row cap = maxStockItems). */
  stockTracking: boolean;
  /** Starter+: otpis / kalo. */
  stockWriteOff: boolean;
  /** Starter+: nabavna cena na dopuni (osnovna dopuna je na svim planovima). */
  stockRestock: boolean;
  /** Pro+: inventura. */
  stockInventory: boolean;
  /** Team+: userId audit on stock moves. */
  stockMoveAudit: boolean;
};

const RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  team: 3,
  business: 4,
};

/**
 * Map DB / legacy values onto PlanId.
 * Old single “Premium” flag (`premium` | `pro`) → `pro`.
 */
export function normalizePlanId(value: DbPlanValue): PlanId {
  if (value === "starter") return "starter";
  if (value === "team") return "team";
  if (value === "business") return "business";
  if (value === "pro" || value === "premium") return "pro";
  return "free";
}

export function planRank(plan: PlanId): number {
  return RANK[plan] ?? 0;
}

export function hasMinPlan(plan: PlanId, min: PlanId): boolean {
  return planRank(plan) >= planRank(min);
}

export function getEntitlements(plan: PlanId): PlanEntitlements {
  const paid = plan !== "free";
  const proPlus = hasMinPlan(plan, "pro");
  const teamPlus = hasMinPlan(plan, "team");
  const business = plan === "business";
  const starterPlus = hasMinPlan(plan, "starter");

  return {
    planId: plan,
    maxRecipes: paid ? UNLIMITED : FREE_MAX_RECIPES,
    maxIngredients: paid ? UNLIMITED : FREE_MAX_INGREDIENTS,
    maxShiftTemplates: proPlus
      ? UNLIMITED
      : plan === "starter"
        ? STARTER_MAX_TEMPLATES
        : FREE_MAX_TEMPLATES,
    maxTimers: proPlus ? UNLIMITED : FREE_MAX_PARALLEL_TIMERS,
    maxLocations: teamPlus ? UNLIMITED : 1,
    maxStockItems: proPlus
      ? UNLIMITED
      : plan === "starter"
        ? STARTER_MAX_STOCK_ITEMS
        : FREE_MAX_STOCK_ITEMS,
    multiUser: teamPlus,
    roles: teamPlus,
    foodCostCalculator: true,
    priceHistory: proPlus,
    foodCostVariance: proPlus,
    basicReports: proPlus,
    prepListPdf: starterPlus,
    pdfExcelReports: business,
    offlineCachedRecipes: true,
    trialEligible: plan === "free" || plan === "starter",
    stockTracking: true,
    stockWriteOff: starterPlus,
    stockRestock: starterPlus,
    stockInventory: proPlus,
    stockMoveAudit: teamPlus,
  };
}

export function isUnlimited(max: number): boolean {
  return !Number.isFinite(max) || max >= Number.MAX_SAFE_INTEGER;
}

export function canCreateRecipe(plan: PlanId, currentCount: number): boolean {
  const { maxRecipes } = getEntitlements(plan);
  return isUnlimited(maxRecipes) || currentCount < maxRecipes;
}

export function canCreateIngredient(
  plan: PlanId,
  currentCount: number
): boolean {
  const { maxIngredients } = getEntitlements(plan);
  return isUnlimited(maxIngredients) || currentCount < maxIngredients;
}

export function canCreateTemplate(
  plan: PlanId,
  currentCount: number
): boolean {
  const { maxShiftTemplates } = getEntitlements(plan);
  return isUnlimited(maxShiftTemplates) || currentCount < maxShiftTemplates;
}

export function canStartTimer(plan: PlanId, activeCount: number): boolean {
  const { maxTimers } = getEntitlements(plan);
  return isUnlimited(maxTimers) || activeCount < maxTimers;
}

/** True when another stock_levels row may be created (existing rows never blocked). */
export function canAddStockItem(plan: PlanId, currentCount: number): boolean {
  const { maxStockItems } = getEntitlements(plan);
  return isUnlimited(maxStockItems) || currentCount < maxStockItems;
}

export function planDisplayName(plan: PlanId): string {
  switch (plan) {
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
    case "team":
      return "Team";
    case "business":
      return "Business";
    default:
      return "Free";
  }
}

/** Pro-tier feature unlock (price history, variance, multi-timer, …). */
export function hasProFeatures(plan: PlanId): boolean {
  return hasMinPlan(plan, "pro");
}

/** Any paid plan (not free). */
export function isPaidPlan(plan: PlanId): boolean {
  return plan !== "free";
}
