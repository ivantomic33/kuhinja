import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { sr } from "@/lib/i18n/sr";

export const metadata: Metadata = {
  title: sr.auth.forgotPassword,
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title={sr.auth.forgotPassword}
      subtitle={sr.auth.resetHint}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
