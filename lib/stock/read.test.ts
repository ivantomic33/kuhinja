import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { fetchStockRows, keepStockSnapshot } from "./read";
import type { StockRow } from "./types";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const original: StockRow[] = [{
  id: "level", venueId: "venue", ingredientId: "ingredient", name: "Luk",
  unit: "kg", qty: 5, min: 2, price: 90, usedToday: 1, usedOn: "2026-11-19", hasLevel: true,
}];

it("keeps the rendered stock snapshot when a background read changes nothing", () => {
  expect(keepStockSnapshot(original, [{ ...original[0] }])).toBe(original);
});

it("renders new stock when a background read changes the amount or consumption", () => {
  const incoming = [{ ...original[0], qty: 4, usedToday: 2 }];
  expect(keepStockSnapshot(original, incoming)).toBe(incoming);
  expect(keepStockSnapshot(original, [])).toEqual([]);
});

it("fetches levels for just the selected venue in the ingredient request and keeps untracked ingredients", async () => {
  const level = { id: "level", venue_id: "venue", ingredient_id: "ingredient", qty: 5, min_qty: 2, used_today: 1, used_on: "2026-11-19" };
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
    const query = new URL(String(url));
    if (query.pathname.endsWith("/stock_levels")) return Response.json([level]);
    return Response.json([
      { id: "ingredient", name: "Luk", unit: "kg", price: 90, stock_levels: [level] },
      { id: "untracked", name: "Paprika", unit: "kg", price: 150, stock_levels: [] },
    ]);
  });
  vi.mocked(createClient).mockReturnValue(createSupabaseClient("https://stock.example.com", "test-key", {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
  }));

  const rows = await fetchStockRows("venue");

  expect(rows.map(({ ingredientId, qty, hasLevel }) => ({ ingredientId, qty, hasLevel }))).toEqual([
    { ingredientId: "ingredient", qty: 5, hasLevel: true },
    { ingredientId: "untracked", qty: 0, hasLevel: false },
  ]);
  expect(fetch).toHaveBeenCalledTimes(1);
  const url = new URL(String(fetch.mock.calls[0][0]));
  expect(url.pathname).toBe("/rest/v1/ingredients");
  expect(url.searchParams.get("stock_levels.venue_id")).toBe("eq.venue");
});
