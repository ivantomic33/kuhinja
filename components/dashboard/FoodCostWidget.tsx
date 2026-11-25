"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoCard";
import { SectionCardHeader } from "@/components/ui/SectionCardHeader";
import type { FoodCostWidgetRow } from "@/lib/alerts/format";
import { buildPriceSuggestion } from "@/lib/alerts/suggestions";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type FoodCostWidgetProps = {
  rows: FoodCostWidgetRow[];
  /** True when workspace has no selling_price_net on any recipe. */
  missingSellPrices: boolean;
  locked?: boolean;
};

function money(value: number): string {
  return value.toLocaleString("sr-Latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pct(value: number): string {
  return `${value.toLocaleString("sr-Latn", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function FoodCostWidget({
  rows,
  missingSellPrices,
  locked = false,
}: FoodCostWidgetProps) {
  const copy = sr.dashboard.foodCostAlarm;

  return (
    <BentoCard
      dense
      className={cn(locked && "opacity-80")}
      header={
        <SectionCardHeader
          title={copy.title}
          count={rows.length > 0 ? rows.length : undefined}
          singleLine
        />
      }
    >
      {locked ? (
        <p className="text-sm text-text-2">
          {copy.locked}{" "}
          <Link href="/premium#plan-starter" className="font-semibold text-accent hover:underline">
            {copy.unlock}
          </Link>
        </p>
      ) : missingSellPrices && rows.length === 0 ? (
        <div className="flex items-start gap-2 text-sm text-text-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p>{copy.needSellPrice}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-start gap-2 text-sm text-text-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <p>{copy.allOk}</p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => {
            const suggestion = buildPriceSuggestion(row.portionCost, row.targetFoodCostPct);
            return (
              <li key={row.recipeId}>
                <Link
                  href={`/recipes/${row.recipeId}?focus=food-cost`}
                  className="focus-ring flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2 no-underline transition-colors hover:bg-[var(--accent-soft)]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-text">{row.recipeName}</span>
                    <span className="shrink-0 text-ui-xs font-semibold tabular-nums text-danger-text">
                      {row.diffLabel}
                    </span>
                  </span>
                  <span className="text-ui-xs text-text-2 tabular-nums">
                    {money(row.portionCost)} din · prodaja {money(row.sellingPriceNet)} din ·{" "}
                    {pct(row.foodCostPct)} / cilj {pct(row.targetFoodCostPct)}
                  </span>
                  <span className="text-ui-xs text-muted">
                    {copy.suggestPrice} {money(suggestion.suggestedNetPrice)} din
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </BentoCard>
  );
}
