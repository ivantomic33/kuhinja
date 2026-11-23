import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import PremiumPage from "@/components/billing/PremiumPage";

const prices = vi.hoisted(() => ({ monthly: 1_000, yearly: 9_000 }));

vi.mock("@/lib/plan/entitlements", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/plan/entitlements")>();
  return { ...original, PLAN_PRICES: { ...original.PLAN_PRICES, pro: prices } };
});

vi.mock("@/lib/hooks/usePlan", () => ({
  usePlan: () => ({ plan: "free", isFree: true, isLoading: false, isPremium: false }),
}));

it("derives the yearly switching badge from the current Pro prices", () => {
  const render = () => renderToStaticMarkup(createElement(PremiumPage));

  expect(render()).toContain("Uštedi 25%");
  prices.yearly = 10_800;
  expect(render()).toContain("Uštedi 10%");
  prices.monthly = 1_200;
  expect(render()).toContain("Uštedi 25%");
  prices.yearly = 14_400;
  expect(render()).not.toContain("Uštedi");
});

it("offers guest pricing and sign-in links without marking a plan active", () => {
  const html = renderToStaticMarkup(createElement(PremiumPage, { guest: true }));
  expect(html).toContain('href="/register"');
  expect(html).toContain('href="/login?next=%2Fpremium%23plan-pro"');
  expect(html).not.toContain("Trenutni plan");
});
