import type { Metadata } from "next";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { LegalPageHeader } from "@/components/legal/LegalPageHeader";
import { PublicLegalLayout } from "@/components/legal/PublicLegalLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQ_ITEMS } from "@/content/faq";
import { sr } from "@/lib/i18n/sr";
import { FAQ_VERSION } from "@/lib/legal/versions";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = publicPageMetadata(
  FAQ_VERSION.title, sr.legal.faqMetaDescription, FAQ_VERSION.path,
);

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default function FaqPage() {
  return (
    <PublicLegalLayout>
      <JsonLd data={faqSchema} />
      <section aria-labelledby="faq-title" className="mx-auto w-full max-w-3xl">
        <LegalPageHeader page={FAQ_VERSION} headingId="faq-title" />
        <FaqAccordion items={FAQ_ITEMS} searchable title={null} />
      </section>
    </PublicLegalLayout>
  );
}
