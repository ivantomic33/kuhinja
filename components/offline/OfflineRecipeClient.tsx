"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FoodCostCalculator,
  type CalculatorIngredient,
  type CalculatorInitialLine,
} from "@/components/recipes/FoodCostCalculator";
import { getCachedIngredients, getCachedRecipe } from "@/lib/offline/cache";
import { useOnline } from "@/lib/hooks/useOnline";
import { sr } from "@/lib/i18n/sr";
import type { CalcUnit } from "@/lib/calc/foodcost";

export type OfflineRecipeClientProps = {
  recipeId: string;
  /** When server already rendered the recipe, skip offline fallback UI. */
  hasServerData: boolean;
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "missing" }
  | {
      status: "ready";
      recipeId: string;
      recipeName: string;
      recipeDescription: string | null;
      venueId: string;
      portions: number;
      sellingPrice: number;
      ingredients: CalculatorIngredient[];
      lines: CalculatorInitialLine[];
    };

/**
 * Offline fallback for recipe detail: reads last cached recipe + ingredients.
 * Also used when the server could not resolve the recipe (shows cache or 404).
 */
export function OfflineRecipeClient({
  recipeId,
  hasServerData,
}: OfflineRecipeClientProps) {
  const online = useOnline(true);
  const [state, setState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (hasServerData) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      const [recipe, cachedIngredients] = await Promise.all([
        getCachedRecipe(recipeId),
        getCachedIngredients(),
      ]);
      if (cancelled) return;

      if (!recipe) {
        setState({ status: "missing" });
        return;
      }

      const calcIngredients: CalculatorIngredient[] = cachedIngredients
        .filter((row) => row.venue_id === recipe.venue_id)
        .map((row) => ({
          id: row.id,
          name: row.name,
          unit: row.unit as CalcUnit,
          price: row.price,
          waste_percent: row.waste_percent,
        }));

      const initialLines: CalculatorInitialLine[] = (recipe.items ?? []).map(
        (item) => ({
          id: item.id,
          ingredientId: item.ingredient_id,
          quantity: item.quantity,
          unit: (item.unit ?? "g") as CalcUnit,
        })
      );

      setState({
        status: "ready",
        recipeId: recipe.id,
        recipeName: recipe.name,
        recipeDescription: recipe.description ?? null,
        venueId: recipe.venue_id,
        portions: Number(recipe.portions) || 1,
        sellingPrice: Number(recipe.selling_price) || 0,
        ingredients: calcIngredients,
        lines: initialLines,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [hasServerData, recipeId]);

  if (hasServerData) return null;

  if (state.status === "loading" || state.status === "idle") {
    return <p className="text-sm text-muted">{sr.common.loading}</p>;
  }

  if (state.status === "missing") {
    return (
      <div className="flex flex-col gap-2">
        {!online ? (
          <p className="text-sm text-muted">{sr.pwa.offline}</p>
        ) : null}
        <p className="text-base text-text">{sr.recipes.notFound}</p>
        <Link href="/dashboard" className="text-sm text-accent">
          {sr.recipes.backToDashboard}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">{sr.pwa.cachedDataHint}</p>
      <FoodCostCalculator
        recipeId={state.recipeId}
        recipeName={state.recipeName}
        recipeDescription={state.recipeDescription}
        venueId={state.venueId}
        portions={state.portions}
        sellingPrice={state.sellingPrice}
        ingredients={state.ingredients}
        initialLines={state.lines}
        allowPersist={online}
      />
    </div>
  );
}
