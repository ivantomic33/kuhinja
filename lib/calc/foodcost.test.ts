import { describe, expect, it } from "vitest";
import {
  calculateFoodCost,
  effectivePrice,
  lineCost,
  netPriceFromMode,
  normalizeQuantity,
  portionCost,
  roundDisplay,
  type IngredientLineInput,
} from "./foodcost";

describe("normalizeQuantity", () => {
  it("converts g → kg", () => {
    expect(normalizeQuantity(150, "g", "kg")).toBe(0.15);
  });

  it("converts ml → l", () => {
    expect(normalizeQuantity(30, "ml", "l")).toBe(0.03);
  });

  it("returns NaN for incompatible units", () => {
    expect(normalizeQuantity(1, "g", "l")).toBeNaN();
  });
});

describe("effectivePrice", () => {
  it("applies loss percent", () => {
    expect(effectivePrice(600, 20)).toBe(750);
  });
});

describe("lineCost", () => {
  it("Chicken 150 g at 600 din/kg with 20% loss → 112.50 din", () => {
    const cost = lineCost({
      quantity: 150,
      quantityUnit: "g",
      price: 600,
      priceUnit: "kg",
      lossPercent: 20,
    });
    expect(roundDisplay(cost)).toBe(112.5);
    expect(cost).toBe(112.5);
  });
});

describe("portionCost + pricing", () => {
  /** Full example lines that sum to exactly 123.21 din */
  const fullExampleLines: IngredientLineInput[] = [
    // Chicken 150 g @ 600 din/kg, 20% loss → 112.50
    {
      quantity: 150,
      quantityUnit: "g",
      price: 600,
      priceUnit: "kg",
      lossPercent: 20,
    },
    // Oil 30 ml @ 250 din/l, 0% loss → 7.50
    {
      quantity: 30,
      quantityUnit: "ml",
      price: 250,
      priceUnit: "l",
      lossPercent: 0,
    },
    // Spice 20 g @ 160.5 din/kg, 0% loss → 3.21
    {
      quantity: 20,
      quantityUnit: "g",
      price: 160.5,
      priceUnit: "kg",
      lossPercent: 0,
    },
  ];

  it("Full example portion cost → 123.21 din", () => {
    const cost = portionCost(fullExampleLines);
    expect(cost).toBe(123.21);
    expect(roundDisplay(cost)).toBe(123.21);
  });

  it("Food cost 30% → net price 410.70 din", () => {
    const cost = portionCost(fullExampleLines);
    const net = netPriceFromMode(cost, "target_food_cost", 30);
    expect(roundDisplay(net)).toBe(410.7);
    expect(net).toBe(410.7);
  });

  it("calculateFoodCost wires the full pipeline", () => {
    const result = calculateFoodCost({
      lines: fullExampleLines,
      mode: "target_food_cost",
      percent: 30,
      vatPercent: 20,
    });

    expect(result.portionCost).toBe(123.21);
    expect(result.netPrice).toBe(410.7);
    expect(roundDisplay(result.grossPrice)).toBe(492.84);
    expect(roundDisplay(result.foodCostPercent)).toBe(30);
  });

  it("margin mode matches equivalent food-cost target", () => {
    const cost = portionCost(fullExampleLines);
    // 70% margin ≡ 30% food cost
    const netFromMargin = netPriceFromMode(cost, "margin", 70);
    const netFromTarget = netPriceFromMode(cost, "target_food_cost", 30);
    expect(netFromMargin).toBe(netFromTarget);
  });
});
