import { JsonLd } from "@/components/seo/JsonLd";
import type { PricingPlan } from "@/lib/billing/plans";
import icons from "@/lib/config/pwa-icons.json";
import { DEFAULT_DESCRIPTION, getSiteUrl, SITE_NAME } from "@/lib/seo/site";

export function MarketingJsonLd({ plans }: { plans: readonly PricingPlan[] }) {
  const siteUrl = new URL("/", getSiteUrl()).href;
  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: siteUrl,
    description: DEFAULT_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "sr",
    offers: plans.flatMap(({ name, prices }) => {
      const price = prices.monthly;
      return price ? [{
        "@type": "Offer", name, price: price.amount, priceCurrency: price.currency,
      }] : [];
    }),
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
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
