"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { CountryCode } from "@paddle/paddle-js";
import { previewPrices } from "@/lib/billing/paddle-browser";
import { startAuthorizedCheckout } from "@/lib/billing/start-checkout";
import type { Tier, TierInterval } from "@/lib/billing/tiers";
import { Badge } from "@/components/ui/Badge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StateLink } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

type BillingPeriod = "monthly" | "yearly";

type PricingTiersProps = {
  tiers: Tier[];
  /** ISO-3166 alpha-2 from the edge. Omit when unknown — Paddle auto-detects. */
  country?: string;
  /** When true, Subscribe sends guests to login first. */
  requireAuth?: boolean;
  guest?: boolean;
};

function intervalFromPeriod(period: BillingPeriod): TierInterval {
  return period === "yearly" ? "year" : "month";
}

export function PricingTiers({
  tiers,
  country,
  requireAuth = false,
  guest = false,
}: PricingTiersProps) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const interval = intervalFromPeriod(period);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [busyPriceId, setBusyPriceId] = useState<string | null>(null);

  const priceIds = useMemo(
    () => tiers.flatMap((tier) => [tier.priceId.month, tier.priceId.year]),
    [tiers],
  );

  const loadPrices = useCallback(async () => {
    setLoadingPrices(true);
    setPriceError(null);
    try {
      const params = {
        items: priceIds.map((priceId) => ({ priceId, quantity: 1 })),
        ...(country
          ? { address: { countryCode: country as CountryCode } }
          : {}),
      };
      const result = await previewPrices(params);
      const next: Record<string, string> = {};
      for (const line of result.data.details.lineItems) {
        // Display only Paddle's formatted totals — no local math or re-format.
        next[line.price.id] = line.formattedTotals.total;
      }
      setPrices(next);
    } catch (error) {
      setPrices({});
      setPriceError(
        error instanceof Error
          ? error.message
          : "Cene trenutno nisu dostupne.",
      );
    } finally {
      setLoadingPrices(false);
    }
  }, [country, priceIds]);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  async function subscribe(tier: Tier) {
    const priceId = tier.priceId[interval];
    setCheckoutError(null);
    setBusyPriceId(priceId);

    try {
      if (guest && requireAuth) {
        window.location.assign(
          `/login?next=${encodeURIComponent(`/premium#plan-${tier.name.toLowerCase()}`)}`,
        );
        return;
      }

      // Authorized server checkout binds the Paddle customer + transaction so
      // the webhook can grant the paid plan. Never open a bare price-id overlay.
      await startAuthorizedCheckout(
        tier.key,
        period === "yearly" ? "yearly" : "monthly",
      );
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : sr.billing.checkoutError,
      );
    } finally {
      setBusyPriceId(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="billing mx-auto flex justify-center">
        <SegmentedControl<BillingPeriod>
          ariaLabel="Period naplate"
          value={period}
          onChange={setPeriod}
          size="lg"
          options={[
            { value: "monthly", label: "Mesečno" },
            { value: "yearly", label: "Godišnje" },
          ]}
        />
      </div>

      {priceError ? (
        <p role="alert" className="mx-auto max-w-xl text-center text-sm text-danger">
          {priceError}
        </p>
      ) : null}
      {checkoutError ? (
        <p role="alert" className="mx-auto max-w-xl text-center text-sm text-danger">
          {checkoutError}
        </p>
      ) : null}

      <section
        aria-labelledby="pricing-tiers-heading"
        className="motion-card-list mx-auto grid w-full min-w-0 max-w-[1200px] grid-cols-1 gap-5 md:grid-cols-3"
      >
        <h2 id="pricing-tiers-heading" className="sr-only">
          Planovi
        </h2>

        {tiers.map((tier) => {
          const priceId = tier.priceId[interval];
          const formatted = prices[priceId];
          const featured = Boolean(tier.featured);
          const busy = busyPriceId === priceId;

          return (
            <article
              key={tier.key}
              id={`plan-${tier.name.toLowerCase()}`}
              className={cn(
                "relative flex min-h-0 flex-col gap-4 rounded-2xl px-5 py-6",
                featured
                  ? "premium-pro-card scroll-mt-20"
                  : "border border-border bg-surface shadow-[var(--shadow)]",
              )}
            >
              {featured ? (
                <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-ui-xs font-bold uppercase tracking-wide text-text-on-accent shadow-sm">
                  Najpopularnije
                </span>
              ) : null}

              <div className={cn("flex items-start justify-between gap-2", featured && "pt-1")}>
                <h3 className="text-ui-lg font-semibold text-text">{tier.name}</h3>
                {featured ? <Badge variant="accent">Preporučeno</Badge> : null}
              </div>

              <p className="text-ui-sm text-text-2">{tier.description}</p>

              <div>
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="text-ui-3xl font-bold leading-none tracking-[-0.03em] tabular-nums text-text">
                    {loadingPrices
                      ? "…"
                      : formatted ?? "Cena nije dostupna"}
                  </span>
                  {formatted ? (
                    <span className="text-ui-base text-text-2">
                      {period === "yearly" ? "/ god" : "/ mes"}
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 text-ui-sm text-text-2">
                  {period === "yearly"
                    ? "Naplata godišnje. Otkažite kad želite."
                    : "Naplata mesečno. Otkažite kad želite."}
                </p>
              </div>

              <ul className="flex flex-col gap-3 border-t border-border pt-4">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-ui-sm text-text"
                  >
                    <span
                      className={cn(
                        "ck mt-1 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full",
                        featured
                          ? "bg-[var(--accent-soft)] text-accent"
                          : "bg-surface-3 text-text-2",
                      )}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-2">
                {guest && requireAuth ? (
                  <StateLink
                    href={`/login?next=${encodeURIComponent(`/premium#plan-${tier.name.toLowerCase()}`)}`}
                    fullWidth
                    variant={featured ? undefined : "secondary"}
                  >
                    {sr.auth.signInForPlan}
                  </StateLink>
                ) : (
                  <PrimaryButton
                    type="button"
                    fullWidth
                    className="min-h-[46px]"
                    variant={featured ? "primary" : "secondary"}
                    loading={busy}
                    disabled={loadingPrices || !formatted || Boolean(busyPriceId)}
                    onClick={() => void subscribe(tier)}
                  >
                    Pretplati se · {tier.name}
                  </PrimaryButton>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
