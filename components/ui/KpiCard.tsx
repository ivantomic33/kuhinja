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
  trend?: {
    direction: "up" | "down" | "flat";
    label: string;
  };
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
  trend,
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
        <p className="text-[length:var(--fs-sm)] font-medium text-[var(--text-2)]">
          {label}
        </p>
        {locked ? (
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-[var(--text-2)]"
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
                : "bg-surface-2 text-[var(--text-2)]"
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
      </div>

      {locked ? (
        <div className="flex flex-1 flex-col justify-between gap-2">
          <p className="text-sm font-medium leading-snug text-text">
            {lockedTitle ?? value}
          </p>
          {lockedLinkLabel ? (
            <Link
              href={lockedHref}
              className="text-xs font-semibold text-accent hover:text-[var(--accent-hover)]"
            >
              {lockedLinkLabel}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <p className="flex items-baseline text-[length:var(--fs-kpi)] font-semibold leading-none tracking-[-0.02em] text-text tabular-nums">
            {value}
            {suffix ? (
              <span className="ml-1 text-[length:var(--fs-base)] font-medium text-[var(--text-2)]">
                {suffix}
              </span>
            ) : null}
          </p>
          {trend ? (
            <p
              className={cn(
                "text-[13px] font-medium",
                trend.direction === "up" && "text-success",
                trend.direction === "down" && "text-success",
                trend.direction === "flat" && "text-[var(--text-2)]"
              )}
            >
              {trend.direction !== "flat" ? (
                <span className="font-bold">{trend.label.split(" ")[0]}</span>
              ) : null}{" "}
              <span className="text-[var(--text-2)]">
                {trend.direction === "flat"
                  ? trend.label
                  : trend.label.split(" ").slice(1).join(" ")}
              </span>
            </p>
          ) : hint ? (
            <p className="text-[13px] text-[var(--text-2)]">{hint}</p>
          ) : null}
        </>
      )}
    </article>
  );
}
