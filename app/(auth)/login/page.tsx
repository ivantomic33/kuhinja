import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { FormSkeleton } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";

export const metadata: Metadata = {
  title: sr.auth.signIn,
  description: sr.auth.loginMetaDescription,
  alternates: { canonical: "/login" },
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <AuthShell title={sr.auth.signIn} subtitle={sr.auth.loginHint}>
      <Suspense
        fallback={
          <FormSkeleton fields={2} />
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
