import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { termsOfUse } from "@/lib/legal/documents";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = publicPageMetadata(
  LEGAL_VERSIONS.terms.title,
  "Pročitajte uslove korišćenja TreuPlate-a, pravila za korisnički nalog i odgovornosti pri korišćenju aplikacije.",
  LEGAL_VERSIONS.terms.path,
);

export default function TermsOfUsePage() {
  return <LegalDocument doc={termsOfUse} />;
}
