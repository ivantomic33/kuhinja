import { foodCostPercentFromPrices, portionCost } from "@/lib/calc/foodcost";
import type { RecipeForSale } from "./types";

export function summarizeSaleFoodCost(
  recipes: readonly RecipeForSale[],
  portionsByRecipe: Readonly<Record<string, number>>
) {
  let cost = 0;
  let revenue = 0;
  const dishes = [];

  for (const recipe of recipes) {
    const portions = Math.floor(portionsByRecipe[recipe.id] ?? 0);
    if (portions <= 0) continue;

    const dishCost = portions * portionCost(recipe.items.map((item) => ({
      quantity: item.quantity,
      quantityUnit: item.unit,
      price: item.price,
      priceUnit: item.unit,
      lossPercent: item.wastePercent,
    })));
    const dishRevenue = recipe.sellingPrice * portions;
    cost += dishCost;
    revenue += dishRevenue;
    dishes.push({
      id: recipe.id,
      name: recipe.name,
      portions,
      cost: dishCost,
      percent: dishRevenue > 0 ? foodCostPercentFromPrices(dishCost, dishRevenue) : null,
    });
  }

  return {
    cost,
    revenue,
    percent: revenue > 0 ? foodCostPercentFromPrices(cost, revenue) : null,
    dishes: dishes
      .sort((a, b) => b.cost - a.cost)
      .map((dish) => ({
        ...dish,
        share: cost > 0 ? foodCostPercentFromPrices(dish.cost, cost) : 0,
      })),
  };
}
