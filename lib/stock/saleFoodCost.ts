import { foodCostPercentFromPrices, portionCost } from "@/lib/calc/foodcost";
import type { RecipeForSale } from "./types";
import type { Ingredient, Recipe } from "@/lib/supabase/database.types";

export const saleRecipeSelect = "id, name, venue_id, portions, selling_price, description, recipe_items(ingredient_id, quantity, ingredients(name, unit, price, waste_percent))";

type SaleIngredient = Pick<Ingredient, "name" | "unit" | "price" | "waste_percent">;
export type SaleRecipeRow = Pick<Recipe, "id" | "name" | "portions" | "venue_id" | "selling_price" | "description"> & {
  recipe_items: {
    ingredient_id: string;
    quantity: number;
    ingredients: SaleIngredient | SaleIngredient[] | null;
  }[];
};

export function toSaleRecipe(row: SaleRecipeRow): RecipeForSale {
  return {
    id: row.id,
    name: row.name,
    portions: Number(row.portions) || 1,
    sellingPrice: Number(row.selling_price) || 0,
    items: row.recipe_items.flatMap((item) => {
      const ingredient = Array.isArray(item.ingredients) ? item.ingredients[0] : item.ingredients;
      if (!ingredient) return [];
      return [{
        ingredientId: item.ingredient_id,
        name: ingredient.name,
        unit: ingredient.unit,
        quantity: Number(item.quantity) || 0,
        price: Number(ingredient.price) || 0,
        wastePercent: Number(ingredient.waste_percent) || 0,
      }];
    }),
  };
}

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
