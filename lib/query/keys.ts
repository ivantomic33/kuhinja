import {
  recipeListKeyParts,
  type RecipeListSort,
} from "@/lib/recipes/list-params";

/** Stable TanStack Query keys for server-hydrated lists. */
export const queryKeys = {
  plan: ["profile", "plan"] as const,
  ingredients: (venueId: string | null) =>
    ["ingredients", venueId ?? "none"] as const,
  /** Legacy full-list key — prefer `recipesList` for paged server fetches. */
  recipes: (venueId: string | null) =>
    ["recipes", venueId ?? "none"] as const,
  /**
   * Server-paged recipe list. Include search/page/sort so stale responses
   * are dropped when the key changes (TanStack Query).
   */
  recipesList: (
    venueId: string | null,
    params: {
      query?: string;
      page?: number;
      pageSize?: number;
      sort?: RecipeListSort | null;
    } = {},
  ) =>
    ["recipes", "list", venueId ?? "none", recipeListKeyParts(params)] as const,
  recipesListRoot: (venueId: string | null) =>
    ["recipes", "list", venueId ?? "none"] as const,
  dashboard: (venueId: string | null) =>
    ["dashboard", venueId ?? "none"] as const,
} as const;
