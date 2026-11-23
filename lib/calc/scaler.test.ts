import { describe, expect, it } from "vitest";
import {
  buildShoppingList,
  calculateOvenCapacity,
  clampServings,
  formatScaledQuantity,
  formatShoppingListText,
  packagesNeeded,
  scaleFactor,
  scaleIngredients,
  scaleQuantity,
} from "./scaler";

describe("clampServings", () => {
  it("clamps to 1–500", () => {
    expect(clampServings(0)).toBe(1);
    expect(clampServings(12.4)).toBe(12);
    expect(clampServings(999)).toBe(500);
  });
});

describe("scaleFactor + scaleQuantity", () => {
  it("computes linear factor", () => {
    expect(scaleFactor(20, 10)).toBe(2);
  });

  it("scales linear ingredients", () => {
    expect(scaleQuantity(100, 2, "linear")).toBe(200);
  });

  it("scales sublinear with factor^0.8", () => {
    const factor = 2;
    const expected = 100 * Math.pow(factor, 0.8);
    expect(scaleQuantity(100, factor, "sublinear")).toBeCloseTo(expected, 10);
  });
});

describe("formatScaledQuantity", () => {
  it("shows grams below 1000 g", () => {
    expect(formatScaledQuantity(250, "g")).toMatchObject({
      value: 250,
      unit: "g",
    });
  });

  it("shows kg at or above 1000 g", () => {
    const result = formatScaledQuantity(1500, "g");
    expect(result.unit).toBe("kg");
    expect(result.value).toBe(1.5);
  });

  it("prefers teaspoons for small liquids", () => {
    const result = formatScaledQuantity(10, "ml");
    expect(result.unit).toBe("tsp");
    expect(result.value).toBe(2);
  });

  it("prefers tablespoons for small liquids", () => {
    const result = formatScaledQuantity(30, "ml");
    expect(result.unit).toBe("tbsp");
    expect(result.value).toBe(2);
  });
});

describe("oven capacity", () => {
  it("ceils cycles and multiplies time", () => {
    expect(
      calculateOvenCapacity({ totalPieces: 25, capacity: 10, baseTime: 20 })
    ).toEqual({ cycles: 3, totalTime: 60 });
  });
});

describe("shopping list", () => {
  it("rounds up to package size and merges ids", () => {
    const scaled = scaleIngredients(
      [
        {
          id: "flour",
          name: "Brašno",
          quantity: 400,
          unit: "g",
          packageSize: 1000,
        },
        {
          id: "flour",
          name: "Brašno",
          quantity: 700,
          unit: "g",
          packageSize: 1000,
        },
      ],
      1
    );

    const list = buildShoppingList(scaled);
    expect(list).toHaveLength(1);
    expect(list[0]?.buyQuantity).toBe(2000);
    expect(list[0]?.packages).toBe(2);
    expect(packagesNeeded(1100, 1000)).toBe(2);
  });

  it("formats copy-friendly text", () => {
    const text = formatShoppingListText(
      [
        {
          id: "1",
          name: "So",
          buyQuantity: 1000,
          unit: "g",
          packages: 1,
          packageSize: 1000,
          display: formatScaledQuantity(1000, "g"),
        },
      ],
      "Lista"
    );
    expect(text).toContain("Lista");
    expect(text).toContain("So");
  });
});
