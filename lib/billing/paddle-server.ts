import { planRank } from "@/lib/plan/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  paddleApi, readPaidAccess, signPaidAccess, type PaddleApi, type PaddleSubscription,
} from "@/supabase/functions/_shared/paddle";
import { configuredPrice } from "@/supabase/functions/_shared/billing-prices";
import { entitlementPlanId, planFromPriceId, type BillingInterval, type PaidPlan } from "./plans";

export function paddleClient() {
  return paddleApi((key) => process.env[key]);
}

export class BillingConflict extends Error {}

export async function withPlanMutation<T>(userId: string, mutate: () => Promise<T>): Promise<T> {
  const admin = createAdminClient();
  const params = { p_key: `customer:${userId}`, p_token: crypto.randomUUID() };
  const claim = await admin.rpc("claim_billing_lock", params);
  if (claim.error) throw new Error("Billing lock unavailable");
  if (!claim.data) throw new BillingConflict("Billing busy");
  try {
    return await mutate();
  } finally {
    const release = await admin.rpc("release_billing_lock", params);
    if (release.error) console.error("Billing lock release failed", release.error.code);
  }
}

export async function retrieveManageablePaddleSubscription(api: PaddleApi, id: string, customerId: string) {
  const subscription = await api.get<PaddleSubscription>(`/subscriptions/${id}`);
  return subscription.customer_id === customerId &&
    (subscription.status === "active" || subscription.status === "trialing")
    ? subscription : null;
}

export async function changePaddlePlan(
  api: PaddleApi, subscription: PaddleSubscription, target: PaidPlan, interval: BillingInterval, targetPriceId: string,
) {
  if (subscription.scheduled_change || subscription.items.length !== 1) return null;
  const item = subscription.items[0];
  const current = planFromPriceId(item.price.id);
  if (!current || !item.price.billing_cycle || item.quantity !== 1) return null;
  const secret = process.env.PADDLE_ACCESS_SECRET;
  if (!secret) throw new Error("Missing Paddle access signing key");

  const existing = await readPaidAccess(secret, subscription.id, subscription.custom_data?.treuplate_paid_access);
  const accessUntil = existing && Date.parse(existing.until) > Date.now() ? existing : null;
  const trialing = subscription.status === "trialing";
  const readEnv = (key: string) => process.env[key];
  const beforeInterval = item.price.billing_cycle.interval;
  if (beforeInterval !== "month" && beforeInterval !== "year") return null;
  const targetInterval = interval === "yearly" ? "year" : "month";
  const intervalChanges = beforeInterval !== targetInterval;
  const currentPlan = accessUntil?.plan ?? current;
  const paidInterval = accessUntil?.interval ?? beforeInterval;
  const restore = Boolean(accessUntil && target === currentPlan && targetInterval === paidInterval);
  const defer = !trialing && !restore && (
    Boolean(accessUntil) ||
    planRank(entitlementPlanId(target)) < planRank(entitlementPlanId(currentPlan)) ||
    (target === current && beforeInterval === "year" && intervalChanges)
  );
  const end = accessUntil?.until ?? subscription.current_billing_period?.ends_at ?? item.trial_dates?.ends_at;
  if (defer && (!end || Date.parse(end) <= Date.now())) return null;
  if (trialing && (target !== current || intervalChanges)) {
    // A plan swap must never start billing during the customer's remaining trial.
    // Paddle's trial-price variant is required to keep the trial when switching items.
    targetPriceId = configuredPrice(readEnv, target, interval, true) ?? "";
    if (!targetPriceId || planFromPriceId(targetPriceId) !== target) return null;
  }

  const outcome = defer
    ? { effective: "period_end" as const, effectiveAt: Math.floor(Date.parse(end!) / 1000) }
    : { effective: "now" as const };
  if (target === current && !intervalChanges && !restore) return outcome;
  if (restore && accessUntil) targetPriceId = accessUntil.priceId;

  const preserve = defer ? await signPaidAccess(secret, subscription.id, {
    plan: currentPlan, interval: paidInterval, priceId: accessUntil?.priceId ?? item.price.id, until: end!,
  }) : null;
  const path = `/subscriptions/${subscription.id}`;
  const update = {
    items: [{ price_id: targetPriceId, quantity: 1 }],
    proration_billing_mode: defer || trialing || restore ? "do_not_bill" : "prorated_immediately",
    ...(!trialing && (defer || restore) && intervalChanges && { next_billed_at: end }),
    ...(!trialing && { custom_data: { ...subscription.custom_data, treuplate_paid_access: preserve } }),
  };
  if (defer || trialing || restore) {
    const preview = await api.patch<PaddleSubscription & { immediate_transaction: unknown }>(
      `${path}/preview`, update,
    );
    const expectedRenewal = trialing ? item.trial_dates?.ends_at ?? subscription.next_billed_at : end;
    if (preview.immediate_transaction !== null || !expectedRenewal || !preview.next_billed_at ||
        Date.parse(preview.next_billed_at) !== Date.parse(expectedRenewal) ||
        (trialing && preview.status !== "trialing")) return null;
  }
  await api.patch(path, update);
  return outcome;
}

export async function setPaddleCancellation(api: PaddleApi, subscription: PaddleSubscription, cancel: boolean) {
  const existing = subscription.scheduled_change;
  if (existing && existing.action !== "cancel") return null;
  const end = subscription.current_billing_period?.ends_at ??
    subscription.items[0]?.trial_dates?.ends_at ?? subscription.next_billed_at;
  if (!end) return null;
  const path = `/subscriptions/${subscription.id}`;
  const updated = Boolean(existing) === cancel ? subscription : cancel
    ? await api.post<PaddleSubscription>(`${path}/cancel`, { effective_from: "next_billing_period" })
    : await api.patch<PaddleSubscription>(path, { scheduled_change: null });
  return {
    cancelAtPeriodEnd: updated.scheduled_change?.action === "cancel",
    periodEnd: updated.scheduled_change?.effective_at ?? end,
  };
}
