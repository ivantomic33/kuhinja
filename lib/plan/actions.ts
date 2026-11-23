"use server";

import {
  assertCanCreateIngredient,
  assertCanCreateRecipe,
  assertCanCreateTemplate,
  assertCanUsePriceHistory,
} from "@/lib/plan/server-enforce";
import { getFreeLimitCode } from "@/lib/plan/free-limit";
import { LIMIT_REACHED, formatLimitReachedMessage } from "@/lib/plan/limit-error";
import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  requireVenueOwner,
  type ActionResult,
} from "@/lib/server/action";
import {
  checklistTemplateInsertSchema,
  ingredientInsertSchema,
  ingredientPriceHistoryInsertSchema,
  recipeInsertSchema,
} from "@/lib/schemas/domain";
import type { Json } from "@/lib/supabase/database.types";

function mapInsertError(error: {
  message?: string;
  code?: string;
}): ActionResult<never> {
  const freeCode = getFreeLimitCode(error);
  if (freeCode || (error.message && error.message.includes(LIMIT_REACHED))) {
    return {
      error: {
        code: LIMIT_REACHED,
        message:
          error.message && error.message.includes(LIMIT_REACHED)
            ? error.message
            : formatLimitReachedMessage(
                freeCode === "FREE_LIMIT_INGREDIENTS"
                  ? "ingredients"
                  : freeCode === "FREE_LIMIT_RECIPES"
                    ? "recipes"
                    : freeCode === "FREE_LIMIT_TEMPLATES"
                      ? "templates"
                      : freeCode === "FREE_LIMIT_STOCK_ITEMS"
                        ? "stockItems"
                        : freeCode === "FREE_LIMIT_PRICE_HISTORY"
                          ? "priceHistory"
                          : "ingredients",
                error.message
              ),
      },
    };
  }
  if (
    error.code === "23505" ||
    (error.message ?? "").toLowerCase().includes("unique") ||
    (error.message ?? "").toLowerCase().includes("duplicate")
  ) {
    return actionError("VALIDATION_ERROR", "duplicate");
  }
  return actionError("INTERNAL_ERROR", error.message ?? "Insert failed.");
}

export type CreatedIngredient = {
  id: string;
  venue_id: string;
  name: string;
  unit: string;
  price: number;
  waste_percent: number;
  notes: string | null;
};

export type CreatedRecipe = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  portions: number;
  selling_price: number;
};

export type CreatedTemplate = {
  id: string;
  venue_id: string;
  name: string;
  items: Json;
};

/**
 * Create an ingredient. Plan limits are enforced from the server profile
 * before insert; DB triggers remain defense-in-depth.
 */
export async function createIngredientAction(
  input: unknown
): Promise<ActionResult<CreatedIngredient>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(ingredientInsertSchema, input);
  if ("error" in parsed) return parsed;

  const venue = await requireVenueOwner(auth, parsed.data.venue_id);
  if ("error" in venue) return venue;

  const limit = await assertCanCreateIngredient(auth, venue.venueId);
  if (limit !== true) return limit;

  const { data, error } = await auth.supabase
    .from("ingredients")
    .insert({
      venue_id: parsed.data.venue_id,
      name: parsed.data.name,
      unit: parsed.data.unit,
      price: parsed.data.price,
      waste_percent: parsed.data.waste_percent,
      notes: parsed.data.notes ?? null,
    })
    .select("id, venue_id, name, unit, price, waste_percent, notes")
    .single();

  if (error) return mapInsertError(error);
  if (!data) return actionError("INTERNAL_ERROR", "Insert failed.");

  return actionData({
    id: data.id,
    venue_id: data.venue_id,
    name: data.name,
    unit: data.unit,
    price: Number(data.price) || 0,
    waste_percent: Number(data.waste_percent) || 0,
    notes: data.notes,
  });
}

/**
 * Create a recipe. Free plan is capped; Pro+ is unlimited.
 */
export async function createRecipeAction(
  input: unknown
): Promise<ActionResult<CreatedRecipe>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(recipeInsertSchema, input);
  if ("error" in parsed) return parsed;

  const venue = await requireVenueOwner(auth, parsed.data.venue_id);
  if ("error" in venue) return venue;

  const limit = await assertCanCreateRecipe(auth, venue.venueId);
  if (limit !== true) return limit;

  const { data, error } = await auth.supabase
    .from("recipes")
    .insert({
      venue_id: parsed.data.venue_id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      portions: parsed.data.portions,
      selling_price: parsed.data.selling_price,
    })
    .select("id, venue_id, name, description, portions, selling_price")
    .single();

  if (error) return mapInsertError(error);
  if (!data) return actionError("INTERNAL_ERROR", "Insert failed.");

  return actionData({
    id: data.id,
    venue_id: data.venue_id,
    name: data.name,
    description: data.description,
    portions: Number(data.portions) || 1,
    selling_price: Number(data.selling_price) || 0,
  });
}

/**
 * Create a checklist template. Free: 1, Starter: 3, Pro+: unlimited.
 */
export async function createTemplateAction(
  input: unknown
): Promise<ActionResult<CreatedTemplate>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(checklistTemplateInsertSchema, input);
  if ("error" in parsed) return parsed;

  const venue = await requireVenueOwner(auth, parsed.data.venue_id);
  if ("error" in venue) return venue;

  const limit = await assertCanCreateTemplate(auth, venue.venueId);
  if (limit !== true) return limit;

  const { data, error } = await auth.supabase
    .from("checklist_templates")
    .insert({
      venue_id: parsed.data.venue_id,
      name: parsed.data.name,
      items: parsed.data.items as unknown as Json,
    })
    .select("id, venue_id, name, items")
    .single();

  if (error) return mapInsertError(error);
  if (!data) return actionError("INTERNAL_ERROR", "Insert failed.");

  return actionData({
    id: data.id,
    venue_id: data.venue_id,
    name: data.name,
    items: data.items as Json,
  });
}

/**
 * Insert a price-history row. Pro+ only — Free/Starter rejected with LIMIT_REACHED.
 */
export async function createPriceHistoryAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(ingredientPriceHistoryInsertSchema, input);
  if ("error" in parsed) return parsed;

  const access = await assertCanUsePriceHistory();
  if (access !== true) return access;

  // Confirm the ingredient belongs to a venue the user owns (RLS also enforces).
  const { data: ingredient, error: ingError } = await auth.supabase
    .from("ingredients")
    .select("id, venue_id")
    .eq("id", parsed.data.ingredient_id)
    .maybeSingle();

  if (ingError) {
    return actionError("INTERNAL_ERROR", "Could not verify ingredient.");
  }
  if (!ingredient) {
    return actionError("NOT_FOUND", "Ingredient not found.");
  }

  const venue = await requireVenueOwner(auth, ingredient.venue_id as string);
  if ("error" in venue) return venue;

  const { data, error } = await auth.supabase
    .from("ingredient_price_history")
    .insert({
      ingredient_id: parsed.data.ingredient_id,
      price: parsed.data.price,
      ...(parsed.data.recorded_at
        ? { recorded_at: parsed.data.recorded_at }
        : {}),
    })
    .select("id")
    .single();

  if (error) return mapInsertError(error);
  if (!data) return actionError("INTERNAL_ERROR", "Insert failed.");

  return actionData({ id: data.id as string });
}
