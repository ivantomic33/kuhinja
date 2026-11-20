import { createClient } from "@/lib/supabase/client";
import { mergeStockRows } from "./actions";
import type { StockRow } from "./types";

export function keepStockSnapshot(current: StockRow[], incoming: StockRow[]) {
  if (current.length !== incoming.length) return incoming;

  const unchanged = current.every((row, index) => {
    const next = incoming[index];
    return row.id === next.id && row.venueId === next.venueId &&
      row.ingredientId === next.ingredientId && row.name === next.name && row.unit === next.unit &&
      row.qty === next.qty && row.min === next.min && row.price === next.price &&
      row.usedToday === next.usedToday && row.usedOn === next.usedOn && row.hasLevel === next.hasLevel;
  });
  return unchanged ? current : incoming;
}

export async function fetchStockRows(venueId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("ingredients")
    .select("id, name, unit, price, stock_levels(id, venue_id, ingredient_id, qty, min_qty, used_today, used_on)")
    .eq("stock_levels.venue_id", venueId)
    .order("name")
    .limit(200);
  if (error) throw error;
  return mergeStockRows({
    venueId,
    ingredients: data.map(({ id, name, unit, price }) => ({ id, name, unit, price: Number(price) || 0 })),
    levels: data.flatMap((ingredient) => ingredient.stock_levels),
  });
}
