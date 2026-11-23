"use client";

import { useState, type FormEvent } from "react";
import { parseDecimal } from "@/lib/domain/parse";
import { sr } from "@/lib/i18n/sr";
import { stockSr as t } from "@/lib/i18n/stock";
import { updateStockMin } from "@/lib/stock/actions";
import { formatQty } from "@/lib/stock/math";
import type { StockRow } from "@/lib/stock/types";

export function StockMinimum({ row, onSetUp, onSaved }: {
  row: StockRow;
  onSetUp: () => void;
  onSaved: (min: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const min = parseDecimal(value);
    if (min === null || min <= 0) {
      setError(t.minInvalid);
      return;
    }
    setError("");
    setSaving(true);
    try {
      await updateStockMin({ levelId: row.id, min });
      setEditing(false);
      onSaved(min);
    } catch {
      setError(t.minSaveError);
    } finally {
      setSaving(false);
    }
  }

  if (row.hasLevel && row.min > 0) return <>{formatQty(row.min)} {row.unit}</>;

  return editing ? (
    <form onSubmit={save} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          aria-label={`${t.colMin} ${row.name} (${row.unit})`}
          aria-invalid={Boolean(error)}
          className="min-input"
          inputMode="decimal"
          value={value}
          disabled={saving}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            setEditing(false);
            setError("");
          }}
        />
        <button className="btn-set-min" type="submit" disabled={saving}>{sr.common.save}</button>
      </div>
      {error ? <span className="whitespace-normal text-xs text-danger" role="alert">{error}</span> : null}
    </form>
  ) : (
    <button className="btn-set-min" type="button" onClick={row.hasLevel ? () => setEditing(true) : onSetUp}>
      {t.setMin}
    </button>
  );
}
