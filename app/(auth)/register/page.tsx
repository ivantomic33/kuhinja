import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { sr } from "@/lib/i18n/sr";

export const metadata: Metadata = {
  title: sr.auth.signUp,
  description: sr.auth.registerMetaDescription,
  alternates: { canonical: "/register" },
  robots: { index: true, follow: true },
};

export default function RegisterPage() {
  return (
    <AuthShell title={sr.auth.signUp} subtitle={sr.auth.registerHint}>
      <RegisterForm />
    </AuthShell>
  );
}
