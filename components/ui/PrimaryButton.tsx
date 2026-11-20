"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

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
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap",
        "rounded-[10px] font-semibold transition-[background,border-color,color] duration-150 outline-none",
        "[&_svg]:size-5",
        size === "sm" &&
          "min-h-9 px-3 text-[length:var(--fs-sm)] [&_svg]:size-4",
        size === "md" &&
          "min-h-11 px-[18px] text-[length:var(--fs-base)]",
        size === "lg" &&
          "min-h-[52px] px-5 text-[length:var(--fs-md)]",
        fullWidth && "w-full",
        variant === "primary" &&
          "bg-accent text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-pressed)]",
        variant === "secondary" &&
          "border border-border-strong bg-surface-2 text-text hover:bg-surface-3",
        variant === "ghost" &&
          "bg-transparent text-[var(--text-2)] hover:bg-surface-2 hover:text-text",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        isDisabled &&
          !loading &&
          "cursor-not-allowed border border-border bg-surface-2 text-[var(--text-3)] hover:bg-surface-2 hover:text-[var(--text-3)] active:bg-surface-2",
        loading && "cursor-not-allowed opacity-80",
        className
      )}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden="true" />
          <span>{sr.ui.primaryButton.loading}</span>
          <span className="sr-only">{sr.common.loading}</span>
        </>
      ) : (
        <>
          {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
          <span>{children}</span>
          {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
        </>
      )}
    </button>
  );
}
