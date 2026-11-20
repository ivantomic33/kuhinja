import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import MarketingPage from "@/app/(marketing)/page";
import { PLAN_PRICES } from "@/lib/plan/entitlements";

it("shows available plans and keeps structured offers in sync", () => {
  const html = renderToStaticMarkup(createElement(MarketingPage));
  const pricing = html.match(/<section id="pricing"[^>]*>(.*?)<\/section>/)?.[1];
  expect(pricing).toBeDefined();
  const plans = [
    { name: "Besplatno", price: PLAN_PRICES.free.monthly },
    { name: "Starter", price: PLAN_PRICES.starter.monthly },
    { name: "Pro", price: PLAN_PRICES.pro.monthly },
  ];
  for (const { name, price } of plans) {
    expect(pricing).toContain(`>${name}</h3>`);
    expect(pricing).toContain(`${new Intl.NumberFormat("sr-Latn").format(price)} din`);
  }
  expect(pricing).toContain("Team i Business su na listi čekanja.");
  const software = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1] ?? "{}");
  expect(software.offers).toMatchObject(plans.map(({ name, price }) => ({
    name, price: String(price), priceCurrency: "RSD",
  })));
});
