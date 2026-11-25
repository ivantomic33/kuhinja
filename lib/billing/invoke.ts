"use client";

import { createClient } from "@/lib/supabase/client";

import type { BillingInterval, PaidPlan } from "./plans";

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
 * Start Paddle Checkout (14-day trial). Interval maps to server price secrets.
 * Sends a requested plan key. Paddle events determine effective entitlements.
 */
export async function startCheckout(
  interval: CheckoutInterval = "month",
  plan: PaidPlan = "pro",
): Promise<{ url: string } | { error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(
    "create-checkout-session",
    {
      method: "POST",
      body: { interval, plan_key: plan },
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

export async function changeBillingPlan(planKey: PaidPlan, interval: BillingInterval) {
  return fetch("/api/billing/change-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planKey, interval }),
  });
}

/** Open Paddle Customer Portal for the current user. */
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
