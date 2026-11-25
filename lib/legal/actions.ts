"use server";

import { registerLegalConsentSchema, type RegisterLegalConsentInput } from "@/lib/schemas/legal";
import { actionData, actionError, parseActionInput, requireActionUser } from "@/lib/server/action";
import { currentConsent, hasRequiredConsents, insertLegalConsent } from "@/lib/legal/consent";
import { sr } from "@/lib/i18n/sr";

export async function recordLegalConsent(input: RegisterLegalConsentInput) {
  const parsed = parseActionInput(registerLegalConsentSchema, input);
  if ("error" in parsed) return parsed;

  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  if (auth.user.app_metadata.provider !== "google") {
    return actionError("FORBIDDEN", sr.auth.errors.generic);
  }
  if (await hasRequiredConsents(auth.supabase, auth.user.id)) return actionData(null);

  const error = await insertLegalConsent(
    auth.supabase,
    auth.user.id,
    currentConsent(parsed.data.marketingOptIn),
  );
  return error
    ? actionError("INTERNAL_ERROR", sr.auth.errors.legalConsentFailed)
    : actionData(null);
}
