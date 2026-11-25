import type { VersionedIngredient, VersionedRecipe } from "@/lib/domain/versioned-update";
import type { IngredientUpdateInput, RecipeUpdateInput } from "@/lib/schemas/domain";
import type { ActionResult } from "@/lib/server/action";

type Patches = { ingredients: IngredientUpdateInput; recipes: RecipeUpdateInput };
type Rows = { ingredients: VersionedIngredient; recipes: VersionedRecipe };

export async function updateVersioned<R extends keyof Rows>(
  resource: R,
  input: { id: string; version: number; patch: Patches[R] }
): Promise<ActionResult<Rows[R]>> {
  const response = await fetch("/api/versioned-update", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resource, input }),
  });
  return response.json();
}
