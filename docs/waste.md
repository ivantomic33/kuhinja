# Waste log (P8 F5) — evidencija otpada

## Product decisions (locked before code)

### 1. Frozen unit cost at entry

`unit_cost_snapshot` is written once and never updated.

- **Ingredient:** current `ingredients.price` (price per ingredient `unit`).
- **Recipe:** current `recipe_cost_snapshot.portion_cost` (cost per portion). If no snapshot can be computed (no items / unpriced lines), the recipe cannot be selected.
- Past reports are stable when ingredient prices change later.

### 2. Stock is not auto-adjusted

Waste does **not** change stock by default.

- Optional UI checkbox **„Skini i sa zaliha“** (default off).
- When checked and F4 `adjust_stock` exists, RPC calls `adjust_stock(..., reason 'otpad')` in the same transaction.
- Cooks may log waste; stock adjust still requires chef+ inside `adjust_stock` — if the caller is only cook, adjust is refused and the waste row is not inserted (transaction rolls back). UI only shows the checkbox for chef+.

### 3. Recipe waste

`recipe_id` XOR `ingredient_id`. Quantity is number of portions (unit `kom` for recipes). `unit_cost_snapshot` = portion cost at insert time.

### 4. Corrections (owner default)

- No `UPDATE` / `DELETE` on `waste_entries` (trigger blocks everyone, including service_role in normal context).
- Correction = new row: `is_correction = true`, `quantity = −original.quantity`, `reason = 'greška'`, `corrects_entry_id = original.id`.
- Allowed only within **24 hours** of the original and **once** per original (unique index on `corrects_entry_id` where correction).
- Owner may later change the 24h window; left as an open product knob in code comments only.

### 5. Time zone and month bounds

- `created_at` stored in UTC.
- Reports and “current month” use **Europe/Belgrade** calendar dates.
- Example: entry at 2026-04-01 00:30 Europe/Belgrade belongs to April, even if UTC is still March 31.

### 6. Currency and rounding

- Amounts in **RSD**.
- Row storage: `cost_rsd = quantity * unit_cost_snapshot` as `numeric(18,6)` **without** per-row `round`.
- Widget, `waste_report`, and exports all use the same SQL expression: `round(sum(cost_rsd), 2)` (round once at the aggregate).

### 7. Offline unit cost

**Decision:** queue stores **unit cost from IndexedDB cache at capture time** (`unit_cost_snapshot` on the op). On sync, RPC prefers that value when `client_id` is present.

- Rationale: cost should reflect the moment of discard, not a later price edit while offline.
- If cache has no price (or recipe has no portion cost), offline submit is blocked with a clear message.
- Online submits omit client snapshot; server always reads DB.

### 8. CSV format

- UTF-8 **with BOM**
- Separator: **semicolon** (`;`)
- Decimal separator: **comma** (`,`) for numeric fields (sr-Latn Excel)
- Date/time: Europe/Belgrade

### 9. Excel library

**exceljs** (MIT). Chosen over SheetJS community build for clearer license and typed workbook API. Loaded only in the export route / generator (dynamic import) so it stays out of the client bundle. See also `docs/decisions.md`.

### 10. PDF

Same stack as F2/F4: **pdf-lib** + `assets/fonts/NotoSans-Regular.ttf`.

## Plan gates

| Feature key | Free | Starter | Pro+ |
| --- | --- | --- | --- |
| `waste_log` / `wasteLog` | No | Yes | Yes |
| `waste_export_csv` / `wasteExportCsv` | No | Yes | Yes |
| `waste_export_pdf_xlsx` / `wasteExportPdfXlsx` | No | No | Yes |

## Acceptance notes

- Duplicate `client_id` → single row (`ON CONFLICT DO NOTHING` + return existing).
- Export totals for a period must equal `waste_report` net total for the same period.
- Free workspace: RLS hides rows; insert RPC raises `UPGRADE_REQUIRED`.
