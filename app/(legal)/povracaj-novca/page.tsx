import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { getRefundPolicy } from "@/lib/legal/documents";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = publicPageMetadata(
  LEGAL_VERSIONS.refund.title,
  "Pročitajte politiku povraćaja za TreuPlate pretplate i saznajte kako da zatražite pomoć oko naplate.",
  LEGAL_VERSIONS.refund.path,
);

export default function RefundPolicyPage() {
  return <LegalDocument doc={getRefundPolicy()} />;
}
