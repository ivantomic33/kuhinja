"use client";

import { useState, type ReactNode } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { BillingInterval, PaidPlan } from "@/lib/billing/plans";
import { startAuthorizedCheckout } from "@/lib/billing/start-checkout";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

type CheckoutButtonProps = {
  /** Server-authorized billing plan. */
  planKey?: PaidPlan;
  /** Billing interval matching the price shown on the page. */
  priceTier: BillingInterval;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

/**
 * Starts authorized checkout (customer bind + transaction authorization).
 * Webhooks only grant plans for authorized TreuPlate transactions.
 */
export function CheckoutButton({
  planKey = "pro",
  priceTier,
  disabled = false,
  fullWidth = true,
  leftIcon,
  children,
  variant = "primary",
  className,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleClick() {
    setLoading(true);
    setError(undefined);

    try {
      await startAuthorizedCheckout(planKey, priceTier);
    } catch (err) {
      setError(err instanceof Error ? err.message : sr.billing.checkoutError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <PrimaryButton
        type="button"
        fullWidth={fullWidth}
        disabled={disabled}
        loading={loading}
        leftIcon={leftIcon}
        variant={variant}
        className={cn("min-h-[46px]", className)}
        onClick={() => void handleClick()}
      >
        {children}
      </PrimaryButton>
      {error ? (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
