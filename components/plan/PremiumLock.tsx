"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type PremiumLockProps = {
  /** When true, blur children and show unlock CTA */
  locked: boolean;
  children: ReactNode;
  onUnlock: () => void;
  className?: string;
  /** Optional short label above the button */
  label?: string;
};

/**
 * Blurred preview + single unlock button for premium features.
 */
export function PremiumLock({
  locked,
  children,
  onUnlock,
  className,
  label = sr.premium.lockedFeature,
}: PremiumLockProps) {
  if (!locked) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative min-h-40 overflow-hidden rounded-[var(--radius-card)]", className)}>
      <div
        className="pointer-events-none select-none blur-[6px] opacity-60"
        aria-hidden="true"
        inert
      >
        {children}
      </div>

      <div
        className={cn(
          "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2",
          "bg-background/40 px-2 backdrop-blur-[2px]"
        )}
      >
        <p className="text-center text-sm font-medium text-text">{label}</p>
        <PrimaryButton
          type="button"
          onClick={onUnlock}
          leftIcon={<Lock className="size-5" aria-hidden="true" />}
        >
          {sr.premium.unlock}
        </PrimaryButton>
      </div>
    </div>
  );
}
