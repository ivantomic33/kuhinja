import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HydrationBoundary, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { IngredientsWorkspace } from "@/components/ingredients/IngredientsWorkspace";
import { PlanProvider } from "@/components/plan/PlanProvider";
import { RecipesWorkspace } from "@/components/recipes/RecipesWorkspace";
import { StockWorkspace } from "@/components/stock/StockWorkspace";
import { ToastProvider } from "@/components/ui/Toast";
import { dehydrateQuery } from "@/lib/query/hydrate";
import { queryKeys } from "@/lib/query/keys";
import { RECIPE_LIST_PAGE_SIZE } from "@/lib/recipes/list-params";
import type { RecipeListPageResult } from "@/lib/recipes/list-server";
import { mergeStockRows } from "@/lib/stock/actions";

const listRecipesAction = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

vi.mock("@/lib/recipes/actions", () => ({
  listRecipesAction: (...args: unknown[]) => listRecipesAction(...args),
}));

function renderWorkspace(
  workspace: ReturnType<typeof createElement>,
  state?: ReturnType<typeof dehydrateQuery>,
) {
  return renderToStaticMarkup(createElement(
    QueryClientProvider,
    { client: new QueryClient() },
    createElement(PlanProvider, null, createElement(ToastProvider, null,
      state ? createElement(HydrationBoundary, { state }, workspace) : workspace,
    )),
  ));
}

function makeRecipeRows(start: number, count: number, totalHint = count) {
  return Array.from({ length: count }, (_, index) => {
    const n = start + index;
    return {
      id: `recipe-${String(n).padStart(4, "0")}`,
      venue_id: "venue",
      name: `Sample item ${String(n + 1).padStart(3, "0")}`,
      portions: 1,
      selling_price: 100 + (n % 7),
      description: null as string | null,
    };
  }).slice(0, Math.min(count, totalHint));
}

function makeListPage(input: {
  page: number;
  totalCount: number;
  pageSize?: number;
  query?: string;
}): RecipeListPageResult {
  const pageSize = input.pageSize ?? RECIPE_LIST_PAGE_SIZE;
  const pageCount = input.totalCount <= 0 ? 1 : Math.ceil(input.totalCount / pageSize);
  const page = Math.min(Math.max(0, input.page), Math.max(0, pageCount - 1));
  const start = page * pageSize;
  const rows =
    input.totalCount === 0
      ? []
      : makeRecipeRows(start, Math.min(pageSize, input.totalCount - start), input.totalCount);

  return {
    rows,
    totalCount: input.totalCount,
    page,
    pageSize,
    pageCount,
    query: input.query ?? "",
    sort: { column: "updated_at", direction: "descending" },
  };
}

function recipesListKey(pageResult: RecipeListPageResult, venueId: string | null = "venue") {
  return queryKeys.recipesList(venueId, {
    query: pageResult.query,
    page: pageResult.page,
    pageSize: pageResult.pageSize,
    sort: pageResult.sort,
  });
}

it("shows removal for tracked stock and keeps a removed level out of the reloaded list", () => {
  const initialRows = mergeStockRows({
    venueId: "venue",
    ingredients: [
      { id: "onion", name: "Crni luk", unit: "kg", price: 90 },
      { id: "pepper", name: "Crvena paprika", unit: "kg", price: 240 },
    ],
    levels: [
      { id: "level", venue_id: "venue", ingredient_id: "onion", qty: 3, min_qty: 1, used_today: 0, used_on: "2026-11-20" },
    ],
  });
  const html = renderWorkspace(createElement(StockWorkspace, { venueId: "venue", initialRows, recipes: Promise.resolve([]) }));

  expect(html).toContain('aria-label="Obriši sa stanja: Crni luk"');
  expect(html).not.toContain("Crvena paprika");
  expect(html).toContain("1 od 1 stavki");
});

it("keeps the recipe and ingredient prices, details and actions in the responsive rows", () => {
  const firstPage = makeListPage({ page: 0, totalCount: 1 });
  firstPage.rows = [{
    id: "recipe",
    venue_id: "venue",
    name: "Hleb",
    portions: 5,
    selling_price: 890,
    description: null,
  }];
  const recipe = renderWorkspace(createElement(RecipesWorkspace, {
    canSeeInsights: false,
    venueId: "venue",
  }), dehydrateQuery(recipesListKey(firstPage), firstPage));
  const ingredient = renderWorkspace(createElement(IngredientsWorkspace), dehydrateQuery(queryKeys.ingredients(null), [
    { id: "ingredient", venue_id: "venue", name: "Brašno", unit: "kg", price: 240, waste_percent: 5 },
  ]));

  expect(recipe).toContain('class="app-table table-cards"');
  expect(recipe).toMatch(/<th[^>]*aria-sort="none"[^>]*><button[^>]*>Prodajna cena/);
  expect(recipe).toMatch(/data-card-price="true"[^>]*>.*Prodajna cena.*890/);
  expect(recipe).toContain('aria-label="Izaberi: Hleb"');
  expect(recipe).toContain('aria-label="Obriši Hleb"');
  expect(ingredient).toContain('class="app-table table-cards"');
  expect(ingredient).toMatch(/<th[^>]*aria-sort="none"[^>]*><button[^>]*>Trenutna cena/);
  expect(ingredient).toMatch(/data-card-price="true"[^>]*>.*Trenutna cena.*240/);
  expect(ingredient).toContain('aria-label="Izaberi: Brašno"');
  expect(ingredient).toContain('aria-label="Obriši Brašno"');
});

it("offers a retry for failed recipe and ingredient requests", () => {
  const empty = makeListPage({ page: 0, totalCount: 0 });
  const recipe = renderWorkspace(createElement(RecipesWorkspace, {
    canSeeInsights: false, loadError: true, venueId: "venue",
  }), dehydrateQuery(recipesListKey(empty), empty));
  const ingredient = renderWorkspace(createElement(IngredientsWorkspace, { loadError: true }),
    dehydrateQuery(queryKeys.ingredients(null), []));

  expect(recipe).toContain("Pokušaj ponovo");
  expect(ingredient).toContain("Pokušaj ponovo");
  expect(recipe).not.toContain("Još nema recepata");
  expect(ingredient).not.toContain("Još nema sastojaka");
});

describe("server-paged recipe list fixtures", () => {
  it("renders the first page of recipes from RecipeListPageResult", () => {
    const firstPage = makeListPage({ page: 0, totalCount: 51 });
    expect(firstPage.rows).toHaveLength(RECIPE_LIST_PAGE_SIZE);
    expect(firstPage.pageCount).toBe(3);
    expect(firstPage.rows[0]?.name).toBe("Sample item 001");
    expect(firstPage.rows.at(-1)?.name).toBe("Sample item 025");

    listRecipesAction.mockResolvedValue({ data: firstPage });
    const html = renderWorkspace(
      createElement(RecipesWorkspace, { canSeeInsights: false, venueId: "venue" }),
      dehydrateQuery(recipesListKey(firstPage), firstPage),
    );

    expect(html).toContain("Sample item 025");
    expect(html).not.toContain("Sample item 026");
    expect(html).toContain(`${RECIPE_LIST_PAGE_SIZE} od 51 recepata`);
  });

  it("covers a middle page fixture without overlapping neighbors", () => {
    const middlePage = makeListPage({ page: 1, totalCount: 51 });
    expect(middlePage.page).toBe(1);
    expect(middlePage.rows).toHaveLength(RECIPE_LIST_PAGE_SIZE);
    expect(middlePage.rows[0]?.name).toBe("Sample item 026");
    expect(middlePage.rows.at(-1)?.name).toBe("Sample item 050");
    expect(middlePage.rows.some((row) => row.name === "Sample item 025")).toBe(false);
    expect(middlePage.rows.some((row) => row.name === "Sample item 051")).toBe(false);

    listRecipesAction.mockResolvedValue({ data: middlePage });
    // Hydrate under the component's initial page-0 key with middle-page rows so
    // static markup can assert the page payload shape the server would return.
    const hydrateKey = recipesListKey({ ...middlePage, page: 0 });
    const html = renderWorkspace(
      createElement(RecipesWorkspace, { canSeeInsights: false, venueId: "venue" }),
      dehydrateQuery(hydrateKey, { ...middlePage, page: 0 }),
    );

    expect(html).toContain("Sample item 026");
    expect(html).toContain("Sample item 050");
    expect(html).not.toContain("Sample item 001");
    expect(html).toContain(`${RECIPE_LIST_PAGE_SIZE} od 51 recepata`);
  });

  it("covers the last partial page fixture", () => {
    const lastPage = makeListPage({ page: 2, totalCount: 51 });
    expect(lastPage.page).toBe(2);
    expect(lastPage.rows).toHaveLength(1);
    expect(lastPage.rows[0]?.name).toBe("Sample item 051");
    expect(lastPage.pageCount).toBe(3);

    listRecipesAction.mockResolvedValue({ data: lastPage });
    const hydrateKey = recipesListKey({ ...lastPage, page: 0 });
    const html = renderWorkspace(
      createElement(RecipesWorkspace, { canSeeInsights: false, venueId: "venue" }),
      dehydrateQuery(hydrateKey, { ...lastPage, page: 0 }),
    );

    expect(html).toContain("Sample item 051");
    expect(html).not.toContain("Sample item 050");
    expect(html).toContain("1 od 51 recepata");
  });

  it("covers an empty recipe list result", () => {
    const empty = makeListPage({ page: 0, totalCount: 0 });
    expect(empty.rows).toEqual([]);
    expect(empty.totalCount).toBe(0);
    expect(empty.pageCount).toBe(1);

    listRecipesAction.mockResolvedValue({ data: empty });
    const html = renderWorkspace(
      createElement(RecipesWorkspace, { canSeeInsights: false, venueId: "venue" }),
      dehydrateQuery(recipesListKey(empty), empty),
    );

    expect(html).toContain("Još nema recepata");
    expect(html).not.toContain("od 0 recepata");
  });
});

describe("large workspace lists", () => {
  const entries = Array.from({ length: 51 }, (_, index) => ({
    id: String(index),
    name: `Sample item ${String(index + 1).padStart(3, "0")}`,
    venue_id: "venue",
  }));

  it("renders only the first page of ingredients and keeps short lists intact", () => {
    const initialIngredients = entries.map((row) => ({ ...row, unit: "kg" as const, price: 100, waste_percent: 0 }));
    const html = renderWorkspace(createElement(IngredientsWorkspace),
      dehydrateQuery(queryKeys.ingredients(null), initialIngredients));
    expect(html).toContain("Sample item 050");
    expect(html).not.toContain("Sample item 051");
    expect(html).toContain("51 od 51 sastojaka");

    const shortList = renderWorkspace(createElement(IngredientsWorkspace),
      dehydrateQuery(queryKeys.ingredients(null), initialIngredients.slice(0, 50)));
    expect(shortList).toContain("Sample item 050");
  });
});
