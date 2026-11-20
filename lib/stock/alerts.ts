import { hasMinPlan, type PlanId } from "@/lib/plan/entitlements";
import { effectiveUsedToday } from "./math";
import type { StockRow } from "./types";

export type StockAlertStatus = "bez" | "ok" | "warn" | "crit";

export function classifyStockAlert(
  row: Pick<StockRow, "qty" | "min" | "hasLevel" | "usedToday" | "usedOn">,
  plan: PlanId
): {
  status: StockAlertStatus;
  gone: boolean;
  soon: boolean;
  remainingShifts: number;
} {
  if (!row.hasLevel) {
    return { status: "bez", gone: false, soon: false, remainingShifts: Infinity };
  }

  const canWarn = hasMinPlan(plan, "starter");
  const used = canWarn ? effectiveUsedToday(row) : 0;
  const remainingShifts = used > 0 ? row.qty / used : Infinity;
  const gone = row.qty <= 0;
  const soon = row.qty > 0 && remainingShifts <= 2;
  let status: StockAlertStatus = "ok";

  if (gone || remainingShifts <= 1) {
    status = "crit";
  } else if (soon || (canWarn && row.qty < row.min)) {
    status = "warn";
  }

  return { status, gone, soon, remainingShifts };
}
