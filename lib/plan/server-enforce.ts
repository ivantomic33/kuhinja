/**
 * Server-only plan limit checks.
 * Reads effective billing entitlements from the database.
 */

import {
  enforceIngredientLimit,
  enforceRecipeLimit,
  enforceStockItemLimit,
  enforceTemplateLimit,
  toLimitReachedActionError,
  type EnforceResult,
} from "@/lib/plan/enforce";
import { requireFeature } from "@/lib/billing/guard";
import { LIMIT_REACHED } from "@/lib/plan/limit-error";
import {
  actionError,
  type ActionError,
  type ActionUserContext,
} from "@/lib/server/action";
import { readUserPlan } from "@/lib/supabase/plan-server";
import type { Plan } from "@/lib/supabase/plan";

export type LimitActionError = ActionError & {
  error: ActionError["error"] & {
    code: typeof LIMIT_REACHED;
    resource?: string;
  };
};

function asActionError(result: EnforceResult): true | LimitActionError {
  if (result.ok) return true;
  const mapped = toLimitReachedActionError(result);
  return {
    error: {
      code: LIMIT_REACHED,
      message: mapped.error.message,
      resource: mapped.error.resource,
    },
  };
}

/** Load the authenticated user's effective subscription plan. */
async function getServerPlanForUser(ctx: ActionUserContext): Promise<Plan> {
  const details = await readUserPlan(ctx.supabase, ctx.user.id);
  return details.plan;
}

async function countRows(
  ctx: ActionUserContext,
  table: "ingredients" | "recipes" | "checklist_templates" | "stock_levels",
  venueId: string
): Promise<number | ActionError> {
  const { count, error } = await ctx.supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId);

  if (error) {
    return actionError("INTERNAL_ERROR", "Could not verify plan limits.");
  }
  return count ?? 0;
}

export async function assertCanCreateIngredient(
  ctx: ActionUserContext,
  venueId: string
): Promise<true | LimitActionError | ActionError> {
  const plan = await getServerPlanForUser(ctx);
  const count = await countRows(ctx, "ingredients", venueId);
  if (typeof count !== "number") return count;
  return asActionError(enforceIngredientLimit(plan, count));
}

export async function assertCanCreateRecipe(
  ctx: ActionUserContext,
  venueId: string
): Promise<true | LimitActionError | ActionError> {
  const plan = await getServerPlanForUser(ctx);
  const count = await countRows(ctx, "recipes", venueId);
  if (typeof count !== "number") return count;
  return asActionError(enforceRecipeLimit(plan, count));
}

export async function assertCanCreateTemplate(
  ctx: ActionUserContext,
  venueId: string
): Promise<true | LimitActionError | ActionError> {
  const plan = await getServerPlanForUser(ctx);
  const count = await countRows(ctx, "checklist_templates", venueId);
  if (typeof count !== "number") return count;
  return asActionError(enforceTemplateLimit(plan, count));
}

export async function assertCanAddStockItems(
  ctx: ActionUserContext,
  venueId: string,
  newItemCount: number
): Promise<true | LimitActionError | ActionError> {
  const plan = await getServerPlanForUser(ctx);
  const count = await countRows(ctx, "stock_levels", venueId);
  if (typeof count !== "number") return count;
  return asActionError(enforceStockItemLimit(plan, count, newItemCount));
}

export async function assertCanUsePriceHistory(ctx: ActionUserContext): Promise<true | ActionError> {
  const access = await requireFeature("priceHistory", ctx);
  return "error" in access ? access : true;
}
