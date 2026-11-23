"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Badge } from "@/components/ui/Badge";
import { stockSr as t } from "@/lib/i18n/stock";
import { fetchStockMoves } from "@/lib/stock/actions";
import { formatQty } from "@/lib/stock/math";
import type { StockMove, StockMoveType } from "@/lib/stock/types";
import { formatShortDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

function typeLabel(type: StockMoveType): string {
  switch (type) {
    case "dopuna":
      return t.moveDopuna;
    case "prodaja":
      return t.moveProdaja;
    case "otpis":
      return t.moveOtpis;
    case "korekcija":
      return t.moveKorekcija;
  }
}

function typeVariant(
  type: StockMoveType
): "success" | "danger" | "warning" | "neutral" {
  switch (type) {
    case "dopuna":
      return "success";
    case "prodaja":
      return "danger";
    case "otpis":
      return "warning";
    default:
      return "neutral";
  }
}

export type HistorySheetProps = {
  open: boolean;
  onClose: () => void;
  venueId: string;
  ingredientId?: string | null;
  ingredientName?: string | null;
};

export function HistorySheet({
  open,
  onClose,
  venueId,
  ingredientId,
  ingredientName,
}: HistorySheetProps) {
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !venueId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchStockMoves({
      venueId,
      ingredientId: ingredientId ?? undefined,
      limit: 40,
    })
      .then((rows) => {
        if (!cancelled) setMoves(rows);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, venueId, ingredientId]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.historyTitle}
      description={ingredientName ?? undefined}
      size="md"
    >
      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-text-2">…</p>
        ) : error ? (
          <p className="text-sm text-danger">{t.loadError}</p>
        ) : moves.length === 0 ? (
          <p className="text-sm text-text-2">
            {ingredientId ? t.historyEmpty : t.historyGlobalEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {moves.map((move) => {
              const positive = move.qtyDelta >= 0;
              return (
                <li
                  key={move.id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3 py-3",
                    move.undone && "opacity-50"
                  )}
                >
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={typeVariant(move.type)}>
                        {typeLabel(move.type)}
                      </Badge>
                      {move.undone ? (
                        <Badge variant="neutral">{t.moveUndone}</Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-sm font-medium text-text">
                      {move.ingredientName ?? ingredientName ?? "—"}
                    </p>
                    <p className="text-ui-xs text-text-3">
                      {formatShortDate(move.createdAt)}
                      {move.reason ? ` · ${move.reason}` : ""}
                      {move.note ? ` · ${move.note}` : ""}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      positive ? "text-success" : "text-danger"
                    )}
                  >
                    {positive ? "+" : ""}
                    {formatQty(move.qtyDelta)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}
