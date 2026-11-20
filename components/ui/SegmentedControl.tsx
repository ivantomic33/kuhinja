"use client";

import { cn } from "@/lib/utils/cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[] | SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("seg", size === "lg" && "big", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key
                )
              )
                return;
              event.preventDefault();
              const enabled = options.filter((item) => !item.disabled);
              const index = enabled.findIndex(
                (item) => item.value === option.value
              );
              const direction =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? 1
                  : -1;
              const next =
                enabled[(index + direction + enabled.length) % enabled.length];
              if (next) onChange(next.value);
            }}
            className={cn(
              "inline-flex items-center justify-center gap-1.5",
              selected && "on",
              option.disabled && "cursor-not-allowed"
            )}
          >
            {option.icon}
            {option.label}
            {option.badge ? (
              <span className="rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[11.5px] font-semibold leading-none text-success">
                {option.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
