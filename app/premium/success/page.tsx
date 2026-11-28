import { redirect } from "next/navigation";
import { getEntitlement } from "@/lib/billing/entitlements";
import { createClient, getServerUser } from "@/lib/supabase/server";
import { PaymentConfirmation } from "./payment-confirmation";

export const metadata = { title: "Potvrda plaćanja", robots: { index: false, follow: false } };

export default async function PaymentSuccessPage() {
  const user = await getServerUser();
  if (!user) redirect("/login?next=%2Fpremium%2Fsuccess");

  const supabase = await createClient();
  let confirmed = false;
  try {
    confirmed = (await getEntitlement(supabase, user.id)).isPremium;
  } catch {
    // A temporary database error is retried by the same polling flow.
  }
  return <PaymentConfirmation confirmed={confirmed} />;
}
