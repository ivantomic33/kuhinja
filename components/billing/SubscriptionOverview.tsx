import Link from "next/link";
import { PortalButton } from "@/components/billing/PortalButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatShortDate } from "@/lib/utils/format";
import type { SubscriptionStatus } from "@/supabase/functions/_shared/entitlements";

const statusLabels: Partial<Record<SubscriptionStatus, string>> = {
  trialing: "Probni period",
  active: "Aktivna",
  past_due: "Plaćanje kasni",
  canceled: "Otkazana",
  paused: "Pauzirana",
};

export function SubscriptionOverview({ name, status, currentPeriodEnd, hasCustomer }: {
  name: string;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
}) {
  const until = status === "canceled" ? "Pristup do" : "Trenutni period do";
  return (
    <section className="mx-auto grid w-full max-w-xl gap-4 py-6">
      <PageHeader title={`Vaša pretplata · ${name}`} />
      <p>{status ? statusLabels[status] : "Pretplata"}</p>
      {currentPeriodEnd ? <p>{until} {formatShortDate(currentPeriodEnd)}</p> : null}
      {status === "past_due" ? (
        <p role="alert">Plaćanje nije uspelo. Ažurirajte način plaćanja u korisničkom portalu.</p>
      ) : null}
      {hasCustomer ? <PortalButton /> : null}
      {status === "active" || status === "trialing" ? (
        <Link href="/premium/upravljanje" className="font-semibold text-accent underline">Promeni paket</Link>
      ) : null}
    </section>
  );
}
