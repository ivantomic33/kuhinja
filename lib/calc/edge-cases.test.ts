import { describe, expect, it } from "vitest";
import {
  areUnitsCompatible,
  effectivePrice,
  foodCostPercentFromPrices,
  grossPriceFromNet,
  lineCost,
  netPriceFromMode,
  normalizeQuantity,
  roundDisplay,
} from "./foodcost";
import { priceChangePercent, priceDifference, unitPrice } from "./prices";
import {
  buildShoppingList,
  calculateBatchScale,
  calculateOvenCapacity,
  clampServings,
  defaultPackageSize,
  formatScaledQuantity,
  formatShoppingListText,
  packagesNeeded,
  scaleFactor,
  scaleIngredients,
  scaleQuantity,
} from "./scaler";

describe("pricing edge cases", () => {
  it("keeps the purchase price at 0% waste and doubles it at 50%", () => {
    expect(effectivePrice(120, 0)).toBe(120);
    expect(effectivePrice(120, 50)).toBe(240);
  });

  it("treats 100% waste as undefined and preserves the zero-cost fallback", () => {
    expect(effectivePrice(120, 100)).toBeNaN();
    expect(lineCost({
      quantity: 1, quantityUnit: "kom", price: 120, priceUnit: "kom", lossPercent: 100,
    })).toBe(0);
  });

  it("handles zero quantity and division by zero", () => {
    expect(lineCost({
      quantity: 0, quantityUnit: "kg", price: 120, priceUnit: "kg", lossPercent: 0,
    })).toBe(0);
    expect(unitPrice(120, 0)).toBeNull();
    expect(unitPrice(120, 2.5)).toBe(48);
    expect(unitPrice(0, 2)).toBe(0);
    expect(netPriceFromMode(120, "target_food_cost", 0)).toBe(0);
    expect(netPriceFromMode(120, "margin", 100)).toBe(0);
    expect(foodCostPercentFromPrices(120, 0)).toBe(0);
    expect(scaleFactor(12, 0)).toBe(0);
  });

  it("keeps the absolute difference from zero and leaves percentage change undefined", () => {
    expect(priceDifference(120, 0)).toBe(120);
    expect(priceChangePercent(120, 0)).toBeNull();
    expect(priceChangePercent(0, 0)).toBeNull();
    expect(priceChangePercent(120, 100)).toBe(20);
    expect(priceChangePercent(75, 100)).toBe(-25);
  });

  it("converts mass and volume and keeps discrete unit families separate", () => {
    expect(normalizeQuantity(350, "g", "kg")).toBe(0.35);
    expect(normalizeQuantity(450, "ml", "l")).toBe(0.45);
    expect(normalizeQuantity(3, "kom", "kom")).toBe(3);
    expect(normalizeQuantity(3, "pak", "pak")).toBe(3);
    expect(normalizeQuantity(3, "kom", "pak")).toBeNaN();
    expect(normalizeQuantity(Infinity, "g", "kg")).toBeNaN();
    expect(areUnitsCompatible("kg", "g")).toBe(true);
    expect(areUnitsCompatible("l", "kg")).toBe(false);
  });

  it("rejects invalid prices, percentages, and quantities", () => {
    expect(unitPrice(-1, 10)).toBeNull();
    expect(unitPrice(Infinity, 10)).toBeNull();
    expect(unitPrice(1, Infinity)).toBeNull();
    expect(unitPrice(Number.MAX_VALUE, 0.5)).toBeNull();
    expect(priceChangePercent(-1, 100)).toBeNull();
    expect(priceChangePercent(NaN, 100)).toBeNull();
    expect(priceChangePercent(100, Infinity)).toBeNull();
    expect(priceChangePercent(Number.MAX_VALUE, 1)).toBeNull();
    expect(effectivePrice(Infinity, 10)).toBeNaN();
    expect(effectivePrice(1, NaN)).toBeNaN();
    expect(effectivePrice(1, -1)).toBeNaN();
    expect(lineCost({
      quantity: 1, quantityUnit: "g", price: -1, priceUnit: "kg", lossPercent: 0,
    })).toBe(0);
    expect(lineCost({
      quantity: 1, quantityUnit: "g", price: 120, priceUnit: "l", lossPercent: 0,
    })).toBe(0);
    expect(netPriceFromMode(-1, "margin", 30)).toBe(0);
    expect(netPriceFromMode(1, "margin", NaN)).toBe(0);
    expect(grossPriceFromNet(-1, 20)).toBe(0);
    expect(grossPriceFromNet(1, -1)).toBe(0);
    expect(roundDisplay(NaN)).toBe(0);
  });

  it("rounds servings and display quantities while preserving the scaled quantity", () => {
    const batch = calculateBatchScale({
      baseServings: 3,
      targetServings: 4.6,
      ovenCapacity: 0,
      baseTime: 20,
      ingredients: [{ id: "oil", name: "Oil", quantity: 0.8, unit: "l", packageSize: 1 }],
    });
    expect(batch.targetServings).toBe(5);
    expect(batch.factor).toBe(5 / 3);
    expect(batch.scaled[0].scaledQuantity).toBe(0.8 * (5 / 3));
    expect(formatScaledQuantity(batch.scaled[0].scaledQuantity, "l").value).toBe(1.33);
    expect(batch.oven).toEqual({ cycles: 0, totalTime: 0 });
    expect(batch.shoppingList[0].packages).toBe(2);
  });
});

describe("scaling edge cases", () => {
  it("handles invalid servings, quantities, and oven inputs", () => {
    expect(clampServings(NaN)).toBe(1);
    expect(scaleFactor(NaN, 10)).toBe(0);
    expect(scaleFactor(10, Infinity)).toBe(0);
    expect(scaleFactor(0, 10)).toBe(0);
    expect(scaleQuantity(-1, 2)).toBe(0);
    expect(scaleQuantity(1, -2)).toBe(0);
    expect(calculateOvenCapacity({ totalPieces: 0, capacity: 3, baseTime: 20 }))
      .toEqual({ cycles: 0, totalTime: 0 });
    expect(calculateOvenCapacity({ totalPieces: 3, capacity: 3, baseTime: -1 }))
      .toEqual({ cycles: 0, totalTime: 0 });
    expect(calculateBatchScale({
      baseServings: 3, targetServings: 5, totalPieces: 11,
      ovenCapacity: 5, baseTime: 10, ingredients: [],
    }).oven).toEqual({ cycles: 3, totalTime: 30 });
  });

  it.each([
    [0, "kg", 0, "kg"],
    [7, "ml", 1.4, "tsp"],
    [20, "ml", 1.3, "tbsp"],
    [72.4, "ml", 72, "ml"],
    [75, "ml", 5, "tbsp"],
    [2.25, "pak", 2.3, "pak"],
    [12.6, "kom", 13, "kom"],
  ] as const)("formats %s %s as %s %s", (quantity, unit, value, displayUnit) => {
    expect(formatScaledQuantity(quantity, unit)).toMatchObject({ value, unit: displayUnit });
  });

  it("ignores zero demand and uses whole packages with missing or mixed package sizes", () => {
    expect(packagesNeeded(0, 1)).toBe(0);
    expect(packagesNeeded(1, 0)).toBe(0);
    expect(formatShoppingListText([])).toBe("—");
    const items = scaleIngredients([
      { id: "", name: "Oil", quantity: 2.1, unit: "l", packageSize: 0 },
      { id: "", name: "Oil", quantity: 3.1, unit: "l", packageSize: 2 },
      { id: "salt", name: "Salt", quantity: 0, unit: "g", packageSize: 500 },
    ], 1);
    expect(items[0].packageSize).toBe(1);
    expect(buildShoppingList(items)).toMatchObject([{ packages: 3, buyQuantity: 6, packageSize: 2 }]);
    expect(defaultPackageSize("g")).toBe(1000);
    expect(defaultPackageSize("ml")).toBe(1000);
    for (const unit of ["kg", "l", "kom", "pak"] as const) {
      expect(defaultPackageSize(unit)).toBe(1);
    }
  });
});
