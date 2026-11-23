import { sr } from "@/lib/i18n/sr";
import { PLAN_PRICES } from "@/lib/plan/entitlements";

type MarketingJsonLdProps = {
  siteUrl: string;
};

const FAQ = [
  [sr.marketing.faq1Q, sr.marketing.faq1A],
  [sr.marketing.faq2Q, sr.marketing.faq2A],
  [sr.marketing.faq3Q, sr.marketing.faq3A],
  [sr.marketing.faq4Q, sr.marketing.faq4A],
  [sr.marketing.faq5Q, sr.marketing.faq5A],
] as const;

export function MarketingJsonLd({ siteUrl }: MarketingJsonLdProps) {
  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: sr.app.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description: sr.marketing.jsonLdDescription,
    offers: Object.values(sr.marketing.pricingPlans).map(({ id, name }) => ({
      "@type": "Offer",
      price: String(PLAN_PRICES[id].monthly),
      priceCurrency: "RSD",
      name,
      ...(id === "free" ? {} : { billingDuration: "P1M" }),
    })),
    url: siteUrl,
    inLanguage: "sr-Latn",
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: sr.app.name,
    description: sr.app.description,
    url: siteUrl,
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(software) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
    </>
  );
}
