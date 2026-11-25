import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PremiumPage from "@/components/billing/PremiumPage";
import type { Tier } from "@/lib/billing/tiers";

vi.mock("@/lib/hooks/usePlan", () => ({
  usePlan: () => ({
    plan: "free",
    isFree: true,
    isLoading: false,
    isPremium: false,
    email: null,
    paddleCustomerId: null,
  }),
}));

vi.mock("@/components/billing/PricingTiers", () => ({
  PricingTiers: ({
    tiers,
    country,
    guest,
  }: {
    tiers: Tier[];
    country?: string;
    guest?: boolean;
  }) =>
    createElement(
      "div",
      { "data-testid": "pricing-tiers" },
      createElement("span", null, `tiers:${tiers.map((t) => t.name).join(",")}`),
      createElement("span", null, `country:${country ?? "auto"}`),
      createElement("span", null, `guest:${guest ? "yes" : "no"}`),
      tiers.map((tier) =>
        createElement(
          "article",
          { key: tier.name, id: `plan-${tier.name.toLowerCase()}` },
          createElement("h3", null, tier.name),
          createElement("p", null, tier.description),
          createElement("button", { type: "button" }, `Pretplati se · ${tier.name}`),
        ),
      ),
    ),
}));

const sampleTiers: Tier[] = [
  {
    name: "Starter",
    description: "Starter plan",
    features: ["Feature A"],
    priceId: {
      month: "pri_01stamonth0000000000000001",
      year: "pri_01stayear00000000000000001",
    },
  },
  {
    name: "Pro",
    description: "Pro plan",
    featured: true,
    features: ["Feature B"],
    priceId: {
      month: "pri_01promonth0000000000000001",
      year: "pri_01proyear00000000000000001",
    },
  },
  {
    name: "Advanced",
    description: "Advanced plan",
    features: ["Feature C"],
    priceId: {
      month: "pri_01advmonth0000000000000001",
      year: "pri_01advyear00000000000000001",
    },
  },
];

describe("PremiumPage", () => {
  it("renders three editable tiers and passes visitor country through", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPage, {
        tiers: sampleTiers,
        country: "RS",
      }),
    );

    expect(html).toContain("tiers:Starter,Pro,Advanced");
    expect(html).toContain("country:RS");
    expect(html).toContain("guest:no");
    expect(html).toContain("Pretplati se · Starter");
    expect(html).toContain("Pretplati se · Pro");
    expect(html).toContain("Pretplati se · Advanced");
    expect(html).toContain("Paddle vas vraća na /welcome");
  });

  it("renders guest pricing without inventing a country code", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPage, {
        guest: true,
        tiers: sampleTiers,
      }),
    );

    expect(html).toContain("guest:yes");
    expect(html).toContain("country:auto");
    expect(html).not.toContain("Trenutni plan");
  });

  it("surfaces configuration errors when tiers are missing", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPage, {
        tiers: null,
        tiersError: "Missing PADDLE_PRICE_STARTER_MONTHLY_ID",
      }),
    );

    expect(html).toContain("Missing PADDLE_PRICE_STARTER_MONTHLY_ID");
    expect(html).not.toContain('data-testid="pricing-tiers"');
  });
});
