import Link from "next/link";
import { Suspense } from "react";
import {
  FoodCostCalculator,
  type CalculatorIngredient,
  type CalculatorInitialLine,
} from "@/components/recipes/FoodCostCalculator";
import { DeleteRecipeButton } from "@/components/recipes/DeleteRecipeButton";
import {
  PriceHistory,
  type PriceHistoryEntry,
} from "@/components/recipes/PriceHistory";
import { OfflineCacheSeeder } from "@/components/offline/OfflineCacheSeeder";
import { OfflineRecipeClient } from "@/components/offline/OfflineRecipeClient";
import { BentoCard } from "@/components/ui/BentoCard";
import type { CalcUnit } from "@/lib/calc/foodcost";
import { sr } from "@/lib/i18n/sr";
import { createClient } from "@/lib/supabase/server";
import type {
  Ingredient,
  IngredientUnit,
  Recipe,
} from "@/lib/supabase/database.types";

type RecipePageProps = {
  params: Promise<{ id: string }>;
};

type RecipeItemRow = {
  id: string;
  ingredient_id: string;
  quantity: number;
  ingredients:
    | { id: string; unit: IngredientUnit }
    | { id: string; unit: IngredientUnit }[]
    | null;
};

function toCalcUnit(unit: IngredientUnit): CalcUnit {
  return unit;
}

async function RecipePriceHistory({
  ingredientIds,
  ingredientNames,
}: {
  ingredientIds: string[];
  ingredientNames: Map<string, string>;
}) {
  if (ingredientIds.length === 0) return <PriceHistory entries={[]} />;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredient_price_history")
    .select("id, ingredient_id, price, recorded_at")
    .in("ingredient_id", ingredientIds)
    .order("recorded_at", { ascending: false })
    .limit(20);

  const entries: PriceHistoryEntry[] = (data ?? []).map((row) => ({
    id: row.id,
    ingredientName:
      ingredientNames.get(row.ingredient_id) ?? sr.recipes.foodCost.ingredient,
    price: Number(row.price) || 0,
    recordedAt: row.recorded_at,
  }));

  return <PriceHistory entries={entries} loadError={Boolean(error)} />;
}

export default async function RecipeFoodCostPage({ params }: RecipePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const recipeRes = await supabase
    .from("recipes")
    .select("id, name, venue_id, portions, selling_price, description")
    .eq("id", id)
    .maybeSingle();

  const recipe = recipeRes.data as Pick<
    Recipe,
    | "id"
    | "name"
    | "venue_id"
    | "portions"
    | "selling_price"
    | "description"
  > | null;

  if (recipeRes.error || !recipe) {
    return (
      <div className="flex flex-col gap-2">
        <OfflineRecipeClient recipeId={id} hasServerData={false} />
      </div>
    );
  }

  const [ingredientsRes, itemsRes] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id, name, unit, price, waste_percent, venue_id, notes")
      .eq("venue_id", recipe.venue_id)
      .order("name", { ascending: true }),
    supabase
      .from("recipe_items")
      .select("id, ingredient_id, quantity, ingredients ( id, unit )")
      .eq("recipe_id", recipe.id),
  ]);

  const ingredientsData = (ingredientsRes.data ?? []) as Pick<
    Ingredient,
    | "id"
    | "name"
    | "unit"
    | "price"
    | "waste_percent"
    | "venue_id"
    | "notes"
  >[];
  const itemsData = (itemsRes.data ?? []) as RecipeItemRow[];

  const ingredients: CalculatorIngredient[] = ingredientsData.map((row) => ({
    id: row.id,
    name: row.name,
    unit: toCalcUnit(row.unit),
    price: Number(row.price) || 0,
    waste_percent: Number(row.waste_percent) || 0,
  }));

  const ingredientUnitById = new Map(
    ingredients.map((item) => [item.id, item.unit] as const)
  );

  const ingredientNameById = new Map(
    ingredients.map((item) => [item.id, item.name] as const)
  );

  const initialLines: CalculatorInitialLine[] = itemsData.map((item) => {
    const joined = item.ingredients;
    const joinedUnit = Array.isArray(joined)
      ? joined[0]?.unit
      : joined?.unit;

    const unit = toCalcUnit(
      joinedUnit ?? ingredientUnitById.get(item.ingredient_id) ?? "g"
    );

    return {
      id: item.id,
      ingredientId: item.ingredient_id,
      quantity: Number(item.quantity) || 0,
      unit,
    };
  });

  const recipeIngredientIds = Array.from(
    new Set(initialLines.map((line) => line.ingredientId).filter(Boolean))
  );

  const cacheIngredients = ingredientsData.map((row) => ({
    id: row.id,
    venue_id: row.venue_id,
    name: row.name,
    unit: row.unit,
    price: Number(row.price) || 0,
    waste_percent: Number(row.waste_percent) || 0,
    notes: row.notes,
  }));

  return (
    <div className="flex flex-col gap-2">
      <OfflineCacheSeeder
        recipeDetail={{
          id: recipe.id,
          venue_id: recipe.venue_id,
          name: recipe.name,
          description: recipe.description,
          portions: Number(recipe.portions) || 1,
          selling_price: Number(recipe.selling_price) || 0,
          items: initialLines.map((line) => ({
            id: line.id,
            ingredient_id: line.ingredientId,
            quantity: line.quantity,
            unit: line.unit,
          })),
        }}
        ingredients={cacheIngredients}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[var(--radius-input)]"
          >
            ← {sr.recipes.backToDashboard}
          </Link>
          <span className="text-muted" aria-hidden="true">
            ·
          </span>
          <Link
            href={`/scaler/${recipe.id}`}
            className="text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[var(--radius-input)]"
          >
            {sr.recipes.openScaler}
          </Link>
        </div>
        <DeleteRecipeButton recipeId={recipe.id} recipeName={recipe.name} />
      </div>

      <FoodCostCalculator
        recipeId={recipe.id}
        recipeName={recipe.name}
        recipeDescription={recipe.description}
        venueId={recipe.venue_id}
        portions={Number(recipe.portions) || 1}
        sellingPrice={Number(recipe.selling_price) || 0}
        ingredients={ingredients}
        initialLines={initialLines}
        allowPersist
      />

      <Suspense
        fallback={
          <BentoCard
            header={
              <h2 className="text-base font-semibold text-text">
                {sr.premium.priceHistoryTitle}
              </h2>
            }
          >
            <p role="status" className="py-4 text-sm text-muted">
              {sr.common.loading}
            </p>
          </BentoCard>
        }
      >
        <RecipePriceHistory
          ingredientIds={recipeIngredientIds}
          ingredientNames={ingredientNameById}
        />
      </Suspense>
    </div>
  );
}
