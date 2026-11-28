"use client";

import { checkoutHref } from "@/lib/billing/checkout-intent";
import type { BillingInterval, PaidPlan } from "@/lib/billing/plans";
import { sr } from "@/lib/i18n/sr";
import { checkoutSuccessUrl, openOverlayCheckout } from "./paddle-browser";

const messages: Record<string, string> = {
  EXISTING_SUBSCRIPTION: "Već imate pretplatu. Upravljajte njom u podešavanjima.",
  CHECKOUT_PROCESSING: "Prethodna naplata je još u toku.",
  BILLING_BUSY: "Naplata je zauzeta. Pokušajte ponovo za nekoliko sekundi.",
  CUSTOMER_CONFLICT: "Nalog za naplatu nije povezan. Kontaktirajte podršku.",
  PRICE_UNAVAILABLE: "Izabrana cena trenutno nije dostupna.",
};

export async function requestCheckoutTransaction(plan_key: PaidPlan, interval: BillingInterval):
  Promise<{ transactionId: string } | { error: string; status: number }> {
  const response = await fetch("/api/billing/transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_key, interval }),
  });
  const body: { transactionId?: string; error?: string } = await response.json().catch(() => ({}));
  if (response.ok && typeof body.transactionId === "string" && /^txn_[a-z\d]{26}$/.test(body.transactionId)) {
    return { transactionId: body.transactionId } as const;
  }
  return { error: body.error ?? "CHECKOUT_FAILED", status: response.status } as const;
}

export async function startAuthorizedCheckout(plan: PaidPlan, interval: BillingInterval) {
  const result = await requestCheckoutTransaction(plan, interval);
  if ("error" in result) {
    const next = encodeURIComponent(checkoutHref(plan, interval));
    if (result.status === 401) {
      window.location.assign(`/login?next=${next}`);
      return;
    }
    if (result.error === "CONSENT_REQUIRED") {
      window.location.assign(`/auth/legal-consent?next=${next}`);
      return;
    }
    throw new Error(messages[result.error] ?? sr.billing.checkoutError);
  }

  await openOverlayCheckout({
    transactionId: result.transactionId,
    settings: { successUrl: checkoutSuccessUrl() },
  });
}
