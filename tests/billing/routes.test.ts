import { beforeEach, expect, it, vi } from "vitest";
import { PLANS } from "@/lib/billing/plans";
import { POST } from "@/app/api/billing/change-plan/route";
import { createPriceHistoryAction } from "@/lib/plan/actions";

const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
}));

const request = (body: object) => new Request("http://localhost/api/billing/change-plan", {
  method: "POST",
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "verified" } } });
  rpc.mockResolvedValue({ data: { plan: "free", status: null, features: PLANS.free.features, limits: PLANS.free.limits, grace: false, trial_ends_at: null } });
});

it("denies a direct request from an authenticated user without a subscription", async () => {
  const response = await POST(request({ planKey: "pro", interval: "monthly" }));
  expect(response.status).toBe(402);
  expect(await response.json()).toMatchObject({ error: { code: "UPGRADE_REQUIRED" } });
  expect(rpc).toHaveBeenCalledWith("get_entitlements", { p_user_id: "verified" });
});

it("denies direct access to the price-history action", async () => {
  const result = await createPriceHistoryAction({
    ingredient_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    price: 10,
  });
  expect(result).toMatchObject({ error: { code: "UPGRADE_REQUIRED", status: 402 } });
});

it("rejects client-supplied Paddle price IDs", async () => {
  const response = await POST(request({ planKey: "pro", interval: "monthly", priceId: "pri_other" }));
  expect(response.status).toBe(400);
});
