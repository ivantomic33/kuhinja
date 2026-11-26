import { PremiumOffer } from "@/components/billing/PremiumPage";
import { BillingPlanNotice } from "@/components/billing/BillingPlanNotice";

export const metadata = { title: "Paketi i cene za restorane" };

export default function AccountPricingPage() {
  return <PremiumOffer accountNotice={<BillingPlanNotice />} />;
}
