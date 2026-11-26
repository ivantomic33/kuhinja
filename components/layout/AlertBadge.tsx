"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type AlertBadgeProps = {
  count: number;
  className?: string;
  /** Compact icon-only for rail mode. */
  compact?: boolean;
};

/** Unread alerts count from a single server count query (not client-side length). */
export function AlertBadge({ count, className, compact = false }: AlertBadgeProps) {
  if (!count || count < 1) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-danger text-ui-xs font-bold text-accent-ink",
        compact ? "min-h-5 min-w-5 justify-center px-1" : "h-5 px-1.5",
        className,
      )}
      title={`${label} nepročitanih upozorenja`}
      aria-label={`${label} nepročitanih upozorenja`}
    >
      {!compact ? <Bell className="size-3" aria-hidden="true" /> : null}
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
