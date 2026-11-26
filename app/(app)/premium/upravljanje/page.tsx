import { redirect } from "next/navigation";
import { ManageSubscription } from "@/components/billing/ManageSubscription";
import { BentoCard } from "@/components/ui/BentoCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getBillingCatalog } from "@/lib/billing/catalog";
import { requireManageableSubscription } from "@/lib/billing/guard";

export const metadata = { title: "Upravljanje pretplatom", robots: { index: false, follow: false } };

export default async function ManagePremiumPage() {
  const access = await requireManageableSubscription();
  if ("error" in access) {
    if (access.error.code === "UNAUTHORIZED") redirect("/login?next=%2Fpremium%2Fupravljanje");
    if (access.error.code === "UPGRADE_REQUIRED") redirect("/settings/billing");
    throw new Error(access.error.message);
  }

  const subscription = access.subscription;
  const catalog = await getBillingCatalog();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Upravljanje pretplatom" />
      <BentoCard>
        <ManageSubscription
          catalog={catalog}
          plan={subscription.plan_key}
          periodEnd={subscription.current_period_end}
          trialing={subscription.status === "trialing"}
          cancelAtPeriodEnd={subscription.cancel_at_period_end}
        />
      </BentoCard>
    </div>
  );
}
