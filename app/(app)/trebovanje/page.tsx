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

export default async function TrebovanjePage() {
  const supabase = await createClient();
  const venueQuery = supabase
    .from("venues")
    .select("id, stock_levels(id, venue_id, ingredient_id, qty, min_qty, used_today, used_on)")
    .order("created_at", { ascending: true })
    .limit(1);

  const ingredientsQuery = supabase
    .from("ingredients")
    .select("id, venue_id, name, unit, price, waste_percent, notes")
    .order("name", { ascending: true })
    .limit(200);

  const recipesQuery = supabase
    .from("recipes")
    .select("id, name, venue_id, portions, selling_price, description, recipe_items(ingredient_id, quantity, ingredients(name, unit, price, waste_percent))")
    .order("name", { ascending: true })
    .limit(100);

  const templatesQuery = supabase
    .from("checklist_templates")
    .select("id, name, venue_id")
    .order("name", { ascending: true });

  const [user, venuesRes, ingredientsRes, recipesRes, templatesRes] = await Promise.all([
    getServerUser(), venueQuery, ingredientsQuery, recipesQuery, templatesQuery,
  ]);
  const venue = venuesRes.data?.[0] as VenueRow | undefined;
  const venueId = venue?.id ?? null;

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

  const ingredientRows: CachedIngredient[] = ingredients.map((row) => ({
    id: row.id,
    venue_id: row.venue_id,
    name: row.name,
    unit: row.unit,
    price: Number(row.price) || 0,
    waste_percent: Number(row.waste_percent) || 0,
    notes: row.notes,
  }));

  const stockRows =
    venue
      ? mergeStockRows({
          venueId: venue.id,
          ingredients: ingredients.map((row) => ({
            id: row.id,
            name: row.name,
            unit: row.unit,
            price: Number(row.price) || 0,
          })),
          levels: venue.stock_levels,
        })
      : [];

  const recipeRecords = (recipesRes.data ?? []) as RecipeRow[];
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

  const templateRows = (templatesRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    venue_id: row.venue_id,
  }));

  const loadError = Boolean(
    ingredientsRes.error || venuesRes.error || recipesRes.error
  );

  return (
    <>
      <OfflineCacheSeeder
        recipes={recipesRes.error ? undefined : recipeRows}
        ingredients={ingredientsRes.error ? undefined : ingredientRows}
        templates={templatesRes.error ? undefined : templateRows}
      />
      <StockWorkspace
        venueId={venueId}
        initialRows={stockRows}
        recipes={recipes}
        loadError={loadError}
        userId={user?.id ?? null}
      />
    </>
  );
}
