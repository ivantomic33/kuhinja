import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { ReactElement } from "react";
import { expect, it, vi } from "vitest";
import TrebovanjePage from "@/app/(app)/trebovanje/page";
import type { StockWorkspaceProps } from "@/components/stock/StockWorkspace";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), getServerUser: async () => null }));

it("loads quantities and recipe items with their parent records for the stock page", async () => {
  const ingredient = { id: "onion", venue_id: "venue", name: "Luk", unit: "kg", price: 90, waste_percent: 0, notes: null };
  const level = { id: "stock", venue_id: "venue", ingredient_id: "onion", qty: 5, min_qty: 2, used_today: 0, used_on: "2000-01-01" };
  const item = { id: "item", recipe_id: "meal", ingredient_id: "onion", quantity: .25, ingredients: ingredient };
  const recipe = { id: "meal", venue_id: "venue", name: "Supa", portions: 1, selling_price: 280, description: null };
  const requestPaths: string[] = [];
  let releaseRecipes!: () => void;
  const recipeGate = new Promise<void>((resolve) => { releaseRecipes = resolve; });
  const client = createSupabaseClient("https://stock.example.com", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url) => {
        const query = new URL(String(url));
        const table = query.pathname.split("/").at(-1)!;
        requestPaths.push(table);
        if (table === "recipes") await recipeGate;
        const include = query.searchParams.get("select") ?? "";
        const rows: Record<string, unknown[]> = {
          venues: [include.includes("stock_levels(") ? { id: "venue", stock_levels: [level] } : { id: "venue" }],
          ingredients: [ingredient],
          recipes: [include.includes("recipe_items(") ? { ...recipe, recipe_items: [item] } : recipe],
          checklist_templates: [],
          stock_levels: [level],
          recipe_items: [item],
        };
        return Response.json(rows[table]);
      },
    },
  });
  vi.mocked(createClient).mockResolvedValue(client);

  const rendering = TrebovanjePage() as Promise<ReactElement<{ children: [ReactElement, ReactElement<StockWorkspaceProps>] }>>;
  try {
    // Parent reads start together even though load metadata waits for recipes.
    await vi.waitFor(() => {
      expect(requestPaths).toEqual(expect.arrayContaining(["checklist_templates", "ingredients", "recipes", "venues"]));
    });
  } finally {
    releaseRecipes();
  }
  const page = await rendering;
  const { initialRows, recipes, venueId } = page.props.children[1].props;

  expect(venueId).toBe("venue");
  expect(initialRows).toMatchObject([{ ingredientId: "onion", qty: 5, hasLevel: true }]);
  await expect(recipes).resolves.toMatchObject([{ name: "Supa", items: [{ ingredientId: "onion", name: "Luk", quantity: .25 }] }]);
  expect(requestPaths.sort()).toEqual(["checklist_templates", "ingredients", "recipes", "venues"]);
});
