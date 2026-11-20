/**
 * Pure food-cost calculation helpers.
 * Never round intermediate values — only use `roundDisplay` for UI.
 */

export type CalcUnit = "g" | "kg" | "ml" | "l" | "kom" | "pak";

export type PricingMode = "target_food_cost" | "margin";

export type IngredientLineInput = {
  /** Quantity as entered by the user */
  quantity: number;
  /** Unit of the entered quantity */
  quantityUnit: CalcUnit;
  /** Purchase price per `priceUnit` */
  price: number;
  /** Unit the purchase price is expressed in */
  priceUnit: CalcUnit;
  /** Loss / waste percent (0–100, exclusive of 100) */
  lossPercent: number;
};

export type FoodCostInput = {
  lines: IngredientLineInput[];
  mode: PricingMode;
  /** Target food-cost % or margin %, depending on `mode` */
  percent: number;
  /** VAT percent (e.g. 20) */
  vatPercent: number;
};

export type FoodCostResult = {
  /** Sum of line costs (unrounded) */
  portionCost: number;
  /** Suggested net selling price (unrounded) */
  netPrice: number;
  /** Suggested gross selling price (unrounded) */
  grossPrice: number;
  /** Realized food-cost % from portion / net (unrounded) */
  foodCostPercent: number;
  /** Per-line costs aligned with input lines (unrounded) */
  lineCosts: number[];
};

type UnitFamily = "mass" | "volume" | "kom" | "pak";

/** Convert a quantity into its family base unit (kg, l, kom, pak). */
function toBase(quantity: number, unit: CalcUnit): { value: number; family: UnitFamily } {
  switch (unit) {
    case "g":
      return { value: quantity / 1000, family: "mass" };
    case "kg":
      return { value: quantity, family: "mass" };
    case "ml":
      return { value: quantity / 1000, family: "volume" };
    case "l":
      return { value: quantity, family: "volume" };
    case "kom":
      return { value: quantity, family: "kom" };
    case "pak":
      return { value: quantity, family: "pak" };
  }
}

/** True when quantity can be expressed in the price unit. */
export function areUnitsCompatible(a: CalcUnit, b: CalcUnit): boolean {
  return toBase(1, a).family === toBase(1, b).family;
}

/**
 * Normalize `quantity` from `fromUnit` into `toUnit`.
 * Returns NaN when units are incompatible.
 */
export function normalizeQuantity(
  quantity: number,
  fromUnit: CalcUnit,
  toUnit: CalcUnit
): number {
  if (!Number.isFinite(quantity)) return Number.NaN;
  const from = toBase(quantity, fromUnit);
  const to = toBase(1, toUnit);
  if (from.family !== to.family) return Number.NaN;
  return from.value / to.value;
}

/**
 * effectivePrice = price / (1 - loss / 100)
 */
export function effectivePrice(price: number, lossPercent: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(lossPercent)) {
    return Number.NaN;
  }
  if (lossPercent < 0 || lossPercent >= 100) {
    return Number.NaN;
  }
  return price / (1 - lossPercent / 100);
}

/**
 * lineCost = normalizedQuantity × effectivePrice
 * Units are normalized (g→kg, ml→l) before multiplying.
 */
export function lineCost(input: IngredientLineInput): number {
  const { quantity, quantityUnit, price, priceUnit, lossPercent } = input;

  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (!Number.isFinite(price) || price < 0) return 0;

  const qtyInPriceUnit = normalizeQuantity(quantity, quantityUnit, priceUnit);
  if (!Number.isFinite(qtyInPriceUnit)) return 0;

  const unitPrice = effectivePrice(price, lossPercent);
  if (!Number.isFinite(unitPrice)) return 0;

  return qtyInPriceUnit * unitPrice;
}

/**
 * portionCost = sum of all lineCosts
 */
export function portionCost(lines: readonly IngredientLineInput[]): number {
  return lines.reduce((sum, line) => sum + lineCost(line), 0);
}

/**
 * netPrice from target food-cost %:
 *   portionCost / (target / 100)
 * or from margin %:
 *   portionCost / (1 - margin / 100)
 */
export function netPriceFromMode(
  portion: number,
  mode: PricingMode,
  percent: number
): number {
  if (!Number.isFinite(portion) || portion < 0) return 0;
  if (!Number.isFinite(percent)) return 0;

  if (mode === "target_food_cost") {
    if (percent <= 0 || percent >= 100) return 0;
    // portion / (target/100) — multiply form avoids float noise
    return (portion * 100) / percent;
  }

  // margin: portion / (1 - margin/100)
  if (percent < 0 || percent >= 100) return 0;
  return (portion * 100) / (100 - percent);
}

/**
 * grossPrice = netPrice × (1 + vat / 100)
 */
export function grossPriceFromNet(net: number, vatPercent: number): number {
  if (!Number.isFinite(net) || net < 0) return 0;
  if (!Number.isFinite(vatPercent) || vatPercent < 0) return 0;
  return (net * (100 + vatPercent)) / 100;
}

/**
 * foodCost% = portionCost / netPrice × 100
 */
export function foodCostPercentFromPrices(portion: number, net: number): number {
  if (!Number.isFinite(portion) || !Number.isFinite(net) || net <= 0) return 0;
  return (portion / net) * 100;
}

/** Round only for display — 2 decimal places. */
export function roundDisplay(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Full live calculation pipeline (unrounded intermediates). */
export function calculateFoodCost(input: FoodCostInput): FoodCostResult {
  const lineCosts = input.lines.map((line) => lineCost(line));
  const portion = lineCosts.reduce((sum, cost) => sum + cost, 0);
  const net = netPriceFromMode(portion, input.mode, input.percent);
  const gross = grossPriceFromNet(net, input.vatPercent);
  const foodCostPct = foodCostPercentFromPrices(portion, net);

  return {
    portionCost: portion,
    netPrice: net,
    grossPrice: gross,
    foodCostPercent: foodCostPct,
    lineCosts,
  };
}
