"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { parseDecimal } from "@/lib/domain/parse";
import { sr } from "@/lib/i18n/sr";
import { stockSr as t } from "@/lib/i18n/stock";
import { applyWriteOff } from "@/lib/stock/actions";
import type { StockRow, WriteOffReason } from "@/lib/stock/types";

const REASONS: Array<{ value: WriteOffReason; label: string }> = [
  { value: "pokvareno", label: t.reasonSpoiled },
  { value: "prosuto", label: t.reasonSpilled },
  { value: "hrana-osoblja", label: t.reasonStaff },
  { value: "ostalo", label: t.reasonOther },
];

export type WriteOffModalProps = {
  open: boolean;
  onClose: () => void;
  venueId: string;
  rows: StockRow[];
  userId?: string | null;
  onSaved: () => void;
};

export function WriteOffModal({
  open,
  onClose,
  venueId,
  rows,
  userId,
  onSaved,
}: WriteOffModalProps) {
  const { toast } = useToast();
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<WriteOffReason>("pokvareno");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIngredientId(rows[0]?.ingredientId ?? "");
    setQty("");
    setReason("pokvareno");
    setNote("");
    setError(null);
    setLoading(false);
  }, [open, rows]);

  const selected = rows.find((row) => row.ingredientId === ingredientId);

  async function handleSave() {
    const amount = parseDecimal(qty);
    if (!ingredientId || amount == null || amount <= 0) {
      setError(sr.auth.errors.required);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await applyWriteOff({
        venueId,
        ingredientId,
        qty: amount,
        reason,
        note,
        userId,
        unitCost: selected?.price,
      });
      toast(t.writeOffSuccess);
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
      title={t.writeOffTitle}
      description={t.writeOffSub}
      size="md"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-2">{t.writeOffFoot}</p>
          <div className="flex gap-2">
            <PrimaryButton variant="secondary" onClick={onClose}>
              {sr.common.cancel}
            </PrimaryButton>
            <PrimaryButton loading={loading} onClick={() => void handleSave()}>
              {t.writeOffConfirm}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-ui-xs text-text-2">
          {t.restockIngredient}
          <select
            className="field-control"
            value={ingredientId}
            onChange={(e) => setIngredientId(e.target.value)}
          >
            {rows.map((row) => (
              <option key={row.ingredientId} value={row.ingredientId}>
                {row.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-ui-xs text-text-2">
          {t.writeOffQty}
          <div className="flex gap-2">
            <input
              className="field-control flex-1 tabular-nums"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <span className="flex min-w-12 items-center text-sm text-text-2">
              {selected?.unit ?? ""}
            </span>
          </div>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-ui-xs text-text-2">
            {t.writeOffReason}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REASONS.map((item) => (
              <label
                key={item.value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 text-sm text-text"
              >
                <input
                  type="radio"
                  name="writeoff-reason"
                  checked={reason === item.value}
                  onChange={() => setReason(item.value)}
                />
                {item.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-ui-xs text-text-2">
          {t.writeOffNote}
          <input
            className="field-control"
            placeholder={t.writeOffNotePh}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
