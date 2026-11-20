import { Lock, UtensilsCrossed } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { FOOD_COST_TARGET_MAX, FOOD_COST_TARGET_MIN } from "@/lib/calc/recipe-food-cost";
import { stockSr as t } from "@/lib/i18n/stock";
import { planDisplayName } from "@/lib/plan/entitlements";
import type { summarizeSaleFoodCost } from "@/lib/stock/saleFoodCost";
import { formatMoney, formatPercent } from "@/lib/utils/format";

export function SaleFoodCost({
  summary,
  showDishes,
  onSeePlans,
}: {
  summary: ReturnType<typeof summarizeSaleFoodCost> | null;
  showDishes: boolean;
  onSeePlans: () => void;
}) {
  if (!summary) {
    return (
      <section className="fc-lock-teaser flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-accent">
          <Lock className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
            {t.saleFoodCostTitle}
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-accent">
              {planDisplayName("starter")}
            </span>
          </h3>
          <p className="mt-1 text-sm text-muted">{t.saleFoodCostLock}</p>
          <PrimaryButton className="mt-3" size="sm" onClick={onSeePlans}>
            {t.saleFoodCostPlans}
          </PrimaryButton>
        </div>
      </section>
    );
  }

  const { cost, revenue, percent, dishes } = summary;
  let percentTone: string | undefined;
  if (percent !== null) {
    if (percent > FOOD_COST_TARGET_MAX) percentTone = "text-danger";
    else if (percent >= FOOD_COST_TARGET_MIN) percentTone = "text-success";
  }
  const metrics = [
    { label: t.saleFoodCostSpent, value: `${formatMoney(cost)} ${t.din}` },
    { label: t.saleFoodCostRevenue, value: `${formatMoney(revenue)} ${t.din}` },
    { label: t.saleFoodCostPercent, value: percent === null ? "—" : formatPercent(percent), tone: percentTone },
  ];

  return (
    <>
      <dl className="fc-kpis">
        {metrics.map(({ label, value, tone }) => (
          <div key={label} className="fc-kpi">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`mt-1 text-xl font-semibold tabular-nums ${tone ?? "text-text"}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {showDishes && dishes.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text">{t.saleFoodCostDishes}</h3>
          <ul className="flex flex-col gap-2">
            {dishes.map((dish) => (
              <li key={dish.id} className="fc-dish flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-accent">
                  <UtensilsCrossed className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{dish.name}</p>
                  <p className="text-xs text-muted">
                    {t.saleFoodCostDishPortions.replace("{n}", formatMoney(dish.portions))} · {t.saleFoodCostDishPercent.replace("{percent}", dish.percent === null ? "—" : formatPercent(dish.percent))}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="text-sm font-semibold text-text">{formatMoney(dish.cost)} {t.din}</p>
                  <p className="text-xs text-muted">
                    {t.saleFoodCostDishShare.replace("{share}", formatPercent(dish.share, { fractionDigits: 0 }))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
