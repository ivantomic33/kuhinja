"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { PremiumLock } from "@/components/plan/PremiumLock";
import { FreeLimitSheet } from "@/components/plan/FreeLimitSheet";
import { BentoCard } from "@/components/ui/BentoCard";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type PriceHistoryEntry = {
  id: string;
  ingredientName: string;
  price: number;
  recordedAt: string;
};

export type PriceHistoryProps = {
  entries: PriceHistoryEntry[];
  currencyLabel?: string;
  loadError?: boolean;
};

function formatPrice(value: number, currency: string): string {
  return `${value.toLocaleString("sr-Latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("sr-Latn", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PriceHistory({
  entries,
  currencyLabel = sr.recipes.foodCost.currency,
  loadError = false,
}: PriceHistoryProps) {
  const { isPremium, isLoading } = usePlan();
  const [sheetOpen, setSheetOpen] = useState(false);

  const locked = !isLoading && !isPremium;
  const rows = entries;

  return (
    <>
      <BentoCard
        header={
          <div className="flex items-center gap-1">
            <History className="size-4 text-muted" aria-hidden="true" />
            <h2 className="text-base font-semibold text-text">
              {sr.premium.priceHistoryTitle}
            </h2>
          </div>
        }
      >
        {isLoading ? <p role="status" className="py-4 text-sm text-muted">{sr.common.loading}</p> : loadError ? <p role="alert" className="text-sm text-danger">Istorija cena nije učitana. Proverite vezu i pokušajte ponovo.</p> : <PremiumLock
          locked={locked}
          onUnlock={() => setSheetOpen(true)}
          label={sr.premium.priceHistoryLocked}
        >
          {rows.length === 0 ? (
            <p className="text-sm text-muted">{sr.premium.priceHistoryEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "flex items-center justify-between gap-2",
                    "rounded-[var(--radius-input)] border border-border bg-surface-2 px-2 py-2"
                  )}
                >
                  <div className="min-w-0 flex flex-col">
                    <span className="truncate text-sm font-medium text-text">
                      {row.ingredientName}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDate(row.recordedAt)}
                    </span>
                  </div>
                  <span
                    data-numeric
                    className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-text"
                  >
                    {formatPrice(row.price, currencyLabel)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PremiumLock>}
      </BentoCard>

      <FreeLimitSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        code={null}
      />
    </>
  );
}
