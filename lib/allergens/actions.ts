"use server";

import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  type ActionResult,
} from "@/lib/server/action";
import {
  ALLERGEN_CODES,
  type AllergenCode,
  type AllergenPresence,
} from "./catalog";
import { buildRecipeAllergenMatrix, dedupeAllergenItems } from "./matrix";
import {
  getRecipeAllergenMatrixSchema,
  setIngredientAllergensSchema,
} from "./schemas";

export type IngredientAllergenItem = {
  code: AllergenCode;
  presence: AllergenPresence;
};

export type RecipeAllergenMatrixData = {
  recipeId: string;
  recipeName: string;
  workspaceId: string;
  ingredients: { id: string; name: string }[];
  cells: {
    ingredientId: string;
    code: AllergenCode;
    presence: AllergenPresence | null;
  }[];
  totals: { code: AllergenCode; presence: AllergenPresence }[];
};

function mapRpcError(error: {
  message?: string;
  code?: string;
}): ActionResult<never> {
  const message = error.message ?? "Request failed.";
  if (message.includes("UPGRADE_REQUIRED") || message.includes("P0001")) {
    return actionError(
      "UPGRADE_REQUIRED",
      "Za matricu alergena potreban je Pro paket vlasnika radnog prostora.",
    );
  }
  if (error.code === "42501" || message.toLowerCase().includes("access denied")) {
    return actionError("FORBIDDEN", "Nemate dozvolu za ovu radnju.");
  }
  if (message.includes("INGREDIENT_NOT_FOUND") || error.code === "P0002") {
    return actionError("NOT_FOUND", "Sastojak nije pronađen.");
  }
  if (
    message.includes("INVALID_") ||
    message.includes("TOO_MANY") ||
    error.code === "22023"
  ) {
    return actionError("VALIDATION_ERROR", message);
  }
  return actionError("INTERNAL_ERROR", message);
}

/**
 * Replace allergen rows for one ingredient (chef+ and Pro workspace).
 */
export async function setIngredientAllergens(
  input: unknown,
): Promise<ActionResult<{ ingredientId: string; items: IngredientAllergenItem[] }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(setIngredientAllergensSchema, input);
  if ("error" in parsed) return parsed;

  const items = dedupeAllergenItems(parsed.data.items);

  const { error } = await auth.supabase.rpc("set_ingredient_allergens", {
    p_ingredient_id: parsed.data.ingredientId,
    p_items: items,
  });

  if (error) return mapRpcError(error);

  return actionData({
    ingredientId: parsed.data.ingredientId,
    items,
  });
}

/**
 * Load ingredient-level + aggregated recipe allergen matrix.
 * Returns UPGRADE_REQUIRED without real rows when the feature is locked.
 */
export async function getRecipeAllergenMatrix(
  input: unknown,
): Promise<ActionResult<RecipeAllergenMatrixData>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(getRecipeAllergenMatrixSchema, input);
  if ("error" in parsed) return parsed;

  const { data: recipe, error: recipeError } = await auth.supabase
    .from("recipes")
    .select("id, name, workspace_id")
    .eq("id", parsed.data.recipeId)
    .maybeSingle();

  if (recipeError) {
    return actionError("INTERNAL_ERROR", recipeError.message);
  }
  if (!recipe) {
    return actionError("NOT_FOUND", "Recept nije pronađen.");
  }

  const workspaceId = recipe.workspace_id as string;

  const { data: hasFeature, error: featureError } = await auth.supabase.rpc(
    "workspace_has_feature",
    { p_workspace_id: workspaceId, p_feature: "allergens" },
  );

  if (featureError) {
    return actionError("INTERNAL_ERROR", featureError.message);
  }
  if (!hasFeature) {
    return actionError(
      "UPGRADE_REQUIRED",
      "Za matricu alergena potreban je Pro paket vlasnika radnog prostora.",
    );
  }

  const { data: itemRows, error: itemsError } = await auth.supabase
    .from("recipe_items")
    .select("ingredient_id, ingredients ( id, name )")
    .eq("recipe_id", recipe.id);

  if (itemsError) {
    return actionError("INTERNAL_ERROR", itemsError.message);
  }

  type JoinedIngredient = { id: string; name: string };
  const ingredients: { id: string; name: string }[] = [];
  const ingredientIds: string[] = [];

  for (const row of itemRows ?? []) {
    const joined = row.ingredients as JoinedIngredient | JoinedIngredient[] | null;
    const ingredient = Array.isArray(joined) ? joined[0] : joined;
    const id = ingredient?.id ?? (row.ingredient_id as string);
    if (!id || ingredientIds.includes(id)) continue;
    ingredientIds.push(id);
    ingredients.push({
      id,
      name: ingredient?.name ?? "Sastojak",
    });
  }

  if (ingredientIds.length === 0) {
    return actionData({
      recipeId: recipe.id,
      recipeName: recipe.name,
      workspaceId,
      ingredients: [],
      cells: [],
      totals: [],
    });
  }

  const { data: allergenRows, error: allergenError } = await auth.supabase
    .from("ingredient_allergens")
    .select("ingredient_id, allergen_code, presence")
    .in("ingredient_id", ingredientIds);

  if (allergenError) {
    return actionError("INTERNAL_ERROR", allergenError.message);
  }

  const flat = (allergenRows ?? []).flatMap((row) => {
    const code = row.allergen_code as string;
    const presence = row.presence as string;
    if (!(ALLERGEN_CODES as readonly string[]).includes(code)) return [];
    if (presence !== "contains" && presence !== "trace") return [];
    return [
      {
        ingredientId: row.ingredient_id as string,
        code: code as AllergenCode,
        presence: presence as AllergenPresence,
      },
    ];
  });

  const matrix = buildRecipeAllergenMatrix(ingredientIds, flat);

  return actionData({
    recipeId: recipe.id,
    recipeName: recipe.name,
    workspaceId,
    ingredients,
    cells: matrix.cells,
    totals: matrix.totals,
  });
}

/**
 * Load allergens for one ingredient (editor). Empty when locked / none set.
 */
export async function getIngredientAllergens(
  ingredientId: string,
): Promise<ActionResult<{ items: IngredientAllergenItem[]; locked: boolean }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  if (!zUuid(ingredientId)) {
    return actionError("VALIDATION_ERROR", "Neispravan identifikator sastojka.");
  }

  const { data: ingredient, error: ingredientError } = await auth.supabase
    .from("ingredients")
    .select("id, workspace_id")
    .eq("id", ingredientId)
    .maybeSingle();

  if (ingredientError) {
    return actionError("INTERNAL_ERROR", ingredientError.message);
  }
  if (!ingredient) {
    return actionError("NOT_FOUND", "Sastojak nije pronađen.");
  }

  const { data: hasFeature } = await auth.supabase.rpc("workspace_has_feature", {
    p_workspace_id: ingredient.workspace_id,
    p_feature: "allergens",
  });

  if (!hasFeature) {
    return actionData({ items: [], locked: true });
  }

  const { data, error } = await auth.supabase
    .from("ingredient_allergens")
    .select("allergen_code, presence")
    .eq("ingredient_id", ingredientId);

  if (error) {
    return actionError("INTERNAL_ERROR", error.message);
  }

  const items = dedupeAllergenItems(
    (data ?? []).flatMap((row) => {
      const code = row.allergen_code as string;
      const presence = row.presence as string;
      if (!(ALLERGEN_CODES as readonly string[]).includes(code)) return [];
      if (presence !== "contains" && presence !== "trace") return [];
      return [{ code: code as AllergenCode, presence: presence as AllergenPresence }];
    }),
  );

  return actionData({ items, locked: false });
}

function zUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
