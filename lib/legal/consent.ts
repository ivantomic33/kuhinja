import type { User } from "@supabase/supabase-js";
import { LEGAL_VERSIONS, REQUIRED_CONSENT_DOCUMENTS } from "@/lib/legal/versions";
import { pendingLegalConsentSchema, type PendingLegalConsent } from "@/lib/schemas/legal";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export function currentConsent(marketingOptIn: boolean): PendingLegalConsent {
  return {
    terms: LEGAL_VERSIONS.terms.version,
    privacy: LEGAL_VERSIONS.privacy.version,
    acceptedAt: new Date().toISOString(),
    ...(marketingOptIn ? { marketing: LEGAL_VERSIONS.marketing.version } : {}),
  };
}

export async function insertLegalConsent(supabase: Supabase, userId: string, consent: PendingLegalConsent) {
  const documents = consent.marketing
    ? [...REQUIRED_CONSENT_DOCUMENTS, "marketing" as const]
    : REQUIRED_CONSENT_DOCUMENTS;
  const rows = documents.map((document) => ({
    user_id: userId,
    document,
    version: consent[document]!,
    accepted_at: consent.acceptedAt,
  }));
  const { error } = await supabase.from("legal_consents").upsert(rows, {
    onConflict: "user_id,document,version",
    ignoreDuplicates: true,
  });
  return error;
}

export async function persistPendingLegalConsent(supabase: Supabase, user: User) {
  const pending: unknown = user.user_metadata.legal_consent;
  if (pending == null) return true;

  const parsed = pendingLegalConsentSchema.safeParse(pending);
  if (!parsed.success) return false;

  const error = await insertLegalConsent(supabase, user.id, parsed.data);
  if (error) {
    console.error("Could not store registration consent", error.code);
    return false;
  }

  // A failed metadata cleanup can be retried without changing the stored rows.
  await supabase.auth.updateUser({ data: { legal_consent: null } });
  return true;
}

export async function hasRequiredConsents(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from("legal_consents")
    .select("document")
    .eq("user_id", userId)
    .in("document", [...REQUIRED_CONSENT_DOCUMENTS]);
  if (error) throw new Error("Could not check required legal consents.");
  return REQUIRED_CONSENT_DOCUMENTS.every((document) => data.some((row) => row.document === document));
}
