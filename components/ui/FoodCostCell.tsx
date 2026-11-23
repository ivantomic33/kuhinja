import { cn } from "@/lib/utils/cn";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { FOOD_COST_TARGET_MAX, FOOD_COST_TARGET_MIN } from "@/lib/calc/recipe-food-cost";

export type FoodCostCellProps = {
  /** Food cost percent 0–100 */
  percent: number | null | undefined;
  /** Absolute cost in din */
  cost?: number | null;
  className?: string;
};

export function foodCostTone(
  percent: number
): "success" | "neutral" | "danger" {
  if (percent > FOOD_COST_TARGET_MAX) return "danger";
  if (percent < FOOD_COST_TARGET_MIN) return "neutral";
  return "success";
}

export function FoodCostCell({ percent, cost, className }: FoodCostCellProps) {
  if (percent == null || !Number.isFinite(percent)) {
    return <span className={cn("text-text-3", className)}>—</span>;
  }

  const tone = foodCostTone(percent);
  const color =
    tone === "danger"
      ? "var(--danger)"
      : tone === "neutral"
        ? "var(--text-3)"
        : "var(--success)";
  const width = Math.max(0, Math.min(100, percent));

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <span
        className="relative block h-1.5 w-16 overflow-hidden rounded-full bg-surface-3"
        aria-hidden="true"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${width}%`, background: color }}
        />
      </span>
      <span className="font-semibold tabular-nums text-text">
        {formatPercent(percent, { fractionDigits: 0 })}
      </span>
      {cost != null && Number.isFinite(cost) ? (
        <span className="hide-sm text-ui-sm tabular-nums text-text-3">
          {formatMoney(cost, { fractionDigits: 0 })} din
        </span>
      ) : null}
    </div>
  );
}
