import { JsonLd } from "@/components/seo/JsonLd";
import type { PricingPlan } from "@/lib/billing/plans";
import icons from "@/lib/config/pwa-icons.json";
import { sr } from "@/lib/i18n/sr";
import { getSiteUrl } from "@/lib/seo/site";

export function MarketingJsonLd({ plans }: { plans: readonly PricingPlan[] }) {
  const siteUrl = new URL("/", getSiteUrl()).href;
  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: sr.app.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: sr.marketing.jsonLdDescription,
    offers: plans.flatMap(({ name, prices }) => {
      const price = prices.monthly;
      return price ? [{
        "@type": "Offer", name, price: price.amount, priceCurrency: price.currency,
      }] : [];
    }),
    url: siteUrl,
    inLanguage: "sr",
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: sr.app.name,
    url: siteUrl,
    logo: new URL(icons.png512, siteUrl).href,
  };

  return (
    <>
      <JsonLd data={software} />
      <JsonLd data={organization} />
    </>
  );
}
