import { expect, it } from "vitest";
import { summarizeSaleFoodCost } from "./saleFoodCost";
import type { RecipeForSale } from "./types";

const recipes: RecipeForSale[] = [
  {
    id: "bread",
    name: "Lepinja",
    portions: 1,
    sellingPrice: 200,
    items: [{ ingredientId: "bread", name: "Lepinja", unit: "kom", quantity: 1, price: 50, wastePercent: 0 }],
  },
  {
    id: "burger",
    name: "Pljeskavica",
    portions: 4,
    sellingPrice: 500,
    items: [{ ingredientId: "meat", name: "Meso", unit: "kg", quantity: 0.25, price: 800, wastePercent: 20 }],
  },
];

it("weights recipe costs and revenue by the sold portions and ranks dishes by total cost", () => {
  expect(summarizeSaleFoodCost(recipes, { bread: 5, burger: 3 })).toEqual({
    cost: 1000,
    revenue: 2500,
    percent: 40,
    dishes: [
      { id: "burger", name: "Pljeskavica", portions: 3, cost: 750, percent: 50, share: 75 },
      { id: "bread", name: "Lepinja", portions: 5, cost: 250, percent: 25, share: 25 },
    ],
  });
});

it("includes only sold dishes and leaves the food cost percentage empty when revenue is zero", () => {
  const unpriced = [recipes[0], { ...recipes[1], sellingPrice: 0 }];
  expect(summarizeSaleFoodCost(unpriced, { burger: 1 })).toEqual({
    cost: 250,
    revenue: 0,
    percent: null,
    dishes: [
      { id: "burger", name: "Pljeskavica", portions: 1, cost: 250, percent: null, share: 100 },
    ],
  });
});
