import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "danger"
  | "warning";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const VARIANT: Record<BadgeVariant, string> = {
  neutral: "bg-surface-2 text-[var(--text-2)] border-border-strong",
  accent: "border-accent bg-accent text-text-on-accent",
  success:
    "bg-[var(--success-soft)] text-success border-[rgba(34,197,94,.3)]",
  danger: "bg-[var(--danger-soft)] text-danger-text border-danger/30",
  warning:
    "bg-[var(--warning-soft)] text-warning border-[rgba(245,158,11,.3)]",
};

export function Badge({
  variant = "neutral",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "focus-ring inline-flex h-6 items-center gap-1 rounded-full",
        "border px-2.5 text-[length:var(--fs-xs)] font-semibold",
        VARIANT[variant],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
