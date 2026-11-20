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
import { BentoCard } from "@/components/ui/BentoCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FoodCostCell } from "@/components/ui/FoodCostCell";
import { SectionCardHeader } from "@/components/ui/SectionCardHeader";
import { useOnline } from "@/lib/hooks/useOnline";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import { getRecentRecipes, type CachedRecipe } from "@/lib/offline/cache";
import { FREE_MAX_RECIPES } from "@/lib/plan/limits";
import { formatMoney } from "@/lib/utils/format";
import { formatPortions } from "@/lib/utils/portions";

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
  const cost = use(costs).get(recipeId);
  return <FoodCostCell percent={cost?.percent} cost={cost?.amount} />;
}

export function RecentRecipesCard({
  initialRecipes,
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
    if (online && initialRecipes.length > 0) return;
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
    if (isFree && recipes.length >= FREE_MAX_RECIPES) {
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

  const shown = recipes.slice(0, 8);

  return (
    <>
      <BentoCard
        header={
          <SectionCardHeader
            title="Poslednji recepti"
            count={recipes.length}
            href="/recipes"
            onAdd={openCreate}
            addLabel={sr.create.recipe.add}
            subtitle="Food cost i prodajna cena"
          />
        }
      >
        {shown.length > 0 ? (
          <div className="max-h-80 overflow-auto app-scroll -mx-6 -mb-6">
            <table className="app-table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>Recept</th>
                  <th className="hide-sm">Porcije</th>
                  <th>Food cost %</th>
                  <th className="num">Cena</th>
                  <th>
                    <span className="sr-only">Akcije</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((recipe) => (
                  <tr key={recipe.id}>
                    <td>
                      <Link
                        href={`/recipes/${recipe.id}`}
                        className="flex items-center gap-3 no-underline text-inherit"
                      >
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-[var(--text-2)]">
                          <BookOpen className="size-5" aria-hidden="true" />
                        </span>
                        <span className="font-semibold text-text line-clamp-1">
                          {recipe.name}
                        </span>
                      </Link>
                    </td>
                    <td className="hide-sm text-[var(--text-2)]">
                      {formatPortions(recipe.portions)}
                    </td>
                    <td>
                      {initialRecipes.includes(recipe) ? (
                        <Suspense
                          fallback={
                            <span
                              aria-hidden="true"
                              className="inline-block h-3 w-24 rounded bg-surface-2 align-middle motion-safe:animate-pulse min-[901px]:w-40"
                            />
                          }
                        >
                          <RecipePreviewCost
                            recipeId={recipe.id}
                            costs={recipeFoodCosts}
                          />
                        </Suspense>
                      ) : (
                        <FoodCostCell
                          percent={recipe.foodCostPercent}
                          cost={recipe.foodCostAmount}
                        />
                      )}
                    </td>
                    <td className="num font-semibold">
                      {formatMoney(recipe.selling_price, { fractionDigits: 0 })}{" "}
                      din
                    </td>
                    <td className="w-12">
                      <div className="flex justify-end">
                        <DeleteRecipeButton
                          compact
                          recipeId={recipe.id}
                          recipeName={recipe.name}
                          onDeleted={handleDeleted}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen className="size-7" aria-hidden="true" />}
            title="Još nema recepata"
            description="Dodajte prvi recept."
            actionLabel="Dodaj recept"
            onAction={openCreate}
          />
        )}
      </BentoCard>

      <CreateRecipeSheet
        open={open}
        onClose={() => setOpen(false)}
        venueId={resolvedVenueId}
        currentCount={recipes.length}
        onCreated={handleCreated}
      />
    </>
  );
}
