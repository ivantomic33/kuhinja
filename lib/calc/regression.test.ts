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
    }).toEqual({
      purchase: 207.91666666666669,
      preview: [207.91666666666669, 415.83333333333337, null],
      effective: [207.91666666666669, 415.83333333333337, NaN],
      differences: [499, 49, -51],
    });
  });

  it("preserves ingredient conversions and recipe pricing", () => {
    expect({
      converted: lines.map((line) => normalizeQuantity(line.quantity, line.quantityUnit, line.priceUnit)),
      zeroQuantity: lineCost({ ...lines[0], quantity: 0 }),
      invalidWaste: lineCost({ ...lines[0], lossPercent: 100 }),
      target: calculateFoodCost({ lines: [...lines], mode: "target_food_cost", percent: 30, vatPercent: 20 }),
      margin: calculateFoodCost({ lines: [...lines], mode: "margin", percent: 62, vatPercent: 10 }),
      recipe: getRecipeFoodCost(lines, 200, true),
    }).toEqual({
      converted: [0.175, 0.085, 2],
      invalidWaste: 0,
      margin: {
        foodCostPercent: 38,
        grossPrice: 248.3828947368421,
        lineCosts: [19.075, 28.73, 38],
        netPrice: 225.80263157894737,
        portionCost: 85.805,
      },
      recipe: {
        amount: 85.805,
        insight: {
          ingredients: [
            { cost: 38, id: "eggs", name: "Eggs", price: 19, share: 44.28646349280345, unit: "kom" },
            { cost: 28.73, id: "milk", name: "Milk", price: 169, share: 33.48289726705902, unit: "l" },
            { cost: 19.075, id: "flour", name: "Flour", price: 109, share: 22.230639240137517, unit: "kg" },
          ],
          suggestedPrice: 270,
        },
        percent: 42.9025,
      },
      target: {
        foodCostPercent: 30.000000000000004,
        grossPrice: 343.22,
        lineCosts: [19.075, 28.73, 38],
        netPrice: 286.01666666666665,
        portionCost: 85.805,
      },
      zeroQuantity: 0,
    });
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
    }).toEqual({
      display: [
        { label: "1,42 kg", unit: "kg", value: 1.42 },
        { label: "2,6 kašika", unit: "tbsp", value: 2.6 },
        { label: "5 kom", unit: "kom", value: 5 },
      ],
      factor: 2,
      oven: { cycles: 3, totalTime: 60 },
      scaled: [
        {
          baseQuantity: 712.34,
          id: "flour",
          name: "Flour",
          packageSize: 1000,
          scaledQuantity: 1424.68,
          scaling: "linear",
          unit: "g",
        },
        {
          baseQuantity: 22,
          id: "oil",
          name: "Oil",
          packageSize: 500,
          scaledQuantity: 38.30422478502946,
          scaling: "sublinear",
          unit: "ml",
        },
        {
          baseQuantity: 2.5,
          id: "eggs",
          name: "Eggs",
          packageSize: 6,
          scaledQuantity: 5,
          scaling: "linear",
          unit: "kom",
        },
      ],
      shoppingList: [
        {
          buyQuantity: 6,
          display: { label: "6 kom", unit: "kom", value: 6 },
          id: "eggs",
          name: "Eggs",
          packageSize: 6,
          packages: 1,
          unit: "kom",
        },
        {
          buyQuantity: 2000,
          display: { label: "2,00 kg", unit: "kg", value: 2 },
          id: "flour",
          name: "Flour",
          packageSize: 1000,
          packages: 2,
          unit: "g",
        },
        {
          buyQuantity: 500,
          display: { label: "500 ml", unit: "ml", value: 500 },
          id: "oil",
          name: "Oil",
          packageSize: 500,
          packages: 1,
          unit: "ml",
        },
      ],
      targetServings: 12,
    });
  });
});
