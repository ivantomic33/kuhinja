/**
 * Deterministic food-cost remediation suggestions (no AI, not persisted).
 */

export type CostShareIngredient = {
  id: string;
  name: string;
  /** Absolute contribution to batch or portion cost (same basis for all rows). */
  cost: number;
};

export type PriceSuggestion = {
  /** Net selling price that restores food cost to the target %. */
  suggestedNetPrice: number;
  portionCost: number;
  targetFoodCostPct: number;
};

export type IngredientShareSuggestion = {
  id: string;
  name: string;
  cost: number;
  sharePct: number;
};

/** Round money up to 2 decimal places (ceiling). */
export function ceilMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value * 100 - 1e-9) / 100;
}

/**
 * Net price that hits target food-cost %:
 * portionCost / (target / 100), rounded **up** to 2 decimals.
 */
export function suggestedNetPriceForTarget(
  portionCost: number,
  targetFoodCostPct: number,
): number {
  if (!Number.isFinite(portionCost) || portionCost < 0) return 0;
  if (!Number.isFinite(targetFoodCostPct) || targetFoodCostPct <= 0 || targetFoodCostPct > 100) {
    return 0;
  }
  return ceilMoney((portionCost * 100) / targetFoodCostPct);
}

export function buildPriceSuggestion(
  portionCost: number,
  targetFoodCostPct: number,
): PriceSuggestion {
  return {
    portionCost,
    targetFoodCostPct,
    suggestedNetPrice: suggestedNetPriceForTarget(portionCost, targetFoodCostPct),
  };
}

/**
 * Highest cost share; ties broken by name (locale-independent UTF-16 order) then id.
 */
export function mostExpensiveIngredientShare(
  ingredients: readonly CostShareIngredient[],
): IngredientShareSuggestion | null {
  if (ingredients.length === 0) return null;

  const total = ingredients.reduce((sum, row) => sum + (Number.isFinite(row.cost) ? row.cost : 0), 0);
  const sorted = [...ingredients].sort((a, b) => {
    const costDiff = b.cost - a.cost;
    if (costDiff !== 0) return costDiff;
    const nameDiff = a.name.localeCompare(b.name, "en");
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id, "en");
  });

  const top = sorted[0];
  return {
    id: top.id,
    name: top.name,
    cost: top.cost,
    sharePct: total > 0 ? (top.cost / total) * 100 : 0,
  };
}

/** Difference in percentage points from displayed values (1 decimal). */
export function foodCostDiffPp(foodCostPct: number, targetFoodCostPct: number): number {
  if (!Number.isFinite(foodCostPct) || !Number.isFinite(targetFoodCostPct)) return 0;
  return Math.round((foodCostPct - targetFoodCostPct) * 10) / 10;
}

export function formatDiffPp(diffPp: number): string {
  const abs = Math.abs(diffPp).toFixed(1).replace(".", ",");
  if (diffPp > 0) return `+${abs} p.p.`;
  if (diffPp < 0) return `−${abs} p.p.`;
  return `±${abs} p.p.`;
}
