import { beforeEach, expect, it, vi } from "vitest";
import { createCheckoutSession } from "@/app/checkout/actions";
import { checkoutReturnPath } from "@/lib/billing/checkout-intent";

const { transact, getUser, getServerUser, hasRequiredConsents } = vi.hoisted(() => ({
  transact: vi.fn(),
  getUser: vi.fn(),
  getServerUser: vi.fn(),
  hasRequiredConsents: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth: { getUser } }), getServerUser }));
vi.mock("@/lib/paddle/checkout", () => ({ createCheckoutTransaction: transact }));
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
  expect(transact).not.toHaveBeenCalled();
});

it("starts server checkout with an authenticated user and the chosen price interval", async () => {
  const user = { id: "user" };
  getServerUser.mockResolvedValue(user);
  getUser.mockResolvedValue({ data: { user }, error: null });
  const transactionId = "txn_" + "a".repeat(26);
  transact.mockResolvedValue({ transactionId });
  await expect(createCheckoutSession(form())).rejects.toThrow(
    `/checkout?_ptxn=${encodeURIComponent(transactionId)}`,
  );
  expect(transact).toHaveBeenCalledWith(expect.objectContaining({ user }), {
    plan_key: "starter", interval: "yearly",
  });
});

it("carries the checkout intent through required Google consent", async () => {
  getServerUser.mockResolvedValue({ id: "user", app_metadata: { provider: "google" } });
  hasRequiredConsents.mockResolvedValue(false);
  const next = encodeURIComponent("/checkout?plan_key=starter&interval=yearly");
  await expect(createCheckoutSession(form())).rejects.toThrow(`/auth/legal-consent?next=${next}`);
  expect(transact).not.toHaveBeenCalled();
});

it("rejects invalid plan selection before checkout", async () => {
  await expect(createCheckoutSession(form("free"))).rejects.toThrow("/#cenovnik");
  expect(transact).not.toHaveBeenCalled();
});
