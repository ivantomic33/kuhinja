import { describe, expect, it } from "vitest";
import {
  buildPriceSuggestion,
  ceilMoney,
  foodCostDiffPp,
  formatDiffPp,
  mostExpensiveIngredientShare,
  suggestedNetPriceForTarget,
} from "./suggestions";
import { buildWidgetRow } from "./format";
import { targetFoodCostPctSchema } from "./schemas";
import { foodCostPercentFromPrices } from "@/lib/calc/foodcost";

describe("food cost %", () => {
  it("portion 3.00 / sell 10.00 → 30%", () => {
    expect(foodCostPercentFromPrices(3, 10)).toBe(30);
  });
});

describe("suggested net price (ceil 2dp)", () => {
  it("cost 3.00 target 30 → 10.00", () => {
    expect(suggestedNetPriceForTarget(3, 30)).toBe(10);
    expect(buildPriceSuggestion(3, 30).suggestedNetPrice).toBe(10);
  });

  it("cost 3.01 target 30 → 10.04 (round up)", () => {
    // 3.01 / 0.3 = 10.0333… → ceil money 10.04
    expect(suggestedNetPriceForTarget(3.01, 30)).toBe(10.04);
  });

  it("ceilMoney edges", () => {
    expect(ceilMoney(10)).toBe(10);
    expect(ceilMoney(10.001)).toBe(10.01);
  });
});

describe("most expensive ingredient share", () => {
  it("picks highest cost; tie-break by name", () => {
    const top = mostExpensiveIngredientShare([
      { id: "2", name: "Ulje", cost: 5 },
      { id: "1", name: "Brašno", cost: 10 },
      { id: "3", name: "So", cost: 10 },
    ]);
    expect(top?.name).toBe("Brašno");
    expect(top?.sharePct).toBe(40);
  });
});

describe("widget diff pp", () => {
  it("matches subtraction of displayed values (1 decimal)", () => {
    const row = buildWidgetRow({
      recipeId: "r1",
      recipeName: "Test",
      portionCost: 3.4,
      sellingPriceNet: 10,
      foodCostPct: 34.2,
      targetFoodCostPct: 30,
    });
    expect(row.diffPp).toBe(foodCostDiffPp(34.2, 30));
    expect(row.diffPp).toBe(4.2);
    expect(row.diffLabel).toBe(formatDiffPp(4.2));
    expect(row.diffLabel).toBe("+4,2 p.p.");
  });
});

describe("targetFoodCostPctSchema", () => {
  it("accepts 30 and 12.5", () => {
    expect(targetFoodCostPctSchema.parse(30)).toBe(30);
    expect(targetFoodCostPctSchema.parse(12.5)).toBe(12.5);
  });

  it("rejects 0, 101 and non-numeric", () => {
    expect(targetFoodCostPctSchema.safeParse(0).success).toBe(false);
    expect(targetFoodCostPctSchema.safeParse(101).success).toBe(false);
    expect(targetFoodCostPctSchema.safeParse("30").success).toBe(false);
    expect(targetFoodCostPctSchema.safeParse(Number.NaN).success).toBe(false);
  });
});
