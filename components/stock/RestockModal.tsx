"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { parseDecimal } from "@/lib/domain/parse";
import { sr } from "@/lib/i18n/sr";
import { stockSr as t } from "@/lib/i18n/stock";
import { restockIngredientPriceSchema } from "@/lib/schemas/stock";
import { applyRestock } from "@/lib/stock/actions";
import { formatQty } from "@/lib/stock/math";
import type { StockRow } from "@/lib/stock/types";
import { cn } from "@/lib/utils/cn";

type RowDraft = {
  key: string;
  ingredientId: string;
  qty: string;
  price: string;
};

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function hasInvalidPrice(draft: RowDraft) {
  const qty = parseDecimal(draft.qty);
  return Boolean(draft.ingredientId && qty !== null && qty > 0 && draft.price.trim() &&
    !restockIngredientPriceSchema.safeParse({
      ingredientId: draft.ingredientId,
      newPrice: parseDecimal(draft.price),
    }).success);
}

export type RestockModalProps = {
  open: boolean;
  onClose: () => void;
  venueId: string;
  rows: StockRow[];
  preferIngredientId?: string | null;
  userId?: string | null;
  /** Starter+: allow nabavna cena on save. */
  canSetPrice?: boolean;
  /** Cap on stock_levels rows; unlimited when omitted / non-finite. */
  maxStockItems?: number;
  /** Current count of ingredients that already have a stock row. */
  stockItemCount?: number;
  onLimitReached?: () => void;
  onSaved: () => void;
};

export function RestockModal({
  open,
  onClose,
  venueId,
  rows,
  preferIngredientId,
  userId,
  canSetPrice = true,
  maxStockItems,
  stockItemCount = 0,
  onLimitReached,
  onSaved,
}: RestockModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<RowDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPriceErrors, setShowPriceErrors] = useState(false);
  const formId = useId();

  const limited = maxStockItems != null && Number.isFinite(maxStockItems);
  const canAddNew = !limited || stockItemCount < (maxStockItems as number);
  const selectableRows = useMemo(
    () => (canAddNew ? rows : rows.filter((row) => row.hasLevel)),
    [canAddNew, rows]
  );

  useEffect(() => {
    if (!open) return;
    const pool = selectableRows.length > 0 ? selectableRows : rows;
    const preferred =
      preferIngredientId &&
      pool.some((row) => row.ingredientId === preferIngredientId)
        ? preferIngredientId
        : (pool[0]?.ingredientId ?? "");
    setDrafts([
      {
        key: newKey(),
        ingredientId: preferred,
        qty: "",
        price: "",
      },
    ]);
    setError(null);
    setShowPriceErrors(false);
    setLoading(false);
  }, [open, preferIngredientId, rows, selectableRows]);

  const validCount = useMemo(
    () =>
      drafts.filter((d) => {
        const qty = parseDecimal(d.qty);
        return Boolean(d.ingredientId) && qty != null && qty > 0;
      }).length,
    [drafts]
  );

  const usedIds = useMemo(
    () => new Set(drafts.map((d) => d.ingredientId).filter(Boolean)),
    [drafts]
  );

  const canAddAnotherRow = useMemo(() => {
    const pool = selectableRows.length > 0 ? selectableRows : rows;
    return pool.some((row) => !usedIds.has(row.ingredientId));
  }, [rows, selectableRows, usedIds]);

  function optionsFor(draft: RowDraft): StockRow[] {
    const pool = selectableRows.length > 0 ? selectableRows : rows;
    return pool.filter(
      (row) =>
        row.ingredientId === draft.ingredientId ||
        !usedIds.has(row.ingredientId)
    );
  }

  function updateDraft(key: string, patch: Partial<RowDraft>) {
    setDrafts((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    const pool = selectableRows.length > 0 ? selectableRows : rows;
    const next = pool.find((row) => !usedIds.has(row.ingredientId));
    if (!next) return;
    setDrafts((prev) => [
      ...prev,
      {
        key: newKey(),
        ingredientId: next.ingredientId,
        qty: "",
        price: "",
      },
    ]);
  }

  function removeRow(key: string) {
    setDrafts((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)
    );
  }

  function goUpgrade() {
    toast(t.restockPriceLocked);
    router.push("/premium");
  }

  async function handleSave() {
    if (canSetPrice && drafts.some(hasInvalidPrice)) {
      setError(null);
      setShowPriceErrors(true);
      return;
    }

    const lines = drafts
      .map((d) => {
        const qty = parseDecimal(d.qty);
        const price = parseDecimal(d.price);
        if (!d.ingredientId || qty == null || qty <= 0) return null;
        return {
          ingredientId: d.ingredientId,
          qty,
          unitCost: canSetPrice ? price : null,
        };
      })
      .filter(Boolean) as Array<{
      ingredientId: string;
      qty: number;
      unitCost?: number | null;
    }>;

    if (lines.length === 0) {
      setError(sr.auth.errors.required);
      return;
    }

    if (limited) {
      const existingIds = new Set(
        rows.filter((row) => row.hasLevel).map((row) => row.ingredientId)
      );
      const newIds = new Set(
        lines
          .map((line) => line.ingredientId)
          .filter((id) => id && !existingIds.has(id))
      );
      if (existingIds.size + newIds.size > (maxStockItems as number)) {
        onLimitReached?.();
        setError(t.limitReached.replace("{n}", String(maxStockItems)));
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      await applyRestock({
        venueId,
        lines,
        userId,
        updatePrices: canSetPrice,
        maxStockItems: limited ? maxStockItems : undefined,
      });
      toast(`${t.restockSuccess} (${lines.length})`);
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? "");
      if (message.includes("FREE_LIMIT_STOCK_ITEMS")) {
        onLimitReached?.();
        setError(
          t.limitReached.replace(
            "{n}",
            String(maxStockItems ?? stockItemCount)
          )
        );
      } else {
        setError(sr.common.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.restockTitle}
      description={t.restockSub}
      size="lg"
      className="md:w-[min(100%-32px,820px)]"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p id={`${formId}-count`} className="text-sm tabular-nums text-text-2">
            {validCount === 0
              ? rows.length === 0 ? t.emptyHint : "Izaberi sastojak i unesi količinu veću od nule."
              : `${t.restockCount}: ${validCount}`}
          </p>
          <div className="flex gap-2">
            <PrimaryButton variant="secondary" onClick={onClose}>
              {sr.common.cancel}
            </PrimaryButton>
            <PrimaryButton
              loading={loading}
              disabled={validCount === 0}
              aria-describedby={validCount === 0 ? `${formId}-count` : undefined}
              onClick={() => void handleSave()}
            >
              {t.restockSave}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="restock-list">
        {drafts.map((draft) => {
          const selected = rows.find(
            (r) => r.ingredientId === draft.ingredientId
          );
          const unit = selected?.unit ?? "";
          const pricePlaceholder =
            canSetPrice && selected && selected.price > 0
              ? String(selected.price)
              : t.restockPricePh;
          const options = optionsFor(draft);
          const rowId = `${formId}-${draft.key}`;
          const qty = parseDecimal(draft.qty);
          const invalidQty = Boolean(draft.qty.trim()) && (qty === null || qty <= 0);
          const invalidPrice = canSetPrice && showPriceErrors && hasInvalidPrice(draft);

          return (
            <div key={draft.key} className="restock-row">
              <div className="restock-field restock-ing">
                <label htmlFor={`${rowId}-ingredient`} className="text-ui-xs text-text-2">{t.restockIngredient}</label>
                <select
                  id={`${rowId}-ingredient`}
                  className="field-control"
                  value={draft.ingredientId}
                  onChange={(e) =>
                    updateDraft(draft.key, {
                      ingredientId: e.target.value,
                      price: "",
                    })
                  }
                >
                  {options.map((row) => (
                    <option key={row.ingredientId} value={row.ingredientId}>
                      {row.name}
                    </option>
                  ))}
                </select>
                {selected ? (
                  <p className="restock-hint">
                    {t.restockNow}:{" "}
                    {selected.hasLevel
                      ? `${formatQty(selected.qty)} ${selected.unit}`
                      : "—"}
                    {selected.min > 0
                      ? ` · ${t.buyMin} ${formatQty(selected.min)} ${selected.unit}`
                      : null}
                  </p>
                ) : null}
              </div>

              <div className="restock-field">
                <label htmlFor={`${rowId}-qty`} className="text-ui-xs text-text-2">{t.restockQty}</label>
                <input
                  id={`${rowId}-qty`}
                  aria-invalid={invalidQty || undefined}
                  aria-describedby={invalidQty ? `${rowId}-qty-error` : undefined}
                  className="field-control tabular-nums"
                  inputMode="decimal"
                  value={draft.qty}
                  placeholder="0"
                  onChange={(e) =>
                    updateDraft(draft.key, { qty: e.target.value })
                  }
                />
                {invalidQty ? <p id={`${rowId}-qty-error`} role="alert" className="text-xs text-danger">Unesi količinu veću od nule.</p> : null}
              </div>

              <div className="restock-field">
                <label htmlFor={`${rowId}-unit`} className="text-ui-xs text-text-2">{t.restockUnit}</label>
                <input id={`${rowId}-unit`} className="field-control" value={unit} readOnly />
              </div>

              <div className="restock-field restock-price">
                <label htmlFor={`${rowId}-price`} className="text-ui-xs text-text-2">{t.restockPrice}</label>
                {canSetPrice ? (
                  <input
                    id={`${rowId}-price`}
                    aria-invalid={invalidPrice || undefined}
                    aria-describedby={invalidPrice ? `${rowId}-price-error` : undefined}
                    className="field-control tabular-nums"
                    inputMode="decimal"
                    placeholder={pricePlaceholder}
                    value={draft.price}
                    onChange={(e) =>
                      updateDraft(draft.key, { price: e.target.value })
                    }
                  />
                ) : (
                  <div className="restock-price-lock">
                    <input
                      id={`${rowId}-price`}
                      className="field-control tabular-nums"
                      value=""
                      placeholder={t.restockPricePh}
                      disabled
                      aria-describedby={`${formId}-price-locked`}
                    />
                    <Lock aria-hidden="true" />
                  </div>
                )}
                {invalidPrice ? <p id={`${rowId}-price-error`} role="alert" className="text-xs text-danger">{t.restockPriceError}</p> : null}
              </div>

              <button
                type="button"
                aria-label={sr.common.delete}
                className={cn(
                  "icon-btn restock-remove",
                  drafts.length <= 1 && "invisible pointer-events-none"
                )}
                disabled={drafts.length <= 1}
                onClick={() => removeRow(draft.key)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          className="restock-add"
          onClick={addRow}
          disabled={!canAddAnotherRow}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t.restockAddRow}
        </button>

        {!canSetPrice ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-text-2">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            <span id={`${formId}-price-locked`}>{t.restockPriceLocked}</span>
            <button
              type="button"
              onClick={goUpgrade}
              className="font-semibold text-accent hover:text-accent-hover"
            >
              {t.restockUpgrade}
            </button>
          </p>
        ) : null}

        {!canAddNew ? (
          <p className="text-sm text-text-2">{t.overLimitBanner}</p>
        ) : null}

        {!canAddAnotherRow && drafts.length > 0 ? (
          <p className="text-sm text-text-3">{t.restockNoMore}</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
