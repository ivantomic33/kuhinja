"use client";

import { useState } from "react";
import { PricingCard } from "@/components/ui/PricingCard";
import { trackAnalytics } from "@/lib/analytics/track";
import { checkoutHref } from "@/lib/billing/checkout-intent";
import type { BillingInterval, PlanPrice, PricingPlan } from "@/lib/billing/plans";
import { sr } from "@/lib/i18n/sr";
import { primaryCtaClass, secondaryCtaClass } from "./landing-links";

export function annualSavings(monthly: PlanPrice | null, yearly: PlanPrice | null) {
  if (!monthly || !yearly || monthly.currency !== yearly.currency) return null;
  const fullYear = Number(monthly.amount) * 12;
  const pct = 100 * (fullYear - Number(yearly.amount)) / fullYear;
  const rounded = Math.round(pct);
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
}

export function PricingTable({ plans }: { plans: readonly PricingPlan[] }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const labels = sr.marketing.landing;
  const yearly = interval === "yearly";

  function toggleInterval() {
    const next = yearly ? "monthly" : "yearly";
    setInterval(next);
    trackAnalytics("landing_pricing_toggle", { interval: next });
  }

  return (
    <div className="flex flex-col items-start gap-6">
      <button
        type="button"
        role="switch"
        aria-checked={yearly}
        aria-label={labels.yearlyBilling}
        onClick={toggleInterval}
        className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-xl border border-border-strong bg-surface p-1 text-sm font-semibold"
      >
        <span className={`rounded-lg px-3 py-2 ${yearly ? "text-text-2" : "bg-accent text-accent-ink"}`}>{labels.monthly}</span>
        <span className={`rounded-lg px-3 py-2 ${yearly ? "bg-accent text-accent-ink" : "text-text-2"}`}>{labels.yearly}</span>
      </button>
      <div className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
        {plans.map((plan) => {
          const free = plan.key === "free";
          const href = plan.key === "free" ? "/register" : checkoutHref(plan.key, interval);
          const price = plan.prices[interval];
          const savings = !free && yearly ? annualSavings(plan.prices.monthly, plan.prices.yearly) : null;
          return (
            <PricingCard
              key={plan.key}
              name={plan.name}
              description={plan.description}
              price={price?.label ?? <span className="text-base text-text-2">{labels.priceUnavailable}</span>}
              priceHint={price && !free ? (yearly ? labels.yearly : labels.monthly) : undefined}
              features={plan.features}
              badge={savings === null ? undefined : labels.savings(savings)}
              cta={plan.checkoutAvailable[interval] ? (
                <a href={href} data-landing-cta="pricing" className={`${free ? primaryCtaClass : secondaryCtaClass} w-full`}>
                  {free ? sr.marketing.ctaRegister : labels.selectPlan(plan.name)}
                </a>
              ) : (
                <p className="text-sm text-text-2">{labels.enrollmentUnavailable}</p>
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
