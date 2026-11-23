import { cache } from "react";
import { getServerUser, createClient } from "@/lib/supabase/server";

/**
 * Recipe count for the current authenticated user (RLS-scoped).
 * Uses getUser() so unauthenticated callers never hit the table.
 */
export const getRecipeCount = cache(async () => {
  const user = await getServerUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { count } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
});
