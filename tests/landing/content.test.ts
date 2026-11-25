import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PricingTable, annualSavings } from "@/components/marketing/PricingTable";
import { SocialProof } from "@/components/marketing/SocialProof";

const monthly = { label: "25,00 EUR", amount: "25.00", currency: "EUR" };
const yearly = { label: "240,00 EUR", amount: "240.00", currency: "EUR" };

it("shows a positive annual saving and omits a loss, zero or a different currency", () => {
  expect(annualSavings(monthly, yearly)).toBe(20);
  expect(annualSavings(monthly, { ...yearly, amount: "301.00" })).toBeNull();
  expect(annualSavings(monthly, { ...yearly, amount: "300.00" })).toBeNull();
  expect(annualSavings(monthly, { ...yearly, currency: "RSD" })).toBeNull();
});

it("renders a plan price and checkout destination without a popularity claim", () => {
  const html = renderToStaticMarkup(createElement(PricingTable, {
    plans: [{
      key: "starter",
      name: "Starter",
      features: ["Raspored smena"],
      prices: { monthly, yearly },
      checkoutAvailable: { monthly: true, yearly: true },
    }],
  }));
  expect(html).toContain("25,00 EUR");
  expect(html).toContain("/checkout?plan_key=starter&amp;interval=monthly");
  expect(html).not.toContain("Najpopularnije");
});

it("omits unapproved testimonials and hides the empty section", () => {
  const testimonial = { quote: "Primer svedočenja", attribution: "Test" };
  expect(renderToStaticMarkup(createElement(SocialProof, { testimonials: [testimonial] }))).toBe("");
  expect(renderToStaticMarkup(createElement(SocialProof, {
    testimonials: [{ ...testimonial, approvedAt: "2026-11-24" }],
  }))).toContain(testimonial.quote);
});
