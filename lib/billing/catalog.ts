import { cache } from "react";
import { billingIntervals, paidPlans, type BillingInterval, type PaidPlan } from "@/supabase/functions/_shared/billing-prices";
import { matchesPaddleInterval, matchingTrialPrice, type PaddlePrice } from "@/supabase/functions/_shared/paddle";
import { paddleClient } from "./paddle-server";
import { priceIdFor, trialPriceIdFor } from "./plans";

type CatalogPrice = { label: string; amount: string; currency: string; trialAvailable?: boolean };
export type BillingCatalog = Record<PaidPlan, Record<BillingInterval, CatalogPrice | null>>;

function emptyCatalog(): BillingCatalog {
  return {
    starter: { monthly: null, yearly: null },
    pro: { monthly: null, yearly: null },
    advanced: { monthly: null, yearly: null },
  };
}

export const getBillingCatalog = cache(async (): Promise<BillingCatalog> => {
  const catalog = emptyCatalog();
  const environment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
  if (!process.env.PADDLE_API_KEY || (environment !== "sandbox" && environment !== "production")) {
    return catalog;
  }

  const api = paddleClient();
  await Promise.all(paidPlans.flatMap((plan) => billingIntervals.map(async (interval) => {
    const priceId = priceIdFor(plan, interval);
    if (!priceId) return;
    try {
      const trialId = trialPriceIdFor(plan, interval);
      const [price, trial] = await Promise.all([
        api.get<PaddlePrice>(`/prices/${priceId}`),
        trialId ? api.get<PaddlePrice>(`/prices/${trialId}`).catch(() => null) : null,
      ]);
      if (!matchesPaddleInterval(price, interval) || price.trial_period) return;
      const minor = Number(price.unit_price.amount);
      if (!Number.isSafeInteger(minor) || minor < 0) return;
      const format = new Intl.NumberFormat("sr-Latn-RS", {
        style: "currency", currency: price.unit_price.currency_code, currencyDisplay: "code",
      });
      const decimals = format.resolvedOptions().maximumFractionDigits ?? 2;
      const amount = (minor / 10 ** decimals).toFixed(decimals);
      catalog[plan][interval] = {
        label: format.format(Number(amount)),
        amount,
        currency: price.unit_price.currency_code,
        trialAvailable: Boolean(trial && matchesPaddleInterval(trial, interval) && matchingTrialPrice(trial, price)),
      };
    } catch (error) {
      console.error("Paddle catalog price unavailable", error instanceof Error ? error.message : "unknown");
    }
  })));
  return catalog;
});
