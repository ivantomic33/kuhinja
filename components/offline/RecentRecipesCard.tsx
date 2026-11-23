"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  CreateRecipeSheet,
  type CreatedRecipeSummary,
} from "@/components/create/CreateRecipeSheet";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { DeleteRecipeButton } from "@/components/recipes/DeleteRecipeButton";
import { DashboardPreviewCard, dashboardRowClass } from "@/components/dashboard/DashboardLayout";
import { useOnline } from "@/lib/hooks/useOnline";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import { getRecentRecipes, type CachedRecipe } from "@/lib/offline/cache";
import { FREE_MAX_RECIPES } from "@/lib/plan/limits";
import { TableMoney } from "@/components/ui/TableMoney";
import { formatPercent } from "@/lib/utils/format";

export type RecipePreview = {
  id: string;
  name: string;
  venue_id: string;
  portions: number;
  selling_price: number;
  description?: string | null;
  foodCostPercent?: number | null;
  foodCostAmount?: number | null;
};

export type RecipeFoodCosts = Map<string, { percent: number; amount: number }>;

export type RecentRecipesCardProps = {
  initialRecipes: RecipePreview[];
  initialCount: number | null;
  recipeFoodCosts: Promise<RecipeFoodCosts>;
  venueId?: string | null;
};

function RecipePreviewCost({
  recipeId,
  costs,
}: {
  recipeId: string;
  costs: Promise<RecipeFoodCosts>;
}) {
  return formatPreviewCost(use(costs).get(recipeId)?.percent);
}

function formatPreviewCost(percent: number | null | undefined) {
  return percent == null ? "—" : formatPercent(percent, { fractionDigits: 0 });
}

export function RecentRecipesCard({
  initialRecipes,
  initialCount,
  recipeFoodCosts,
  venueId = null,
}: RecentRecipesCardProps) {
  const online = useOnline(true);
  const { isFree } = usePlan();
  const { showFreeLimit } = usePlanUi();
  const [recipes, setRecipes] = useState(initialRecipes);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setRecipes(initialRecipes);
  }, [initialRecipes]);

  useEffect(() => {
    if (online) return;
    void getRecentRecipes().then((cached: CachedRecipe[]) => {
      if (cached.length === 0) return;
      setRecipes(
        cached.map((row) => ({
          id: row.id,
          name: row.name,
          venue_id: row.venue_id,
          portions: row.portions,
          selling_price: row.selling_price,
          description: row.description,
        }))
      );
    });
  }, [online, initialRecipes.length]);

  const resolvedVenueId = useMemo(() => {
    if (venueId) return venueId;
    return recipes.find((row) => row.venue_id)?.venue_id ?? null;
  }, [venueId, recipes]);

  function openCreate() {
    if (isFree && (count ?? recipes.length) >= FREE_MAX_RECIPES) {
      showFreeLimit("FREE_LIMIT_RECIPES");
      return;
    }
    setOpen(true);
  }

  function handleCreated(recipe: CreatedRecipeSummary) {
    setRecipes((prev) => [
      recipe,
      ...prev.filter((row) => row.id !== recipe.id),
    ]);
  }

  function handleDeleted(recipeId: string) {
    setRecipes((prev) => prev.filter((row) => row.id !== recipeId));
  }

  const count = online
    ? initialCount === null ? null : initialCount + recipes.length - initialRecipes.length
    : recipes.length;
  const shown = recipes.slice(0, 3);

  return (
    <>
      <DashboardPreviewCard
        title={sr.dashboard.recentRecipes}
        count={count}
        href="/recipes"
        onAdd={openCreate}
        addLabel={sr.create.recipe.add}
        emptyTitle={sr.listStates.recipes.empty}
        emptyIcon={<BookOpen />}
        hasItems={shown.length > 0}
      >
        {shown.map((recipe) => (
          <li key={recipe.id} className={dashboardRowClass}>
            <BookOpen className="size-4 shrink-0 text-text-2" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <Link href={`/recipes/${recipe.id}`} className="block truncate font-semibold text-text hover:underline">
                {recipe.name}
              </Link>
              <p className="truncate text-ui-xs text-text-2">
                {recipe.selling_price > 0 ? <TableMoney value={recipe.selling_price} /> : "—"} · Food cost{" "}
                <span className="tabular-nums">
                  {initialRecipes.includes(recipe) ? (
                    <Suspense fallback={<span aria-hidden="true" className="inline-block h-3 w-8 rounded bg-surface-3 align-middle motion-safe:animate-pulse" />}>
                      <RecipePreviewCost recipeId={recipe.id} costs={recipeFoodCosts} />
                    </Suspense>
                  ) : formatPreviewCost(recipe.foodCostPercent)}
                </span>
              </p>
            </div>
            <DeleteRecipeButton compact recipeId={recipe.id} recipeName={recipe.name} onDeleted={handleDeleted} />
          </li>
        ))}
      </DashboardPreviewCard>

      <CreateRecipeSheet
        open={open}
        onClose={() => setOpen(false)}
        venueId={resolvedVenueId}
        currentCount={count ?? recipes.length}
        onCreated={handleCreated}
      />
    </>
  );
}
