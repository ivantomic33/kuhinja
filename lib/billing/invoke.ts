"use client";

import type { BillingInterval, PaidPlan } from "./plans";
import { requestCheckoutTransaction } from "./start-checkout";

export type CheckoutInterval = "month" | "year";

export async function startCheckout(interval: CheckoutInterval = "month", plan: PaidPlan = "pro") {
  const result = await requestCheckoutTransaction(plan, interval === "year" ? "yearly" : "monthly");
  return "error" in result
    ? { error: result.error }
    : { url: `/checkout?_ptxn=${encodeURIComponent(result.transactionId)}` };
}

export async function changeBillingPlan(planKey: PaidPlan, interval: BillingInterval) {
  return fetch("/api/billing/change-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planKey, interval }),
  });
}

export async function openCustomerPortal(): Promise<{ url: string } | { error: string }> {
  try {
    const response = await fetch("/api/billing/portal", { method: "POST", cache: "no-store" });
    const data = await response.json();
    if (response.ok && typeof data.url === "string" && new URL(data.url).protocol === "https:") {
      return { url: data.url };
    }
    return { error: typeof data.error === "string" ? data.error : "portal_failed" };
  } catch {
    return { error: "portal_failed" };
  }
}
