import { OfflineCacheSeeder } from "@/components/offline/OfflineCacheSeeder";
import { RecipesWorkspace } from "@/components/recipes/RecipesWorkspace";
import type { CachedIngredient } from "@/lib/offline/cache";
import { RECENT_RECIPE_LIMIT } from "@/lib/offline/cache";
import { hasMinPlan } from "@/lib/plan/entitlements";
import { dehydrateQuery, Hydrate } from "@/lib/query/hydrate";
import { queryKeys } from "@/lib/query/keys";
import { RECIPE_LIST_PAGE_SIZE } from "@/lib/recipes/list-params";
import { fetchRecipeListPageWithCosts } from "@/lib/recipes/list-server";
import { getPlan } from "@/lib/supabase/plan-server";
import { createClient } from "@/lib/supabase/server";
import type { Ingredient } from "@/lib/supabase/database.types";

export default async function RecipesPage() {
  const supabase = await createClient();
  const [plan, venuesRes, ingredientsRes, templatesRes] = await Promise.all([
    getPlan(),
    supabase.from("venues").select("id").order("created_at", { ascending: true }).limit(1),
    supabase
      .from("ingredients")
      .select("id, venue_id, name, unit, price, waste_percent, notes")
      .order("name", { ascending: true })
      .limit(RECENT_RECIPE_LIMIT),
    supabase.from("checklist_templates").select("id, name, venue_id").order("name", { ascending: true }),
  ]);
  const canSeeInsights = hasMinPlan(plan, "pro");
  const venueId = venuesRes.data?.[0]?.id ?? null;

  let listError = Boolean(venuesRes.error);
  let listPage = {
    rows: [] as Awaited<ReturnType<typeof fetchRecipeListPageWithCosts>>["rows"],
    totalCount: 0,
    page: 0,
    pageSize: RECIPE_LIST_PAGE_SIZE,
    pageCount: 1,
    query: "",
    sort: { column: "updated_at" as const, direction: "descending" as const },
  } as Awaited<ReturnType<typeof fetchRecipeListPageWithCosts>>;

  if (venueId) {
    try {
      listPage = await fetchRecipeListPageWithCosts(
        supabase,
        {
          venueId,
          query: "",
          page: 0,
          pageSize: RECIPE_LIST_PAGE_SIZE,
        },
        canSeeInsights,
      );
    } catch {
      listError = true;
    }
  }

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

  // Offline: only recent recipes from the first page (cap 20), never full catalog.
  const recipeRowsBase = listPage.rows.slice(0, RECENT_RECIPE_LIMIT).map((row) => ({
    id: row.id,
    venue_id: row.venue_id,
    name: row.name,
    description: row.description,
    portions: row.portions,
    selling_price: row.selling_price,
  }));

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

  const listKey = queryKeys.recipesList(venueId, {
    query: listPage.query,
    page: listPage.page,
    pageSize: listPage.pageSize,
    sort: listPage.sort,
  });

  return (
    <>
      <OfflineCacheSeeder
        recipes={recipeRowsBase}
        ingredients={ingredientRows}
        templates={templateRows}
      />
      <Hydrate state={dehydrateQuery(listKey, listPage)}>
        <RecipesWorkspace
          canSeeInsights={canSeeInsights}
          venueId={venueId}
          loadError={listError}
          initialListKey={listKey}
        />
      </Hydrate>
    </>
  );
}
