# Purchase orders & low stock (P8 F4)

## What trebovanje contains today

Route `/trebovanje` is **not** a separate requisition document table.

It loads:

| Source | Fields used |
| --- | --- |
| `ingredients` | `id`, `venue_id`, `name`, `unit`, `price`, `waste_percent`, `notes` |
| `stock_levels` | `id`, `venue_id`, `ingredient_id`, `qty`, `min_qty`, `used_today`, `used_on` |

Each display row is an **ingredient** joined to an optional stock level (`mergeStockRows`). There is always an `ingredient_id`. Movement history lives in `stock_moves` (`dopuna` / `prodaja` / `otpis` / `korekcija`).

**Implication for PO generation**

- Source **upozorenja / low stock** uses `ingredients.par_level` + `ingredients.current_stock` (new columns; backfilled from `stock_levels.min_qty` / `qty` when present).
- Source **trebovanje** uses `stock_levels` rows where `qty < min_qty`, keyed by `ingredient_id`. Because `ingredient_id` exists, those lines **are** merged with low-stock needs (sum / max rules below) — not free-text shopping lines.

There is no trebovanje line without `ingredient_id` in this codebase.

## Product decisions (locked before code)

### 1. Units and pack size

- Column `ingredients.pack_size numeric(12,3)` nullable, must be `> 0` when set.
- Order quantity base need = `max(0, par_level − current_stock)` (and merged trebovanje need — see generation).
- If `pack_size` is set: round **up** to the next multiple of `pack_size`.
- If `pack_size` is null: round to **2 decimal places**.
- No unit conversion between stock and price units. Mismatched entry is a data error; validation rejects non-positive order qty and invalid numerics. Stock and par are stored in the ingredient’s `unit`.

### 2. Negative stock

- **Default:** `current_stock` must stay `>= 0`.
- `adjust_stock` rejects a decrease that would go below zero.
- Exception reason `greska_popisa` may go negative only after an explicit UI confirmation flag (`allow_negative`); owner decision on whether negative stock is ever allowed long-term remains **open**.
- Direct `UPDATE` of `current_stock` by `authenticated` is revoked; only RPCs change it.

### 3. Low-stock alert threshold (same pattern as F3)

- Kind: `low_stock`. Subject: `ingredient_id`.
- Create alert only when stock **crosses** from `>= par_level` (or first observation) to `< par_level`.
- Partial unique index `(kind, subject_id) WHERE read_at IS NULL` blocks a second unread row.
- After mark-read, if stock stays under par, further decreases do **not** open a new alert until stock returns to `>= par_level` and drops again.
- When stock returns to `>= par_level`, active unread `low_stock` alerts for that ingredient are **auto-marked read** (resolved). This is stricter than F3 food-cost (manual only) and is intentional for stock.

### 4. Ingredient without supplier

- Grouped into a draft PO with `supplier_id IS NULL` (UI label **Bez dobavljača**).
- May copy text or download PDF.
- **Cannot** send email (no `contact_email` on supplier).

### 5. Order number

- Table `order_counters (workspace_id PK, last_number)`.
- `allocate_purchase_order_number` locks the counter row (`FOR UPDATE`), increments, returns the number.
- Never `max(number)+1` without a lock.

### 6. Who can send / manage POs

- **Chef and above** (`is_member(..., 'chef')`): create drafts, edit draft lines, send, receive, adjust stock.
- **Cook:** may **select** suppliers and read stock; **no** purchase-order navigation; ingredient stock is read-only; cannot call adjust / receive / create PO RPCs.

## Plan gates

| Feature key | Free | Starter | Pro+ |
| --- | --- | --- | --- |
| `stockAlerts` / `stock_alerts` | No | Yes | Yes |
| `purchaseOrders` / `purchase_orders` (generate from trebovanje) | No | No | Yes |

- Generate **from alerts / low stock** requires `stock_alerts`.
- Generate **from trebovanje** (or combined source including trebovanje) requires `purchase_orders` (Pro+).
- Flags live in `lib/billing/plans.ts` + `get_entitlements` / `workspace_has_feature`, not hard-coded in components.

## Generation rules

1. Candidates:
   - Low stock: `par_level IS NOT NULL AND current_stock < par_level`.
   - Trebovanje (if allowed): `stock_levels.qty < stock_levels.min_qty`.
2. Merge by `ingredient_id`: need = `max(par_gap, trebovanje_gap)` then pack round. One line per ingredient.
3. One PO per `supplier_id` (null = “Bez dobavljača”).
4. Skip zero qty. Status starts as `nacrt`.
5. After `poslato` / `primljeno`, lines are immutable; create a new PO to change items.

## Sending

| Channel | Behavior |
| --- | --- |
| Copy text | Server formats body; client clipboard. Optional `https://wa.me/<digits>` from supplier phone (digits only). |
| PDF | `GET /api/purchase-orders/[id]/pdf` — **pdf-lib** + `assets/fonts/NotoSans-Regular.ttf` (same as F2 allergens). |
| Email | Edge Function `send-purchase-order`. |

### Email provider

This repo still has **no production mail sender** (same as F3 digest: checks `RESEND_API_KEY` / `SMTP_URL` / `EMAIL_PROVIDER_URL`). When unset:

- UI disables email with an explanation.
- Edge Function returns **501** `email_provider_missing`.
- Do not invent a provider; do not email real suppliers from tests.

### Send idempotency & compensation

1. `UPDATE purchase_orders SET status = 'poslato', sent_at, sent_to WHERE id = $1 AND status = 'nacrt' RETURNING id`.
2. If no row → already sent or not draft → do not send again.
3. Then attempt provider send.
4. If send fails after status flip → set status back to `nacrt`, clear `sent_at` / `sent_to`, return error.

**Rare failure mode:** process dies after successful provider send but before/during compensation logic, or after send with DB unreachable. Ops: inspect provider logs + PO row; prefer manual mark `poslato` over double-send. Documented for owners.

## Receiving

RPC `receive_purchase_order(p_order_id, p_lines jsonb)` — **single transaction**:

1. Lock PO (`FOR UPDATE`). Reject if already `primljeno`.
2. For each line with `qty_received > 0`: stock movement reason `prijem` + increase `current_stock` (and mirror `stock_levels.qty` when a level row exists).
3. If `unit_price_received` set: same price-history + food-cost alert path as `restock_ingredient` (in-process, not a second client RPC).
4. Persist `qty_received` / `unit_price_received` on items.
5. Status `primljeno` only when every item has `qty_received` not null and coverage complete (all lines received); partial receipt stays `poslato`.
6. `qty_received > qty_ordered` allowed in DB; UI asks for confirmation.
7. Any line failure rolls back the whole transaction.
8. Duplicate receive on fully received PO is a no-op error (no double stock).

**Deviation from early task wording:** receiving is **not** “only `restock_ingredient`”. `restock_ingredient` still only updates price + history + food-cost checks. Stock goes through `adjust_stock` / receive path + `stock_movements`.

## Schema additions (summary)

- `suppliers`, `stock_movements`, `purchase_orders`, `purchase_order_items`, `order_counters`
- `ingredients.par_level`, `current_stock`, `pack_size`, `supplier_id`
- `alerts_kind_check` extended with `low_stock` (drop old check, add new — do not edit F3 migration)

## Manual owner steps

1. Enter suppliers (name, email, phone) per workspace.
2. Set `par_level` and optional `pack_size` + `supplier_id` on ingredients.
3. Confirm Starter+ for stock alerts, Pro+ for trebovanje-sourced POs.
4. Decide long-term policy on negative stock / `greska_popisa`.
5. On staging only: test email with a disposable address once a provider is configured.
6. Never run supplier email tests against real vendor inboxes from CI.
