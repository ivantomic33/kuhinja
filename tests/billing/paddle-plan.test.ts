import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changePaddlePlan, setPaddleCancellation } from "@/lib/billing/paddle-server";
import { readPaidAccess, signPaidAccess, type PaddleApi, type PaddleSubscription } from "@/supabase/functions/_shared/paddle";

const starter = `pri_${"s".repeat(26)}`;
const pro = `pri_${"p".repeat(26)}`;
const proYear = `pri_${"y".repeat(26)}`;
const end = "2030-01-01T00:00:00Z";

function subscription(price: string, interval = "month"): PaddleSubscription {
  return {
    id: "sub_test", customer_id: "ctm_test", status: "active",
    current_billing_period: { starts_at: "2028-12-31T00:00:00Z", ends_at: end },
    next_billed_at: end, scheduled_change: null, custom_data: { keep: true },
    items: [{ price: { id: price, billing_cycle: { interval, frequency: 1 } }, quantity: 1, trial_dates: null }],
  };
}

function client() {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), list: vi.fn() } satisfies PaddleApi;
}

beforeEach(() => {
  vi.stubEnv("PADDLE_ACCESS_SECRET", "access-test");
  vi.stubEnv("PADDLE_PRICE_STARTER_MONTHLY_ID", starter);
  vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY_ID", pro);
  vi.stubEnv("PADDLE_PRICE_PRO_YEARLY_ID", proYear);
  vi.useFakeTimers({ now: Date.parse("2029-01-05T00:00:00Z") });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("upgrades immediately and preserves unrelated customer metadata", async () => {
  const api = client();
  await expect(changePaddlePlan(api, subscription(starter), "pro", "monthly", pro))
    .resolves.toEqual({ effective: "now" });
  expect(api.patch).toHaveBeenCalledWith("/subscriptions/sub_test", expect.objectContaining({
    items: [{ price_id: pro, quantity: 1 }],
    proration_billing_mode: "prorated_immediately",
    custom_data: { keep: true, treuplate_paid_access: null },
  }));
});

it("keeps paid Pro access and the existing renewal date when downgrading to monthly", async () => {
  const api = client();
  api.patch.mockResolvedValue({ immediate_transaction: null, next_billed_at: end });
  await expect(changePaddlePlan(api, subscription(proYear, "year"), "starter", "monthly", starter))
    .resolves.toEqual({ effective: "period_end", effectiveAt: Date.parse(end) / 1000 });
  expect(api.patch.mock.calls.map(([path]) => path)).toEqual(["/subscriptions/sub_test/preview", "/subscriptions/sub_test"]);
  const update = api.patch.mock.calls[1][1];
  expect(update).toMatchObject({
    items: [{ price_id: starter, quantity: 1 }],
    next_billed_at: end,
    proration_billing_mode: "do_not_bill",
    custom_data: { keep: true },
  });
  const paid = update.custom_data.treuplate_paid_access;
  await expect(readPaidAccess("access-test", "sub_test", paid)).resolves.toMatchObject({ plan: "pro", until: end });
  await expect(readPaidAccess("access-test", "sub_other", paid)).resolves.toBeNull();
  await expect(readPaidAccess("access-test", "sub_test", { ...paid, until: "2040-01-01T00:00:00Z" })).resolves.toBeNull();
});

it("restores the originally paid annual price without another charge", async () => {
  const api = client();
  api.patch.mockResolvedValue({ immediate_transaction: null, next_billed_at: end });
  const current = subscription(starter);
  current.custom_data = { treuplate_paid_access: await signPaidAccess("access-test", current.id, {
    plan: "pro", interval: "year", priceId: proYear, until: end,
  }) };
  await expect(changePaddlePlan(api, current, "pro", "yearly", proYear)).resolves.toEqual({ effective: "now" });
  expect(api.patch).toHaveBeenLastCalledWith("/subscriptions/sub_test", {
    items: [{ price_id: proYear, quantity: 1 }],
    proration_billing_mode: "do_not_bill",
    next_billed_at: end,
    custom_data: { treuplate_paid_access: null },
  });
});

it("leaves the subscription untouched if Paddle previews a different renewal date", async () => {
  const api = client();
  api.patch.mockResolvedValue({ immediate_transaction: null, next_billed_at: "2030-02-01T00:00:00Z" });
  await expect(changePaddlePlan(api, subscription(proYear, "year"), "starter", "monthly", starter))
    .resolves.toBeNull();
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(api.patch.mock.calls[0][0]).toBe("/subscriptions/sub_test/preview");
});

it("uses Paddle's trial update fields without advancing the billing date", async () => {
  const api = client();
  const trialPrice = `pri_${"t".repeat(26)}`;
  vi.stubEnv("PADDLE_PRICE_STARTER_MONTHLY_TRIAL_ID", trialPrice);
  const trial: PaddleSubscription = {
    ...subscription(pro),
    status: "trialing",
    current_billing_period: null,
  };
  api.patch.mockResolvedValue({ ...trial, immediate_transaction: null });
  await expect(changePaddlePlan(api, trial, "starter", "monthly", starter)).resolves.toEqual({ effective: "now" });
  expect(api.patch).toHaveBeenLastCalledWith("/subscriptions/sub_test", {
    items: [{ price_id: trialPrice, quantity: 1 }], proration_billing_mode: "do_not_bill",
  });
});

it("cancels at the next renewal and can remove the cancellation", async () => {
  const api = client();
  const current = subscription(pro);
  const cancellation = { ...current, scheduled_change: { action: "cancel", effective_at: end } };
  api.post.mockResolvedValue(cancellation);
  api.patch.mockResolvedValue(current);

  await expect(setPaddleCancellation(api, current, true)).resolves.toEqual({ cancelAtPeriodEnd: true, periodEnd: end });
  expect(api.post).toHaveBeenCalledWith("/subscriptions/sub_test/cancel", { effective_from: "next_billing_period" });
  await expect(setPaddleCancellation(api, cancellation, false)).resolves.toEqual({ cancelAtPeriodEnd: false, periodEnd: end });
  expect(api.patch).toHaveBeenCalledWith("/subscriptions/sub_test", { scheduled_change: null });
});
