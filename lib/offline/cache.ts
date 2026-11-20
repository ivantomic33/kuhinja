/**
 * Offline cache for recent recipes and ingredients via idb-keyval.
 */
import { clear, createStore, del, get, set } from "idb-keyval";
import type { IngredientUnit } from "@/lib/supabase/database.types";
import type { ChecklistItemInput } from "@/lib/schemas/domain";

const store = createStore("mise-offline", "cache");

const KEYS = {
  recipes: "recent-recipes",
  ingredients: "ingredients",
  templates: "checklist-templates",
  recipePrefix: "recipe:",
  templatePrefix: "template:",
} as const;

export const RECENT_RECIPE_LIMIT = 20;

export type CachedIngredient = {
  id: string;
  venue_id: string;
  name: string;
  unit: IngredientUnit;
  price: number;
  waste_percent: number;
  notes?: string | null;
};

export type CachedRecipeItem = {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit?: IngredientUnit;
};

export type CachedRecipe = {
  id: string;
  venue_id: string;
  name: string;
  description?: string | null;
  portions: number;
  selling_price: number;
  items?: CachedRecipeItem[];
  cachedAt: number;
};

export type CachedTemplateSummary = {
  id: string;
  name: string;
  venue_id?: string;
};

export type CachedTemplate = {
  id: string;
  name: string;
  venue_id: string;
  items: ChecklistItemInput[];
  cachedAt: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export async function saveRecentRecipes(
  recipes: Omit<CachedRecipe, "cachedAt">[]
): Promise<void> {
  if (!isBrowser()) return;
  const now = Date.now();
  const existing = (await get<CachedRecipe[]>(KEYS.recipes, store)) ?? [];
  const byId = new Map<string, CachedRecipe>();

  for (const row of existing) {
    byId.set(row.id, row);
  }
  for (const row of recipes) {
    byId.set(row.id, { ...row, cachedAt: now });
  }

  const merged = Array.from(byId.values())
    .sort((a, b) => b.cachedAt - a.cachedAt)
    .slice(0, RECENT_RECIPE_LIMIT);

  await set(KEYS.recipes, merged, store);
}

export async function touchRecentRecipe(
  recipe: Omit<CachedRecipe, "cachedAt">
): Promise<void> {
  await saveRecentRecipes([recipe]);
  if (!isBrowser()) return;
  await set(
    `${KEYS.recipePrefix}${recipe.id}`,
    { ...recipe, cachedAt: Date.now() } satisfies CachedRecipe,
    store
  );
}

export async function getRecentRecipes(): Promise<CachedRecipe[]> {
  if (!isBrowser()) return [];
  return (await get<CachedRecipe[]>(KEYS.recipes, store)) ?? [];
}

export async function getCachedRecipe(
  id: string
): Promise<CachedRecipe | null> {
  if (!isBrowser()) return null;
  const detailed = await get<CachedRecipe>(`${KEYS.recipePrefix}${id}`, store);
  if (detailed) return detailed;
  const recent = await getRecentRecipes();
  return recent.find((row) => row.id === id) ?? null;
}

export async function removeCachedRecipe(id: string): Promise<void> {
  if (!isBrowser()) return;
  const recent = await getRecentRecipes();
  const next = recent.filter((row) => row.id !== id);
  await set(KEYS.recipes, next, store);
  await del(`${KEYS.recipePrefix}${id}`, store);
}

export async function saveIngredients(
  ingredients: CachedIngredient[]
): Promise<void> {
  if (!isBrowser()) return;
  await set(
    KEYS.ingredients,
    {
      cachedAt: Date.now(),
      items: ingredients,
    },
    store
  );
}

export async function getCachedIngredients(
  venueId?: string
): Promise<CachedIngredient[]> {
  if (!isBrowser()) return [];
  const payload = await get<{
    cachedAt: number;
    items: CachedIngredient[];
  }>(KEYS.ingredients, store);
  const items = payload?.items ?? [];
  if (!venueId) return items;
  return items.filter((item) => item.venue_id === venueId);
}

export async function removeCachedIngredient(id: string): Promise<void> {
  if (!isBrowser()) return;
  const items = await getCachedIngredients();
  const next = items.filter((row) => row.id !== id);
  await saveIngredients(next);
}

export async function saveTemplateSummaries(
  templates: CachedTemplateSummary[]
): Promise<void> {
  if (!isBrowser()) return;
  const existing = await getCachedTemplateSummaries();
  const byId = new Map<string, CachedTemplateSummary>();
  for (const row of existing) byId.set(row.id, row);
  for (const row of templates) byId.set(row.id, row);
  await set(
    KEYS.templates,
    { cachedAt: Date.now(), items: Array.from(byId.values()) },
    store
  );
}

export async function getCachedTemplateSummaries(): Promise<
  CachedTemplateSummary[]
> {
  if (!isBrowser()) return [];
  const payload = await get<{
    cachedAt: number;
    items: CachedTemplateSummary[];
  }>(KEYS.templates, store);
  return payload?.items ?? [];
}

export async function saveChecklistTemplate(
  template: Omit<CachedTemplate, "cachedAt">
): Promise<void> {
  if (!isBrowser()) return;
  const full: CachedTemplate = { ...template, cachedAt: Date.now() };
  await set(`${KEYS.templatePrefix}${template.id}`, full, store);
  await saveTemplateSummaries([
    {
      id: template.id,
      name: template.name,
      venue_id: template.venue_id,
    },
  ]);
}

export async function getCachedChecklistTemplate(
  id: string
): Promise<CachedTemplate | null> {
  if (!isBrowser()) return null;
  return (
    (await get<CachedTemplate>(`${KEYS.templatePrefix}${id}`, store)) ?? null
  );
}

export async function removeCachedTemplate(id: string): Promise<void> {
  if (!isBrowser()) return;
  const summaries = await getCachedTemplateSummaries();
  const next = summaries.filter((row) => row.id !== id);
  await set(
    KEYS.templates,
    { cachedAt: Date.now(), items: next },
    store
  );
  await del(`${KEYS.templatePrefix}${id}`, store);
}

/** Wipe the entire offline idb-keyval store (lists + recipe:/template: keys). */
export async function clearOfflineCache(): Promise<void> {
  if (!isBrowser()) return;
  await clear(store);
}
