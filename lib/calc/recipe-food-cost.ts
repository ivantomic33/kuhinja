import { foodCostPercentFromPrices, lineCost, netPriceFromMode, type IngredientLineInput } from "./foodcost";

export const FOOD_COST_TARGET_MIN = 28;
export const FOOD_COST_TARGET_MAX = 35;
export const FOOD_COST_TARGET_MID = 32;
export const FOOD_COST_FAR_OVER = 40;
export const FOOD_COST_TARGET_LABEL = `${FOOD_COST_TARGET_MIN}–${FOOD_COST_TARGET_MAX}%`;

export type RecipeCostLine = IngredientLineInput & { id: string; name: string };
export type RecipeFoodCost = ReturnType<typeof getRecipeFoodCost>;

export function getRecipeFoodCost(
  lines: readonly RecipeCostLine[],
  sellingPrice: number,
  includeInsight: boolean,
) {
  const costs = lines.map(lineCost);
  const total = costs.reduce((sum, cost) => sum + cost, 0);
  const amount = lines.length > 0 ? total : null;
  const percent = amount !== null && sellingPrice > 0
    ? foodCostPercentFromPrices(amount, sellingPrice)
    : null;

  const insight = includeInsight ? {
    ingredients: lines.map((line, index) => ({
      id: line.id,
      name: line.name,
      price: line.price,
      unit: line.priceUnit,
      cost: costs[index],
      share: total > 0 ? costs[index] / total * 100 : 0,
    })).sort((a, b) => b.cost - a.cost),
    suggestedPrice: percent !== null && percent > FOOD_COST_TARGET_MAX
      ? Math.round(netPriceFromMode(total, "target_food_cost", FOOD_COST_TARGET_MID) / 10) * 10
      : null,
  } : null;

  return { amount, percent, insight };
}
