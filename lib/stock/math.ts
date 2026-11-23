import { APP_NAME } from "@/lib/config/app";
import type {
  BuyListItem,
  SaleDeductionLine,
  StockRow,
  StockStatus,
} from "./types";
import type { RecipeForSale } from "./types";

const belgradeDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Belgrade",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Belgrade calendar date YYYY-MM-DD. */
export function belgradeToday(): string {
  return belgradeDateFormatter.format(new Date());
}

export function effectiveUsedToday(row: Pick<StockRow, "usedToday" | "usedOn">): number {
  return row.usedOn === belgradeToday() ? row.usedToday : 0;
}

export function stockStatus(qty: number, min: number, hasLevel: boolean): StockStatus {
  if (!hasLevel) return "bez";
  if (qty <= 0) return "nestalo";
  if (min > 0 && qty < min) return "nisko";
  return "ok";
}

export function statusRank(status: StockStatus): number {
  switch (status) {
    case "nestalo":
      return 0;
    case "nisko":
      return 1;
    case "bez":
      return 2;
    default:
      return 3;
  }
}

/** Share remaining against the stock before today's sales or twice the minimum, whichever is higher. */
export function stockLevelPercent(qty: number, min: number, usedToday: number): number {
  if (qty <= 0) return 0;
  return (qty / Math.max(min * 2, qty + usedToday)) * 100;
}

/** Restock toward 2× minimum. */
export function buyNeed(qty: number, min: number): number {
  if (min <= 0) return 0;
  return Math.max(0, min * 2 - qty);
}

export function sortStockRows(rows: StockRow[]): StockRow[] {
  return [...rows].sort((a, b) => {
    const sa = stockStatus(a.qty, a.min, a.hasLevel);
    const sb = stockStatus(b.qty, b.min, b.hasLevel);
    const rank = statusRank(sa) - statusRank(sb);
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name, "sr");
  });
}

export function buildBuyList(rows: StockRow[]): BuyListItem[] {
  return sortStockRows(rows)
    .filter((row) => row.hasLevel && row.min > 0 && row.qty < row.min)
    .map((row) => ({
      ingredientId: row.ingredientId,
      name: row.name,
      unit: row.unit,
      qty: row.qty,
      min: row.min,
      need: buyNeed(row.qty, row.min),
    }));
}

export function formatBuyListClipboard(items: BuyListItem[]): string {
  const lines = [`Nabavka — ${APP_NAME}`];
  for (const item of items) {
    lines.push(
      `- ${item.name}: ${formatQty(item.need)} ${item.unit} (sada ${formatQty(item.qty)}, min ${formatQty(item.min)})`
    );
  }
  return lines.join("\n");
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const rounded =
    Math.round(value * Math.pow(10, digits)) / Math.pow(10, digits);
  return String(rounded).replace(".", ",");
}

export function stockValue(rows: StockRow[]): number {
  return rows.reduce(
    (sum, row) => sum + Math.max(0, row.qty) * (row.price || 0),
    0
  );
}

export function usedTodayValue(rows: StockRow[]): number {
  return rows.reduce((sum, row) => {
    const used = effectiveUsedToday(row);
    return sum + used * (row.price || 0);
  }, 0);
}

export function countByStatus(rows: StockRow[]) {
  let nestalo = 0;
  let nisko = 0;
  let bez = 0;
  let withQty = 0;
  for (const row of rows) {
    const status = stockStatus(row.qty, row.min, row.hasLevel);
    if (status === "nestalo") nestalo += 1;
    else if (status === "nisko") nisko += 1;
    else if (status === "bez") bez += 1;
    if (row.hasLevel && row.qty > 0) withQty += 1;
  }
  return { nestalo, nisko, bez, withQty, total: rows.length };
}

export function selectSaleRecipes(
  recipesById: ReadonlyMap<string, { recipe: RecipeForSale; index: number }>,
  portionsByRecipe: Readonly<Record<string, number>>
): RecipeForSale[] {
  const selected = [];
  for (const [id, portions] of Object.entries(portionsByRecipe)) {
    if (portions < 1) continue;
    const entry = recipesById.get(id);
    if (entry) selected.push(entry);
  }
  // Preserve the original order for shared ingredients and food-cost ties.
  return selected.sort((a, b) => a.index - b.index).map(({ recipe }) => recipe);
}

/** Aggregate recipe deductions for N portions of each recipe. */
export function previewSaleDeductions(
  recipes: RecipeForSale[],
  portionsByRecipe: Record<string, number>,
  stockByIngredient: Map<string, StockRow>
): SaleDeductionLine[] {
  const acc = new Map<
    string,
    { name: string; unit: StockRow["unit"]; qty: number; unitCost: number }
  >();

  for (const recipe of recipes) {
    const portions = Math.max(0, Math.floor(portionsByRecipe[recipe.id] ?? 0));
    if (portions <= 0) continue;
    for (const item of recipe.items) {
      const add = item.quantity * portions;
      if (add <= 0) continue;
      const existing = acc.get(item.ingredientId);
      const stock = stockByIngredient.get(item.ingredientId);
      if (existing) {
        existing.qty += add;
      } else {
        acc.set(item.ingredientId, {
          name: item.name,
          unit: item.unit,
          qty: add,
          unitCost: stock?.price ?? 0,
        });
      }
    }
  }

  const lines: SaleDeductionLine[] = [];
  for (const [ingredientId, row] of acc) {
    const stock = stockByIngredient.get(ingredientId);
    const before = stock?.hasLevel ? stock.qty : 0;
    lines.push({
      ingredientId,
      name: row.name,
      unit: row.unit,
      qty: row.qty,
      before,
      after: before - row.qty,
      unitCost: row.unitCost,
    });
  }

  return lines.sort((a, b) => a.name.localeCompare(b.name, "sr"));
}
