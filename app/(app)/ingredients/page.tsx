import { IngredientsWorkspace } from "@/components/ingredients/IngredientsWorkspace";
import { OfflineCacheSeeder } from "@/components/offline/OfflineCacheSeeder";
import type { CachedIngredient } from "@/lib/offline/cache";
import { dehydrateQuery, Hydrate } from "@/lib/query/hydrate";
import { queryKeys } from "@/lib/query/keys";
import { createClient } from "@/lib/supabase/server";
import type { Ingredient } from "@/lib/supabase/database.types";

export default async function IngredientsPage() {
  const supabase = await createClient();

  const [venuesRes, ingredientsRes, recipesRes, templatesRes] = await Promise.all([
    supabase.from("venues").select("id").order("created_at", { ascending: true }).limit(1),
    supabase
      .from("ingredients")
      .select("id, venue_id, name, unit, price, waste_percent, notes, version")
      .order("name", { ascending: true })
      .limit(200),
    supabase
      .from("recipes")
      .select("id, name, venue_id, portions, selling_price, description")
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase.from("checklist_templates").select("id, name, venue_id").order("name", { ascending: true }),
  ]);
  const venueId = venuesRes.data?.[0]?.id ?? null;

  const ingredients = (ingredientsRes.data ?? []) as Pick<
    Ingredient,
    | "id"
    | "venue_id"
    | "name"
    | "unit"
    | "price"
    | "waste_percent"
    | "notes"
    | "version"
  >[];

  const ingredientRows: CachedIngredient[] = ingredients.map((row) => ({
    id: row.id,
    venue_id: row.venue_id,
    name: row.name,
    unit: row.unit,
    price: Number(row.price) || 0,
    waste_percent: Number(row.waste_percent) || 0,
    notes: row.notes,
    version: row.version,
  }));

  const recipeRows = (recipesRes.data ?? []).map((row) => ({
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

  return (
    <>
      <OfflineCacheSeeder
        recipes={recipeRows}
        ingredients={ingredientRows}
        templates={templateRows}
      />
      <Hydrate state={dehydrateQuery(queryKeys.ingredients(venueId), ingredientRows)}>
        <IngredientsWorkspace
          venueId={venueId}
          loadError={Boolean(ingredientsRes.error || venuesRes.error)}
        />
      </Hydrate>
    </>
  );
}
