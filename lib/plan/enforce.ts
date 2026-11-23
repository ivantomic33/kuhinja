/**
 * Pure plan-limit gates (server + tests).
 * Plan must come from profiles on the server — never trust the client.
 */

import {
  canAddStockItem,
  canCreateIngredient,
  canCreateRecipe,
  canCreateTemplate,
  getEntitlements,
  type PlanId,
} from "@/lib/plan/entitlements";
import {
  formatLimitReachedMessage,
  LIMIT_REACHED,
  type LimitReachedPayload,
  type LimitResource,
  limitReachedPayload,
} from "@/lib/plan/limit-error";

export type EnforceOk = { ok: true };
export type EnforceFail = { ok: false; error: LimitReachedPayload };
export type EnforceResult = EnforceOk | EnforceFail;

function fail(
  resource: LimitResource,
  detail?: string
): EnforceFail {
  return { ok: false, error: limitReachedPayload(resource, detail) };
}

export function enforceRecipeLimit(
  plan: PlanId,
  currentCount: number
): EnforceResult {
  if (canCreateRecipe(plan, currentCount)) return { ok: true };
  const max = getEntitlements(plan).maxRecipes;
  return fail(
    "recipes",
    `maximum ${Number.isFinite(max) ? max : "∞"} recipes per venue`
  );
}

export function enforceIngredientLimit(
  plan: PlanId,
  currentCount: number
): EnforceResult {
  if (canCreateIngredient(plan, currentCount)) return { ok: true };
  const max = getEntitlements(plan).maxIngredients;
  return fail(
    "ingredients",
    `maximum ${Number.isFinite(max) ? max : "∞"} ingredients per venue`
  );
}

export function enforceTemplateLimit(
  plan: PlanId,
  currentCount: number
): EnforceResult {
  if (canCreateTemplate(plan, currentCount)) return { ok: true };
  const max = getEntitlements(plan).maxShiftTemplates;
  return fail(
    "templates",
    `maximum ${Number.isFinite(max) ? max : "∞"} checklist templates per venue`
  );
}

export function enforceStockItemLimit(
  plan: PlanId,
  currentCount: number,
  newItemCount = 1
): EnforceResult {
  if (newItemCount <= 0) return { ok: true };
  // Existing rows never blocked; only brand-new stock_levels rows.
  if (canAddStockItem(plan, currentCount + newItemCount - 1)) return { ok: true };
  const max = getEntitlements(plan).maxStockItems;
  return fail(
    "stockItems",
    `maximum ${Number.isFinite(max) ? max : "∞"} stock items per venue`
  );
}

/** Price history is Pro+ only (feature gate, not a row cap). */
export function enforcePriceHistoryAccess(plan: PlanId): EnforceResult {
  if (getEntitlements(plan).priceHistory) return { ok: true };
  return fail("priceHistory", "price history requires Pro");
}

/**
 * Map a failed enforce result onto the ActionError shape used by server actions.
 */
export function toLimitReachedActionError(result: EnforceFail): {
  error: { code: typeof LIMIT_REACHED; message: string; resource: LimitResource };
} {
  return {
    error: {
      code: LIMIT_REACHED,
      message: result.error.message,
      resource: result.error.resource,
    },
  };
}

/** Convenience: detail string for Postgres RAISE EXCEPTION. */
export function postgresLimitException(
  resource: LimitResource,
  detail: string
): string {
  return formatLimitReachedMessage(resource, detail);
}
