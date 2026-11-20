"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type ChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onSelect"
> & {
  /** Selected / active state */
  selected?: boolean;
  /** Makes the chip toggleable via click */
  selectable?: boolean;
  /** Called when selection should change (selectable only) */
  onSelectedChange?: (selected: boolean) => void;
  /** Optional leading icon */
  icon?: ReactNode;
};

export function Chip({
  selected = false,
  selectable = false,
  onSelectedChange,
  icon,
  className,
  children,
  type = "button",
  disabled,
  onClick,
  ...rest
}: ChipProps) {
  const handleClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"] = (
    event
  ) => {
    if (selectable && !disabled) {
      onSelectedChange?.(!selected);
    }
    onClick?.(event);
  };

  return (
    <button
      type={type}
      disabled={disabled}
      aria-pressed={selectable ? selected : undefined}
      aria-label={
        selectable && selected
          ? `${String(children)} — ${sr.ui.chip.selected}`
          : undefined
      }
      onClick={handleClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-pill)] px-3",
        "border text-sm font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:border-dashed",
        selected
          ? "border-accent bg-[var(--accent-muted)] text-accent"
          : "border-border bg-surface-2 text-muted hover:text-text",
        className
      )}
      {...rest}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
