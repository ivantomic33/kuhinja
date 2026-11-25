import { createClient } from "@/lib/supabase/client";
import { entitlementSchema } from "@/lib/billing/entitlements";
import { restockIngredientPriceSchema } from "@/lib/schemas/stock";
import { belgradeToday } from "./math";
import type {
  SaleDeductionLine,
  StockMove,
  StockMoveType,
  StockRow,
  WriteOffReason,
} from "./types";

type LevelRow = {
  id: string;
  venue_id: string;
  ingredient_id: string;
  qty: number | string;
  min_qty: number | string;
  used_today: number | string;
  used_on: string;
};

const LEVEL_COLUMNS =
  "id, venue_id, ingredient_id, qty, min_qty, used_today, used_on" as const;

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function mapMove(row: {
  id: string;
  venue_id: string;
  ingredient_id: string;
  type: string;
  qty_delta: number | string;
  unit_cost: number | string | null;
  reason: string | null;
  note: string | null;
  sale_id: string | null;
  user_id: string | null;
  undone: boolean;
  created_at: string;
  ingredients?: { name?: string } | null;
}): StockMove {
  return {
    id: row.id,
    venueId: row.venue_id,
    ingredientId: row.ingredient_id,
    type: row.type as StockMoveType,
    qtyDelta: num(row.qty_delta),
    unitCost: row.unit_cost == null ? null : num(row.unit_cost),
    reason: row.reason,
    note: row.note,
    saleId: row.sale_id,
    userId: row.user_id,
    undone: Boolean(row.undone),
    createdAt: row.created_at,
    ingredientName: row.ingredients?.name,
  };
}

/** One round-trip load of stock_levels for many ingredients. */
async function loadLevelsMap(
  venueId: string,
  ingredientIds: string[]
): Promise<Map<string, LevelRow>> {
  const map = new Map<string, LevelRow>();
  const ids = uniqueIds(ingredientIds);
  if (ids.length === 0) return map;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("stock_levels")
    .select(LEVEL_COLUMNS)
    .eq("venue_id", venueId)
    .in("ingredient_id", ids);

  if (error) throw error;
  for (const row of data ?? []) {
    map.set((row as LevelRow).ingredient_id, row as LevelRow);
  }
  return map;
}

/** Reset used_today for stale calendar days in one request. */
async function refreshUsedTodayBatch(
  levels: Map<string, LevelRow>
): Promise<Map<string, LevelRow>> {
  const today = belgradeToday();
  const stale = [...levels.values()].filter((level) => level.used_on !== today);
  if (stale.length === 0) return levels;

  const supabase = createClient();
  const { data: refreshed, error } = await supabase
    .from("stock_levels")
    .update({ used_today: 0, used_on: today })
    .in("id", stale.map((level) => level.id))
    .neq("used_on", today)
    .select(LEVEL_COLUMNS);
  if (error) throw error;

  let current: LevelRow[] = refreshed;
  if (refreshed.length !== stale.length) {
    // Another client may have already reset some rows and recorded today's usage.
    const latest = await loadLevelsMap(stale[0].venue_id, stale.map((level) => level.ingredient_id));
    current = [...latest.values()];
  }
  if (current.length !== stale.length) throw new Error("level-missing");

  for (const row of current) {
    levels.set(row.ingredient_id, row);
  }
  return levels;
}

/**
 * Ensure stock_levels rows exist for all ingredient ids.
 * 1 select + optional batch insert + optional day-roll updates.
 */
async function ensureLevels(
  venueId: string,
  ingredientIds: string[],
  defaults?: Map<string, { min?: number; qty?: number }>
): Promise<Map<string, LevelRow>> {
  const ids = uniqueIds(ingredientIds);
  const map = await loadLevelsMap(venueId, ids);
  const missing = ids.filter((id) => !map.has(id));

  if (missing.length > 0) {
    const supabase = createClient();
    const today = belgradeToday();
    const { data: inserted, error } = await supabase
      .from("stock_levels")
      .insert(
        missing.map((ingredientId) => ({
          venue_id: venueId,
          ingredient_id: ingredientId,
          qty: defaults?.get(ingredientId)?.qty ?? 0,
          min_qty: defaults?.get(ingredientId)?.min ?? 0,
          used_today: 0,
          used_on: today,
        }))
      )
      .select(LEVEL_COLUMNS);

    if (error) throw error;
    for (const row of inserted ?? []) {
      map.set((row as LevelRow).ingredient_id, row as LevelRow);
    }
  }

  return refreshUsedTodayBatch(map);
}

export async function fetchStockMoves(options: {
  venueId: string;
  ingredientId?: string;
  limit?: number;
}): Promise<StockMove[]> {
  const supabase = createClient();
  let query = supabase
    .from("stock_moves")
    .select(
      "id, venue_id, ingredient_id, type, qty_delta, unit_cost, reason, note, sale_id, user_id, undone, created_at, ingredients ( name )"
    )
    .eq("venue_id", options.venueId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  if (options.ingredientId) {
    query = query.eq("ingredient_id", options.ingredientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapMove(row as Parameters<typeof mapMove>[0]));
}

export type RestockLineInput = {
  ingredientId: string;
  qty: number;
  min?: number;
  unitCost?: number | null;
};

export async function applyRestock(options: {
  venueId: string;
  lines: RestockLineInput[];
  userId?: string | null;
  updatePrices?: boolean;
  /** When set, block creating brand-new stock rows past this cap. */
  maxStockItems?: number;
}): Promise<void> {
  const supabase = createClient();
  const lines = options.lines.filter((line) => line.qty > 0);
  if (lines.length === 0) throw new Error("empty");
  const prices = options.updatePrices
    ? lines.filter((line) => line.unitCost != null).map((line) =>
        restockIngredientPriceSchema.parse({
          ingredientId: line.ingredientId,
          newPrice: line.unitCost,
        })
      )
    : [];

  if (lines.some((line) => line.unitCost != null)) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error("UNAUTHORIZED");
    const { data, error } = await supabase.rpc("get_entitlements", { p_user_id: user.id });
    if (error) throw error;
    if (!entitlementSchema.safeParse(data).data?.features.stockRestock) throw new Error("UPGRADE_REQUIRED");
  }

  if (
    options.maxStockItems != null &&
    Number.isFinite(options.maxStockItems)
  ) {
    const { data: existingLevels, error: existingError } = await supabase
      .from("stock_levels")
      .select("ingredient_id")
      .eq("venue_id", options.venueId);
    if (existingError) throw existingError;

    const existingIds = new Set(
      (existingLevels ?? []).map((row) => row.ingredient_id as string)
    );
    const newIds = new Set(
      lines
        .map((line) => line.ingredientId)
        .filter((id) => id && !existingIds.has(id))
    );
    if (existingIds.size + newIds.size > options.maxStockItems) {
      throw new Error(
        `FREE_LIMIT_STOCK_ITEMS: maximum ${options.maxStockItems} stock items per venue`
      );
    }
  }

  const defaults = new Map<string, { min?: number; qty?: number }>();
  for (const line of lines) {
    if (line.min != null && Number.isFinite(line.min)) {
      defaults.set(line.ingredientId, { min: line.min });
    }
  }

  const levels = await ensureLevels(
    options.venueId,
    lines.map((line) => line.ingredientId),
    defaults
  );

  // Parallel level updates (unique ingredients expected from UI).
  await Promise.all(
    lines.map(async (line) => {
      const level = levels.get(line.ingredientId);
      if (!level) throw new Error("level-missing");
      const nextQty = num(level.qty) + line.qty;
      const nextMin =
        line.min != null && Number.isFinite(line.min)
          ? Math.max(0, line.min)
          : num(level.min_qty);

      const { error: updateError } = await supabase
        .from("stock_levels")
        .update({ qty: nextQty, min_qty: nextMin })
        .eq("id", level.id);
      if (updateError) throw updateError;

      // Keep local map coherent if the same id appears twice.
      level.qty = nextQty;
      level.min_qty = nextMin;
    })
  );

  const { error: moveError } = await supabase.from("stock_moves").insert(
    lines.map((line) => ({
      venue_id: options.venueId,
      ingredient_id: line.ingredientId,
      type: "dopuna" as const,
      qty_delta: line.qty,
      unit_cost: line.unitCost ?? null,
      user_id: options.userId ?? null,
    }))
  );
  if (moveError) throw moveError;

  for (const { ingredientId, newPrice, note } of prices) {
    const { error } = await supabase.rpc("restock_ingredient", {
      p_ingredient_id: ingredientId,
      p_new_price: newPrice,
      p_note: note,
    });
    if (error) throw error;
  }
}

export async function applySale(options: {
  venueId: string;
  lines: SaleDeductionLine[];
  userId?: string | null;
  allowNegative?: boolean;
}): Promise<{ saleId: string }> {
  const supabase = createClient();
  if (options.lines.length === 0) throw new Error("empty");

  if (!options.allowNegative) {
    const negatives = options.lines.filter((line) => line.after < 0);
    if (negatives.length > 0) {
      throw new Error("negative");
    }
  }

  const saleId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sale-${Date.now()}`;

  const levels = await ensureLevels(
    options.venueId,
    options.lines.map((line) => line.ingredientId)
  );
  const today = belgradeToday();

  await Promise.all(
    options.lines.map(async (line) => {
      const level = levels.get(line.ingredientId);
      if (!level) throw new Error("level-missing");
      const before = num(level.qty);
      const nextQty = before - line.qty;
      const nextUsed = num(level.used_today) + line.qty;

      const { error: updateError } = await supabase
        .from("stock_levels")
        .update({
          qty: nextQty,
          used_today: nextUsed,
          used_on: today,
        })
        .eq("id", level.id);
      if (updateError) throw updateError;
    })
  );

  const { error: moveError } = await supabase.from("stock_moves").insert(
    options.lines.map((line) => ({
      venue_id: options.venueId,
      ingredient_id: line.ingredientId,
      type: "prodaja" as const,
      qty_delta: -line.qty,
      unit_cost: line.unitCost,
      sale_id: saleId,
      user_id: options.userId ?? null,
    }))
  );
  if (moveError) throw moveError;

  return { saleId };
}

export async function undoSale(options: {
  venueId: string;
  saleId: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: moves, error } = await supabase
    .from("stock_moves")
    .select("id, ingredient_id, qty_delta, undone")
    .eq("venue_id", options.venueId)
    .eq("sale_id", options.saleId)
    .eq("type", "prodaja");

  if (error) throw error;
  const active = (moves ?? []).filter((row) => !row.undone);
  if (active.length === 0) return;

  const levels = await ensureLevels(
    options.venueId,
    active.map((move) => move.ingredient_id as string)
  );

  await Promise.all(
    active.map(async (move) => {
      const restore = Math.abs(num(move.qty_delta));
      const level = levels.get(move.ingredient_id as string);
      if (!level) throw new Error("level-missing");
      const nextQty = num(level.qty) + restore;
      const nextUsed = Math.max(0, num(level.used_today) - restore);

      // Keep map coherent when multiple moves hit the same ingredient.
      level.qty = nextQty;
      level.used_today = nextUsed;

      const { error: updateError } = await supabase
        .from("stock_levels")
        .update({ qty: nextQty, used_today: nextUsed })
        .eq("id", level.id);
      if (updateError) throw updateError;
    })
  );

  const { error: flagError } = await supabase
    .from("stock_moves")
    .update({ undone: true })
    .in(
      "id",
      active.map((move) => move.id as string)
    );
  if (flagError) throw flagError;
}

export async function applyWriteOff(options: {
  venueId: string;
  ingredientId: string;
  qty: number;
  reason: WriteOffReason;
  note?: string;
  userId?: string | null;
  unitCost?: number;
}): Promise<void> {
  if (options.qty <= 0) throw new Error("empty");
  const { error } = await createClient().rpc("record_stock_adjustment", {
    p_venue_id: options.venueId,
    p_type: "otpis",
    p_lines: [{
      ingredient_id: options.ingredientId,
      qty: options.qty,
      reason: options.reason,
      note: options.note,
      unit_cost: options.unitCost,
    }],
  });
  if (error) throw error;
}

export type InventoryLineInput = {
  ingredientId: string;
  counted: number;
  unitCost?: number;
};

export async function applyInventory(options: {
  venueId: string;
  lines: InventoryLineInput[];
  userId?: string | null;
}): Promise<void> {
  if (options.lines.length === 0) throw new Error("empty");
  const { error } = await createClient().rpc("record_stock_adjustment", {
    p_venue_id: options.venueId,
    p_type: "korekcija",
    p_lines: options.lines.map((line) => ({
      ingredient_id: line.ingredientId,
      qty: line.counted,
      unit_cost: line.unitCost,
    })),
  });
  if (error) throw error;
}

export async function removeStockLevel({ venueId, levelId }: {
  venueId: string;
  levelId: string;
}): Promise<void> {
  const { error } = await createClient()
    .from("stock_levels")
    .delete()
    .eq("venue_id", venueId)
    .eq("id", levelId);
  if (error) throw error;
}

export async function updateStockMin(options: {
  levelId: string;
  min: number;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("stock_levels")
    .update({ min_qty: Math.max(0, options.min) })
    .eq("id", options.levelId);
  if (error) throw error;
}

/** Merge ingredients + stock_levels into display rows. */
export function mergeStockRows(options: {
  venueId: string;
  ingredients: Array<{
    id: string;
    name: string;
    unit: StockRow["unit"];
    price: number;
  }>;
  levels: Array<{
    id: string;
    venue_id: string;
    ingredient_id: string;
    qty: number | string;
    min_qty: number | string;
    used_today: number | string;
    used_on: string;
  }>;
}): StockRow[] {
  const byIngredient = new Map(
    options.levels.map((level) => [level.ingredient_id, level])
  );
  const today = belgradeToday();

  return options.ingredients.map((ing) => {
    const level = byIngredient.get(ing.id);
    if (!level) {
      return {
        id: `virtual-${ing.id}`,
        venueId: options.venueId,
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        qty: 0,
        min: 0,
        price: ing.price,
        usedToday: 0,
        usedOn: today,
        hasLevel: false,
      };
    }
    return {
      id: level.id,
      venueId: level.venue_id,
      ingredientId: level.ingredient_id,
      name: ing.name,
      unit: ing.unit,
      qty: num(level.qty),
      min: num(level.min_qty),
      price: ing.price,
      usedToday: num(level.used_today),
      usedOn: level.used_on,
      hasLevel: true,
    };
  });
}
