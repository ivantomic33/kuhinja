import { describe, expect, it } from "vitest";
import {
  foodCostPercentFromPrices,
  lineCost,
  normalizeQuantity,
  type IngredientLineInput,
} from "./foodcost";

/**
 * Documents the SQL formula used in refresh_recipe_cost_snapshot.
 * Values here are the fixture shared with supabase/tests/food_cost_alerts.sql.
 */
function sqlStylePortionCost(
  lines: IngredientLineInput[],
  portions: number,
): number {
  const batch = lines.reduce((sum, line) => sum + lineCost(line), 0);
  return batch / portions;
}

describe("SQL ↔ TypeScript food-cost parity fixture", () => {
  const lines: IngredientLineInput[] = [
    {
      quantity: 200,
      quantityUnit: "g",
      price: 500,
      priceUnit: "kg",
      lossPercent: 10,
    },
    {
      quantity: 50,
      quantityUnit: "ml",
      price: 200,
      priceUnit: "l",
      lossPercent: 0,
    },
  ];
  const portions = 2;
  const sellingNet = 20;

  it("normalize matches expected bases", () => {
    expect(normalizeQuantity(200, "g", "kg")).toBe(0.2);
    expect(normalizeQuantity(50, "ml", "l")).toBe(0.05);
  });

  it("line costs", () => {
    // 0.2 kg * (500 / 0.9) = 111.111...
    expect(lineCost(lines[0])).toBeCloseTo(111.111111, 5);
    // 0.05 l * 200 = 10
    expect(lineCost(lines[1])).toBe(10);
  });

  it("portion cost and food cost %", () => {
    const portion = sqlStylePortionCost(lines, portions);
    // batch ≈ 121.111111 / 2 ≈ 60.555555
    expect(portion).toBeCloseTo(60.555555, 5);
    const pct = foodCostPercentFromPrices(portion, sellingNet);
    expect(pct).toBeCloseTo(302.777777, 4);
  });
});
