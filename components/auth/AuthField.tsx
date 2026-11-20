"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function AuthField({
  label,
  error,
  id,
  className,
  ...rest
}: AuthFieldProps) {
  const fieldId = id ?? rest.name;
  const errorId = error && fieldId ? `${fieldId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={fieldId}
        className="text-sm font-medium text-text"
      >
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          "min-h-[52px] w-full rounded-[var(--radius-input)] border bg-surface-2 px-3",
          "text-base text-text outline-none transition-opacity",
          "placeholder:text-muted",
          "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          error ? "border-danger" : "border-border",
          className
        )}
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
