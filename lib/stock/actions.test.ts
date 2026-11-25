import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/billing/plans";
import { applyRestock, applySale, removeStockLevel } from "./actions";
import { belgradeToday } from "./math";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

function mockStockResponse(fetch: typeof globalThis.fetch) {
  vi.mocked(createClient).mockReturnValue(createSupabaseClient(
    "https://stock.example.com",
    "test-key",
    { global: { fetch }, auth: { persistSession: false, autoRefreshToken: false } }
  ));
}

it.each([0, -1, 1.001, Number.NaN])("rejects an invalid restock price %s before writing stock", async (unitCost) => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  mockStockResponse(fetch);
  await expect(applyRestock({
    venueId: "venue-a",
    updatePrices: true,
    lines: [{ ingredientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", qty: 1, unitCost }],
  })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it("sends one price restock RPC per priced ingredient", async () => {
  const ingredientId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (_url, request) => {
    if (new URL(String(_url)).pathname.endsWith("/get_entitlements")) {
      return Response.json({
        plan: "starter", status: "active", grace: false, trial_ends_at: null,
        features: PLANS.starter.features, limits: PLANS.starter.limits,
      });
    }
    if (request?.method === "GET") {
      return Response.json([{
        id: "level-a", venue_id: "venue-a", ingredient_id: ingredientId,
        qty: 5, min_qty: 2, used_today: 0, used_on: belgradeToday(),
      }]);
    }
    return new Response(null, { status: 204 });
  });
  mockStockResponse(fetch);
  vi.spyOn(createClient().auth, "getUser").mockResolvedValue({
    data: { user: { id: ingredientId, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" } },
    error: null,
  });

  await applyRestock({
    venueId: "venue-a", updatePrices: true,
    lines: [{ ingredientId, qty: 1, unitCost: 5.25 }],
  });

  const writes = fetch.mock.calls.filter(([url, request]) =>
    request?.method !== "GET" && !String(url).endsWith("/get_entitlements"));
  expect(writes.map(([url]) => new URL(String(url)).pathname)).toEqual([
    "/rest/v1/stock_levels", "/rest/v1/stock_moves", "/rest/v1/rpc/restock_ingredient",
  ]);
  expect(JSON.parse(String(writes[2][1]?.body))).toEqual({
    p_ingredient_id: ingredientId, p_new_price: 5.25, p_note: null,
  });
});

it("deletes only the selected stock level for the specified venue", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }));
  mockStockResponse(fetch);

  await removeStockLevel({ venueId: "venue-a", levelId: "level-a" });

  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, request] = fetch.mock.calls[0];
  expect(request?.method).toBe("DELETE");
  expect(new URL(String(url)).pathname).toBe("/rest/v1/stock_levels");
  expect(Object.fromEntries(new URL(String(url)).searchParams)).toEqual({
    venue_id: "eq.venue-a",
    id: "eq.level-a",
  });
});

it("propagates a failed deletion so the workspace can keep the item", async () => {
  mockStockResponse(async () => Response.json(
    { code: "42501", message: "Permission denied" },
    { status: 403 }
  ));

  await expect(removeStockLevel({ venueId: "venue-a", levelId: "level-a" }))
    .rejects.toMatchObject({ code: "42501" });
});

it.each([false, true])("batches stale sale ingredient resets (concurrent update: %s)", async (concurrent) => {
  const levels = ["onion", "pepper"].map((ingredient_id) => ({
    id: `${ingredient_id}-level`, venue_id: "venue-a", ingredient_id,
    qty: 5, min_qty: 2, used_today: 3, used_on: "2000-01-01",
  }));
  const resets: URL[] = [];
  const usage: number[] = [];
  let reads = 0;

  mockStockResponse(async (url, request) => {
    const parsedUrl = new URL(String(url));
    if (request?.method === "GET") {
      if (++reads === 1) return Response.json(levels);
      const today = resets[0].searchParams.get("used_on")?.slice(4);
      return Response.json(levels.map((level, index) => ({ ...level, used_on: today, used_today: index === 0 ? 7 : 0 })));
    }
    if (request?.method === "PATCH") {
      const body = JSON.parse(String(request.body));
      if (body.used_today !== 0) {
        usage.push(body.used_today);
        return new Response(null, { status: 204 });
      }
      resets.push(parsedUrl);
      const updated = levels.map((level) => ({ ...level, ...body }));
      return Response.json(concurrent && parsedUrl.searchParams.has("used_on") ? updated.slice(1) : updated);
    }
    return new Response(null, { status: 201 });
  });

  await applySale({
    venueId: "venue-a",
    lines: levels.map(({ ingredient_id }) => ({
      ingredientId: ingredient_id, name: ingredient_id, unit: "kg", qty: 1, before: 5, after: 4, unitCost: 100,
    })),
  });

  expect(resets.map((url) => url.searchParams.get("id"))).toEqual(["in.(onion-level,pepper-level)"]);
  expect(reads).toBe(concurrent ? 2 : 1);
  expect(usage).toEqual(concurrent ? [8, 1] : [1, 1]);
});
