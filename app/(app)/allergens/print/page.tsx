import { MenuAllergenPrintTable } from "@/components/allergens/MenuAllergenPrintTable";
import { createClient } from "@/lib/supabase/server";

export default async function AllergenPrintPage() {
  const supabase = await createClient();
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id")
    .order("name", { ascending: true })
    .limit(200);

  return (
    <MenuAllergenPrintTable
      recipeIds={(recipes ?? []).map((recipe) => recipe.id)}
      loadError={Boolean(error)}
    />
  );
}
