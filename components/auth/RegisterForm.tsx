"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { AuthError } from "@/components/auth/AuthError";
import { AuthField } from "@/components/auth/AuthField";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { registerAction } from "@/lib/auth/actions";
import { registerSchema } from "@/lib/schemas/auth";
import { sr } from "@/lib/i18n/sr";

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setFormError(undefined);
    setSuccessMessage(undefined);

    const parsed = registerSchema.safeParse({
      fullName,
      venueName,
      email,
      password,
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
      const result = await registerAction(parsed.data);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.message ?? sr.auth.errors.generic);
        return;
      }

      setSuccessMessage(result.message ?? sr.auth.registerSuccess);
      setPassword("");
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
          label={sr.auth.fullName}
          name="fullName"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={fieldErrors.fullName}
          required
        />
        <AuthField
          label={sr.auth.venueName}
          name="venueName"
          type="text"
          autoComplete="organization"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          error={fieldErrors.venueName}
          required
        />
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

        <AuthError message={formError} />

        <PrimaryButton type="submit" fullWidth loading={loading}>
          {formError ? sr.common.retry : sr.auth.signUp}
        </PrimaryButton>
      </form>

      <AuthDivider />
      <GoogleButton nextPath="/dashboard" />

      <EmptyState className="!gap-1 !p-0" title={sr.auth.hasAccount} action={
        <Link
          href="/login"
          className="font-medium text-text underline-offset-2 hover:underline"
        >
          {sr.auth.signIn}
        </Link>
      } />
    </div>
  );
}
