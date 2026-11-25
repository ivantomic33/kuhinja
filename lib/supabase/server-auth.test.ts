import { beforeEach, expect, it, vi } from "vitest";
import { PLANS } from "@/lib/billing/plans";
import { createIngredientAction } from "@/lib/plan/actions";
import { getServerUser } from "@/lib/supabase/server";

const { getUser, getClaims, from, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser, getClaims }, from, rpc }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));

beforeEach(() => vi.resetAllMocks());

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

it("uses verified JWT claims for the server-rendered viewer", async () => {
  getClaims.mockResolvedValue({
    data: { claims: { sub: id, email: "cook@example.test", role: "authenticated" } },
  });
  await expect(getServerUser()).resolves.toMatchObject({ id, email: "cook@example.test" });
  expect(getUser).not.toHaveBeenCalled();
});

it("rejects unreadable claims", async () => {
  getClaims.mockResolvedValue({ data: null, error: new Error("Invalid JWT signature") });
  await expect(getServerUser()).resolves.toBeNull();
  expect(getUser).not.toHaveBeenCalled();
});

it("uses one getUser check for a mutation with a plan prerequisite", async () => {
  getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  rpc.mockResolvedValue({
    data: {
      plan: "pro", status: "active", grace: false, trial_ends_at: null,
      features: PLANS.pro.features, limits: JSON.parse(JSON.stringify(PLANS.pro.limits)),
    },
  });
  const inserted = { id, venue_id: id, name: "Flour", unit: "kg", price: 10, waste_percent: 0, version: 1 };
  const query = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValueOnce({ data: { id } }).mockResolvedValueOnce({ data: { paddle_customer_id: null } }),
    single: vi.fn().mockResolvedValue({ data: inserted }),
    then(resolve: (value: { count: number }) => void) { resolve({ count: 0 }); },
  };
  from.mockReturnValue(query);

  await expect(createIngredientAction({ venue_id: id, name: "Flour", unit: "kg", price: 10 }))
    .resolves.toMatchObject({ data: inserted });
  expect(getUser).toHaveBeenCalledOnce();
  expect(getClaims).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith("get_entitlements", { p_user_id: id });
});
