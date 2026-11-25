"use server";

import { redirect } from "next/navigation";
import { checkoutHref, checkoutIntent } from "@/lib/billing/checkout-intent";
import { getSiteUrl } from "@/lib/seo/site";
import { requireCheckoutUser } from "./session";

export async function createCheckoutSession(formData: FormData) {
  const parsed = checkoutIntent.safeParse({
    plan_key: formData.get("plan_key"),
    interval: formData.get("interval"),
  });
  if (!parsed.success) redirect("/#cenovnik");

  const { plan_key, interval } = parsed.data;
  const href = checkoutHref(plan_key, interval);
  const supabase = await requireCheckoutUser(href);
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    method: "POST",
    body: parsed.data,
  });
  const rawUrl = typeof data?.url === "string" ? data.url : null;
  let transaction: string | null = null;
  if (rawUrl) {
    try {
      const parsedUrl = URL.canParse(rawUrl)
        ? new URL(rawUrl)
        : rawUrl.startsWith("/checkout?")
          ? new URL(rawUrl, getSiteUrl())
          : null;
      const candidate = parsedUrl?.searchParams.get("_ptxn")?.trim() ?? null;
      if (
        parsedUrl &&
        parsedUrl.pathname === "/checkout" &&
        candidate &&
        /^txn_[a-z\d]{26}$/.test(candidate)
      ) {
        transaction = candidate;
      }
    } catch {
      transaction = null;
    }
  }
  if (error || !transaction) {
    redirect(`${href}&error=1`);
  }
  // Stay on this app origin; overlay checkout only needs the authorized transaction id.
  redirect(`/checkout?_ptxn=${encodeURIComponent(transaction)}`);
}
