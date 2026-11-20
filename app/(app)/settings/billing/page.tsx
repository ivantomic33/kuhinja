import Link from "next/link";
import { PortalButton } from "@/components/billing/PortalButton";
import { Badge } from "@/components/ui/Badge";
import { BentoCard } from "@/components/ui/BentoCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";
import { isPremium } from "@/lib/supabase/plan";
import { getPlanDetails } from "@/lib/supabase/plan-server";
import { formatShortDate } from "@/lib/utils/format";

function formatExpiresAt(iso: string | null): string {
  if (!iso) return sr.billing.noExpiration;
  return formatShortDate(iso);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const checkout = params?.checkout;
  const details = await getPlanDetails();
  const premium = isPremium(details.plan);
  const hasCustomer = Boolean(details.stripeCustomerId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={sr.billing.title}
        description={sr.billing.manageHint}
        action={
          <Link
            href="/settings"
            className="text-sm font-medium text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            {sr.common.back}
          </Link>
        }
      />

      {checkout === "success" ? (
        <BentoCard>
          <p className="text-sm font-medium text-success">
            {sr.billing.checkoutSuccess}
          </p>
        </BentoCard>
      ) : null}

      <BentoCard
        header={
          <div className="flex w-full items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{sr.billing.currentPlan}</h2>
            <Badge variant={premium ? "accent" : "neutral"}>
              {premium ? sr.settings.planPremium : sr.settings.planFree}
            </Badge>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {sr.settings.plan}
            </p>
            <p className="mt-1 text-lg font-semibold text-text">
              {premium ? sr.premium.proName : sr.premium.freeName}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {sr.settings.renewalDate}
            </p>
            <p className="mt-1 text-base text-text">
              {premium
                ? formatExpiresAt(details.planExpiresAt)
                : sr.billing.noExpiration}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {sr.premium.priceLabel}
            </p>
            <p className="mt-1 text-base tabular-nums text-text">
              {premium
                ? "Prema aktivnoj pretplati"
                : `${sr.premium.freePrice} ${sr.premium.currency}`}
            </p>
          </div>
        </div>
      </BentoCard>

      <BentoCard
        header={
          <h2 className="text-base font-semibold">{sr.billing.manage}</h2>
        }
      >
        <p className="text-sm text-muted">{sr.billing.manageHint}</p>
        {hasCustomer ? (
          <div className="max-w-xs">
            <PortalButton />
          </div>
        ) : (
          <div className="max-w-xs">
            <Link href="/premium" className="block">
              <PrimaryButton fullWidth type="button">
                {sr.settings.upgrade}
              </PrimaryButton>
            </Link>
          </div>
        )}
      </BentoCard>
    </div>
  );
}
