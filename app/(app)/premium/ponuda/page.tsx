import { PremiumOffer } from "@/components/billing/PremiumPage";
import { SubscriptionOverview } from "@/components/billing/SubscriptionOverview";
import { getPlanDetails } from "@/lib/supabase/plan-server";
import { planDisplayName } from "@/lib/plan/entitlements";

export const metadata = { title: "Paketi i cene za restorane" };

export default async function AccountPricingPage() {
  const details = await getPlanDetails();
  const overview = <SubscriptionOverview name={planDisplayName(details.plan)} status={details.billingStatus ?? null}
    currentPeriodEnd={details.currentPeriodEnd ?? null} hasCustomer={Boolean(details.paddleCustomerId)} />;
  if (details.plan !== "free") return overview;
  const pendingPayment = details.billingStatus === "past_due" || details.billingStatus === "paused";
  return <PremiumOffer accountNotice={pendingPayment ? overview : undefined} />;
}
