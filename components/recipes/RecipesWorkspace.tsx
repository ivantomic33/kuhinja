"use client";

import { memo, startTransition, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
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
import { DataTable, type DataTableColumn, type DataTableSort } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FoodCostCell } from "@/components/ui/FoodCostCell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import RouteError from "@/components/ui/RouteError";
import { useToast } from "@/components/ui/Toast";
import { UsageStrip } from "@/components/ui/UsageStrip";
import { WorkspacePagination } from "@/components/ui/WorkspacePagination";
import {
  FOOD_COST_FAR_OVER,
  FOOD_COST_TARGET_LABEL,
  FOOD_COST_TARGET_MAX,
  type RecipeFoodCost,
} from "@/lib/calc/recipe-food-cost";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import { FREE_MAX_RECIPES } from "@/lib/plan/limits";
import { queryKeys } from "@/lib/query/keys";
import { listRecipesAction } from "@/lib/recipes/actions";
import {
  RECIPE_LIST_PAGE_SIZE,
  isRecipeListSortColumn,
  type RecipeListSort,
} from "@/lib/recipes/list-params";
import type { RecipeListPageResult } from "@/lib/recipes/list-server";
import { TableMoney } from "@/components/ui/TableMoney";
import { formatPortions } from "@/lib/utils/portions";

const RecipeFoodCostCell = memo(FoodCostCell);
const SEARCH_DEBOUNCE_MS = 300;

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
  canSeeInsights: boolean;
  venueId?: string | null;
  loadError?: boolean;
  /** SSR dehydrated query key so the first paint reuses server data. */
  initialListKey?: QueryKey;
};

function sortFromTable(sort?: DataTableSort): RecipeListSort {
  if (!sort) return { column: "updated_at", direction: "descending" };
  const column =
    sort.column === "price"
      ? "selling_price"
      : isRecipeListSortColumn(sort.column)
        ? sort.column
        : "updated_at";
  return { column, direction: sort.direction };
}

function emptyPage(sort: RecipeListSort): RecipeListPageResult {
  return {
    rows: [],
    totalCount: 0,
    page: 0,
    pageSize: RECIPE_LIST_PAGE_SIZE,
    pageCount: 1,
    query: "",
    sort,
  };
}

export function RecipesWorkspace({
  canSeeInsights,
  venueId = null,
  loadError = false,
}: RecipesWorkspaceProps) {
  const { isFree, isPremium } = usePlan();
  const { showFreeLimit } = usePlanUi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<DataTableSort>();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const didShowAlert = useRef(false);

  const listSort = useMemo(() => sortFromTable(sort), [sort]);
  const listKey = queryKeys.recipesList(venueId, {
    query: debouncedQuery,
    page,
    pageSize: RECIPE_LIST_PAGE_SIZE,
    sort: listSort,
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      startTransition(() => {
        setDebouncedQuery(queryInput.trim());
        setPage(0);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [queryInput]);

  const listQuery = useQuery({
    queryKey: listKey,
    enabled: Boolean(venueId) && !loadError,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<RecipeListPageResult> => {
      if (!venueId) return emptyPage(listSort);
      const result = await listRecipesAction({
        venueId,
        query: debouncedQuery,
        page,
        pageSize: RECIPE_LIST_PAGE_SIZE,
        sort: listSort,
      });
      if ("error" in result) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });

  const listPage = listQuery.data ?? emptyPage(listSort);
  const recipes = listPage.rows as RecipeListItem[];
  const totalCount = listPage.totalCount;
  const pageCount = listPage.pageCount;
  const hasQuery = Boolean(debouncedQuery);
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId);
  const showLoadError = loadError || listQuery.isError;

  useEffect(() => {
    if (didShowAlert.current) return;
    const overTarget = recipes.filter((recipe) => (recipe.foodCost?.percent ?? 0) > FOOD_COST_TARGET_MAX);
    const first = overTarget[0];
    if (!first) return;

    didShowAlert.current = true;
    try {
      if (sessionStorage.getItem("treuplate.recipe-food-cost-alert")) return;
      sessionStorage.setItem("treuplate.recipe-food-cost-alert", "1");
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

  function goToPage(next: number) {
    scrollRef.current?.scrollTo({ top: 0 });
    setPage(next);
  }

  function invalidateLists() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recipesListRoot(venueId) });
  }

  const columns: DataTableColumn<RecipeListItem>[] = [
    {
      id: "name",
      header: "Recept",
      compare: (a, b) => a.name.localeCompare(b.name, "sr-Latn"),
      cell: recipe => {
        const percent = recipe.foodCost?.percent ?? null;
        return (
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-text-2">
              <BookOpen className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-text md:line-clamp-1">{recipe.name}</p>
              {recipe.updatedLabel || recipe.description ? (
                <p className="text-ui-sm text-text-3 md:line-clamp-1">{recipe.updatedLabel ?? recipe.description}</p>
              ) : null}
              {percent !== null && percent > FOOD_COST_TARGET_MAX ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant={percent >= FOOD_COST_FAR_OVER ? "danger" : "warning"}>
                    {percent >= FOOD_COST_FAR_OVER ? "Znatno iznad cilja" : "Iznad cilja"}
                  </Badge>
                  {canSeeInsights ? null : <Badge variant="accent">Dostupno na Pro</Badge>}
                </div>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "portions",
      header: "Porcije",
      mobileLabel: "Porcije",
      compare: (a, b) => a.portions - b.portions,
      className: "whitespace-nowrap text-text-2",
      cell: recipe => formatPortions(recipe.portions),
    },
    {
      id: "cost",
      header: "Food cost %",
      mobileLabel: "Food cost %",
      cell: recipe => <RecipeFoodCostCell percent={recipe.foodCost?.percent} cost={recipe.foodCost?.amount} className="max-md:flex-wrap" />,
    },
    {
      id: "price",
      header: "Prodajna cena",
      mobileLabel: "Prodajna cena",
      compare: (a, b) => a.selling_price - b.selling_price,
      align: "right",
      price: true,
      className: "font-semibold",
      cell: recipe => <TableMoney value={recipe.selling_price} />,
    },
    {
      id: "actions",
      header: "Akcije",
      mobileLabel: null,
      cell: recipe => {
        const openRecipe = () => setSelectedRecipeId(recipe.id);
        return (
          <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
            <button
              type="button"
              className="icon-btn focus-ring size-11"
              aria-label={`Food cost: ${recipe.name}`}
              aria-haspopup="dialog"
              onClick={openRecipe}
            >
              <Info className="size-4" aria-hidden="true" />
            </button>
            <PrimaryButton variant="secondary" size="sm" className="max-md:min-h-11 max-md:min-w-11" aria-haspopup="dialog" onClick={openRecipe}>
              Otvori
            </PrimaryButton>
            <DeleteRecipeButton compact recipeId={recipe.id} recipeName={recipe.name} onDeleted={handleDeleted} />
          </div>
        );
      },
    },
  ];

  function openCreate() {
    if (isFree && totalCount >= FREE_MAX_RECIPES) {
      showFreeLimit("FREE_LIMIT_RECIPES");
      return;
    }
    setOpen(true);
  }

  function handleCreated(recipe: CreatedRecipeSummary) {
    invalidateLists();
    if (!debouncedQuery && page === 0) {
      queryClient.setQueryData<RecipeListPageResult>(listKey, (prev) => {
        const base = prev ?? emptyPage(listSort);
        const row: RecipeListItem = {
          id: recipe.id,
          name: recipe.name,
          venue_id: recipe.venue_id,
          portions: recipe.portions,
          selling_price: recipe.selling_price,
          description: recipe.description ?? null,
        };
        return {
          ...base,
          totalCount: base.totalCount + 1,
          rows: [row, ...base.rows.filter((r) => r.id !== recipe.id)].slice(0, base.pageSize),
        };
      });
    }
  }

  function handleDeleted(recipeId: string) {
    queryClient.setQueryData<RecipeListPageResult>(listKey, (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        totalCount: Math.max(0, prev.totalCount - 1),
        rows: prev.rows.filter((row) => row.id !== recipeId),
      };
    });
    invalidateLists();
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={sr.recipes.title}
        description={sr.listStates.recipes.description}
        action={!showLoadError && totalCount > 0 ? (
          <PrimaryButton
            type="button"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={openCreate}
          >
            {sr.create.recipe.add}
          </PrimaryButton>
        ) : undefined}
      />

      {!showLoadError ? <UsageStrip
        label={sr.recipes.title}
        used={totalCount}
        max={FREE_MAX_RECIPES}
        isPremium={isPremium}
      /> : null}

      {showLoadError ? (
        <RouteError message={sr.listStates.recipes.error} />
      ) : (
        <BentoCard
          flush={recipes.length > 0}
          bodyClassName="min-w-0"
          header={
            <div className="flex w-full min-w-0 flex-col gap-3">
              <div className="w-full min-w-0 max-w-[480px] max-[900px]:max-w-none">
                <label htmlFor={searchId} className="field-label">Pretraži recepte</label>
                <div className="field-input">
                  <Search className="size-4" aria-hidden="true" />
                  <input
                    id={searchId}
                    ref={searchRef}
                    type="search"
                    defaultValue={queryInput}
                    onChange={(event) => {
                      setQueryInput(event.currentTarget.value);
                    }}
                    placeholder="Pretraži recepte..."
                    aria-busy={listQuery.isFetching || undefined}
                  />
                </div>
              </div>
              <WorkspacePagination page={page} pageCount={pageCount} goToPage={goToPage} />
            </div>
          }
          footer={
            totalCount > 0 || hasQuery ? (
              <>
                <span>
                  {recipes.length} od {totalCount} recepata
                </span>
                <span>Cilj food cost-a: {FOOD_COST_TARGET_LABEL}</span>
              </>
            ) : null
          }
        >
          {recipes.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-7" aria-hidden="true" />}
              title={hasQuery ? sr.listStates.noResults : sr.listStates.recipes.empty}
              description={hasQuery ? undefined : sr.listStates.recipes.emptyDescription}
              actionLabel={hasQuery ? sr.listStates.clearSearch : sr.listStates.recipes.emptyAction}
              onAction={hasQuery ? () => {
                setQueryInput("");
                setDebouncedQuery("");
                setPage(0);
                if (searchRef.current) {
                  searchRef.current.value = "";
                  searchRef.current.focus();
                }
              } : openCreate}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={recipes}
              rowKey={recipe => recipe.id}
              rowLabel={recipe => recipe.name}
              label={sr.recipes.title}
              scrollRef={scrollRef}
              sort={sort}
              onSortChange={next => {
                setSort(next);
                setPage(0);
              }}
              onRowClick={recipe => setSelectedRecipeId(recipe.id)}
              selectable
              stacked
            />
          )}
        </BentoCard>
      )}

      <CreateRecipeSheet
        open={open}
        onClose={() => setOpen(false)}
        venueId={venueId}
        currentCount={totalCount}
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
