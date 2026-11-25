"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthError } from "@/components/auth/AuthError";
import { LegalConsentFields } from "@/components/auth/LegalConsentFields";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";
import { recordLegalConsent } from "@/lib/legal/actions";

export function LegalConsentForm({ next }: { next: string }) {
  const router = useRouter();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptTerms || loading) return;
    setError(undefined);
    setLoading(true);
    try {
      const result = await recordLegalConsent({ acceptTerms, marketingOptIn });
      if ("error" in result) {
        setError(result.error.message);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError(sr.auth.errors.legalConsentFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <LegalConsentFields
        acceptTerms={acceptTerms}
        marketingOptIn={marketingOptIn}
        onAcceptTerms={setAcceptTerms}
        onMarketingOptIn={setMarketingOptIn}
      />
      <AuthError message={error} />
      <PrimaryButton type="submit" fullWidth loading={loading}>
        {sr.auth.legalConsentContinue}
      </PrimaryButton>
    </form>
  );
}
