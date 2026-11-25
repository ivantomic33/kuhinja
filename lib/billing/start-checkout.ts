"use client";

import { checkoutHref } from "@/lib/billing/checkout-intent";
import type { BillingInterval, PaidPlan } from "@/lib/billing/plans";
import { sr } from "@/lib/i18n/sr";

function messageForCode(code: string | undefined): string {
  switch (code) {
    case "EXISTING_SUBSCRIPTION":
      return "Već imate aktivnu pretplatu. Upravljajte njom u podešavanjima.";
    case "CHECKOUT_PROCESSING":
      return "Prethodna naplata je još u toku. Sačekajte trenutak.";
    case "BILLING_BUSY":
      return "Naplata je zauzeta. Pokušajte ponovo za nekoliko sekundi.";
    case "CUSTOMER_CONFLICT":
      return "Nalog za naplatu je u konfliktu. Kontaktirajte podršku.";
    case "PRICE_UNAVAILABLE":
      return "Cena paketa nije podešena u Paddle-u. Proverite price ID tajne.";
    case "CHECKOUT_UNAVAILABLE":
    case "CHECKOUT_FAILED":
      return "Checkout nije uspeo. Proverite Edge funkciju i Paddle API ključ.";
    case "BILLING_UNAVAILABLE":
      return "Naplata nije konfigurisana (SITE_URL ili Supabase tajne nedostaju).";
    case "PROFILE_UNAVAILABLE":
    case "CUSTOMER_SAVE_FAILED":
      return "Nalog nije spreman za naplatu. Osvežite stranicu ili se ponovo prijavite.";
    case "VALIDATION_ERROR":
      return "Neispravan zahtev za naplatu. Osvežite stranicu i pokušajte ponovo.";
    case "FUNCTIONS_UNAVAILABLE":
      return "Billing Edge funkcija nije dostupna. Deploy-ujte create-checkout-session.";
    case "UNAUTHORIZED":
      return sr.auth.signInForPlan;
    default:
      return sr.billing.checkoutError;
  }
}

async function readInvokeErrorCode(
  data: unknown,
  error: { message?: string; context?: unknown; name?: string } | null,
): Promise<string | undefined> {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  const response = error?.context;
  if (response && typeof response === "object" && "json" in response &&
      typeof (response as { json?: unknown }).json === "function") {
    try {
      const body = await (response as Response).clone().json();
      if (body && typeof body === "object" && typeof body.error === "string") {
        return body.error;
      }
    } catch {
      // Fall through to transport-level hints below.
    }
  }
  const hint = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (
    hint.includes("failed to send a request to the edge function") ||
    hint.includes("not found") ||
    hint.includes("functionshttperror") ||
    hint.includes("functionsfetcherror")
  ) {
    return "FUNCTIONS_UNAVAILABLE";
  }
  return undefined;
}

/**
 * Starts the authorized TreuPlate checkout path:
 * create-checkout-session → /checkout?_ptxn=… → Paddle overlay.
 * Direct price-id overlays skip customer binding + authorization, so webhooks
 * cannot grant the paid plan.
 */
export async function startAuthorizedCheckout(
  planKey: PaidPlan,
  interval: BillingInterval,
): Promise<void> {
  const href = checkoutHref(planKey, interval);
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    window.location.assign(`/login?next=${encodeURIComponent(href)}`);
    return;
  }

  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    method: "POST",
    body: { plan_key: planKey, interval },
  });

  const url =
    data && typeof data === "object" && "url" in data && typeof data.url === "string"
      ? data.url
      : null;

  // Prefer same-origin /checkout so local tunnels keep working even if SITE_URL differs.
  if (url) {
    try {
      const target = URL.canParse(url)
        ? new URL(url)
        : url.startsWith("/checkout?")
          ? new URL(url, window.location.origin)
          : null;
      const transaction = target?.searchParams.get("_ptxn")?.trim();
      if (
        target &&
        target.pathname === "/checkout" &&
        transaction &&
        /^txn_[a-z\d]{26}$/.test(transaction)
      ) {
        window.location.assign(`/checkout?_ptxn=${encodeURIComponent(transaction)}`);
        return;
      }
    } catch {
      // Fall through to the mapped edge error below.
    }
  }

  const edgeCode = await readInvokeErrorCode(data, error);
  if (edgeCode === "UNAUTHORIZED") {
    window.location.assign(`/login?next=${encodeURIComponent(href)}`);
    return;
  }

  throw new Error(messageForCode(edgeCode));
}
