import { PassThrough } from "node:stream";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { renderToPipeableStream } from "react-dom/server";
import { expect, it, vi } from "vitest";
import RecipeFoodCostPage from "@/app/(app)/recipes/[id]/page";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/components/offline/OfflineCacheSeeder", () => ({
  OfflineCacheSeeder: ({ recipeDetail }: { recipeDetail: unknown }) => JSON.stringify(recipeDetail),
}));
vi.mock("@/components/recipes/FoodCostCalculator", () => ({
  FoodCostCalculator: ({ recipeName }: { recipeName: string }) => recipeName,
}));
vi.mock("@/components/recipes/DeleteRecipeButton", () => ({ DeleteRecipeButton: () => null }));
vi.mock("@/components/recipes/PriceHistory", () => ({
  PriceHistory: ({ entries }: { entries: { ingredientName: string }[] }) =>
    entries.map(({ ingredientName }) => ingredientName).join(", "),
}));

const recipe = {
  id: "recipe", venue_id: "venue", name: "Recipe calculator",
  portions: 2, selling_price: 100, description: null,
};
const ingredient = {
  id: "ingredient", venue_id: "venue", name: "Tracked ingredient",
  unit: "kg", price: 10, waste_percent: 0, notes: null,
};
const line = {
  id: "line", ingredient_id: "ingredient", quantity: 4,
  ingredients: { id: "ingredient", unit: "kg" },
};

it("streams the calculator and offline seed before ordered price history arrives", async () => {
  const ingredients = Promise.withResolvers<Response>();
  const history = Promise.withResolvers<Response>();
  const requested = new Map<string, URLSearchParams>();
  const supabase = createSupabaseClient("https://recipe-detail.test", "test-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input) => {
        const url = new URL(typeof input === "string" ? input : input.toString());
        const table = url.pathname.split("/").at(-1)!;
        requested.set(table, url.searchParams);
        switch (table) {
          case "recipes":
            return Response.json([recipe]);
          case "ingredients":
            return ingredients.promise;
          case "recipe_items":
            return Response.json([line]);
          case "ingredient_price_history":
            return history.promise;
          default:
            throw new Error(`Unexpected request ${url.pathname}`);
        }
      },
    },
  });
  vi.mocked(createClient).mockResolvedValue(supabase);

  const output = new PassThrough();
  let html = "";
  output.setEncoding("utf8").on("data", (chunk: string) => { html += chunk; });
  const rendering = RecipeFoodCostPage({ params: Promise.resolve({ id: "recipe" }) }).then((page) => {
    const stream = renderToPipeableStream(page, {
      onShellReady() { stream.pipe(output); },
    });
  });

  try {
    await vi.waitFor(() => {
      expect(requested.get("ingredients")?.get("venue_id")).toBe("eq.venue");
      expect(requested.get("recipe_items")?.get("recipe_id")).toBe("eq.recipe");
    });
    ingredients.resolve(Response.json([ingredient]));
    await vi.waitFor(() => {
      expect(html).toContain("Recipe calculator");
      expect(html).toContain("&quot;items&quot;:[{&quot;id&quot;:&quot;line&quot;");
      const query = requested.get("ingredient_price_history");
      expect(query?.get("ingredient_id")).toBe("in.(ingredient)");
      expect(query?.get("order")).toBe("recorded_at.desc");
      expect(query?.get("limit")).toBe("20");
    });
    expect(html).not.toContain("Tracked ingredient");

    history.resolve(Response.json([{ id: "history", ingredient_id: "ingredient", price: 9, recorded_at: "2026-11-20T00:00:00Z" }]));
    await vi.waitFor(() => expect(html).toContain("Tracked ingredient"));
  } finally {
    ingredients.resolve(Response.json([]));
    history.resolve(Response.json([]));
    await rendering;
  }
});
