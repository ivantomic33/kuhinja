import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { IngredientsWorkspace } from "@/components/ingredients/IngredientsWorkspace";
import { PlanProvider } from "@/components/plan/PlanProvider";
import { RecipesWorkspace } from "@/components/recipes/RecipesWorkspace";
import { StockWorkspace } from "@/components/stock/StockWorkspace";
import { ToastProvider } from "@/components/ui/Toast";
import { mergeStockRows } from "@/lib/stock/actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

function renderWorkspace(workspace: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(createElement(
    QueryClientProvider,
    { client: new QueryClient() },
    createElement(PlanProvider, null, createElement(ToastProvider, null, workspace)),
  ));
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
  const recipe = renderWorkspace(createElement(RecipesWorkspace, {
    initialRecipes: [{ id: "recipe", venue_id: "venue", name: "Hleb", portions: 5, selling_price: 890 }],
    canSeeInsights: false,
  }));
  const ingredient = renderWorkspace(createElement(IngredientsWorkspace, {
    initialIngredients: [{ id: "ingredient", venue_id: "venue", name: "Brašno", unit: "kg", price: 240, waste_percent: 5 }],
  }));

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
  const recipe = renderWorkspace(createElement(RecipesWorkspace, {
    initialRecipes: [], canSeeInsights: false, loadError: true,
  }));
  const ingredient = renderWorkspace(createElement(IngredientsWorkspace, { initialIngredients: [], loadError: true }));

  expect(recipe).toContain("Pokušaj ponovo");
  expect(ingredient).toContain("Pokušaj ponovo");
  expect(recipe).not.toContain("Još nema recepata");
  expect(ingredient).not.toContain("Još nema sastojaka");
});

describe("large workspace lists", () => {
  const entries = Array.from({ length: 51 }, (_, index) => ({
    id: String(index),
    name: `Sample item ${String(index + 1).padStart(3, "0")}`,
    venue_id: "venue",
  }));

  it("renders only the first page of recipes in their original order", () => {
    const initialRecipes = entries.map((row) => ({ ...row, portions: 1, selling_price: 100 }));
    const html = renderWorkspace(createElement(RecipesWorkspace, { initialRecipes, canSeeInsights: false }));
    expect(html).toContain("Sample item 025");
    expect(html.includes("Sample item 026")).toBe(false);
    expect(html).toContain("51 od 51 recepata");
  });

  it("renders only the first page of ingredients and keeps short lists intact", () => {
    const initialIngredients = entries.map((row) => ({ ...row, unit: "kg" as const, price: 100, waste_percent: 0 }));
    const html = renderWorkspace(createElement(IngredientsWorkspace, { initialIngredients }));
    expect(html).toContain("Sample item 025");
    expect(html.includes("Sample item 026")).toBe(false);
    expect(html).toContain("51 od 51 sastojaka");

    const shortList = renderWorkspace(createElement(IngredientsWorkspace, { initialIngredients: initialIngredients.slice(0, 50) }));
    expect(shortList).toContain("Sample item 050");
  });
});
