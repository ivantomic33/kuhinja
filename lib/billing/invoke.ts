"use client";

import { createClient } from "@/lib/supabase/client";

export type CheckoutInterval = "month" | "year";

type FunctionErrorBody = {
  error?: string;
};

function readUrl(data: unknown): string | null {
  if (
    data &&
    typeof data === "object" &&
    "url" in data &&
    typeof (data as { url: unknown }).url === "string"
  ) {
    return (data as { url: string }).url;
  }
  return null;
}

/**
 * Start Stripe Checkout (14-day trial). Interval maps to server price secrets.
 * Never sends a plan value — server owns plan assignment via webhook.
 */
export async function startCheckout(
  interval: CheckoutInterval = "month"
): Promise<{ url: string } | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(
    "create-checkout-session",
    {
      method: "POST",
      body: { interval },
    }
  );

  if (error) {
    return { error: error.message || "checkout_failed" };
  }

  const url = readUrl(data);
  if (!url) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as FunctionErrorBody).error ?? "checkout_failed")
        : "checkout_failed";
    return { error: message };
  }

  return { url };
}

/** Open Stripe Customer Portal for the current user. */
export async function openCustomerPortal(): Promise<
  { url: string } | { error: string }
> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(
    "create-portal-session",
    { method: "POST" }
  );

  if (error) {
    return { error: error.message || "portal_failed" };
  }

  const url = readUrl(data);
  if (!url) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as FunctionErrorBody).error ?? "portal_failed")
        : "portal_failed";
    return { error: message };
  }

  return { url };
}
