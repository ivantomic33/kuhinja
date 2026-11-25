import { beforeEach, expect, it, vi } from "vitest";
import { createCheckoutSession } from "@/app/checkout/actions";
import { checkoutReturnPath } from "@/lib/billing/checkout-intent";

const { invoke, getServerUser, hasRequiredConsents } = vi.hoisted(() => ({
  invoke: vi.fn(),
  getServerUser: vi.fn(),
  hasRequiredConsents: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ functions: { invoke } }), getServerUser }));
vi.mock("@/lib/legal/consent", () => ({ hasRequiredConsents }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(path); } }));

function form(plan = "starter", interval = "yearly") {
  const payload = new FormData();
  payload.set("plan_key", plan);
  payload.set("interval", interval);
  return payload;
}

beforeEach(() => {
  vi.resetAllMocks();
});

it("preserves the plan and interval through login before invoking checkout", async () => {
  getServerUser.mockResolvedValue(null);
  const path = "/checkout?plan_key=starter&interval=yearly";
  await expect(createCheckoutSession(form())).rejects.toThrow(`/login?next=${encodeURIComponent(path)}`);
  expect(checkoutReturnPath(path)).toBe(path);
  expect(checkoutReturnPath("//example.com/checkout?plan_key=starter&interval=yearly")).toBeUndefined();
  expect(invoke).not.toHaveBeenCalled();
});

it("starts checkout through the Edge function with the chosen plan key and interval", async () => {
  getServerUser.mockResolvedValue({ id: "user" });
  const transaction = "txn_" + "a".repeat(26);
  const url = `https://example.com/checkout?_ptxn=${transaction}`;
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
  try {
    invoke.mockResolvedValue({ data: { url } });
    await expect(createCheckoutSession(form())).rejects.toThrow(
      `/checkout?_ptxn=${encodeURIComponent(transaction)}`,
    );
    expect(invoke).toHaveBeenCalledWith("create-checkout-session", {
      method: "POST",
      body: { plan_key: "starter", interval: "yearly" },
    });
  } finally {
    vi.unstubAllEnvs();
  }
});

it("carries the checkout intent through required Google consent", async () => {
  getServerUser.mockResolvedValue({ id: "user", app_metadata: { provider: "google" } });
  hasRequiredConsents.mockResolvedValue(false);
  const next = encodeURIComponent("/checkout?plan_key=starter&interval=yearly");
  await expect(createCheckoutSession(form())).rejects.toThrow(`/auth/legal-consent?next=${next}`);
  expect(invoke).not.toHaveBeenCalled();
});

it("rejects invalid plan selection before checkout", async () => {
  await expect(createCheckoutSession(form("free"))).rejects.toThrow("/#cenovnik");
  expect(invoke).not.toHaveBeenCalled();
});
