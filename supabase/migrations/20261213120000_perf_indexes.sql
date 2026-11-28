-- =============================================================================
-- perf_indexes: FK column indexes missing from earlier migrations.
-- Idempotent — all use CREATE INDEX IF NOT EXISTS.
-- =============================================================================

-- stock_movements.created_by (FK → auth.users)
create index if not exists stock_movements_created_by_idx
  on public.stock_movements (created_by)
  where created_by is not null;

-- waste_entries.created_by (FK → auth.users)
create index if not exists waste_entries_created_by_idx
  on public.waste_entries (created_by)
  where created_by is not null;

-- purchase_orders.created_by (FK → auth.users)
create index if not exists purchase_orders_created_by_idx
  on public.purchase_orders (created_by)
  where created_by is not null;

-- purchase_order_items.ingredient_id (FK → ingredients, used in joins/filters)
create index if not exists purchase_order_items_ingredient_id_idx
  on public.purchase_order_items (ingredient_id)
  where ingredient_id is not null;
