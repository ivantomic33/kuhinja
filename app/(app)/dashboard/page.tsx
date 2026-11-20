import { Suspense } from "react";
import {
  DashboardClient,
  type ActivityItem,
} from "@/components/dashboard/DashboardClient";
import type {
  RecipeFoodCosts,
  RecipePreview,
} from "@/components/offline/RecentRecipesCard";
import type { TemplateRow } from "@/components/offline/ShiftTemplatesCard";
import type { CachedIngredient } from "@/lib/offline/cache";
import { foodCostPercentFromPrices, lineCost } from "@/lib/calc/foodcost";
import { sr } from "@/lib/i18n/sr";
import { classifyStockAlert } from "@/lib/stock/alerts";
import { getPlan } from "@/lib/supabase/plan-server";
import { createClient, getServerUser } from "@/lib/supabase/server";
import type {
  ChecklistTemplate,
  Ingredient,
  IngredientUnit,
  Recipe,
} from "@/lib/supabase/database.types";

type RecipeRow = Pick<
  Recipe,
  "id" | "name" | "venue_id" | "portions" | "selling_price" | "description"
>;

const greetingHourFormatter = new Intl.DateTimeFormat("sr-Latn", {
  timeZone: "Europe/Belgrade",
  hour: "numeric",
  hourCycle: "h23",
});

function greetingForHour(hour: number): string {
  if (hour < 12) return sr.dashboard.greetingMorning;
  if (hour < 18) return sr.dashboard.greetingAfternoon;
  return sr.dashboard.greetingEvening;
}

async function loadRecipeFoodCosts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipes: RecipePreview[],
): Promise<RecipeFoodCosts> {
  const foodCosts: RecipeFoodCosts = new Map();
  if (recipes.length === 0) return foodCosts;

  const { data } = await supabase
    .from("recipe_items")
    .select("recipe_id, quantity, ingredients ( unit, price, waste_percent )")
    .in("recipe_id", recipes.map((recipe) => recipe.id));

  type IngredientCost = { unit: IngredientUnit; price: number; waste_percent: number };
  type ItemRow = {
    recipe_id: string;
    quantity: number;
    ingredients: IngredientCost | IngredientCost[] | null;
  };

  const totals = new Map<string, number>();
  for (const { recipe_id, quantity, ingredients } of (data ?? []) as ItemRow[]) {
    const ingredient = Array.isArray(ingredients) ? ingredients[0] : ingredients;
    if (!ingredient) continue;
    const cost = lineCost({
      quantity: Number(quantity) || 0,
      quantityUnit: ingredient.unit,
      price: Number(ingredient.price) || 0,
      priceUnit: ingredient.unit,
      lossPercent: Number(ingredient.waste_percent) || 0,
    });
    totals.set(recipe_id, (totals.get(recipe_id) ?? 0) + cost);
  }

  for (const recipe of recipes) {
    const amount = totals.get(recipe.id);
    if (amount === undefined) continue;
    const percent = foodCostPercentFromPrices(amount, recipe.selling_price);
    foodCosts.set(recipe.id, { percent, amount });
  }

  return foodCosts;
}

async function RecipeActivityCost({
  recipeId,
  costs,
}: {
  recipeId: string;
  costs: Promise<RecipeFoodCosts>;
}) {
  const percent = (await costs).get(recipeId)?.percent;
  return percent == null ? "—" : `${Math.round(percent)}%`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const venueAndStock = Promise.resolve(
    supabase
      .from("venues")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
  ).then(async ({ data }) => {
    const venueId = data?.[0]?.id ?? null;
    if (!venueId) return { venueId, stockLevels: null };

    const stock = await supabase
      .from("stock_levels")
      .select("qty, min_qty, used_today, used_on")
      .eq("venue_id", venueId);
    return { venueId, stockLevels: stock.data };
  });

  const recipeInputs = Promise.resolve(
    supabase
      .from("recipes")
      .select("id, name, venue_id, portions, selling_price, description", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(20)
  ).then(({ data, count, error }) => {
    const rows: RecipePreview[] = ((data ?? []) as RecipeRow[]).map((row) => ({
      ...row,
      portions: Number(row.portions) || 1,
      selling_price: Number(row.selling_price) || 0,
    }));
    return { rows, count, error };
  });
  const recipeFoodCosts = recipeInputs
    .then(({ rows }) => loadRecipeFoodCosts(supabase, rows))
    .catch((): RecipeFoodCosts => new Map());

  const [user, plan, { venueId, stockLevels }, templatesRes, recipes, ingredientsRes] =
    await Promise.all([
      getServerUser(),
      getPlan(),
      venueAndStock,
      supabase
        .from("checklist_templates")
        .select("id, name, venue_id, items")
        .order("name", { ascending: true }),
      recipeInputs,
      supabase
        .from("ingredients")
        .select("id, venue_id, name, unit, price, waste_percent, notes", { count: "exact" })
        .order("name", { ascending: true })
        .limit(100),
    ]);

  const firstName =
    (
      (user?.user_metadata?.full_name as string | undefined) ||
      user?.email ||
      sr.app.name
    )
      .split(/\s+/)[0]
      ?.trim() || sr.app.name;

  const hour = Number(greetingHourFormatter.format(new Date()));
  const greeting = greetingForHour(hour);

  const templates = (templatesRes.data ?? []) as Array<
    Pick<ChecklistTemplate, "id" | "name" | "venue_id" | "items">
  >;
  const ingredients = (ingredientsRes.data ?? []) as Pick<
    Ingredient,
    | "id"
    | "venue_id"
    | "name"
    | "unit"
    | "price"
    | "waste_percent"
    | "notes"
  >[];

  const ingredientRows: CachedIngredient[] = ingredients.map((row) => ({
    id: row.id,
    venue_id: row.venue_id,
    name: row.name,
    unit: row.unit,
    price: Number(row.price) || 0,
    waste_percent: Number(row.waste_percent) || 0,
    notes: row.notes,
  }));

  const templateRows: TemplateRow[] = templates.map((row) => {
    const items = Array.isArray(row.items) ? row.items : [];
    let totalMinutes = 0;
    for (const item of items) {
      const mins =
        item && typeof item === "object" && "minutes" in item
          ? Number((item as { minutes?: number }).minutes) || 0
          : 0;
      totalMinutes += mins;
    }
    return {
      id: row.id,
      name: row.name,
      venue_id: row.venue_id,
      itemCount: items.length,
      totalMinutes,
    };
  });

  const activity: ActivityItem[] = [];
  if (ingredientRows[0]) {
    const ing = ingredientRows[0];
    activity.push({
      id: `ing-${ing.id}`,
      kind: "ingredient",
      title: `Dodat sastojak „${ing.name}”`,
      body: `${ing.price.toLocaleString("sr-RS", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} din/${ing.unit}`,
    });
  }
  if (recipes.rows[0]) {
    const r = recipes.rows[0];
    activity.push({
      id: `rec-${r.id}`,
      kind: "recipe",
      title: `Recept „${r.name}” ažuriran`,
      body: (
        <>
          Food cost{" "}
          <Suspense
            fallback={
              <span aria-hidden="true" className="inline-block h-3 w-7 rounded bg-surface-2 motion-safe:animate-pulse" />
            }
          >
            <RecipeActivityCost recipeId={r.id} costs={recipeFoodCosts} />
          </Suspense>
        </>
      ),
    });
  }

  const stockAlertCount = (stockLevels ?? []).filter((row) => {
    const { status } = classifyStockAlert({
      hasLevel: true,
      qty: Number(row.qty),
      min: Number(row.min_qty),
      usedToday: Number(row.used_today),
      usedOn: row.used_on,
    }, plan);
    return status === "crit" || status === "warn";
  }).length;

  return (
    <DashboardClient
      firstName={firstName}
      greeting={greeting}
      venueId={venueId}
      recipes={recipes.rows}
      recipeFoodCosts={recipeFoodCosts}
      recipeCount={recipes.count ?? recipes.rows.length}
      ingredients={ingredientRows}
      ingredientCount={ingredientsRes.count ?? ingredientRows.length}
      stockAlertCount={stockAlertCount}
      stockAlertsAreZeroOnly={plan === "free"}
      templates={templateRows}
      loadError={Boolean(recipes.error || ingredientsRes.error || templatesRes.error)}
      activity={activity}
    />
  );
}
