import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { sr } from "@/lib/i18n/sr";

export const metadata: Metadata = {
  title: sr.auth.signIn,
  description: sr.auth.loginMetaDescription,
  alternates: { canonical: "/login" },
  robots: { index: true, follow: true },
};

export default function LoginPage() {
  return (
    <AuthShell title={sr.auth.signIn} subtitle={sr.auth.loginHint}>
      <Suspense
        fallback={
          <p className="text-sm text-muted">{sr.common.loading}</p>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
