import {
  ALLERGEN_CODES,
  type AllergenCode,
  type AllergenPresence,
} from "./catalog";

export type AllergenItemInput = {
  code: AllergenCode;
  presence: AllergenPresence;
};

/**
 * Deduplicate allergen rows. When the same code appears as both contains and
 * trace, contains wins. Later duplicate of the same presence is ignored.
 */
export function dedupeAllergenItems(
  items: readonly AllergenItemInput[],
): AllergenItemInput[] {
  const map = new Map<AllergenCode, AllergenPresence>();
  for (const item of items) {
    const current = map.get(item.code);
    if (!current) {
      map.set(item.code, item.presence);
      continue;
    }
    if (current === "trace" && item.presence === "contains") {
      map.set(item.code, "contains");
    }
  }
  return ALLERGEN_CODES.filter((code) => map.has(code)).map((code) => ({
    code,
    presence: map.get(code)!,
  }));
}

/**
 * Aggregate presence across ingredient rows for one allergen code.
 * contains beats trace; empty list → null (absent).
 */
export function aggregatePresence(
  values: readonly AllergenPresence[],
): AllergenPresence | null {
  if (values.length === 0) return null;
  if (values.some((value) => value === "contains")) return "contains";
  return "trace";
}

export type IngredientAllergenRow = {
  ingredientId: string;
  code: AllergenCode;
  presence: AllergenPresence;
};

export type RecipeMatrixCell = {
  ingredientId: string;
  code: AllergenCode;
  presence: AllergenPresence | null;
};

/**
 * Build per-ingredient cells and recipe totals from flat allergen rows.
 */
export function buildRecipeAllergenMatrix(
  ingredientIds: readonly string[],
  rows: readonly IngredientAllergenRow[],
): {
  cells: RecipeMatrixCell[];
  totals: { code: AllergenCode; presence: AllergenPresence }[];
} {
  const byIngredient = new Map<string, Map<AllergenCode, AllergenPresence>>();
  for (const row of rows) {
    let map = byIngredient.get(row.ingredientId);
    if (!map) {
      map = new Map();
      byIngredient.set(row.ingredientId, map);
    }
    const current = map.get(row.code);
    if (!current || (current === "trace" && row.presence === "contains")) {
      map.set(row.code, row.presence);
    }
  }

  const cells: RecipeMatrixCell[] = [];
  const totalBuckets = new Map<AllergenCode, AllergenPresence[]>();

  for (const ingredientId of ingredientIds) {
    const map = byIngredient.get(ingredientId) ?? new Map();
    for (const code of ALLERGEN_CODES) {
      const presence = map.get(code) ?? null;
      cells.push({ ingredientId, code, presence });
      if (presence) {
        const bucket = totalBuckets.get(code) ?? [];
        bucket.push(presence);
        totalBuckets.set(code, bucket);
      }
    }
  }

  const totals = ALLERGEN_CODES.flatMap((code) => {
    const presence = aggregatePresence(totalBuckets.get(code) ?? []);
    return presence ? [{ code, presence }] : [];
  });

  return { cells, totals };
}

export function presenceSymbol(presence: AllergenPresence | null): string {
  if (presence === "contains") return "S";
  if (presence === "trace") return "T";
  return "";
}

export function presenceAriaLabel(presence: AllergenPresence | null): string {
  if (presence === "contains") return "sadrži";
  if (presence === "trace") return "u tragovima";
  return "nema";
}
