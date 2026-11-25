import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { privacyPolicy } from "@/lib/legal/documents";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = publicPageMetadata(
  LEGAL_VERSIONS.privacy.title,
  "Saznajte koje podatke TreuPlate obrađuje, u koje svrhe i kako možete ostvariti svoja prava u vezi sa privatnošću.",
  LEGAL_VERSIONS.privacy.path,
);

export default function PrivacyPolicyPage() {
  return <LegalDocument doc={privacyPolicy} />;
}
