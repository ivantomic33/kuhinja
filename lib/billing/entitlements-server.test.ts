import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS } from "./plans";
import { hasPremium, hasWorkspaceFeature } from "./entitlements-server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const userId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";

it.each([
  ["starter", "active", true],
  ["pro", "trialing", true],
  ["pro", "past_due", true],
  ["free", "past_due", false],
  ["free", "canceled", false],
] as const)("honors the database's effective %s plan (%s)", async (plan, status, expected) => {
  const rpc = vi.fn().mockResolvedValue({
    data: {
      plan, status, grace: plan !== "free" && status === "past_due",
      features: PLANS[plan].features, limits: JSON.parse(JSON.stringify(PLANS[plan].limits)),
      trial_ends_at: null,
    },
    error: null,
  });
  await expect(hasPremium(userId, { rpc } as unknown as SupabaseClient)).resolves.toBe(expected);
  expect(rpc).toHaveBeenCalledWith("get_entitlements", { p_user_id: userId });
});

it("does not treat a failed entitlement lookup as a free subscription", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } });
  await expect(hasPremium(userId, { rpc } as unknown as SupabaseClient)).rejects.toThrow();
});

it("requires a positive workspace entitlement before using a paid feature", async () => {
  const rpc = vi.fn()
    .mockResolvedValueOnce({ data: true, error: null })
    .mockResolvedValueOnce({ data: true, error: { code: "42501" } });
  const client = { rpc } as unknown as SupabaseClient;
  await expect(hasWorkspaceFeature(client, workspaceId, "stockAlerts")).resolves.toBe(true);
  await expect(hasWorkspaceFeature(client, workspaceId, "stockAlerts")).resolves.toBe(false);
  expect(rpc).toHaveBeenCalledWith("workspace_has_feature", {
    p_workspace_id: workspaceId, p_feature: "stockAlerts",
  });
});
