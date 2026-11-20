import {
  normalizeQuantity,
  type CalcUnit,
} from "@/lib/calc/foodcost";
import {
  touchRecentRecipe,
  type CachedRecipe,
  type CachedRecipeItem,
} from "@/lib/offline/cache";
import { recipeItemQuantitySchema } from "@/lib/schemas/domain";
import { createClient } from "@/lib/supabase/client";

export type RecipeItemSaveInput = {
  ingredientId: string;
  /** Quantity as entered in the UI */
  quantity: number;
  /** Unit of the entered quantity */
  quantityUnit: CalcUnit;
  /** Ingredient purchase unit (storage unit in DB) */
  ingredientUnit: CalcUnit;
};

export type RecipeCacheMeta = {
  id: string;
  venue_id: string;
  name: string;
  description?: string | null;
  portions: number;
  selling_price: number;
};

export type SaveRecipeItemsResult =
  | {
      ok: true;
      items: CachedRecipeItem[];
    }
  | {
      ok: false;
      code:
        | "empty"
        | "invalid"
        | "duplicate"
        | "incompatible"
        | "offline"
        | "error";
      message?: string;
    };

/**
 * Replace all recipe_items for a recipe.
 * Quantities are normalized to each ingredient's unit before insert.
 * DB enforces unique (recipe_id, ingredient_id).
 */
export async function saveRecipeItems(
  recipeId: string,
  drafts: RecipeItemSaveInput[],
  recipeMeta: RecipeCacheMeta
): Promise<SaveRecipeItemsResult> {
  const filled = drafts.filter((row) => row.ingredientId.trim().length > 0);

  if (filled.length === 0) {
    return { ok: false, code: "empty" };
  }

  const seen = new Set<string>();
  const rows: Array<{
    recipe_id: string;
    ingredient_id: string;
    quantity: number;
    unit: CalcUnit;
  }> = [];

  for (const draft of filled) {
    if (seen.has(draft.ingredientId)) {
      return { ok: false, code: "duplicate" };
    }
    seen.add(draft.ingredientId);

    const parsed = recipeItemQuantitySchema.safeParse(draft);
    if (!parsed.success) {
      return { ok: false, code: "invalid" };
    }

    const quantity = normalizeQuantity(
      parsed.data.quantity,
      parsed.data.quantityUnit,
      parsed.data.ingredientUnit
    );

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, code: "incompatible" };
    }

    rows.push({
      recipe_id: recipeId,
      ingredient_id: draft.ingredientId,
      quantity,
      unit: draft.ingredientUnit,
    });
  }

  try {
    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("recipe_items")
      .delete()
      .eq("recipe_id", recipeId);

    if (deleteError) {
      return { ok: false, code: "error", message: deleteError.message };
    }

    const { data, error: insertError } = await supabase
      .from("recipe_items")
      .insert(
        rows.map((row) => ({
          recipe_id: row.recipe_id,
          ingredient_id: row.ingredient_id,
          quantity: row.quantity,
        }))
      )
      .select("id, ingredient_id, quantity");

    if (insertError) {
      return { ok: false, code: "error", message: insertError.message };
    }

    const unitByIngredient = new Map(
      rows.map((row) => [row.ingredient_id, row.unit] as const)
    );

    const items: CachedRecipeItem[] = (data ?? []).map((row) => ({
      id: row.id,
      ingredient_id: row.ingredient_id,
      quantity: Number(row.quantity) || 0,
      unit: unitByIngredient.get(row.ingredient_id),
    }));

    const cached: Omit<CachedRecipe, "cachedAt"> = {
      id: recipeMeta.id,
      venue_id: recipeMeta.venue_id,
      name: recipeMeta.name,
      description: recipeMeta.description ?? null,
      portions: recipeMeta.portions,
      selling_price: recipeMeta.selling_price,
      items,
    };

    void touchRecentRecipe(cached);

    return { ok: true, items };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, code: "error", message };
  }
}
