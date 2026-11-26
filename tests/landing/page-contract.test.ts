import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MarketingPage from "@/app/(marketing)/page";

vi.mock("@/lib/billing/catalog", () => ({
  getBillingCatalog: async () => ({
    starter: { monthly: { amount: "9.00", currency: "EUR", label: "9,00 EUR" }, yearly: null },
    pro: { monthly: { amount: "19.00", currency: "EUR", label: "19,00 EUR" }, yearly: null },
    advanced: { monthly: null, yearly: null },
  }),
}));

vi.mock("@/components/marketing/MobileCta", () => ({
  MobileCta: () => null,
}));

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://treuplate.example"));
afterEach(() => vi.unstubAllEnvs());

it("renders exactly one h1 on the landing page", async () => {
  const html = renderToStaticMarkup(await MarketingPage());
  expect(html.match(/<h1\b/g)).toHaveLength(1);
});

it("renders the hero and landing sections without entrance animation hooks", async () => {
  const html = renderToStaticMarkup(await MarketingPage());
  expect(html).not.toMatch(/landing-hero-el|landing-delay|landing-reveal/);
});

it("includes at least one link to /login", async () => {
  const html = renderToStaticMarkup(await MarketingPage());
  expect(html).toMatch(/href="\/login"/);
});

it("shows at least four FAQ details items", async () => {
  const html = renderToStaticMarkup(await MarketingPage());
  const detailsCount = (html.match(/<details\b/g) ?? []).length;
  expect(detailsCount).toBeGreaterThanOrEqual(4);
});
