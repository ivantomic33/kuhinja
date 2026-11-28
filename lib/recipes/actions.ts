"use server";

import { z } from "zod";
import {
  RECIPE_LIST_MAX_PAGE_SIZE,
  RECIPE_LIST_MAX_QUERY_LENGTH,
  RECIPE_LIST_PAGE_SIZE,
  RECIPE_LIST_SORT_COLUMNS,
} from "@/lib/recipes/list-params";
import {
  fetchRecipeListPageWithCosts,
  type RecipeListPageResult,
} from "@/lib/recipes/list-server";
import { hasMinPlan } from "@/lib/plan/entitlements";
import { getPlan } from "@/lib/supabase/plan-server";
import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  type ActionResult,
} from "@/lib/server/action";

const listRecipesInputSchema = z
  .object({
    venueId: z.string().uuid(),
    query: z.string().max(RECIPE_LIST_MAX_QUERY_LENGTH).optional().default(""),
    page: z.number().int().min(0).max(100_000).optional().default(0),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(RECIPE_LIST_MAX_PAGE_SIZE)
      .optional()
      .default(RECIPE_LIST_PAGE_SIZE),
    sort: z
      .object({
        column: z.enum(RECIPE_LIST_SORT_COLUMNS),
        direction: z.enum(["ascending", "descending"]),
      })
      .optional(),
  })
  .strict();

export type ListRecipesInput = z.infer<typeof listRecipesInputSchema>;

/**
 * Authenticated, RLS-scoped recipe list page for client search/pagination.
 * Uses the user session client — never the service role.
 */
export async function listRecipesAction(
  input: unknown,
): Promise<ActionResult<RecipeListPageResult>> {
  const parsed = parseActionInput(listRecipesInputSchema, input);
  if ("error" in parsed) return parsed;

  const ctx = await requireActionUser();
  if ("error" in ctx) return ctx;

  const { venueId, query, page, pageSize, sort } = parsed.data;

  // Confirm venue is visible under RLS (membership / ownership).
  const { data: venue, error: venueError } = await ctx.supabase
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .maybeSingle();

  if (venueError) {
    return actionError("INTERNAL_ERROR", "Could not verify venue access.");
  }
  if (!venue) {
    return actionError("FORBIDDEN", "You do not have access to this venue.");
  }

  try {
    const plan = await getPlan();
    const canSeeInsights = hasMinPlan(plan, "pro");
    const result = await fetchRecipeListPageWithCosts(
      ctx.supabase,
      { venueId, query, page, pageSize, sort },
      canSeeInsights,
    );
    return actionData(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load recipes.";
    return actionError("INTERNAL_ERROR", message);
  }
}
