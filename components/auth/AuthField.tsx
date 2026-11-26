"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { AuthError } from "./AuthError";

export type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function AuthField({
  label,
  error,
  id,
  className,
  type,
  "aria-describedby": description,
  "aria-invalid": invalid,
  ...rest
}: AuthFieldProps) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const errorId = `${fieldId}-error`;
  const describedBy = [description, error && errorId].filter(Boolean).join(" ");
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={fieldId}
        className="text-sm font-medium text-text"
      >
        {label}
      </label>
      <div className="relative">
        <input
          {...rest}
          id={fieldId}
          type={password && visible ? "text" : type}
          autoCapitalize={password ? "none" : rest.autoCapitalize}
          spellCheck={password ? false : rest.spellCheck}
          aria-invalid={error ? true : invalid}
          aria-describedby={describedBy || undefined}
          className={cn(
            "focus-ring min-h-13 w-full rounded-[var(--radius-input)] border bg-surface-2 px-3 text-base text-text placeholder:text-muted",
            error || invalid ? "border-danger" : "border-border",
            password && "pr-14",
            className
          )}
        />
        {password ? (
          <button
            type="button"
            aria-label={`${visible ? sr.auth.hidePassword : sr.auth.showPassword} (${label})`}
            aria-controls={fieldId}
            onClick={() => setVisible(value => !value)}
            className="focus-ring absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-text-2 hover:bg-surface-3"
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <AuthError id={errorId} message={error} />
    </div>
  );
}
