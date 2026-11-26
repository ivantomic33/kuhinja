import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MarketingPage from "@/app/(marketing)/page";

vi.mock("@/lib/billing/plans", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/billing/plans")>();
  return {
    ...original,
    getPricingPlans: (catalog: Parameters<typeof original.getPricingPlans>[0]) =>
      original.getPricingPlans({
        ...catalog,
        starter: { ...catalog.starter, monthly: { amount: "47.00", currency: "EUR", label: "47,00 EUR" } },
      }),
  };
});
vi.mock("@/lib/billing/catalog", () => ({
  getBillingCatalog: async () => ({
    starter: { monthly: { amount: "9.00", currency: "EUR", label: "9,00 EUR" }, yearly: null },
    pro: { monthly: { amount: "19.00", currency: "EUR", label: "19,00 EUR" }, yearly: null },
    advanced: { monthly: null, yearly: null },
  }),
}));

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://treuplate.example"));
afterEach(() => vi.unstubAllEnvs());

it("uses the same Paddle prices in the cards and structured offers", async () => {
  const html = renderToStaticMarkup(await MarketingPage());
  // Landing body no longer embeds the pricing table; prices live on /premium and in JSON-LD.
  expect(html).not.toMatch(/id="cenovnik"/);
  expect(html).not.toContain(">9,00 EUR<");
  const [software, organization] = Array.from(
    html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g),
    (match) => JSON.parse(match[1]),
  );
  expect(software).toMatchObject({
    "@context": "https://schema.org", "@type": "SoftwareApplication",
    name: "TreuPlate", applicationCategory: "BusinessApplication", operatingSystem: "Web",
    url: "https://treuplate.example/",
  });
  expect(software).not.toHaveProperty("aggregateRating");
  expect(software).not.toHaveProperty("review");
  expect(organization).toMatchObject({
    "@context": "https://schema.org", "@type": "Organization",
    name: "TreuPlate", url: "https://treuplate.example/",
    logo: expect.stringMatching(/^https:\/\/treuplate\.example\/icons\//),
  });
  expect(software.offers).toMatchObject([
    { name: "Free", price: "0" },
    { name: "Starter", price: "47.00", priceCurrency: "EUR" },
    { name: "Pro", price: "19.00", priceCurrency: "EUR" },
  ]);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html.match(/<main\b/g)).toHaveLength(1);
  // Landing uses a CSS food-cost example card instead of marketing screenshots.
  expect(html.match(/<img\b[^>]*>/g) ?? []).toHaveLength(0);
  expect(html).toContain('href="/premium"');
  expect(html).toContain('href="/kako-poceti"');
});
