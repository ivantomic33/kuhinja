import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PriceHistory } from "@/components/recipes/PriceHistory";
import { sr } from "@/lib/i18n/sr";

const plan = vi.hoisted(() => ({ isPremium: true, isLoading: false }));
vi.mock("@/lib/hooks/usePlan", () => ({ usePlan: () => plan }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("price history presentation", () => {
  beforeEach(() => { plan.isPremium = true; plan.isLoading = false; });

  it("waits for plan loading before showing saved records", () => {
    plan.isLoading = true;
    const html = renderToStaticMarkup(createElement(PriceHistory, {
      entries: [{ id: "real", ingredientName: "Sačuvani sastojak", price: 42, recordedAt: "2026-11-19T10:00:00Z" }],
    }));
    expect(html).toContain(sr.common.loading);
    expect(html).not.toContain("Sačuvani sastojak");
  });
  it("shows an honest empty state without inventing ingredient prices", () => {
    const html = renderToStaticMarkup(createElement(PriceHistory, { entries: [] }));
    expect(html).toContain(sr.premium.priceHistoryEmpty);
    expect(html).not.toContain("Brašno");
    expect(html).not.toContain("Mleko");
  });

  it("distinguishes failed loading from an empty history", () => {
    const html = renderToStaticMarkup(createElement(PriceHistory, { entries: [], loadError: true }));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain(sr.premium.priceHistoryEmpty);
  });

  it("shows supplied records, including long names and large amounts", () => {
    const html = renderToStaticMarkup(createElement(PriceHistory, {
      entries: [{ id: "real", ingredientName: "Dugačak naziv sastojka iz korisničke baze", price: 1234567.89, recordedAt: "2026-11-19T10:00:00Z" }],
    }));
    expect(html).toContain("Dugačak naziv sastojka iz korisničke baze");
    expect(html).toContain("1.234.567,89");
    expect(html).not.toContain(sr.premium.priceHistoryEmpty);
  });
});
