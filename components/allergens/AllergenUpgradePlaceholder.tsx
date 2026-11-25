"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

/**
 * Free / locked allergens UI — intentionally renders NO allergen data in the DOM
 * (unlike PremiumLock blur, which still mounts children).
 */
export function AllergenUpgradePlaceholder({
  className,
  title = sr.allergens.lockedTitle,
  message = sr.allergens.lockedBody,
}: {
  className?: string;
  title?: string;
  message?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface-2 px-4 py-8 text-center",
        className,
      )}
    >
      <Lock className="size-6 text-text-2" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="max-w-md text-ui-sm text-text-2">{message}</p>
      </div>
      <PrimaryButton asChild={false}>
        <Link
          href="/premium"
          className="inline-flex items-center justify-center gap-2"
        >
          {sr.allergens.viewPlans}
        </Link>
      </PrimaryButton>
    </div>
  );
}
