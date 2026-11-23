import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { sr } from "@/lib/i18n/sr";

export const metadata: Metadata = {
  title: sr.auth.resetPassword,
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title={sr.auth.resetPassword}
      subtitle={sr.auth.resetPasswordHint}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
