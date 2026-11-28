"use server";

import { redirect } from "next/navigation";
import { checkoutHref, checkoutIntent } from "@/lib/billing/checkout-intent";
import { createCheckoutTransaction } from "@/lib/paddle/checkout";
import { requireCheckoutUser } from "./session";

export async function createCheckoutSession(formData: FormData) {
  const input = checkoutIntent.safeParse({
    plan_key: formData.get("plan_key"),
    interval: formData.get("interval"),
  });
  if (!input.success) redirect("/#cenovnik");

  const href = checkoutHref(input.data.plan_key, input.data.interval);
  const supabase = await requireCheckoutUser(href);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect(`/login?next=${encodeURIComponent(href)}`);

  const result = await createCheckoutTransaction({ user, supabase }, input.data);
  if ("error" in result) redirect(`${href}&error=1`);
  redirect(`/checkout?_ptxn=${encodeURIComponent(result.transactionId)}`);
}
