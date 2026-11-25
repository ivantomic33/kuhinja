import { OfflineCacheSeeder } from "@/components/offline/OfflineCacheSeeder";
import { RecipesWorkspace } from "@/components/recipes/RecipesWorkspace";
import {
  getRecipeFoodCost,
  type RecipeCostLine,
} from "@/lib/calc/recipe-food-cost";
import type { CachedIngredient } from "@/lib/offline/cache";
import { hasMinPlan } from "@/lib/plan/entitlements";
import { dehydrateQuery, Hydrate } from "@/lib/query/hydrate";
import { queryKeys } from "@/lib/query/keys";
import { getPlan } from "@/lib/supabase/plan-server";
import { createClient } from "@/lib/supabase/server";
import type {
  Ingredient,
  Recipe,
} from "@/lib/supabase/database.types";

export default async function RecipesPage() {
  const supabase = await createClient();
  const [plan, venuesRes, recipesRes, ingredientsRes, templatesRes] = await Promise.all([
    getPlan(),
    supabase.from("venues").select("id").order("created_at", { ascending: true }).limit(1),
    supabase
      .from("recipes")
      .select(
        "id, name, venue_id, portions, selling_price, description, recipe_items ( id, quantity, ingredients ( name, unit, price, waste_percent ) )"
      )
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("ingredients")
      .select("id, venue_id, name, unit, price, waste_percent, notes")
      .order("name", { ascending: true })
      .limit(100),
    supabase.from("checklist_templates").select("id, name, venue_id").order("name", { ascending: true }),
  ]);
  const canSeeInsights = hasMinPlan(plan, "pro");
  const venueId = venuesRes.data?.[0]?.id ?? null;

  type RecipeIngredient = Pick<Ingredient, "name" | "unit" | "price" | "waste_percent">;
  type RecipeListRow = Pick<Recipe, "id" | "name" | "venue_id" | "portions" | "selling_price" | "description"> & {
    recipe_items: {
      id: string;
      quantity: number;
      ingredients: RecipeIngredient | RecipeIngredient[] | null;
    }[];
  };
  const recipes = (recipesRes.data ?? []) as RecipeListRow[];

  const ingredients = (ingredientsRes.data ?? []) as Pick<
    Ingredient,
    | "id"
    | "venue_id"
    | "name"
    | "unit"
    | "price"
    | "waste_percent"
    | "notes"
  >[];

  const recipeRowsBase = recipes.map((row) => ({
    id: row.id,
    venue_id: row.venue_id,
    name: row.name,
    description: row.description,
    portions: Number(row.portions) || 1,
    selling_price: Number(row.selling_price) || 0,
  }));

  const recipeRows = recipeRowsBase.map((row, index) => {
    const lines: RecipeCostLine[] = [];
    for (const item of recipes[index].recipe_items) {
      const ing = Array.isArray(item.ingredients) ? item.ingredients[0] : item.ingredients;
      if (!ing) continue;
      lines.push({
        id: item.id,
        name: ing.name,
        quantity: Number(item.quantity) || 0,
        quantityUnit: ing.unit,
        price: Number(ing.price) || 0,
        priceUnit: ing.unit,
        lossPercent: Number(ing.waste_percent) || 0,
      });
    }
    return {
      ...row,
      foodCost: getRecipeFoodCost(lines, row.selling_price, canSeeInsights),
    };
  });

  const ingredientRows: CachedIngredient[] = ingredients.map((row) => ({
    id: row.id,
    venue_id: row.venue_id,
    name: row.name,
    unit: row.unit,
    price: Number(row.price) || 0,
    waste_percent: Number(row.waste_percent) || 0,
    notes: row.notes,
  }));

  const templateRows = (templatesRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    venue_id: row.venue_id,
  }));

  return (
    <>
      <OfflineCacheSeeder
        recipes={recipeRowsBase}
        ingredients={ingredientRows}
        templates={templateRows}
      />
      <Hydrate state={dehydrateQuery(queryKeys.recipes(venueId), recipeRows)}>
        <RecipesWorkspace
          canSeeInsights={canSeeInsights}
          venueId={venueId}
          loadError={Boolean(recipesRes.error || venuesRes.error)}
        />
      </Hydrate>
    </>
  );
}
