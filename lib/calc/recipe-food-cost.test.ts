import { describe, expect, it } from "vitest";
import { getRecipeFoodCost, type RecipeCostLine } from "./recipe-food-cost";

const lines: RecipeCostLine[] = [
  { id: "b", name: "Lepinja", quantity: 1, quantityUnit: "kom", price: 40, priceUnit: "kom", lossPercent: 0 },
  { id: "m", name: "Meso", quantity: 0.2, quantityUnit: "kg", price: 800, priceUnit: "kg", lossPercent: 20 },
];

describe("recipe food cost alerts", () => {
  it("uses the calculator's line costs to rank ingredients and suggest a price", () => {
    const result = getRecipeFoodCost(lines, 600, true);
    expect(result).toMatchObject({ amount: 240, percent: 40, insight: { suggestedPrice: 750 } });
    expect(result.insight?.ingredients).toMatchObject([
      { name: "Meso", cost: 200 },
      { name: "Lepinja", cost: 40 },
    ]);
    expect(result.insight?.ingredients[0].share).toBeCloseTo(83.333);
  });

  it("keeps the basic percentage available when insights are locked", () => {
    expect(getRecipeFoodCost(lines, 600, false)).toEqual({ amount: 240, percent: 40, insight: null });
  });

  it("only suggests prices above 35% and handles unset menu prices", () => {
    const singleLine = [{ ...lines[0], price: 35 }];
    expect(getRecipeFoodCost(singleLine, 100, true)).toMatchObject({ percent: 35, insight: { suggestedPrice: null } });
    expect(getRecipeFoodCost(lines, 0, true)).toMatchObject({ percent: null, insight: { suggestedPrice: null } });
    expect(getRecipeFoodCost([], 100, true)).toEqual({ amount: null, percent: null, insight: { ingredients: [], suggestedPrice: null } });
  });
});
