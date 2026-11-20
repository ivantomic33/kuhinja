import { describe, expect, it } from "vitest";
import { calculateFoodCost, effectivePrice, lineCost, normalizeQuantity } from "./foodcost";
import { priceDifference, unitPrice } from "./prices";
import { getRecipeFoodCost } from "./recipe-food-cost";
import { calculateBatchScale, formatScaledQuantity } from "./scaler";

const lines = [
  { id: "flour", name: "Flour", quantity: 175, quantityUnit: "g", price: 109, priceUnit: "kg", lossPercent: 0 },
  { id: "milk", name: "Milk", quantity: 85, quantityUnit: "ml", price: 169, priceUnit: "l", lossPercent: 50 },
  { id: "eggs", name: "Eggs", quantity: 2, quantityUnit: "kom", price: 19, priceUnit: "kom", lossPercent: 0 },
] as const;

describe("pricing and scaling before extraction", () => {
  it("preserves purchase price, waste, and menu price differences", () => {
    const purchase = unitPrice(499, 2.4);
    if (purchase === null) throw new Error("Expected a unit price for a valid purchase");
    const effective = [0, 50, 100].map((waste) => effectivePrice(purchase, waste));
    expect({
      purchase,
      preview: effective.map((value) => Number.isNaN(value) ? null : value),
      effective,
      differences: [0, 450, 550].map((previous) => priceDifference(499, previous)),
    }).toMatchSnapshot();
  });

  it("preserves ingredient conversions and recipe pricing", () => {
    expect({
      converted: lines.map((line) => normalizeQuantity(line.quantity, line.quantityUnit, line.priceUnit)),
      zeroQuantity: lineCost({ ...lines[0], quantity: 0 }),
      invalidWaste: lineCost({ ...lines[0], lossPercent: 100 }),
      target: calculateFoodCost({ lines: [...lines], mode: "target_food_cost", percent: 30, vatPercent: 20 }),
      margin: calculateFoodCost({ lines: [...lines], mode: "margin", percent: 62, vatPercent: 10 }),
      recipe: getRecipeFoodCost(lines, 200, true),
    }).toMatchSnapshot();
  });

  it("preserves batch scaling, display rounding, and whole-package purchases", () => {
    const batch = calculateBatchScale({
      baseServings: 6,
      targetServings: 11.6,
      ovenCapacity: 5,
      baseTime: 20,
      ingredients: [
        { id: "flour", name: "Flour", quantity: 712.34, unit: "g", packageSize: 1000 },
        { id: "oil", name: "Oil", quantity: 22, unit: "ml", scaling: "sublinear", packageSize: 500 },
        { id: "eggs", name: "Eggs", quantity: 2.5, unit: "kom", packageSize: 6 },
      ],
    });
    expect({
      ...batch,
      display: batch.scaled.map((line) => formatScaledQuantity(line.scaledQuantity, line.unit)),
    }).toMatchSnapshot();
  });
});
