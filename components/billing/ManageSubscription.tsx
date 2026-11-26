"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PortalButton } from "@/components/billing/PortalButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { changeBillingPlan } from "@/lib/billing/invoke";
import type { BillingCatalog } from "@/lib/billing/catalog";
import { PLANS, type BillingInterval, type PaidPlan } from "@/lib/billing/plans";
import { ENTITLEMENTS_QUERY_KEY, useEntitlements } from "@/lib/hooks/useEntitlements";
import { queryKeys } from "@/lib/query/keys";
import { formatShortDate } from "@/lib/utils/format";
import { z } from "zod";

const changeResult = z.object({
  effective: z.enum(["now", "period_end"]),
  effectiveAt: z.number().optional(),
});
const cancellationResult = z.object({
  cancelAtPeriodEnd: z.boolean(),
  periodEnd: z.string(),
});

type Props = {
  plan: PaidPlan;
  periodEnd: string | null;
  trialing: boolean;
  cancelAtPeriodEnd: boolean;
  catalog: BillingCatalog;
};

export function ManageSubscription({ plan, periodEnd, trialing, cancelAtPeriodEnd, catalog }: Props) {
  const formId = useId();
  const router = useRouter();
  const query = useQueryClient();
  const { data: entitlements } = useEntitlements();
  const [target, setTarget] = useState<PaidPlan>(plan);
  const [interval, setInterval] = useState<BillingInterval | "">("");
  const [cancellation, setCancellation] = useState<Props["cancelAtPeriodEnd"] | null>(null);
  const [end, setEnd] = useState(periodEnd);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canceling = cancellation ?? cancelAtPeriodEnd;
  const displayedPlan = entitlements?.plan ?? plan;
  const changeUnavailable = canceling
    ? "Poništite zakazano otkazivanje da biste promenili paket."
    : !interval
      ? "Izaberite period naplate da biste promenili paket."
      : !catalog[target][interval]
        ? "Izaberite period naplate za koji je cena dostupna."
        : undefined;

  function refresh() {
    void query.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });
    void query.invalidateQueries({ queryKey: queryKeys.plan });
    router.refresh();
  }

  async function submitChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interval || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await changeBillingPlan(target, interval);
      if (!response.ok) throw new Error();
      const result = changeResult.parse(await response.json());
      setMessage(result.effective === "period_end" && result.effectiveAt
        ? `Promena je zakazana za ${formatShortDate(new Date(result.effectiveAt * 1000).toISOString())}.`
        : "Promena je potvrđena. Prikaz paketa će se osvežiti po Paddle potvrdi.");
      refresh();
    } catch {
      setError("Promena paketa nije uspela. Pokušajte ponovo ili otvorite Paddle portal.");
    } finally {
      setPending(false);
    }
  }

  async function toggleCancellation() {
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/billing/cancellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelAtPeriodEnd: !canceling }),
      });
      if (!response.ok) throw new Error();
      const result = cancellationResult.parse(await response.json());
      setCancellation(result.cancelAtPeriodEnd);
      setEnd(result.periodEnd);
      setMessage(result.cancelAtPeriodEnd ? "Otkazivanje je zakazano." : "Pretplata će se obnoviti.");
      refresh();
    } catch {
      setError("Izmena otkazivanja nije uspela. Pokušajte ponovo ili otvorite Paddle portal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-ui-lg font-semibold">{PLANS[displayedPlan].name}</h2>
        <p className="text-text-2">
          {canceling
            ? end ? `Aktivno do ${formatShortDate(end)}` : "Otkazivanje je zakazano."
            : trialing ? "Probni period" : "Aktivna pretplata"}
        </p>
      </div>
      <form onSubmit={submitChange} className="flex flex-col items-start gap-3">
        <label htmlFor={`${formId}-plan`} className="flex flex-col gap-1">
          Paket
          <select
            id={`${formId}-plan`}
            className="focus-ring rounded-lg border border-border bg-surface p-2"
            value={target}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "starter" || value === "pro" || value === "advanced") {
                setTarget(value);
              }
            }}
          >
            <option value="starter">{PLANS.starter.name}</option>
            <option value="pro">{PLANS.pro.name}</option>
            <option value="advanced">{PLANS.advanced.name}</option>
          </select>
        </label>
        <label htmlFor={`${formId}-interval`} className="flex flex-col gap-1">
          Period naplate
          <select
            id={`${formId}-interval`}
            aria-describedby={changeUnavailable ? `${formId}-hint` : undefined}
            className="focus-ring rounded-lg border border-border bg-surface p-2"
            value={interval}
            onChange={(event) => setInterval(event.target.value === "yearly" ? "yearly" : "monthly")}
            required
          >
            <option value="" disabled>Izaberite period</option>
            <option value="monthly" disabled={!catalog[target].monthly}>Mesečno · {catalog[target].monthly?.label ?? "Cena nije dostupna"}</option>
            <option value="yearly" disabled={!catalog[target].yearly}>Godišnje · {catalog[target].yearly?.label ?? "Cena nije dostupna"}</option>
          </select>
        </label>
        {changeUnavailable ? <p id={`${formId}-hint`} className="text-sm text-muted">{changeUnavailable}</p> : null}
        <PrimaryButton type="submit" disabled={pending || Boolean(changeUnavailable)} aria-describedby={changeUnavailable ? `${formId}-hint` : undefined}>
          Promeni paket
        </PrimaryButton>
      </form>
      <div className="flex flex-wrap items-start gap-3">
        <PrimaryButton type="button" variant="secondary" disabled={pending} onClick={toggleCancellation}>
          {canceling ? "Poništi otkazivanje" : "Otkaži na kraju perioda"}
        </PrimaryButton>
        <PortalButton />
      </div>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert" className="text-danger">{error}</p> : null}
    </div>
  );
}
