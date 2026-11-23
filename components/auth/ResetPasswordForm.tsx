"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthError } from "@/components/auth/AuthError";
import { AuthField } from "@/components/auth/AuthField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { resetPasswordAction } from "@/lib/auth/actions";
import { resetPasswordSchema } from "@/lib/schemas/auth";
import { sr } from "@/lib/i18n/sr";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setFormError(undefined);
    setSuccessMessage(undefined);

    const parsed = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    });

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
      const result = await resetPasswordAction(parsed.data);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.message ?? sr.auth.errors.generic);
        return;
      }

      setSuccessMessage(result.message ?? sr.auth.passwordUpdated);

      window.setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 1200);
    } catch {
      setFormError(sr.auth.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  if (successMessage) {
    return (
      <div
        role="status"
        className="rounded-[var(--radius-input)] border border-border bg-surface-2 p-2"
      >
        <p className="text-base font-semibold text-success">{successMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
        <AuthField
          label={sr.auth.password}
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />
        <AuthField
          label={sr.auth.confirmPassword}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          required
        />

        <AuthError message={formError} />

        <PrimaryButton type="submit" fullWidth loading={loading}>
          {sr.auth.updatePassword}
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
