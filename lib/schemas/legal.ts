import { z } from "zod";
import { sr } from "@/lib/i18n/sr";

const version = z.string().trim().min(1).max(64);
export const pendingLegalConsentSchema = z.object({
  terms: version,
  privacy: version,
  marketing: version.optional(),
  acceptedAt: z.string().datetime(),
}).strict();

export const registerLegalConsentSchema = z
  .object({
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: sr.auth.errors.acceptTermsRequired }),
    }),
    marketingOptIn: z.boolean().optional().default(false),
  })
  .strict();

export type PendingLegalConsent = z.infer<typeof pendingLegalConsentSchema>;
export type RegisterLegalConsentInput = z.infer<typeof registerLegalConsentSchema>;
