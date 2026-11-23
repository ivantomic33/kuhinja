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
  neutral: "bg-surface-2 text-text-2 border-border-strong",
  accent: "border-accent bg-accent text-text-on-accent",
  success:
    "bg-[var(--success-soft)] text-success border-[var(--success-line)]",
  danger: "bg-[var(--danger-soft)] text-danger-text border-danger/30",
  warning:
    "bg-[var(--warning-soft)] text-warning border-[var(--warning-line)]",
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
        "border px-3 text-ui-xs font-semibold",
        VARIANT[variant],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
