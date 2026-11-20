import { Suspense } from "react";
import { OfflineCacheSeeder } from "@/components/offline/OfflineCacheSeeder";
import { StockWorkspace } from "@/components/stock/StockWorkspace";
import { mergeStockRows } from "@/lib/stock/actions";
import type { RecipeForSale } from "@/lib/stock/types";
import type { CachedIngredient } from "@/lib/offline/cache";
import { createClient, getServerUser } from "@/lib/supabase/server";
import type {
  Ingredient,
  Recipe,
  StockLevel,
} from "@/lib/supabase/database.types";

type SaleIngredient = Pick<Ingredient, "name" | "unit" | "price" | "waste_percent">;
type RecipeRow = Pick<Recipe, "id" | "name" | "portions" | "venue_id" | "selling_price" | "description"> & {
  recipe_items: Array<{
    ingredient_id: string;
    quantity: number;
    ingredients: SaleIngredient | SaleIngredient[] | null;
  }>;
};
type VenueRow = { id: string; stock_levels: Pick<StockLevel, "id" | "venue_id" | "ingredient_id" | "qty" | "min_qty" | "used_today" | "used_on">[] };

async function loadRecipes(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, name, venue_id, portions, selling_price, description, recipe_items(ingredient_id, quantity, ingredients(name, unit, price, waste_percent))")
    .order("name", { ascending: true })
    .limit(100);

  if (error) return null;
  const recipeRecords = (data ?? []) as RecipeRow[];
  const recipes: RecipeForSale[] = recipeRecords.map((row) => ({
    id: row.id,
    name: row.name,
    portions: Number(row.portions) || 1,
    sellingPrice: Number(row.selling_price) || 0,
    items: row.recipe_items.flatMap((item) => {
      const ingredient = Array.isArray(item.ingredients) ? item.ingredients[0] : item.ingredients;
      if (!ingredient) return [];
      return [{
        ingredientId: item.ingredient_id,
        name: ingredient.name,
        unit: ingredient.unit,
        quantity: Number(item.quantity) || 0,
        price: Number(ingredient.price) || 0,
        wastePercent: Number(ingredient.waste_percent) || 0,
      }];
    }),
  }));

  const recipeRows = recipeRecords.map((row) => ({
    id: row.id,
    venue_id: row.venue_id,
    name: row.name,
    description: row.description,
    portions: Number(row.portions) || 1,
    selling_price: Number(row.selling_price) || 0,
  }));

  return { recipes, recipeRows };
}

async function loadTemplates(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("checklist_templates")
    .select("id, name, venue_id")
    .order("name", { ascending: true });
  return error ? undefined : data ?? [];
}

async function DeferredOfflineCache({
  ingredients,
  recipeData,
  templates,
}: {
  ingredients?: CachedIngredient[];
  recipeData: ReturnType<typeof loadRecipes>;
  templates: ReturnType<typeof loadTemplates>;
}) {
  const [recipes, templateRows] = await Promise.all([recipeData, templates]);
  return <OfflineCacheSeeder ingredients={ingredients} recipes={recipes?.recipeRows} templates={templateRows} />;
}

export default async function TrebovanjePage() {
  const supabase = await createClient();
  const recipeData = loadRecipes(supabase).catch(() => null);
  const templates = loadTemplates(supabase).catch(() => undefined);
  const [user, venuesRes, ingredientsRes] = await Promise.all([
    getServerUser(),
    supabase
      .from("venues")
      .select("id, stock_levels(id, venue_id, ingredient_id, qty, min_qty, used_today, used_on)")
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("ingredients")
      .select("id, venue_id, name, unit, price, waste_percent, notes")
      .order("name", { ascending: true })
      .limit(200),
  ]);
  const venue = venuesRes.data?.[0] as VenueRow | undefined;
  const ingredients = (ingredientsRes.data ?? []) as CachedIngredient[];
  const ingredientRows = ingredients.map((row) => ({
    ...row,
    price: Number(row.price) || 0,
    waste_percent: Number(row.waste_percent) || 0,
  }));
  const stockRows = venue ? mergeStockRows({
    venueId: venue.id,
    ingredients: ingredientRows,
    levels: venue.stock_levels,
  }) : [];

  return (
    <>
      <Suspense fallback={null}>
        <DeferredOfflineCache
          ingredients={ingredientsRes.error ? undefined : ingredientRows}
          recipeData={recipeData}
          templates={templates}
        />
      </Suspense>
      <StockWorkspace
        venueId={venue?.id ?? null}
        initialRows={stockRows}
        recipes={recipeData.then((result) => result?.recipes ?? null)}
        loadError={Boolean(ingredientsRes.error || venuesRes.error)}
        userId={user?.id ?? null}
      />
    </>
  );
}
