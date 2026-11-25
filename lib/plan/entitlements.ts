/**
 * Plan entitlements — single source of truth for limits and feature gates.
 * Aligns with Premium compare table / pricing design.
 */

export type PlanId = "free" | "starter" | "pro" | "team" | "business";

export type BillingPeriod = "monthly" | "yearly";

export type DbPlanValue = string | null | undefined;

/** List prices (RSD) by billing period. */
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
  /** Starter+: restock-driven food cost over-target alerts + dashboard widget. */
  foodCostAlarm: boolean;
  /** Starter+: low-stock alerts and PO drafts from alerts. */
  stockAlerts: boolean;
  /** Pro+: purchase orders from trebovanje source. */
  purchaseOrders: boolean;
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
  /** Starter+: waste log capture + report widget. */
  wasteLog: boolean;
  /** Starter+: waste CSV export. */
  wasteExportCsv: boolean;
  /** Pro+: waste PDF + XLSX export. */
  wasteExportPdfXlsx: boolean;
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
  // Advanced checkout tier maps to business entitlements.
  if (value === "business" || value === "advanced") return "business";
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
    foodCostAlarm: starterPlus,
    stockAlerts: starterPlus,
    purchaseOrders: proPlus,
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
    wasteLog: starterPlus,
    wasteExportCsv: starterPlus,
    wasteExportPdfXlsx: proPlus,
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
