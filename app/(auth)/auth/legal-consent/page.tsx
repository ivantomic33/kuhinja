import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LegalConsentForm } from "@/components/auth/LegalConsentForm";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireUser } from "@/lib/auth/require-user";
import { checkoutReturnPath } from "@/lib/billing/checkout-intent";
import { sr } from "@/lib/i18n/sr";
import { hasRequiredConsents } from "@/lib/legal/consent";
import { createClient } from "@/lib/supabase/server";
import { AppQueryProvider } from "@/lib/query/provider";

export const metadata: Metadata = {
  title: sr.auth.legalConsentTitle,
  robots: { index: false, follow: false },
};

export default async function LegalConsentPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = checkoutReturnPath((await searchParams).next) ?? "/dashboard";
  const user = await requireUser();
  if (user.app_metadata?.provider !== "google" || (await hasRequiredConsents(await createClient(), user.id))) {
    redirect(next);
  }

  return (
    <AuthShell title={sr.auth.legalConsentTitle}>
      <LegalConsentForm next={next} />
      <AppQueryProvider><SignOutButton /></AppQueryProvider>
    </AuthShell>
  );
}
