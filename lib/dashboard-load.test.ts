import type { ReactElement, ReactNode } from "react";
import type { DehydratedState } from "@tanstack/react-query";
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
  const windows: Record<string, Array<{ from: string; to: string }>> = {};
  const counts: Record<string, Array<number | null>> = {
    recipes: [3, 1],
    ingredients: [0, 2],
    checklist_templates: [null, 0],
  };
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
      let head = false;
      let from = "";
      let to = "";
      const query = {
        select(...args: [string, { head?: boolean }?]) {
          head = args[1]?.head ?? false;
          return query;
        },
        order: () => query,
        limit: () => query,
        in: () => query,
        eq: () => query,
        gte(column: string, date: string) {
          expect(column).toBe("created_at");
          from = date;
          return query;
        },
        lt(column: string, date: string) {
          expect(column).toBe("created_at");
          to = date;
          return query;
        },
        then(onFulfilled: (response: unknown) => unknown) {
          started.push(table);
          if (head) {
            const requests = (windows[table] ??= []);
            requests.push({ from, to });
            return Promise.resolve({ count: counts[table][requests.length - 1] }).then(onFulfilled);
          }
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

    const { props } = await rendering as ReactElement<{
      state: DehydratedState;
      children: ReactElement<DashboardClientProps>;
    }>;
    const dashboard = props.children;
    expect(dashboard.props.venueId).toBe("venue");
    expect(props.state.queries).toEqual([expect.objectContaining({
      queryKey: ["dashboard", "venue"],
      state: expect.objectContaining({ data: expect.objectContaining({ recipeCount: 1 }) }),
    })]);
    for (const requests of Object.values(windows)) {
      expect(requests).toHaveLength(2);
      const [current, previous] = requests;
      expect(current.from).toBe(previous.to);
      expect(Date.parse(current.to) - Date.parse(current.from)).toBe(7 * 86_400_000);
      expect(Date.parse(previous.to) - Date.parse(previous.from)).toBe(7 * 86_400_000);
    }
    const trendResult = (node: ReactNode) =>
      (node as ReactElement<{ children: ReactElement<{ result: Promise<number | null> }> }>).props.children.props.result;
    await expect(trendResult(dashboard.props.trends.recipes)).resolves.toBe(2);
    await expect(trendResult(dashboard.props.trends.ingredients)).resolves.toBe(-2);
    await expect(trendResult(dashboard.props.trends.templates)).resolves.toBeNull();

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
