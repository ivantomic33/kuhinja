import "server-only";

import {
  getRecipeFoodCost,
  type RecipeCostLine,
  type RecipeFoodCost,
} from "@/lib/calc/recipe-food-cost";
import {
  RECIPE_ITEMS_BATCH_CAP,
  normalizeRecipeListParams,
  rangeForPage,
  recipeNameIlikePattern,
  resolveListPage,
  type RecipeListParams,
  type RecipeListSort,
} from "@/lib/recipes/list-params";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RecipeListItemRow = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  portions: number;
  selling_price: number;
  updated_at?: string | null;
  foodCost?: RecipeFoodCost;
};

export type RecipeListPageResult = {
  rows: RecipeListItemRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  query: string;
  sort: RecipeListSort;
};

type RecipeIngredientJoin = {
  name: string;
  unit: string;
  price: number | string | null;
  waste_percent: number | string | null;
};

type RecipeItemJoinRow = {
  id: string;
  recipe_id: string;
  quantity: number | string | null;
  ingredients: RecipeIngredientJoin | RecipeIngredientJoin[] | null;
};

const LIST_SELECT =
  "id, name, venue_id, portions, selling_price, description, updated_at" as const;

function mapBaseRow(row: {
  id: string;
  name: string;
  venue_id: string;
  portions: number | string | null;
  selling_price: number | string | null;
  description?: string | null;
  updated_at?: string | null;
}): RecipeListItemRow {
  return {
    id: row.id,
    venue_id: row.venue_id,
    name: row.name,
    description: row.description ?? null,
    portions: Number(row.portions) || 1,
    selling_price: Number(row.selling_price) || 0,
    updated_at: row.updated_at ?? null,
  };
}

/**
 * Load one page of recipes (no nested items). Uses the caller’s user-scoped
 * Supabase client so RLS stays in force — never the service role.
 */
export async function fetchRecipeListPage(
  supabase: Supabase,
  params: RecipeListParams,
): Promise<RecipeListPageResult> {
  const normalized = normalizeRecipeListParams(params);
  if (!normalized.venueId) {
    return {
      rows: [],
      totalCount: 0,
      page: 0,
      pageSize: normalized.pageSize,
      pageCount: 1,
      query: normalized.query,
      sort: normalized.sort,
    };
  }

  const pattern = recipeNameIlikePattern(normalized.query);
  const ascending = normalized.sort.direction === "ascending";

  const runQuery = async (page: number) => {
    const { from, to } = rangeForPage(page, normalized.pageSize);
    let q = supabase
      .from("recipes")
      .select(LIST_SELECT, { count: "exact" })
      .eq("venue_id", normalized.venueId)
      .order(normalized.sort.column, { ascending, nullsFirst: false })
      // Stable tie-break so equal sort keys never reshuffle across pages.
      .order("id", { ascending: true });

    if (pattern) {
      // ESCAPE '\' matches escapeIlikePattern()
      q = q.ilike("name", pattern);
    }

    return q.range(from, to);
  };

  let page = normalized.page;
  let { data, error, count } = await runQuery(page);

  if (error) {
    throw new Error(error.message || "Failed to load recipes.");
  }

  const totalCount = count ?? 0;
  const resolved = resolveListPage(page, totalCount, normalized.pageSize);
  if (resolved.outOfRange && resolved.page !== page) {
    page = resolved.page;
    ({ data, error, count } = await runQuery(page));
    if (error) {
      throw new Error(error.message || "Failed to load recipes.");
    }
  }

  const rows = ((data ?? []) as Parameters<typeof mapBaseRow>[0][]).map(mapBaseRow);
  const pageCount = resolveListPage(page, count ?? totalCount, normalized.pageSize).pageCount;

  return {
    rows,
    totalCount: count ?? totalCount,
    page,
    pageSize: normalized.pageSize,
    pageCount,
    query: normalized.query,
    sort: normalized.sort,
  };
}

/** Second query: recipe_items for the page IDs only, then food-cost in process. */
export async function attachRecipeFoodCosts(
  supabase: Supabase,
  rows: RecipeListItemRow[],
  canSeeInsights: boolean,
): Promise<RecipeListItemRow[]> {
  if (rows.length === 0) return rows;

  const ids = rows.map((row) => row.id);
  const { data, error } = await supabase
    .from("recipe_items")
    .select(
      "id, recipe_id, quantity, ingredients ( name, unit, price, waste_percent )",
    )
    .in("recipe_id", ids)
    .limit(RECIPE_ITEMS_BATCH_CAP);

  if (error) {
    // List still usable without cost cells.
    return rows.map((row) => ({ ...row, foodCost: getRecipeFoodCost([], row.selling_price, canSeeInsights) }));
  }

  const linesByRecipe = new Map<string, RecipeCostLine[]>();
  for (const item of (data ?? []) as RecipeItemJoinRow[]) {
    const ing = Array.isArray(item.ingredients) ? item.ingredients[0] : item.ingredients;
    if (!ing) continue;
    const list = linesByRecipe.get(item.recipe_id) ?? [];
    list.push({
      id: item.id,
      name: ing.name,
      quantity: Number(item.quantity) || 0,
      quantityUnit: ing.unit as RecipeCostLine["quantityUnit"],
      price: Number(ing.price) || 0,
      priceUnit: ing.unit as RecipeCostLine["priceUnit"],
      lossPercent: Number(ing.waste_percent) || 0,
    });
    linesByRecipe.set(item.recipe_id, list);
  }

  return rows.map((row) => ({
    ...row,
    foodCost: getRecipeFoodCost(
      linesByRecipe.get(row.id) ?? [],
      row.selling_price,
      canSeeInsights,
    ),
  }));
}

export async function fetchRecipeListPageWithCosts(
  supabase: Supabase,
  params: RecipeListParams,
  canSeeInsights: boolean,
): Promise<RecipeListPageResult> {
  const page = await fetchRecipeListPage(supabase, params);
  const rows = await attachRecipeFoodCosts(supabase, page.rows, canSeeInsights);
  return { ...page, rows };
}
