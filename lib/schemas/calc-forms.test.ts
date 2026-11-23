import { describe, expect, it } from "vitest";
import { ingredientPurchaseSchema, recipeItemQuantitySchema } from "./domain";

describe("calculation form validation", () => {
  const purchase = { unit: "kg", unitAmount: 2.5, price: 120, waste: 50 };
  const line = { quantity: 250, quantityUnit: "g", ingredientUnit: "kg" };

  it("accepts positive decimal quantities and the allowed units", () => {
    expect(ingredientPurchaseSchema.safeParse(purchase).success).toBe(true);
    expect(recipeItemQuantitySchema.safeParse(line).success).toBe(true);
  });

  it.each([undefined, null, "", 0, -1, Infinity, NaN])("rejects quantity %s", (quantity) => {
    expect(ingredientPurchaseSchema.safeParse({ ...purchase, unitAmount: quantity }).success).toBe(false);
    expect(recipeItemQuantitySchema.safeParse({ ...line, quantity }).success).toBe(false);
  });

  it("rejects unknown units and 100% waste", () => {
    expect(ingredientPurchaseSchema.safeParse({ ...purchase, unit: "lb" }).success).toBe(false);
    expect(ingredientPurchaseSchema.safeParse({ ...purchase, waste: 100 }).success).toBe(false);
    expect(recipeItemQuantitySchema.safeParse({ ...line, quantityUnit: "lb" }).success).toBe(false);
    expect(recipeItemQuantitySchema.safeParse({ ...line, ingredientUnit: "lb" }).success).toBe(false);
  });

  it("allows zero prices and zero waste", () => {
    expect(ingredientPurchaseSchema.safeParse({ ...purchase, price: 0, waste: 0 }).success).toBe(true);
  });
});
