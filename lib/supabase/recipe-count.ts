import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getRecipeCount = cache(async () => {
  const supabase = await createClient();
  const { count } = await supabase.from("recipes").select("id", { count: "exact", head: true });
  return count ?? 0;
});
