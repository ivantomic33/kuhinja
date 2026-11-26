import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { checkoutReturnPath } from "@/lib/billing/checkout-intent";
import { sr } from "@/lib/i18n/sr";

export const metadata: Metadata = {
  title: sr.auth.signUp,
  description: sr.auth.registerMetaDescription,
  alternates: { canonical: "/register" },
  robots: { index: false, follow: false },
};

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = checkoutReturnPath((await searchParams).next);
  return (
    <AuthShell title={sr.auth.signUp} subtitle={sr.auth.registerHint}>
      <RegisterForm checkout={next} />
    </AuthShell>
  );
}
