import { describe, expect, it } from "vitest";
import { ALLERGEN_CATALOG, ALLERGEN_CODES } from "./catalog";
import { buildRecipeAllergenMatrix } from "./matrix";
import {
  getIngredientAllergensSchema,
  getMenuAllergenMatrixSchema,
} from "./schemas";

describe("allergen catalogue", () => {
  it("contains the 14 regulated allergens in regulation order", () => {
    expect(ALLERGEN_CATALOG).toHaveLength(14);
    expect(ALLERGEN_CATALOG.map((entry) => entry.uredba)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
    expect(ALLERGEN_CATALOG.map((entry) => entry.code)).toEqual(ALLERGEN_CODES);
  });
});

describe("recipe allergen aggregation", () => {
  it("combines ingredient allergens and prefers contains over trace", () => {
    const result = buildRecipeAllergenMatrix(
      ["ingredient-a", "ingredient-b"],
      [
        { ingredientId: "ingredient-a", code: "gluten", presence: "trace" },
        { ingredientId: "ingredient-b", code: "gluten", presence: "contains" },
        { ingredientId: "ingredient-b", code: "mleko", presence: "trace" },
      ],
    );

    expect(result.totals).toEqual([
      { code: "gluten", presence: "contains" },
      { code: "mleko", presence: "trace" },
    ]);
    expect(result.cells).toHaveLength(28);
  });
});

describe("allergen action input schemas", () => {
  it("rejects malformed ingredient IDs and duplicate menu recipes", () => {
    expect(getIngredientAllergensSchema.safeParse({ ingredientId: "bad" }).success)
      .toBe(false);
    expect(
      getMenuAllergenMatrixSchema.safeParse({
        recipeIds: [
          "11111111-1111-4111-8111-111111111111",
          "11111111-1111-4111-8111-111111111111",
        ],
      }).success,
    ).toBe(false);
  });
});
