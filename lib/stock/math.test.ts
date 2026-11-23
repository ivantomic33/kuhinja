import { expect, it } from "vitest";
import { buildBuyList, formatQty, previewSaleDeductions, selectSaleRecipes, stockLevelPercent } from "./math";
import { summarizeSaleFoodCost } from "./saleFoodCost";
import type { RecipeForSale, StockRow } from "./types";

const recipes: RecipeForSale[] = [
  {
    id: "first",
    name: "First dish",
    portions: 1,
    sellingPrice: 500,
    items: [{ ingredientId: "tomato", name: "Tomato", unit: "kg", quantity: 0.1, price: 500, wastePercent: 0 }],
  },
  {
    id: "unselected",
    name: "Unselected dish",
    portions: 1,
    sellingPrice: 200,
    items: [{ ingredientId: "bread", name: "Bread", unit: "kom", quantity: 1, price: 50, wastePercent: 0 }],
  },
  {
    id: "last",
    name: "Last dish",
    portions: 1,
    sellingPrice: 400,
    items: [{ ingredientId: "tomato", name: "Shared tomato", unit: "kg", quantity: 0.2, price: 500, wastePercent: 0 }],
  },
];

it("selects only sold recipes in menu order, preserving stock and food cost results", () => {
  const portions = { last: 1, unselected: 0, missing: 4, first: 2 };
  const recipesById = new Map(recipes.map((recipe, index) => [recipe.id, { recipe, index }]));
  const stockByIngredient = new Map<string, StockRow>();
  const selected = selectSaleRecipes(recipesById, portions);

  expect(selected).toEqual([recipes[0], recipes[2]]);
  expect(previewSaleDeductions(selected, portions, stockByIngredient)).toEqual(
    previewSaleDeductions(recipes, portions, stockByIngredient)
  );
  expect(summarizeSaleFoodCost(selected, portions)).toEqual(summarizeSaleFoodCost(recipes, portions));
});

it("lists only stock below its minimum and suggests refilling to twice the minimum", () => {
  const tomato: StockRow = {
    id: "tomato",
    ingredientId: "tomato",
    venueId: "kitchen",
    name: "Paradajz",
    unit: "kg",
    qty: 3.5,
    min: 2,
    price: 180,
    usedToday: 0,
    usedOn: "2026-11-19",
    hasLevel: true,
  };
  const meat = { ...tomato, id: "meat", ingredientId: "meat", name: "Meso", qty: 1.2, min: 3 };
  const atMinimum = { ...tomato, id: "onion", ingredientId: "onion", name: "Luk", qty: 2 };

  expect(buildBuyList([tomato, meat, atMinimum])).toMatchObject([
    { name: "Meso", need: 4.8 },
  ]);
});

it("displays decimal quantities with a comma", () => {
  expect(formatQty(5.34)).toBe("5,34");
  expect(formatQty(20)).toBe("20");
});

it("shrinks the stock bar as today's sales consume stock, with or without a minimum", () => {
  expect(stockLevelPercent(20, 0, 0)).toBe(100);
  expect(stockLevelPercent(10, 0, 10)).toBe(50);
  expect(stockLevelPercent(4, 0, 16)).toBe(20);
  expect(stockLevelPercent(16, 5, 4)).toBe(80);
  expect(stockLevelPercent(5, 5, 2)).toBe(50);
  expect(stockLevelPercent(-2, 5, 7)).toBe(0);
  expect(stockLevelPercent(0, 0, 0)).toBe(0);
});

