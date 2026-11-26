/** Stable TanStack Query keys for server-hydrated lists. */
export const queryKeys = {
  plan: ["profile", "plan"] as const,
  ingredients: (venueId: string | null) =>
    ["ingredients", venueId ?? "none"] as const,
  recipes: (venueId: string | null) =>
    ["recipes", venueId ?? "none"] as const,
  dashboard: (venueId: string | null) =>
    ["dashboard", venueId ?? "none"] as const,
} as const;
