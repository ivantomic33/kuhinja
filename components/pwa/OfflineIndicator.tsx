"use client";

import { CloudOff } from "lucide-react";
import { useOnline } from "@/lib/hooks/useOnline";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type OfflineIndicatorProps = {
  className?: string;
};

/** Compact top-bar badge shown only while offline. */
export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const online = useOnline(true);

  if (online) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)]",
        "border border-border bg-surface-2 px-2 text-xs font-medium text-muted",
        className
      )}
    >
      <CloudOff className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{sr.pwa.offline}</span>
    </span>
  );
}
