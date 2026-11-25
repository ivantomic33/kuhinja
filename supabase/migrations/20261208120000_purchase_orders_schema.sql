-- =============================================================================
-- P8 F4: low stock alerts, suppliers, stock_movements, purchase orders
-- =============================================================================

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null
    constraint suppliers_name_length check (length(trim(name)) between 1 and 120),
  contact_email text
    constraint suppliers_contact_email_format check (
      contact_email is null
      or contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    ),
  contact_phone text
    constraint suppliers_contact_phone_length check (
      contact_phone is null or length(trim(contact_phone)) between 1 and 40
    ),
  created_at timestamptz not null default now(),
  constraint suppliers_workspace_name_unique unique (workspace_id, name)
);

create index if not exists suppliers_workspace_id_idx
  on public.suppliers (workspace_id);

alter table public.suppliers enable row level security;
alter table public.suppliers force row level security;

revoke all on table public.suppliers from public, anon, authenticated;
grant select on table public.suppliers to authenticated;
grant insert, update, delete on table public.suppliers to authenticated;

drop policy if exists suppliers_select_cook on public.suppliers;
create policy suppliers_select_cook
  on public.suppliers
  for select to authenticated
  using (public.is_member(workspace_id, 'cook'));

drop policy if exists suppliers_insert_chef on public.suppliers;
create policy suppliers_insert_chef
  on public.suppliers
  for insert to authenticated
  with check (public.is_member(workspace_id, 'chef'));

drop policy if exists suppliers_update_chef on public.suppliers;
create policy suppliers_update_chef
  on public.suppliers
  for update to authenticated
  using (public.is_member(workspace_id, 'chef'))
  with check (public.is_member(workspace_id, 'chef'));

drop policy if exists suppliers_delete_chef on public.suppliers;
create policy suppliers_delete_chef
  on public.suppliers
  for delete to authenticated
  using (public.is_member(workspace_id, 'chef'));

-- ---------------------------------------------------------------------------
-- ingredients: par / stock / pack / supplier
-- ---------------------------------------------------------------------------
alter table public.ingredients
  add column if not exists par_level numeric(12, 3);

alter table public.ingredients
  add column if not exists current_stock numeric(12, 3);

alter table public.ingredients
  add column if not exists pack_size numeric(12, 3);

alter table public.ingredients
  add column if not exists supplier_id uuid;

-- Defaults + backfill from stock_levels before NOT NULL / checks harden.
update public.ingredients i
set current_stock = coalesce(
  (
    select sl.qty
    from public.stock_levels sl
    where sl.ingredient_id = i.id
    order by sl.updated_at desc nulls last
    limit 1
  ),
  0
)
where i.current_stock is null;

update public.ingredients i
set par_level = sl.min_qty
from public.stock_levels sl
where sl.ingredient_id = i.id
  and i.par_level is null
  and sl.min_qty is not null
  and sl.min_qty > 0;

alter table public.ingredients
  alter column current_stock set default 0;

update public.ingredients set current_stock = 0 where current_stock is null;

alter table public.ingredients
  alter column current_stock set not null;

alter table public.ingredients
  drop constraint if exists ingredients_par_level_check;
alter table public.ingredients
  add constraint ingredients_par_level_check
  check (par_level is null or par_level >= 0);

alter table public.ingredients
  drop constraint if exists ingredients_current_stock_check;
alter table public.ingredients
  add constraint ingredients_current_stock_check
  check (current_stock >= 0);

alter table public.ingredients
  drop constraint if exists ingredients_pack_size_check;
alter table public.ingredients
  add constraint ingredients_pack_size_check
  check (pack_size is null or pack_size > 0);

alter table public.ingredients
  drop constraint if exists ingredients_supplier_id_fkey;
alter table public.ingredients
  add constraint ingredients_supplier_id_fkey
  foreign key (supplier_id) references public.suppliers (id) on delete set null;

create index if not exists ingredients_workspace_supplier_id_idx
  on public.ingredients (workspace_id, supplier_id);

-- Column-level update: authenticated may not touch current_stock directly.
revoke update on table public.ingredients from authenticated;
grant update (
  venue_id,
  workspace_id,
  name,
  unit,
  price,
  waste_percent,
  notes,
  version,
  par_level,
  pack_size,
  supplier_id,
  updated_at
) on table public.ingredients to authenticated;

-- Ensure select/insert/delete remain (re-assert after revoke patterns).
grant select, insert, delete on table public.ingredients to authenticated;

-- ---------------------------------------------------------------------------
-- stock_movements (append-only history; writes via RPC only)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  delta numeric(12, 3) not null
    constraint stock_movements_delta_nonzero check (delta <> 0),
  reason text not null
    constraint stock_movements_reason_check check (
      reason in ('prijem', 'potrosnja', 'popis', 'greska_popisa', 'otpad', 'korekcija')
    ),
  note text,
  purchase_order_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_ingredient_created_at_idx
  on public.stock_movements (ingredient_id, created_at desc);

create index if not exists stock_movements_workspace_id_idx
  on public.stock_movements (workspace_id, created_at desc);

create index if not exists stock_movements_purchase_order_id_idx
  on public.stock_movements (purchase_order_id)
  where purchase_order_id is not null;

alter table public.stock_movements enable row level security;
alter table public.stock_movements force row level security;

revoke all on table public.stock_movements from public, anon, authenticated;
grant select on table public.stock_movements to authenticated;
-- no insert/update/delete for authenticated — RPC security definer only

drop policy if exists stock_movements_select_cook on public.stock_movements;
create policy stock_movements_select_cook
  on public.stock_movements
  for select to authenticated
  using (public.is_member(workspace_id, 'cook'));

-- ---------------------------------------------------------------------------
-- purchase_orders + items + counters
-- ---------------------------------------------------------------------------
create table if not exists public.order_counters (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  last_number integer not null default 0
    constraint order_counters_last_number_nonnegative check (last_number >= 0)
);

alter table public.order_counters enable row level security;
alter table public.order_counters force row level security;
revoke all on table public.order_counters from public, anon, authenticated;
-- service / security definer only

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  number integer not null
    constraint purchase_orders_number_positive check (number > 0),
  status text not null default 'nacrt'
    constraint purchase_orders_status_check check (
      status in ('nacrt', 'poslato', 'primljeno')
    ),
  sent_at timestamptz,
  sent_to text,
  received_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint purchase_orders_workspace_number_unique unique (workspace_id, number)
);

create index if not exists purchase_orders_workspace_status_idx
  on public.purchase_orders (workspace_id, status);

create index if not exists purchase_orders_workspace_created_at_idx
  on public.purchase_orders (workspace_id, created_at desc);

alter table public.purchase_orders enable row level security;
alter table public.purchase_orders force row level security;

revoke all on table public.purchase_orders from public, anon, authenticated;
grant select, insert, update on table public.purchase_orders to authenticated;
-- no delete for authenticated (keep audit trail); service_role may still delete via bypass

drop policy if exists purchase_orders_select_chef on public.purchase_orders;
create policy purchase_orders_select_chef
  on public.purchase_orders
  for select to authenticated
  using (public.is_member(workspace_id, 'chef'));

drop policy if exists purchase_orders_insert_chef on public.purchase_orders;
create policy purchase_orders_insert_chef
  on public.purchase_orders
  for insert to authenticated
  with check (
    public.is_member(workspace_id, 'chef')
    and status = 'nacrt'
  );

-- Draft field edits only while nacrt; status transitions go through RPC helpers
-- that use security definer. Authenticated update limited to draft metadata.
drop policy if exists purchase_orders_update_chef_draft on public.purchase_orders;
create policy purchase_orders_update_chef_draft
  on public.purchase_orders
  for update to authenticated
  using (
    public.is_member(workspace_id, 'chef')
    and status = 'nacrt'
  )
  with check (
    public.is_member(workspace_id, 'chef')
    and status = 'nacrt'
  );

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete set null,
  ingredient_name_snapshot text not null
    constraint purchase_order_items_name_length check (
      length(trim(ingredient_name_snapshot)) between 1 and 200
    ),
  unit text not null
    constraint purchase_order_items_unit_length check (length(trim(unit)) between 1 and 20),
  qty_ordered numeric(12, 3) not null
    constraint purchase_order_items_qty_ordered_positive check (qty_ordered > 0),
  qty_received numeric(12, 3)
    constraint purchase_order_items_qty_received_check check (
      qty_received is null or qty_received >= 0
    ),
  unit_price_received numeric(12, 2)
    constraint purchase_order_items_unit_price_received_check check (
      unit_price_received is null or unit_price_received >= 0
    )
);

create index if not exists purchase_order_items_order_id_idx
  on public.purchase_order_items (purchase_order_id);

alter table public.purchase_order_items enable row level security;
alter table public.purchase_order_items force row level security;

revoke all on table public.purchase_order_items from public, anon, authenticated;
grant select, insert, update, delete on table public.purchase_order_items to authenticated;

drop policy if exists purchase_order_items_select_chef on public.purchase_order_items;
create policy purchase_order_items_select_chef
  on public.purchase_order_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.purchase_orders po
      where po.id = purchase_order_id
        and public.is_member(po.workspace_id, 'chef')
    )
  );

drop policy if exists purchase_order_items_insert_chef_draft on public.purchase_order_items;
create policy purchase_order_items_insert_chef_draft
  on public.purchase_order_items
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.purchase_orders po
      where po.id = purchase_order_id
        and po.status = 'nacrt'
        and public.is_member(po.workspace_id, 'chef')
    )
  );

drop policy if exists purchase_order_items_update_chef_draft on public.purchase_order_items;
create policy purchase_order_items_update_chef_draft
  on public.purchase_order_items
  for update to authenticated
  using (
    exists (
      select 1
      from public.purchase_orders po
      where po.id = purchase_order_id
        and po.status = 'nacrt'
        and public.is_member(po.workspace_id, 'chef')
    )
  )
  with check (
    exists (
      select 1
      from public.purchase_orders po
      where po.id = purchase_order_id
        and po.status = 'nacrt'
        and public.is_member(po.workspace_id, 'chef')
    )
  );

drop policy if exists purchase_order_items_delete_chef_draft on public.purchase_order_items;
create policy purchase_order_items_delete_chef_draft
  on public.purchase_order_items
  for delete to authenticated
  using (
    exists (
      select 1
      from public.purchase_orders po
      where po.id = purchase_order_id
        and po.status = 'nacrt'
        and public.is_member(po.workspace_id, 'chef')
    )
  );

-- FK from stock_movements.purchase_order_id (added after purchase_orders exists)
alter table public.stock_movements
  drop constraint if exists stock_movements_purchase_order_id_fkey;
alter table public.stock_movements
  add constraint stock_movements_purchase_order_id_fkey
  foreign key (purchase_order_id) references public.purchase_orders (id) on delete set null;

-- ---------------------------------------------------------------------------
-- alerts: extend kind check with low_stock
-- ---------------------------------------------------------------------------
alter table public.alerts drop constraint if exists alerts_kind_check;
alter table public.alerts
  add constraint alerts_kind_check
  check (kind in ('food_cost_over_target', 'low_stock'));
