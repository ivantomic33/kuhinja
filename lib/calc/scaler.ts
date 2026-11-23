/**
 * Pure batch-scaling helpers.
 * Keep intermediates unrounded; format only at the display boundary.
 */

export type ScalerUnit = "g" | "kg" | "ml" | "l" | "kom" | "pak";

export type ScalingMode = "linear" | "sublinear";

export type ScalerIngredientInput = {
  id: string;
  name: string;
  quantity: number;
  unit: ScalerUnit;
  /** Defaults to linear when omitted */
  scaling?: ScalingMode;
  /**
   * Purchase package size in the same unit as `quantity`/`unit`
   * (after normalizing display unit family). Must be > 0.
   */
  packageSize: number;
};

export type ScaledIngredient = {
  id: string;
  name: string;
  /** Base recipe quantity */
  baseQuantity: number;
  /** Scaled quantity in the same unit as `unit` */
  scaledQuantity: number;
  unit: ScalerUnit;
  scaling: ScalingMode;
  packageSize: number;
};

export type DisplayQuantity = {
  /** Numeric part ready for UI */
  value: number;
  /** Unit key or human label token */
  unit: string;
  /** Full copy-friendly label, e.g. "1,25 kg" */
  label: string;
};

export type OvenCapacityInput = {
  totalPieces: number;
  capacity: number;
  baseTime: number;
};

export type OvenCapacityResult = {
  cycles: number;
  totalTime: number;
};

export type ShoppingListItem = {
  id: string;
  name: string;
  /** Quantity to buy (rounded up to whole packages), in `unit` */
  buyQuantity: number;
  unit: ScalerUnit;
  /** Number of packages to purchase */
  packages: number;
  packageSize: number;
  display: DisplayQuantity;
};

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 500;
export const SUBLINEAR_EXPONENT = 0.8;

const TSP_ML = 5;
const TBSP_ML = 15;

/** Clamp target servings into the supported 1–500 range. */
export function clampServings(value: number): number {
  if (!Number.isFinite(value)) return MIN_SERVINGS;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(value)));
}

/**
 * factor = targetServings / baseServings
 * Returns 0 when base is invalid.
 */
export function scaleFactor(targetServings: number, baseServings: number): number {
  if (!Number.isFinite(targetServings) || !Number.isFinite(baseServings)) {
    return 0;
  }
  if (baseServings <= 0) return 0;
  if (targetServings <= 0) return 0;
  return targetServings / baseServings;
}

/**
 * Linear: quantity × factor
 * Sublinear: quantity × factor^0.8
 */
export function scaleQuantity(
  quantity: number,
  factor: number,
  scaling: ScalingMode = "linear"
): number {
  if (!Number.isFinite(quantity) || quantity < 0) return 0;
  if (!Number.isFinite(factor) || factor < 0) return 0;

  if (scaling === "sublinear") {
    return quantity * Math.pow(factor, SUBLINEAR_EXPONENT);
  }
  return quantity * factor;
}

/** Scale a full ingredient list by the given factor. */
export function scaleIngredients(
  ingredients: readonly ScalerIngredientInput[],
  factor: number
): ScaledIngredient[] {
  return ingredients.map((item) => {
    const scaling = item.scaling ?? "linear";
    return {
      id: item.id,
      name: item.name,
      baseQuantity: item.quantity,
      scaledQuantity: scaleQuantity(item.quantity, factor, scaling),
      unit: item.unit,
      scaling,
      packageSize: item.packageSize > 0 ? item.packageSize : 1,
    };
  });
}

function roundInt(value: number): number {
  return Math.round(value);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function formatSrNumber(value: number, fractionDigits: number): string {
  return new Intl.NumberFormat("sr-Latn", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function toGrams(quantity: number, unit: ScalerUnit): number | null {
  if (unit === "g") return quantity;
  if (unit === "kg") return quantity * 1000;
  return null;
}

function toMl(quantity: number, unit: ScalerUnit): number | null {
  if (unit === "ml") return quantity;
  if (unit === "l") return quantity * 1000;
  return null;
}

/**
 * Weight:
 *  - < 1000 g → grams (integer)
 *  - ≥ 1000 g → kg with 2 decimals
 *
 * Liquids (small quantities):
 *  - 5 ml = 1 teaspoon (kašičica)
 *  - 15 ml = 1 tablespoon (kašika)
 *  - Prefer human-readable units when quantity is small
 *
 * Count units stay as-is with sensible rounding.
 */
export function formatScaledQuantity(
  quantity: number,
  unit: ScalerUnit
): DisplayQuantity {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { value: 0, unit, label: `0 ${unit}` };
  }

  const grams = toGrams(quantity, unit);
  if (grams !== null) {
    if (grams < 1000) {
      const value = Math.max(0, roundInt(grams));
      return { value, unit: "g", label: `${formatSrNumber(value, 0)} g` };
    }
    const value = round2(grams / 1000);
    return { value, unit: "kg", label: `${formatSrNumber(value, 2)} kg` };
  }

  const ml = toMl(quantity, unit);
  if (ml !== null) {
    // Teaspoons for very small amounts
    if (ml > 0 && ml < TBSP_ML) {
      const tsp = round1(ml / TSP_ML);
      return {
        value: tsp,
        unit: "tsp",
        label: `${formatSrNumber(tsp, tsp % 1 === 0 ? 0 : 1)} kaš. (5 ml)`,
      };
    }

    // Tablespoons when still small / near multiples of 15 ml
    if (ml < 100) {
      const tbspExact = ml / TBSP_ML;
      const nearWhole = Math.abs(tbspExact - Math.round(tbspExact)) < 0.08;
      if (ml <= 60 || nearWhole) {
        const tbsp = round1(tbspExact);
        return {
          value: tbsp,
          unit: "tbsp",
          label: `${formatSrNumber(tbsp, tbsp % 1 === 0 ? 0 : 1)} kašika`,
        };
      }
    }

    if (ml < 1000) {
      const value = Math.max(0, roundInt(ml));
      return { value, unit: "ml", label: `${formatSrNumber(value, 0)} ml` };
    }

    const value = round2(ml / 1000);
    return { value, unit: "l", label: `${formatSrNumber(value, 2)} l` };
  }

  // kom / pak
  const whole = quantity >= 10 ? roundInt(quantity) : round1(quantity);
  const digits = whole % 1 === 0 ? 0 : 1;
  return {
    value: whole,
    unit,
    label: `${formatSrNumber(whole, digits)} ${unit}`,
  };
}

/**
 * cycles = ceil(totalPieces / capacity)
 * totalTime = cycles × baseTime
 */
export function calculateOvenCapacity(
  input: OvenCapacityInput
): OvenCapacityResult {
  const { totalPieces, capacity, baseTime } = input;

  if (
    !Number.isFinite(totalPieces) ||
    !Number.isFinite(capacity) ||
    !Number.isFinite(baseTime) ||
    totalPieces <= 0 ||
    capacity <= 0 ||
    baseTime < 0
  ) {
    return { cycles: 0, totalTime: 0 };
  }

  const cycles = Math.ceil(totalPieces / capacity);
  return {
    cycles,
    totalTime: cycles * baseTime,
  };
}

/**
 * packages = ceil(needed / packageSize)
 * buyQuantity = packages × packageSize
 */
export function packagesNeeded(needed: number, packageSize: number): number {
  if (!Number.isFinite(needed) || needed <= 0) return 0;
  if (!Number.isFinite(packageSize) || packageSize <= 0) return 0;
  return Math.ceil(needed / packageSize);
}

/**
 * Merge ingredients by id (fallback: name+unit), sum scaled quantities,
 * then round each line up to whole packages.
 */
export function buildShoppingList(
  ingredients: readonly ScaledIngredient[]
): ShoppingListItem[] {
  type Acc = {
    id: string;
    name: string;
    unit: ScalerUnit;
    packageSize: number;
    scaledQuantity: number;
  };

  const merged = new Map<string, Acc>();

  for (const item of ingredients) {
    if (!Number.isFinite(item.scaledQuantity) || item.scaledQuantity <= 0) {
      continue;
    }

    const key = item.id || `${item.name}::${item.unit}`;
    const existing = merged.get(key);
    if (existing) {
      existing.scaledQuantity += item.scaledQuantity;
      // Keep the larger package size if they differ
      if (item.packageSize > existing.packageSize) {
        existing.packageSize = item.packageSize;
      }
    } else {
      merged.set(key, {
        id: item.id,
        name: item.name,
        unit: item.unit,
        packageSize: item.packageSize > 0 ? item.packageSize : 1,
        scaledQuantity: item.scaledQuantity,
      });
    }
  }

  const list: ShoppingListItem[] = [];

  for (const row of merged.values()) {
    const packages = packagesNeeded(row.scaledQuantity, row.packageSize);
    const buyQuantity = packages * row.packageSize;
    list.push({
      id: row.id,
      name: row.name,
      buyQuantity,
      unit: row.unit,
      packages,
      packageSize: row.packageSize,
      display: formatScaledQuantity(buyQuantity, row.unit),
    });
  }

  return list.sort((a, b) => a.name.localeCompare(b.name, "sr"));
}

/** Plain-text shopping list for clipboard / copy-friendly UI. */
export function formatShoppingListText(
  items: readonly ShoppingListItem[],
  title?: string
): string {
  const lines: string[] = [];
  if (title) {
    lines.push(title);
    lines.push("");
  }

  if (items.length === 0) {
    lines.push("—");
    return lines.join("\n");
  }

  for (const item of items) {
    lines.push(`• ${item.name}: ${item.display.label} (${item.packages} pak)`);
  }

  return lines.join("\n");
}

/** Sensible default package size when the catalog has none. */
export function defaultPackageSize(unit: ScalerUnit): number {
  switch (unit) {
    case "g":
      return 1000;
    case "kg":
      return 1;
    case "ml":
      return 1000;
    case "l":
      return 1;
    case "kom":
      return 1;
    case "pak":
      return 1;
  }
}

/** Full live scale pipeline used by the UI. */
export function calculateBatchScale(input: {
  ingredients: readonly ScalerIngredientInput[];
  baseServings: number;
  targetServings: number;
  ovenCapacity: number;
  baseTime: number;
  /** Pieces to bake; defaults to target servings */
  totalPieces?: number;
}): {
  factor: number;
  targetServings: number;
  scaled: ScaledIngredient[];
  oven: OvenCapacityResult;
  shoppingList: ShoppingListItem[];
} {
  const targetServings = clampServings(input.targetServings);
  const factor = scaleFactor(targetServings, input.baseServings);
  const scaled = scaleIngredients(input.ingredients, factor);
  const totalPieces =
    input.totalPieces !== undefined ? input.totalPieces : targetServings;
  const oven = calculateOvenCapacity({
    totalPieces,
    capacity: input.ovenCapacity,
    baseTime: input.baseTime,
  });
  const shoppingList = buildShoppingList(scaled);

  return { factor, targetServings, scaled, oven, shoppingList };
}
