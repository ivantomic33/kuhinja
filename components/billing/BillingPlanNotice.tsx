"use client";

import Link from "next/link";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";

export function BillingPlanNotice() {
  const { isFree, isLoading } = usePlan();
  if (isFree || isLoading) return null;

  return (
    <p className="mx-auto text-center text-ui-sm text-text-2">
      Već imate plaćeni plan.{" "}
      <Link href="/premium/upravljanje" className="font-semibold text-accent underline">
        {sr.settings.manageBilling}
      </Link>
    </p>
  );
}
