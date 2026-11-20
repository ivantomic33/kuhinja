import type { ReactElement } from "react";
import { expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import type { DashboardClientProps } from "@/components/dashboard/DashboardClient";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  getServerUser: async () => null,
}));
vi.mock("@/lib/supabase/plan-server", () => ({ getPlan: async () => "free" }));

it("loads dashboard data in parallel and renders before recipe costs arrive", async () => {
  const venues = Promise.withResolvers<{ data: { id: string }[] }>();
  const items = Promise.withResolvers<{ data: unknown[] }>();
  const started: string[] = [];
  const responses: Record<string, PromiseLike<unknown> | object> = {
    venues: venues.promise,
    recipes: { data: [{ id: "recipe", selling_price: 100 }] },
    recipe_items: items.promise,
    ingredients: { data: [] },
    checklist_templates: { data: [] },
    stock_levels: { data: [] },
  };
  vi.mocked(createClient).mockResolvedValue({
    from(table: string) {
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        in: () => query,
        eq: () => query,
        then(onFulfilled: (response: unknown) => unknown) {
          started.push(table);
          return Promise.resolve(responses[table]).then(onFulfilled);
        },
      };
      return query;
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  const rendering = DashboardPage();
  try {
    await vi.waitFor(() => expect(started).toEqual(expect.arrayContaining([
      "venues", "recipes", "recipe_items", "ingredients", "checklist_templates",
    ])));
    expect(started).not.toContain("stock_levels");
    venues.resolve({ data: [{ id: "venue" }] });

    const dashboard = await rendering as ReactElement<DashboardClientProps>;
    expect(dashboard.props.venueId).toBe("venue");
    expect(dashboard.props.recipeCount).toBe(1);

    items.resolve({ data: [{
      recipe_id: "recipe",
      quantity: 2,
      ingredients: { unit: "kg", price: 15, waste_percent: 0 },
    }] });
    expect(await dashboard.props.recipeFoodCosts).toEqual(new Map([
      ["recipe", { percent: 30, amount: 30 }],
    ]));
  } finally {
    venues.resolve({ data: [] });
    items.resolve({ data: [] });
  }
});
