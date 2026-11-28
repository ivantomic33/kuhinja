/**
 * Offline cache for recent recipes and ingredients via idb-keyval.
 * Keys are scoped by authenticated user id + active workspace id so shared
 * tablets and multi-restaurant accounts never mix data.
 * Format: `${userId}:${workspaceId}:<entity>`
 */
import { clear, createStore, del, entries, get, set } from "idb-keyval";
import type { IngredientUnit } from "@/lib/supabase/database.types";
import type { ChecklistItemInput } from "@/lib/schemas/domain";

/** IndexedDB database for the offline read cache. */
export const OFFLINE_CACHE_DB_NAME = "treuplate-cache";
const store = createStore(OFFLINE_CACHE_DB_NAME, "cache");

/** 7-day TTL for cached domain snapshots. */
export const OFFLINE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Soft cap on distinct key entries per user (lists + detail rows). */
export const OFFLINE_CACHE_MAX_KEYS_PER_USER = 20;

const LEGACY_KEYS = {
  recipes: "recent-recipes",
  ingredients: "ingredients",
  templates: "checklist-templates",
  recipePrefix: "recipe:",
  templatePrefix: "template:",
  runAliasPrefix: "run-alias:",
} as const;

export type CachedIngredient = {
  id: string;
  venue_id: string;
  name: string;
  unit: IngredientUnit;
  price: number;
  waste_percent: number;
  notes?: string | null;
  /** Optimistic lock token from ingredients.version. */
  version?: number;
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

type TimedPayload<T> = {
  data: T;
  savedAt: number;
};

export const RECENT_RECIPE_LIMIT = 20;

let cachedUserId: string | null | undefined;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

/** Resolve the signed-in user id for key scoping (null when logged out). */
export async function resolveOfflineUserId(): Promise<string | null> {
  if (!isBrowser()) return null;
  if (cachedUserId !== undefined) return cachedUserId;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().auth.getSession();
    cachedUserId = data.session?.user?.id ?? null;
  } catch {
    cachedUserId = null;
  }
  return cachedUserId;
}

/** Drop the memoized user id after sign-out. */
export function resetOfflineUserIdCache(): void {
  cachedUserId = undefined;
}

function userKey(userId: string, suffix: string): string {
  return `${userId}:${suffix}`;
}

function isFresh(savedAt: number, now = Date.now()): boolean {
  return now - savedAt <= OFFLINE_CACHE_TTL_MS;
}

async function readTimed<T>(key: string): Promise<T | null> {
  const raw = await get<TimedPayload<T> | T>(key, store);
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && "savedAt" in raw && "data" in raw) {
    const timed = raw as TimedPayload<T>;
    if (!isFresh(timed.savedAt)) {
      await del(key, store);
      return null;
    }
    return timed.data;
  }
  // Legacy unwrapped values — treat as expired so the next online load rewrites.
  await del(key, store);
  return null;
}

async function writeTimed<T>(key: string, data: T, userId: string): Promise<void> {
  const savedAt = Date.now();
  await set(key, { data, savedAt } satisfies TimedPayload<T>, store);
  await enforceUserKeyLimit(userId, savedAt);
}

async function enforceUserKeyLimit(userId: string, newestSavedAt: number): Promise<void> {
  const prefix = `${userId}:`;
  const all = await entries(store);
  const owned = all
    .filter(([key]) => typeof key === "string" && key.startsWith(prefix))
    .map(([key, value]) => {
      const savedAt =
        value && typeof value === "object" && value !== null && "savedAt" in value
          ? Number((value as TimedPayload<unknown>).savedAt) || 0
          : 0;
      return { key: String(key), savedAt };
    })
    .sort((a, b) => a.savedAt - b.savedAt);

  const overflow = owned.length - OFFLINE_CACHE_MAX_KEYS_PER_USER;
  if (overflow <= 0) return;

  // Drop oldest keys; never drop a key just written in this tick if possible.
  let removed = 0;
  for (const row of owned) {
    if (removed >= overflow) break;
    if (row.savedAt >= newestSavedAt && owned.length - removed <= OFFLINE_CACHE_MAX_KEYS_PER_USER) {
      continue;
    }
    await del(row.key, store);
    removed += 1;
  }
}

async function requireUserId(): Promise<string | null> {
  return resolveOfflineUserId();
}

export async function getChecklistRunAlias(id: string): Promise<string> {
  if (!isBrowser()) return id;
  const userId = await requireUserId();
  if (!userId) return id;
  return (await get<string>(userKey(userId, `${LEGACY_KEYS.runAliasPrefix}${id}`), store)) ?? id;
}

export async function saveChecklistRunAlias(id: string, canonicalId: string): Promise<void> {
  if (!isBrowser()) return;
  const userId = await requireUserId();
  if (!userId) return;
  await set(userKey(userId, `${LEGACY_KEYS.runAliasPrefix}${id}`), canonicalId, store);
}

/** True when payload is the recent-recipes array shape (not a list page object). */
function isCachedRecipeList(value: unknown): value is CachedRecipe[] {
  if (!Array.isArray(value)) return false;
  return value.every((row) => {
    if (!row || typeof row !== "object") return false;
    const item = row as Record<string, unknown>;
    return typeof item.id === "string" && typeof item.name === "string";
  });
}

async function readRecentRecipeList(key: string): Promise<CachedRecipe[]> {
  const raw = await readTimed<unknown>(key);
  if (raw == null) return [];
  // Old or foreign shapes (e.g. paged list objects) are a cache miss, not a crash.
  if (!isCachedRecipeList(raw)) {
    await del(key, store);
    return [];
  }
  return raw;
}

export async function saveRecentRecipes(
  recipes: Omit<CachedRecipe, "cachedAt">[]
): Promise<void> {
  if (!isBrowser()) return;
  const userId = await requireUserId();
  if (!userId) return;

  const key = userKey(userId, LEGACY_KEYS.recipes);
  const now = Date.now();
  const existing = await readRecentRecipeList(key);
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

  await writeTimed(key, merged, userId);
}

export async function touchRecentRecipe(
  recipe: Omit<CachedRecipe, "cachedAt">
): Promise<void> {
  await saveRecentRecipes([recipe]);
  if (!isBrowser()) return;
  const userId = await requireUserId();
  if (!userId) return;
  const detail: CachedRecipe = { ...recipe, cachedAt: Date.now() };
  await writeTimed(userKey(userId, `${LEGACY_KEYS.recipePrefix}${recipe.id}`), detail, userId);
}

export async function getRecentRecipes(): Promise<CachedRecipe[]> {
  if (!isBrowser()) return [];
  const userId = await requireUserId();
  if (!userId) return [];
  return readRecentRecipeList(userKey(userId, LEGACY_KEYS.recipes));
}

export async function getCachedRecipe(
  id: string
): Promise<CachedRecipe | null> {
  if (!isBrowser()) return null;
  const userId = await requireUserId();
  if (!userId) return null;
  const detailed = await readTimed<CachedRecipe>(
    userKey(userId, `${LEGACY_KEYS.recipePrefix}${id}`)
  );
  if (detailed) return detailed;
  const recent = await getRecentRecipes();
  return recent.find((row) => row.id === id) ?? null;
}

export async function removeCachedRecipe(id: string): Promise<void> {
  if (!isBrowser()) return;
  const userId = await requireUserId();
  if (!userId) return;
  const recent = await getRecentRecipes();
  const next = recent.filter((row) => row.id !== id);
  await writeTimed(userKey(userId, LEGACY_KEYS.recipes), next, userId);
  await del(userKey(userId, `${LEGACY_KEYS.recipePrefix}${id}`), store);
}

export async function saveIngredients(
  ingredients: CachedIngredient[]
): Promise<void> {
  if (!isBrowser()) return;
  const userId = await requireUserId();
  if (!userId) return;
  await writeTimed(userKey(userId, LEGACY_KEYS.ingredients), ingredients, userId);
}

export async function getCachedIngredients(
  venueId?: string
): Promise<CachedIngredient[]> {
  if (!isBrowser()) return [];
  const userId = await requireUserId();
  if (!userId) return [];
  const items =
    (await readTimed<CachedIngredient[]>(userKey(userId, LEGACY_KEYS.ingredients))) ?? [];
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
  const userId = await requireUserId();
  if (!userId) return;
  const existing = await getCachedTemplateSummaries();
  const byId = new Map<string, CachedTemplateSummary>();
  for (const row of existing) byId.set(row.id, row);
  for (const row of templates) byId.set(row.id, row);
  await writeTimed(
    userKey(userId, LEGACY_KEYS.templates),
    Array.from(byId.values()),
    userId
  );
}

export async function getCachedTemplateSummaries(): Promise<
  CachedTemplateSummary[]
> {
  if (!isBrowser()) return [];
  const userId = await requireUserId();
  if (!userId) return [];
  return (await readTimed<CachedTemplateSummary[]>(userKey(userId, LEGACY_KEYS.templates))) ?? [];
}

export async function saveChecklistTemplate(
  template: Omit<CachedTemplate, "cachedAt">
): Promise<void> {
  if (!isBrowser()) return;
  const userId = await requireUserId();
  if (!userId) return;
  const full: CachedTemplate = { ...template, cachedAt: Date.now() };
  await writeTimed(userKey(userId, `${LEGACY_KEYS.templatePrefix}${template.id}`), full, userId);
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
  const userId = await requireUserId();
  if (!userId) return null;
  return (
    (await readTimed<CachedTemplate>(
      userKey(userId, `${LEGACY_KEYS.templatePrefix}${id}`)
    )) ?? null
  );
}

export async function removeCachedTemplate(id: string): Promise<void> {
  if (!isBrowser()) return;
  const userId = await requireUserId();
  if (!userId) return;
  const summaries = await getCachedTemplateSummaries();
  const next = summaries.filter((row) => row.id !== id);
  await writeTimed(userKey(userId, LEGACY_KEYS.templates), next, userId);
  await del(userKey(userId, `${LEGACY_KEYS.templatePrefix}${id}`), store);
}

/** Delete every offline cache key that belongs to a user prefix. */
export async function clearOfflineCacheForUser(userId: string): Promise<void> {
  if (!isBrowser() || !userId) return;
  const prefix = `${userId}:`;
  const all = await entries(store);
  await Promise.all(
    all
      .filter(([key]) => typeof key === "string" && key.startsWith(prefix))
      .map(([key]) => del(String(key), store))
  );
}

/** Wipe the entire offline idb-keyval store (lists + recipe:/template: keys). */
export async function clearOfflineCache(): Promise<void> {
  if (!isBrowser()) return;
  await clear(store);
  resetOfflineUserIdCache();
}
