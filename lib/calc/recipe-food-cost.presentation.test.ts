import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecipeFoodCostDialog } from "@/components/recipes/RecipeFoodCostDialog";
import { foodCostTone } from "@/components/ui/FoodCostCell";
import { getRecipeFoodCost } from "./recipe-food-cost";

const recipe = {
  id: "pljeskavica",
  name: "Pljeskavica",
  venue_id: "venue",
  selling_price: 600,
  portions: 1,
  foodCost: getRecipeFoodCost([
    { id: "m", name: "Meso", quantity: 0.3, quantityUnit: "kg", price: 800, priceUnit: "kg", lossPercent: 0 },
  ], 600, true),
};

describe("recipe food cost presentation", () => {
  it("shows the Pro insight and keeps the existing calculator accessible", () => {
    const html = renderToStaticMarkup(createElement(RecipeFoodCostDialog, {
      recipe,
      canSeeInsights: true,
      onClose: () => {},
    }));
    expect(html).toContain('id="modalFcWarn"');
    expect(html).toContain("Meso vuče trošak");
    expect(html).toContain("750 din");
    expect(html).toContain('href="/recipes/pljeskavica"');
  });

  it("hides insight details on lower plans", () => {
    const html = renderToStaticMarkup(createElement(RecipeFoodCostDialog, {
      recipe,
      canSeeInsights: false,
      onClose: () => {},
    }));
    expect(html).toContain("40,0%");
    expect(html).toContain("Ko vuče trošak i predlog cene");
    expect(html).toContain('href="/premium"');
    expect(html).not.toContain("Meso");
    expect(html).not.toContain("750 din");
  });

  it("uses green through the upper target boundary and red above it", () => {
    expect(foodCostTone(28)).toBe("success");
    expect(foodCostTone(35)).toBe("success");
    expect(foodCostTone(35.01)).toBe("danger");
  });
});
