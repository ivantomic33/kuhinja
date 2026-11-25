import { foodCostDiffPp, formatDiffPp } from "./suggestions";

export type FoodCostWidgetRow = {
  recipeId: string;
  recipeName: string;
  portionCost: number;
  sellingPriceNet: number;
  foodCostPct: number;
  targetFoodCostPct: number;
  /** foodCostPct − target, 1 decimal — must match on-screen subtraction. */
  diffPp: number;
  diffLabel: string;
};

export function buildWidgetRow(input: {
  recipeId: string;
  recipeName: string;
  portionCost: number;
  sellingPriceNet: number;
  foodCostPct: number;
  targetFoodCostPct: number;
}): FoodCostWidgetRow {
  const diffPp = foodCostDiffPp(input.foodCostPct, input.targetFoodCostPct);
  return {
    ...input,
    diffPp,
    diffLabel: formatDiffPp(diffPp),
  };
}

/** Sort by overage descending, stable name tie-break. */
export function sortOverTargetRows(rows: FoodCostWidgetRow[]): FoodCostWidgetRow[] {
  return [...rows].sort((a, b) => {
    const d = b.diffPp - a.diffPp;
    if (d !== 0) return d;
    return a.recipeName.localeCompare(b.recipeName, "sr");
  });
}
