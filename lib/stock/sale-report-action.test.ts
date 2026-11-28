import { expect, it, vi } from "vitest";
import { loadSaleReport } from "./sale-report-action";

const { requireActionUser, getEntitlement } = vi.hoisted(() => ({
  requireActionUser: vi.fn(), getEntitlement: vi.fn(),
}));
vi.mock("@/lib/server/action", () => ({ requireActionUser }));
vi.mock("@/lib/billing/entitlements", () => ({ getEntitlement }));

const venueId = "11111111-1111-4111-8111-111111111111";
const recipeId = "22222222-2222-4222-8222-222222222222";
const request = { venueId, portions: { [recipeId]: 2 } };

it("denies an authenticated free account before fetching report data", async () => {
  const from = vi.fn();
  requireActionUser.mockResolvedValue({ user: { id: "user" }, supabase: { from } });
  getEntitlement.mockResolvedValue({ isPremium: false });
  await expect(loadSaleReport(request)).resolves.toBeNull();
  expect(from).not.toHaveBeenCalled();
});

it.each([false, true])("returns dish details only when the plan includes variance: %s", async (hasVariance) => {
  const inIds = vi.fn().mockResolvedValue({
    data: [{ id: recipeId, name: "Potaž", portions: 1, selling_price: 180, recipe_items: [] }],
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ in: inIds });
  const from = vi.fn().mockReturnValue({ select: () => ({ eq }) });
  requireActionUser.mockResolvedValue({ user: { id: "user" }, supabase: { from } });
  getEntitlement.mockResolvedValue({ isPremium: true, features: { foodCostVariance: hasVariance } });
  const report = await loadSaleReport(request);
  expect(eq).toHaveBeenCalledWith("venue_id", venueId);
  expect(inIds).toHaveBeenCalledWith("id", [recipeId]);
  expect(report?.revenue).toBe(360);
  expect(report?.dishes).toHaveLength(hasVariance ? 1 : 0);
});
