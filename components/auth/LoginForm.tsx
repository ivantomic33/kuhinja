"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { AuthError } from "@/components/auth/AuthError";
import { AuthField } from "@/components/auth/AuthField";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { loginAction } from "@/lib/auth/actions";
import { loginSchema } from "@/lib/schemas/auth";
import { sr } from "@/lib/i18n/sr";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setFormError(undefined);

    const parsed = loginSchema.safeParse({ email, password });
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
      const result = await loginAction(parsed.data);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.message ?? sr.auth.errors.generic);
        setLoading(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setFormError(sr.auth.errors.generic);
      setLoading(false);
    }
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
        <AuthField
          label={sr.auth.password}
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-muted underline-offset-2 hover:text-text hover:underline"
          >
            {sr.auth.forgotPasswordLink}
          </Link>
        </div>

        <AuthError message={formError} />

        <PrimaryButton type="submit" fullWidth loading={loading}>
          {formError ? sr.common.retry : sr.auth.signIn}
        </PrimaryButton>
      </form>

      <AuthDivider />
      <GoogleButton nextPath={nextPath} />

      <EmptyState className="!gap-1 !p-0" title={sr.auth.noAccount} action={
        <Link
          href="/register"
          className="font-medium text-text underline-offset-2 hover:underline"
        >
          {sr.auth.signUp}
        </Link>
      } />
    </div>
  );
}
