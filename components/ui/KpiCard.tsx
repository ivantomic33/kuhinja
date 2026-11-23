import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type KpiCardProps = {
  label: string;
  value: ReactNode;
  suffix?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  highlight?: boolean;
  locked?: boolean;
  lockedTitle?: string;
  lockedHref?: string;
  lockedLinkLabel?: string;
  className?: string;
};

export function KpiCard({
  label,
  value,
  suffix,
  hint,
  icon,
  highlight = false,
  locked = false,
  lockedTitle,
  lockedHref = "/premium",
  lockedLinkLabel,
  className,
}: KpiCardProps) {
  return (
    <article
      className={cn(
        "flex min-h-[132px] flex-col gap-3 rounded-[14px] border border-border bg-surface p-5 shadow-[var(--shadow)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-ui-sm font-medium text-text-2">
          {label}
        </p>
        {locked ? (
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-text-2"
            aria-hidden="true"
          >
            <Lock className="size-4" />
          </span>
        ) : icon ? (
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]",
              highlight
                ? "bg-[var(--accent-soft)] text-accent"
                : "bg-surface-2 text-text-2"
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p className="flex items-baseline text-ui-kpi font-semibold leading-none tracking-tight text-text tabular-nums">
        {value}
        {suffix ? (
          <span className="ml-1 text-ui-base font-medium text-text-2">
            {suffix}
          </span>
        ) : null}
      </p>

      {locked ? (
        <div className="flex flex-1 flex-col gap-2">
          {lockedTitle ? <p className="text-ui-sm leading-snug text-text-2">{lockedTitle}</p> : null}
          {lockedLinkLabel ? (
            <Link
              href={lockedHref}
              className="text-xs font-semibold text-accent hover:text-accent-hover"
            >
              {lockedLinkLabel}
            </Link>
          ) : null}
        </div>
      ) : hint ? (
        <p className="text-ui-sm text-text-2">{hint}</p>
      ) : null}
    </article>
  );
}
