"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { parseDecimal } from "@/lib/domain/parse";
import { sr } from "@/lib/i18n/sr";
import { stockSr as t } from "@/lib/i18n/stock";
import { applyInventory } from "@/lib/stock/actions";
import { formatQty } from "@/lib/stock/math";
import type { StockRow } from "@/lib/stock/types";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export type InventoryModalProps = {
  open: boolean;
  onClose: () => void;
  venueId: string;
  rows: StockRow[];
  userId?: string | null;
  onSaved: () => void;
};

export function InventoryModal({
  open,
  onClose,
  venueId,
  rows,
  userId,
  onSaved,
}: InventoryModalProps) {
  const { toast } = useToast();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tracked = useMemo(
    () => rows.filter((row) => row.hasLevel).sort((a, b) => a.name.localeCompare(b.name, "sr")),
    [rows]
  );

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const row of tracked) {
      next[row.ingredientId] = String(row.qty);
    }
    setCounts(next);
    setError(null);
    setLoading(false);
  }, [open, tracked]);

  async function handleSave() {
    const lines = tracked
      .map((row) => {
        const counted = parseDecimal(counts[row.ingredientId] ?? "");
        if (counted == null || counted < 0) return null;
        return {
          ingredientId: row.ingredientId,
          counted,
          unitCost: row.price,
        };
      })
      .filter(Boolean) as Array<{
      ingredientId: string;
      counted: number;
      unitCost?: number;
    }>;

    if (lines.length === 0) {
      setError(sr.auth.errors.required);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await applyInventory({ venueId, lines, userId });
      toast(t.inventorySuccess);
      onSaved();
      onClose();
    } catch {
      setError(sr.common.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.inventoryTitle}
      description={t.inventorySub}
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-2">{t.inventoryFoot}</p>
          <div className="flex gap-2">
            <PrimaryButton variant="secondary" onClick={onClose}>
              {sr.common.cancel}
            </PrimaryButton>
            <PrimaryButton
              loading={loading}
              disabled={tracked.length === 0}
              onClick={() => void handleSave()}
            >
              {t.inventorySave}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      {tracked.length === 0 ? (
        <p className="text-sm text-text-2">{t.emptyHint}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-ui-xs text-text-3">
                <th className="px-2 py-2 font-medium">{t.colIngredient}</th>
                <th className="px-2 py-2 font-medium">{t.inventoryExpected}</th>
                <th className="px-2 py-2 font-medium">{t.inventoryActual}</th>
                <th className="px-2 py-2 font-medium">{t.inventoryDelta}</th>
              </tr>
            </thead>
            <tbody>
              {tracked.map((row) => {
                const counted = parseDecimal(counts[row.ingredientId] ?? "");
                const delta =
                  counted == null ? 0 : counted - row.qty;
                const din = delta * (row.price || 0);
                return (
                  <tr key={row.ingredientId} className="border-b border-border/70">
                    <th scope="row" className="px-2 py-3 font-medium text-text">{row.name}</th>
                    <td className="px-2 py-3 tabular-nums text-text-2">
                      {formatQty(row.qty)} {row.unit}
                    </td>
                    <td className="px-2 py-3">
                      <input
                        aria-label={`${t.inventoryActual}: ${row.name} (${row.unit})`}
                        className="field-control w-28 tabular-nums"
                        inputMode="decimal"
                        value={counts[row.ingredientId] ?? ""}
                        onChange={(e) =>
                          setCounts((prev) => ({
                            ...prev,
                            [row.ingredientId]: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td
                      className={cn(
                        "px-2 py-3 tabular-nums font-medium",
                        delta > 0 && "text-success",
                        delta < 0 && "text-danger"
                      )}
                    >
                      {counted == null
                        ? "—"
                        : `${delta > 0 ? "+" : ""}${formatQty(delta)} ${row.unit} · ${formatMoney(din)} ${t.din}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </BottomSheet>
  );
}
