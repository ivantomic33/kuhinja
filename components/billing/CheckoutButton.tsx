"use client";

import { useState, type ReactNode } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  startCheckout,
  type CheckoutInterval,
} from "@/lib/billing/invoke";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

type CheckoutButtonProps = {
  interval?: CheckoutInterval;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  children: ReactNode;
  /** Visual variant — Pro uses primary orange. */
  variant?: "primary" | "secondary";
  className?: string;
  /**
   * Target plan for future multi-price checkout.
   * Server still owns assignment today; kept for wiring.
   * TODO: payment provider plan-specific price IDs.
   */
  planTarget?: "starter" | "pro";
};

export function CheckoutButton({
  interval = "month",
  disabled = false,
  fullWidth = true,
  leftIcon,
  children,
  variant = "primary",
  className,
  planTarget: _planTarget = "pro",
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleClick() {
    setLoading(true);
    setError(undefined);

    // TODO: payment provider — pass planTarget when starter/pro prices split.
    const result = await startCheckout(interval);
    if ("error" in result) {
      setError(sr.billing.checkoutError);
      setLoading(false);
      return;
    }

    window.location.assign(result.url);
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
        onClick={handleClick}
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
