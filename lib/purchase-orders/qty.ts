/**
 * Purchase-order quantity helpers (pure — Vitest).
 * Units are the ingredient unit; no cross-unit conversion.
 */

/** Round half-up style to 2 decimal places for pack-less orders. */
export function roundQty2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Ceiling to the next multiple of packSize.
 * packSize must be > 0; otherwise falls back to 2-decimal rounding.
 */
export function ceilToPack(need: number, packSize: number | null | undefined): number {
  const n = Number(need);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const pack = packSize == null ? null : Number(packSize);
  if (pack == null || !Number.isFinite(pack) || pack <= 0) {
    return roundQty2(n);
  }
  const multiples = Math.ceil(n / pack - Number.EPSILON);
  return roundQty2(multiples * pack);
}

/** Gap from current stock up to par (never negative). */
export function parGap(
  parLevel: number | null | undefined,
  currentStock: number | null | undefined,
): number {
  if (parLevel == null || !Number.isFinite(Number(parLevel))) return 0;
  const par = Number(parLevel);
  const cur = Number(currentStock) || 0;
  return Math.max(0, par - cur);
}

/** Gap from on-hand up to min on trebovanje/stock_levels. */
export function trebovanjeGap(
  qty: number | null | undefined,
  minQty: number | null | undefined,
): number {
  const onHand = Number(qty) || 0;
  const min = Number(minQty) || 0;
  if (!Number.isFinite(min) || min <= 0) return 0;
  return Math.max(0, min - onHand);
}

/**
 * Final order qty: max(par gap, trebovanje gap), then pack round.
 * Returns 0 when nothing to order.
 */
export function computeOrderQty(input: {
  parLevel?: number | null;
  currentStock?: number | null;
  trebovanjeQty?: number | null;
  trebovanjeMin?: number | null;
  packSize?: number | null;
  /** Explicit trebovanje need already computed (optional). */
  trebovanjeNeed?: number | null;
}): number {
  const fromPar = parGap(input.parLevel, input.currentStock);
  const fromTreb =
    input.trebovanjeNeed != null
      ? Math.max(0, Number(input.trebovanjeNeed) || 0)
      : trebovanjeGap(input.trebovanjeQty, input.trebovanjeMin);
  const need = Math.max(fromPar, fromTreb);
  return ceilToPack(need, input.packSize);
}

export type OrderLineDraft = {
  ingredientId: string;
  name: string;
  unit: string;
  qty: number;
  supplierId: string | null;
};

/** Group lines by supplier_id (null → separate "Bez dobavljača" bucket). */
export function groupBySupplier<T extends { supplierId: string | null }>(
  lines: T[],
): Map<string | null, T[]> {
  const map = new Map<string | null, T[]>();
  for (const line of lines) {
    const key = line.supplierId ?? null;
    const list = map.get(key) ?? [];
    list.push(line);
    map.set(key, list);
  }
  return map;
}

/**
 * Merge low-stock + trebovanje candidates by ingredient_id.
 * Qty = pack-rounded max(par gap, trebovanje need).
 */
export function mergeOrderCandidates(
  candidates: Array<{
    ingredientId: string;
    name: string;
    unit: string;
    supplierId: string | null;
    parLevel?: number | null;
    currentStock?: number | null;
    packSize?: number | null;
    trebovanjeNeed?: number | null;
  }>,
): OrderLineDraft[] {
  const byId = new Map<
    string,
    {
      ingredientId: string;
      name: string;
      unit: string;
      supplierId: string | null;
      parLevel: number | null;
      currentStock: number;
      packSize: number | null;
      trebovanjeNeed: number;
    }
  >();

  for (const c of candidates) {
    const existing = byId.get(c.ingredientId);
    if (!existing) {
      byId.set(c.ingredientId, {
        ingredientId: c.ingredientId,
        name: c.name,
        unit: c.unit,
        supplierId: c.supplierId ?? null,
        parLevel: c.parLevel ?? null,
        currentStock: Number(c.currentStock) || 0,
        packSize: c.packSize ?? null,
        trebovanjeNeed: Math.max(0, Number(c.trebovanjeNeed) || 0),
      });
      continue;
    }
    existing.trebovanjeNeed = Math.max(
      existing.trebovanjeNeed,
      Math.max(0, Number(c.trebovanjeNeed) || 0),
    );
    if (c.parLevel != null) existing.parLevel = c.parLevel;
    if (c.currentStock != null) existing.currentStock = Number(c.currentStock) || 0;
    if (c.packSize != null) existing.packSize = c.packSize;
    if (c.supplierId != null) existing.supplierId = c.supplierId;
    if (c.name) existing.name = c.name;
  }

  const out: OrderLineDraft[] = [];
  for (const row of byId.values()) {
    const qty = computeOrderQty({
      parLevel: row.parLevel,
      currentStock: row.currentStock,
      packSize: row.packSize,
      trebovanjeNeed: row.trebovanjeNeed,
    });
    if (qty <= 0) continue;
    out.push({
      ingredientId: row.ingredientId,
      name: row.name,
      unit: row.unit,
      qty,
      supplierId: row.supplierId,
    });
  }
  return out;
}
