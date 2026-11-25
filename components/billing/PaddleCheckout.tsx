"use client";

import { useEffect, useState } from "react";
import {
  checkoutSuccessUrl,
  getBrowserPaddle,
  openOverlayCheckout,
} from "@/lib/billing/paddle-browser";

/**
 * Ensures Paddle.js is loaded for routes that may open checkout.
 * Token and environment come from NEXT_PUBLIC_* env vars (fail loudly if unset).
 *
 * On the default payment link (`/checkout?_ptxn=…`), opens one-page overlay
 * checkout for that transaction id.
 */
export function PaddleCheckout({
  customerId,
  checkout = false,
}: {
  customerId: string | null;
  checkout?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const paddle = await getBrowserPaddle();
        if (cancelled) return;

        const pwCustomer =
          customerId && /^ctm_[a-z\d]{26}$/.test(customerId)
            ? { id: customerId }
            : {};
        if (paddle.Initialized) {
          paddle.Update({ pwCustomer });
        }

        if (!checkout || typeof window === "undefined") return;

        const params = new URLSearchParams(window.location.search);
        const transactionId = params.get("_ptxn")?.trim();
        if (!transactionId) return;

        await openOverlayCheckout({
          transactionId,
          settings: {
            displayMode: "overlay",
            variant: "one-page",
            successUrl: checkoutSuccessUrl(),
            allowLogout: false,
          },
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Paddle unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, checkout]);

  if (error && checkout) {
    return (
      <p role="alert" className="text-sm text-danger">
        Paddle naplata trenutno nije dostupna. {error}
      </p>
    );
  }

  return null;
}
