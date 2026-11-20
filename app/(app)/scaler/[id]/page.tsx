import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BatchScaler,
  type BatchScalerIngredient,
} from "@/components/recipes/BatchScaler";
import {
  defaultPackageSize,
  type ScalerUnit,
  type ScalingMode,
} from "@/lib/calc/scaler";
import { sr } from "@/lib/i18n/sr";
import { getPlan } from "@/lib/supabase/plan-server";
import { createClient } from "@/lib/supabase/server";
import type { IngredientUnit } from "@/lib/supabase/database.types";

type ScalerPageProps = {
  params: Promise<{ id: string }>;
};

function toScalerUnit(unit: IngredientUnit): ScalerUnit {
  return unit;
}

/** Optional markers in ingredient notes: "scaling:sublinear" / "pak:500" */
function parseIngredientMeta(notes: string | null): {
  scaling: ScalingMode;
  packageSize: number | null;
} {
  if (!notes) {
    return { scaling: "linear", packageSize: null };
  }

  const lower = notes.toLowerCase();
  const scaling: ScalingMode = lower.includes("scaling:sublinear")
    ? "sublinear"
    : "linear";

  const packageMatch = notes.match(/pak(?:ovanje|age|):\s*(\d+(?:[.,]\d+)?)/i);
  const packageSize = packageMatch
    ? Number(packageMatch[1]?.replace(",", "."))
    : null;

  return {
    scaling,
    packageSize:
      packageSize !== null && Number.isFinite(packageSize) && packageSize > 0
        ? packageSize
        : null,
  };
}

/** Optional "vreme:45" or "time:45" in recipe description (minutes). */
function parseBaseTimeMinutes(description: string | null): number {
  if (!description) return 30;
  const match = description.match(/(?:vreme|time)\s*:\s*(\d+)/i);
  if (!match) return 30;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.min(24 * 60, Math.round(value));
}

export default async function BatchScalerPage({ params }: ScalerPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, name, venue_id, portions, description")
    .eq("id", id)
    .maybeSingle();

  if (recipeError || !recipe) {
    notFound();
  }

  const [{ data: itemsData }, plan] = await Promise.all([
    supabase
      .from("recipe_items")
      .select(
        "id, ingredient_id, quantity, ingredients ( id, name, unit, notes )"
      )
      .eq("recipe_id", recipe.id),
    getPlan(),
  ]);

  const ingredients: BatchScalerIngredient[] = (itemsData ?? [])
    .map((item): BatchScalerIngredient | null => {
      const joined = item.ingredients as
        | {
            id: string;
            name: string;
            unit: IngredientUnit;
            notes: string | null;
          }
        | {
            id: string;
            name: string;
            unit: IngredientUnit;
            notes: string | null;
          }[]
        | null;

      const ingredient = Array.isArray(joined) ? joined[0] : joined;
      if (!ingredient) return null;

      const meta = parseIngredientMeta(ingredient.notes);
      const unit = toScalerUnit(ingredient.unit);

      return {
        id: ingredient.id,
        name: ingredient.name,
        quantity: Number(item.quantity) || 0,
        unit,
        scaling: meta.scaling,
        packageSize: meta.packageSize ?? defaultPackageSize(unit),
      } satisfies BatchScalerIngredient;
    })
    .filter((row): row is BatchScalerIngredient => row !== null);

  const baseServings = Number(recipe.portions) > 0 ? Number(recipe.portions) : 1;
  const baseTimeMinutes = parseBaseTimeMinutes(recipe.description);

  return (
    <div className="flex flex-col gap-2">
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
          href={`/recipes/${recipe.id}`}
          className="text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[var(--radius-input)]"
        >
          {sr.scaler.backToRecipe}
        </Link>
      </div>

      <BatchScaler
        recipeId={recipe.id}
        recipeName={recipe.name}
        baseServings={baseServings}
        baseTimeMinutes={baseTimeMinutes}
        ingredients={ingredients}
        plan={plan}
      />
    </div>
  );
}
