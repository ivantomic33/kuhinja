"use client";

import { memo, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Info, Plus, Search } from "lucide-react";
import {
  CreateRecipeSheet,
  type CreatedRecipeSummary,
} from "@/components/create/CreateRecipeSheet";
import { DeleteRecipeButton } from "@/components/recipes/DeleteRecipeButton";
import { RecipeFoodCostDialog } from "@/components/recipes/RecipeFoodCostDialog";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { Badge } from "@/components/ui/Badge";
import { BentoCard } from "@/components/ui/BentoCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FoodCostCell } from "@/components/ui/FoodCostCell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { UsageStrip } from "@/components/ui/UsageStrip";
import { useWorkspacePagination, WorkspacePagination } from "@/components/ui/WorkspacePagination";
import {
  FOOD_COST_FAR_OVER,
  FOOD_COST_TARGET_LABEL,
  FOOD_COST_TARGET_MAX,
  type RecipeFoodCost,
} from "@/lib/calc/recipe-food-cost";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import { FREE_MAX_RECIPES } from "@/lib/plan/limits";
import { formatMoney } from "@/lib/utils/format";
import { formatPortions } from "@/lib/utils/portions";

const RecipeFoodCostCell = memo(FoodCostCell);

export type RecipeListItem = {
  id: string;
  name: string;
  venue_id: string;
  portions: number;
  selling_price: number;
  description?: string | null;
  foodCost?: RecipeFoodCost;
  updatedLabel?: string | null;
};

export type RecipesWorkspaceProps = {
  initialRecipes: RecipeListItem[];
  canSeeInsights: boolean;
  venueId?: string | null;
  loadError?: boolean;
};

export function RecipesWorkspace({
  initialRecipes,
  canSeeInsights,
  venueId = null,
  loadError = false,
}: RecipesWorkspaceProps) {
  const { isFree, isPremium } = usePlan();
  const { showFreeLimit } = usePlanUi();
  const { toast } = useToast();
  const [previousInitialRecipes, setPreviousInitialRecipes] = useState(initialRecipes);
  const [recipes, setRecipes] = useState(initialRecipes);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const didShowAlert = useRef(false);
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId);

  if (previousInitialRecipes !== initialRecipes) {
    setPreviousInitialRecipes(initialRecipes);
    setRecipes(initialRecipes);
  }

  useEffect(() => {
    if (didShowAlert.current) return;
    const overTarget = recipes.filter((recipe) => (recipe.foodCost?.percent ?? 0) > FOOD_COST_TARGET_MAX);
    const first = overTarget[0];
    if (!first) return;

    didShowAlert.current = true;
    try {
      if (sessionStorage.getItem("mise.recipe-food-cost-alert")) return;
      sessionStorage.setItem("mise.recipe-food-cost-alert", "1");
    } catch {
      // Keep the alert usable if browser storage is blocked.
    }

    toast(canSeeInsights
      ? `${overTarget.length} ${overTarget.length === 1 ? "recept" : "recepata"} iznad cilja food cost-a`
      : "1 recept iznad cilja food cost-a · detalj na Pro", {
      tone: "danger",
      action: { label: "Pogledaj", onClick: () => setSelectedRecipeId(first.id) },
    });
  }, [canSeeInsights, recipes, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((row) => row.name.toLowerCase().includes(q));
  }, [recipes, query]);
  const { page, pageCount, goToPage, scrollRef, visible } = useWorkspacePagination(filtered);
  const paginated = pageCount > 1;

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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={sr.recipes.title}
        description="Food cost i skaliranje serija."
        action={
          <PrimaryButton
            type="button"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={openCreate}
          >
            Dodaj recept
          </PrimaryButton>
        }
      />

      <UsageStrip
        label="Recepti"
        used={recipes.length}
        max={FREE_MAX_RECIPES}
        isPremium={isPremium}
      />

      {loadError && recipes.length === 0 ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-[var(--danger-soft)] p-5 text-danger"
        >
          Recepti nisu učitani. Proverite vezu i osvežite stranicu.
        </p>
      ) : (
        <BentoCard
          header={
            <div className="flex w-full flex-col gap-3">
              <label className="field-input w-full min-w-[240px] max-w-[480px] max-[900px]:max-w-none">
                <Search className="size-4" aria-hidden="true" />
                <span className="sr-only">{sr.common.search}</span>
                <input
                  type="search"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    startTransition(() => {
                      setQuery(value);
                      goToPage(0);
                    });
                  }}
                  placeholder="Pretraži recepte..."
                />
              </label>
              <WorkspacePagination page={page} pageCount={pageCount} goToPage={goToPage} />
            </div>
          }
          footer={
            recipes.length > 0 ? (
              <>
                <span>
                  {filtered.length} od {recipes.length} recepata
                </span>
                <span>Cilj food cost-a: {FOOD_COST_TARGET_LABEL}</span>
              </>
            ) : null
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-7" aria-hidden="true" />}
              title={
                query
                  ? `Nema rezultata za „${query}”`
                  : "Još nema recepata"
              }
              description={
                query
                  ? "Proverite pravopis ili probajte drugi naziv."
                  : "Dodajte prvi recept i odmah vidite food cost i maržu."
              }
              actionLabel={query ? undefined : "Dodaj recept"}
              onAction={query ? undefined : openCreate}
              action={
                query ? undefined : (
                  <PrimaryButton onClick={openCreate}>Dodaj recept</PrimaryButton>
                )
              }
            />
          ) : (
            <div
              ref={scrollRef}
              className={paginated
                ? "app-scroll -mx-6 -mb-6 max-h-[70dvh] overflow-auto"
                : "-mx-6 -mb-6 overflow-x-auto"}
              role={paginated ? "region" : undefined}
              aria-label={paginated ? sr.recipes.title : undefined}
              tabIndex={paginated ? 0 : undefined}
            >
              <table className="app-table">
                <thead className={paginated ? "sticky top-0 z-10 shadow-[0_1px_0_var(--border)]" : undefined}>
                  <tr>
                    <th>Recept</th>
                    <th>Porcije</th>
                    <th>Food cost %</th>
                    <th className="num">Prodajna cena</th>
                    <th>
                      <span className="sr-only">Akcije</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((recipe) => {
                    const percent = recipe.foodCost?.percent ?? null;
                    const openRecipe = () => setSelectedRecipeId(recipe.id);

                    return (
                      <tr
                        key={recipe.id}
                        className="cursor-pointer"
                        onClick={(event) => {
                          if (event.target instanceof Element && !event.target.closest("button, a, [role='dialog']")) {
                            openRecipe();
                          }
                        }}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-[var(--text-2)]">
                              <BookOpen className="size-5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-text line-clamp-1">
                                {recipe.name}
                              </p>
                              {recipe.updatedLabel ? (
                                <p className="text-[length:var(--fs-sm)] text-[var(--text-3)]">
                                  {recipe.updatedLabel}
                                </p>
                              ) : recipe.description ? (
                                <p className="text-[length:var(--fs-sm)] text-[var(--text-3)] line-clamp-1">
                                  {recipe.description}
                                </p>
                              ) : null}
                              {percent !== null && percent > FOOD_COST_TARGET_MAX ? (
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <Badge variant={percent >= FOOD_COST_FAR_OVER ? "danger" : "warning"}>Iznad cilja</Badge>
                                  {canSeeInsights ? null : <Badge variant="accent">Dostupno na Pro</Badge>}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="text-[var(--text-2)]">
                          {formatPortions(recipe.portions)}
                        </td>
                        <td>
                          <RecipeFoodCostCell
                            percent={percent}
                            cost={recipe.foodCost?.amount}
                          />
                        </td>
                        <td className="num font-semibold">
                          {formatMoney(recipe.selling_price, {
                            fractionDigits: 0,
                          })}{" "}
                          din
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              className="icon-btn size-11"
                              aria-label={`Food cost: ${recipe.name}`}
                              aria-haspopup="dialog"
                              onClick={openRecipe}
                            >
                              <Info className="size-4" aria-hidden="true" />
                            </button>
                            <PrimaryButton
                              variant="secondary"
                              size="sm"
                              aria-haspopup="dialog"
                              onClick={openRecipe}
                            >
                              Otvori
                            </PrimaryButton>
                            <DeleteRecipeButton
                              compact
                              recipeId={recipe.id}
                              recipeName={recipe.name}
                              onDeleted={handleDeleted}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </BentoCard>
      )}

      <CreateRecipeSheet
        open={open}
        onClose={() => setOpen(false)}
        venueId={venueId}
        currentCount={recipes.length}
        onCreated={handleCreated}
      />
      <RecipeFoodCostDialog
        recipe={selectedRecipe}
        canSeeInsights={canSeeInsights}
        onClose={() => setSelectedRecipeId(null)}
      />
    </div>
  );
}
