/**
 * Pure helpers for server-side recipe list pagination and search.
 * No I/O — safe for unit tests and shared by server + client.
 */

export const RECIPE_LIST_PAGE_SIZE = 25;
export const RECIPE_LIST_MAX_PAGE_SIZE = 50;
export const RECIPE_LIST_MAX_QUERY_LENGTH = 100;
/** Safety cap when batch-loading recipe_items for food-cost on one page. */
export const RECIPE_ITEMS_BATCH_CAP = 2000;
/** Trebovanje / sale picker hard caps (replace silent limit(100)). */
export const TREBOVANJE_RECIPES_CAP = 500;
export const TREBOVANJE_INGREDIENTS_CAP = 1000;

export const RECIPE_LIST_SORT_COLUMNS = [
  "name",
  "portions",
  "selling_price",
  "updated_at",
] as const;

export type RecipeListSortColumn = (typeof RECIPE_LIST_SORT_COLUMNS)[number];
export type RecipeListSortDirection = "ascending" | "descending";

export type RecipeListSort = {
  column: RecipeListSortColumn;
  direction: RecipeListSortDirection;
};

export type RecipeListParams = {
  venueId: string;
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: RecipeListSort;
};

export type NormalizedRecipeListParams = {
  venueId: string;
  query: string;
  page: number;
  pageSize: number;
  sort: RecipeListSort;
};

const DEFAULT_SORT: RecipeListSort = {
  column: "updated_at",
  direction: "descending",
};

/** Escape `%`, `_`, and `\` so user input is literal in ILIKE patterns. */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Trim and bound search text; empty string means no name filter. */
export function normalizeRecipeSearchQuery(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim().slice(0, RECIPE_LIST_MAX_QUERY_LENGTH);
}

export function isRecipeListSortColumn(value: string): value is RecipeListSortColumn {
  return (RECIPE_LIST_SORT_COLUMNS as readonly string[]).includes(value);
}

export function normalizeRecipeListSort(sort?: Partial<RecipeListSort> | null): RecipeListSort {
  const column =
    sort?.column && isRecipeListSortColumn(sort.column) ? sort.column : DEFAULT_SORT.column;
  const direction =
    sort?.direction === "ascending" || sort?.direction === "descending"
      ? sort.direction
      : column === DEFAULT_SORT.column
        ? DEFAULT_SORT.direction
        : "ascending";
  return { column, direction };
}

export function clampRecipePageSize(pageSize?: number): number {
  const n = Number(pageSize);
  if (!Number.isFinite(n) || n <= 0) return RECIPE_LIST_PAGE_SIZE;
  return Math.min(Math.floor(n), RECIPE_LIST_MAX_PAGE_SIZE);
}

export function pageCountFromTotal(totalCount: number, pageSize: number): number {
  const size = Math.max(1, pageSize);
  if (totalCount <= 0) return 1;
  return Math.ceil(totalCount / size);
}

export function clampPageIndex(page: number, pageCount: number): number {
  const count = Math.max(1, pageCount);
  if (!Number.isFinite(page) || page < 0) return 0;
  return Math.min(Math.floor(page), count - 1);
}

/** Inclusive Supabase/PostgREST `.range(from, to)`. */
export function rangeForPage(page: number, pageSize: number): { from: number; to: number } {
  const size = Math.max(1, pageSize);
  const safePage = Math.max(0, Math.floor(page));
  const from = safePage * size;
  return { from, to: from + size - 1 };
}

export function normalizeRecipeListParams(
  input: RecipeListParams,
): NormalizedRecipeListParams {
  const pageSize = clampRecipePageSize(input.pageSize);
  const query = normalizeRecipeSearchQuery(input.query);
  const sort = normalizeRecipeListSort(input.sort);
  const page = clampPageIndex(Number(input.page) || 0, Number.MAX_SAFE_INTEGER);
  return {
    venueId: input.venueId,
    query,
    page,
    pageSize,
    sort,
  };
}

/** Build ILIKE pattern for name search; caller skips filter when null. */
export function recipeNameIlikePattern(query: string): string | null {
  const q = normalizeRecipeSearchQuery(query);
  if (!q) return null;
  return `%${escapeIlikePattern(q)}%`;
}

/**
 * Re-clamp page after the server returns totalCount (last page / empty).
 * Returns whether the requested page was out of range.
 */
export function resolveListPage(
  requestedPage: number,
  totalCount: number,
  pageSize: number,
): { page: number; pageCount: number; outOfRange: boolean } {
  const pageCount = pageCountFromTotal(totalCount, pageSize);
  const page = clampPageIndex(requestedPage, pageCount);
  return {
    page,
    pageCount,
    outOfRange: page !== clampPageIndex(requestedPage, Number.MAX_SAFE_INTEGER) && requestedPage > 0
      ? page !== requestedPage
      : requestedPage > 0 && requestedPage >= pageCount,
  };
}

/** Stable TanStack query-key fragment for list params. */
export function recipeListKeyParts(params: {
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: RecipeListSort | null;
}): {
  q: string;
  page: number;
  pageSize: number;
  sort: string;
  dir: RecipeListSortDirection;
} {
  const normalized = normalizeRecipeListParams({
    venueId: "key",
    query: params.query,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort ?? undefined,
  });
  return {
    q: normalized.query,
    page: normalized.page,
    pageSize: normalized.pageSize,
    sort: normalized.sort.column,
    dir: normalized.sort.direction,
  };
}
