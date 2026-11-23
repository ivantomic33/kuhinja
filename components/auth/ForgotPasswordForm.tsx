"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthError } from "@/components/auth/AuthError";
import { AuthField } from "@/components/auth/AuthField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { sr } from "@/lib/i18n/sr";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setFormError(undefined);
    setSuccessMessage(undefined);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key]) {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const result = await forgotPasswordAction(parsed.data);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.message ?? sr.auth.errors.generic);
        return;
      }

      setSuccessMessage(result.message ?? sr.auth.resetEmailSent);
      setLoading(false);
    } catch {
      setFormError(sr.auth.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  if (successMessage) {
    return (
      <div className="flex flex-col gap-2">
        <div
          role="status"
          className="rounded-[var(--radius-input)] border border-border bg-surface-2 p-2"
        >
          <p className="text-base font-semibold text-text">
            {sr.auth.checkEmailTitle}
          </p>
          <p className="mt-1 text-sm text-muted">{successMessage}</p>
        </div>
        <Link
          href="/login"
          className="text-center text-sm font-medium text-text underline-offset-2 hover:underline"
        >
          {sr.auth.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
        <AuthField
          label={sr.auth.email}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          required
        />

        <AuthError message={formError} />

        <PrimaryButton type="submit" fullWidth loading={loading}>
          {sr.auth.sendResetLink}
        </PrimaryButton>
      </form>

      <Link
        href="/login"
        className="text-center text-sm font-medium text-muted underline-offset-2 hover:text-text hover:underline"
      >
        {sr.auth.backToLogin}
      </Link>
    </div>
  );
}
