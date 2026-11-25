"use server";

import { versionConflictError } from "@/lib/auth/version-conflict";
import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  type ActionResult,
} from "@/lib/server/action";
import {
  ingredientUpdateSchema,
  recipeUpdateSchema,
  type IngredientUnitInput,
} from "@/lib/schemas/domain";
import { z } from "zod";

const ingredientVersionedSchema = z
  .object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
    patch: ingredientUpdateSchema,
  })
  .strict();

const recipeVersionedSchema = z
  .object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
    patch: recipeUpdateSchema,
  })
  .strict();

export type VersionedIngredient = {
  id: string;
  venue_id: string;
  name: string;
  unit: IngredientUnitInput;
  price: number;
  waste_percent: number;
  notes: string | null;
  version: number;
};

export type VersionedRecipe = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  portions: number;
  selling_price: number;
  version: number;
};

/**
 * Update ingredient with optimistic lock (WHERE version = n).
 * Returns VERSION_CONFLICT when another device won (HTTP 409 semantics).
 */
export async function updateIngredientVersionedAction(
  input: unknown
): Promise<ActionResult<VersionedIngredient>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(ingredientVersionedSchema, input);
  if ("error" in parsed) return parsed;

  const { id, version, patch } = parsed.data;
  const { data, error } = await auth.supabase
    .from("ingredients")
    .update(patch)
    .eq("id", id)
    .eq("version", version)
    .select("id, venue_id, name, unit, price, waste_percent, notes, version")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return actionError("VALIDATION_ERROR", "duplicate");
    return actionError("INTERNAL_ERROR", error.message ?? "Update failed.");
  }
  if (!data) {
    return { error: versionConflictError() };
  }

  return actionData({
    id: data.id,
    venue_id: data.venue_id,
    name: data.name,
    unit: data.unit,
    price: Number(data.price) || 0,
    waste_percent: Number(data.waste_percent) || 0,
    notes: data.notes,
    version: data.version,
  });
}

/**
 * Update recipe with optimistic lock (WHERE version = n).
 */
export async function updateRecipeVersionedAction(
  input: unknown
): Promise<ActionResult<VersionedRecipe>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(recipeVersionedSchema, input);
  if ("error" in parsed) return parsed;

  const { id, version, patch } = parsed.data;
  const { data, error } = await auth.supabase
    .from("recipes")
    .update(patch)
    .eq("id", id)
    .eq("version", version)
    .select("id, venue_id, name, description, portions, selling_price, version")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return actionError("VALIDATION_ERROR", "duplicate");
    return actionError("INTERNAL_ERROR", error.message ?? "Update failed.");
  }
  if (!data) {
    return { error: versionConflictError() };
  }

  return actionData({
    id: data.id,
    venue_id: data.venue_id,
    name: data.name,
    description: data.description,
    portions: Number(data.portions) || 1,
    selling_price: Number(data.selling_price) || 0,
    version: data.version,
  });
}
