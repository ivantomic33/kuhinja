import Link from "next/link";
import { LockKeyhole, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  FOOD_COST_FAR_OVER,
  FOOD_COST_TARGET_LABEL,
  FOOD_COST_TARGET_MAX,
  FOOD_COST_TARGET_MID,
  FOOD_COST_TARGET_MIN,
} from "@/lib/calc/recipe-food-cost";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import type { RecipeListItem } from "./RecipesWorkspace";

export function RecipeFoodCostDialog({
  recipe,
  canSeeInsights,
  onClose,
}: {
  recipe?: RecipeListItem;
  canSeeInsights: boolean;
  onClose: () => void;
}) {
  const percent = recipe?.foodCost?.percent ?? null;
  const overTarget = percent !== null && percent > FOOD_COST_TARGET_MAX;
  const farOver = percent !== null && percent >= FOOD_COST_FAR_OVER;
  const inTarget = percent !== null && percent >= FOOD_COST_TARGET_MIN && !overTarget;
  const currentTone = farOver ? "text-danger" : overTarget ? "text-warning" : inTarget ? "text-success" : "text-text";
  const insight = canSeeInsights ? recipe?.foodCost?.insight : null;
  const topIngredient = insight?.ingredients[0];

  let description = "Food cost nije dostupan.";
  if (overTarget) description = "Food cost ovog recepta je iznad cilja.";
  else if (inTarget) description = "Food cost ovog recepta je u ciljnom opsegu.";
  else if (percent !== null) description = "Food cost ovog recepta je ispod ciljnog opsega.";

  return (
    <BottomSheet
      id="modalFcWarn"
      open={Boolean(recipe)}
      onClose={onClose}
      title={recipe?.name}
      description={description}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted">Cilj food cost-a: {FOOD_COST_TARGET_LABEL}</span>
          <div className="flex flex-wrap items-center gap-3">
            {recipe ? (
              <Link href={`/recipes/${recipe.id}`} className="text-sm font-semibold text-muted hover:text-text">
                Kalkulator recepta
              </Link>
            ) : null}
            <PrimaryButton onClick={onClose}>Zatvori</PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="fc-kpis">
          <div className="fc-kpi">
            <dt className="text-sm text-muted">Trenutni food cost</dt>
            <dd className={`mt-1 text-xl font-semibold ${currentTone}`}>{percent === null ? "—" : formatPercent(percent)}</dd>
          </div>
          <div className="fc-kpi">
            <dt className="text-sm text-muted">Cilj</dt>
            <dd className="mt-1 text-xl font-semibold text-text">{FOOD_COST_TARGET_LABEL}</dd>
          </div>
          {canSeeInsights ? (
            <div className="fc-kpi">
              <dt className="text-sm text-muted">Prodajna cena</dt>
              <dd className="mt-1 text-xl font-semibold text-text">
                {recipe && recipe.selling_price > 0 ? `${formatMoney(recipe.selling_price)} din` : "—"}
              </dd>
            </div>
          ) : null}
        </dl>

        {canSeeInsights ? (
          <>
            {topIngredient && topIngredient.cost > 0 ? (
              <div className="culprit flex gap-3 rounded-xl border border-warning/20 bg-[var(--warning-soft)] p-3">
                <TrendingUp className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-text">{topIngredient.name} vuče trošak</h3>
                  <p className="text-sm text-muted">
                    {formatPercent(topIngredient.share, { fractionDigits: 0 })} troška recepta · {formatMoney(topIngredient.price)} din/{topIngredient.unit}
                  </p>
                </div>
              </div>
            ) : null}

            {insight?.ingredients.length ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-text">Udeo sastojaka</h3>
                <ul className="divide-y divide-border rounded-xl border border-border bg-surface-2">
                  {insight.ingredients.map((item) => (
                    <li key={item.id} className="ing-share grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5 text-sm tabular-nums">
                      <span className="break-words text-text">{item.name}</span>
                      <span className="text-muted">{formatPercent(item.share, { fractionDigits: 0 })}</span>
                      <span className="min-w-16 text-right font-semibold text-text">{formatMoney(item.cost)} din</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {insight?.suggestedPrice != null && recipe ? (
              <section className="price-suggest rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-4">
                <h3 className="text-sm font-semibold text-text">Predložena cena na meniju</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                  <del className="text-sm text-muted">{formatMoney(recipe.selling_price)} din</del>
                  <strong className="text-2xl text-accent">{formatMoney(insight.suggestedPrice)} din</strong>
                  <Badge variant={farOver ? "danger" : "warning"}>Iznad cilja</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  Predlog da food cost bude ~{FOOD_COST_TARGET_MID}% (sredina cilja {FOOD_COST_TARGET_LABEL}). Nova cena ≈ trošak ÷ 0,32.
                </p>
              </section>
            ) : inTarget ? (
              <p className="text-sm text-muted">Nova cena nije potrebna.</p>
            ) : null}
          </>
        ) : (
          <section className="fc-lock-teaser">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-accent">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="flex flex-wrap items-center gap-2 font-semibold text-text">
                  Ko vuče trošak i predlog cene <Badge variant="accent">Pro</Badge>
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Vidi koji sastojak najviše utiče na trošak i predloženu cenu da vratiš food cost u cilj.
                </p>
              </div>
            </div>
            <Link
              href="/premium"
              className="mt-3 inline-flex min-h-11 items-center rounded-[10px] bg-accent px-3 text-sm font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
            >
              Pogledaj planove
            </Link>
          </section>
        )}
      </div>
    </BottomSheet>
  );
}
