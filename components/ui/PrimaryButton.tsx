"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

const VARIANT = {
  primary: "bg-accent text-text-on-accent enabled:hover:bg-accent-hover enabled:active:bg-accent-pressed",
  secondary: "border border-border-strong bg-surface-2 text-text enabled:hover:bg-surface-3",
  ghost: "bg-transparent text-text-2 enabled:hover:bg-surface-2 enabled:hover:text-text",
  danger: "bg-danger text-accent-ink enabled:hover:bg-[color-mix(in_srgb,var(--danger)_90%,white)]",
} as const;

export function PrimaryButton({
  loading = false,
  leftIcon,
  rightIcon,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || rest["aria-busy"]}
      aria-disabled={isDisabled || rest["aria-disabled"]}
      className={cn(
        "focus-ring relative inline-flex items-center justify-center whitespace-nowrap",
        "rounded-[10px] font-semibold transition-[background,border-color,color] duration-150 outline-none",
        "[&_svg]:size-5",
        size === "sm" &&
          "min-h-9 px-3 text-ui-sm [&_svg]:size-4",
        size === "md" &&
          "min-h-11 px-5 text-ui-base",
        size === "lg" &&
          "min-h-[52px] px-5 text-ui-md",
        fullWidth && "w-full",
        isDisabled && !loading
          ? "border border-border bg-surface-2 text-text-2"
          : VARIANT[variant],
        isDisabled && "cursor-not-allowed",
        className
      )}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading ? (
          <Loader2 className="shrink-0 motion-safe:animate-spin" aria-hidden="true" />
        ) : leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        <span>{loading ? "Sačekajte…" : children}</span>
        {!loading && rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
      </span>
    </button>
  );
}
