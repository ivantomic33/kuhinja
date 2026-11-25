-- =============================================================================
-- P8 F5: waste_entries schema, RLS, immutability triggers
-- =============================================================================

create table if not exists public.waste_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  ingredient_name_snapshot text not null
    constraint waste_entries_name_snapshot_length check (
      length(trim(ingredient_name_snapshot)) between 1 and 200
    ),
  quantity numeric(12, 3) not null
    constraint waste_entries_quantity_nonzero check (quantity <> 0)
    constraint waste_entries_quantity_abs_max check (abs(quantity) <= 1000000),
  unit text not null
    constraint waste_entries_unit_check check (
      unit in ('g', 'kg', 'ml', 'l', 'kom', 'pak')
    ),
  reason text not null
    constraint waste_entries_reason_check check (
      reason in ('istek', 'pokvareno', 'ostatak', 'greška', 'ostalo')
    ),
  -- Frozen unit cost; never updated after insert.
  unit_cost_snapshot numeric(12, 4) not null
    constraint waste_entries_unit_cost_nonnegative check (unit_cost_snapshot >= 0),
  -- Unrounded row amount; round only in aggregates (decision 6).
  cost_rsd numeric(18, 6) generated always as (quantity * unit_cost_snapshot) stored,
  is_correction boolean not null default false,
  corrects_entry_id uuid references public.waste_entries (id),
  note text
    constraint waste_entries_note_length check (note is null or length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Offline idempotency key (device-generated UUID).
  client_id uuid,
  constraint waste_entries_subject_xor check (
    (ingredient_id is not null) <> (recipe_id is not null)
  ),
  constraint waste_entries_quantity_sign check (
    quantity > 0 or is_correction
  ),
  constraint waste_entries_correction_link check (
    (is_correction = false) or (corrects_entry_id is not null)
  )
);

create unique index if not exists waste_entries_client_id_uidx
  on public.waste_entries (client_id)
  where client_id is not null;

create unique index if not exists waste_entries_corrects_entry_uidx
  on public.waste_entries (corrects_entry_id)
  where is_correction and corrects_entry_id is not null;

create index if not exists waste_entries_workspace_created_idx
  on public.waste_entries (workspace_id, created_at desc);

create index if not exists waste_entries_workspace_reason_created_idx
  on public.waste_entries (workspace_id, reason, created_at desc);

create index if not exists waste_entries_ingredient_id_idx
  on public.waste_entries (ingredient_id)
  where ingredient_id is not null;

create index if not exists waste_entries_recipe_id_idx
  on public.waste_entries (recipe_id)
  where recipe_id is not null;

alter table public.waste_entries enable row level security;

revoke all on table public.waste_entries from anon, authenticated;
grant select, insert on table public.waste_entries to authenticated;
-- No update/delete grants — history is append-only.

drop policy if exists waste_entries_select_member on public.waste_entries;
create policy waste_entries_select_member
  on public.waste_entries
  for select to authenticated
  using (
    public.is_member(workspace_id, 'cook')
    and public.workspace_has_feature(workspace_id, 'waste_log')
  );

drop policy if exists waste_entries_insert_member on public.waste_entries;
create policy waste_entries_insert_member
  on public.waste_entries
  for insert to authenticated
  with check (
    public.is_member(workspace_id, 'cook')
    and public.workspace_has_feature(workspace_id, 'waste_log')
    and created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Immutability: block update/delete for everyone (incl. service_role default path)
-- ---------------------------------------------------------------------------
create or replace function public.waste_entries_reject_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'WASTE_IMMUTABLE'
    using errcode = 'P0001',
          hint = 'Waste entries cannot be updated or deleted; use a correction row.';
end;
$$;

drop trigger if exists waste_entries_no_update on public.waste_entries;
create trigger waste_entries_no_update
  before update on public.waste_entries
  for each row
  execute function public.waste_entries_reject_mutation();

drop trigger if exists waste_entries_no_delete on public.waste_entries;
create trigger waste_entries_no_delete
  before delete on public.waste_entries
  for each row
  execute function public.waste_entries_reject_mutation();

-- ---------------------------------------------------------------------------
-- Before insert: fill snapshots; reject online client price spoofing
-- ---------------------------------------------------------------------------
create or replace function public.waste_entries_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_price numeric;
  v_unit text;
  v_portion numeric;
  v_db_cost numeric;
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;

  if new.ingredient_id is not null then
    select i.name, i.price, i.unit
      into v_name, v_price, v_unit
    from public.ingredients i
    where i.id = new.ingredient_id
      and i.workspace_id = new.workspace_id;

    if v_name is null then
      raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0002';
    end if;

    if new.ingredient_name_snapshot is null or length(trim(new.ingredient_name_snapshot)) = 0 then
      new.ingredient_name_snapshot := v_name;
    end if;

    if new.unit is null or length(trim(new.unit)) = 0 then
      new.unit := v_unit;
    end if;

    v_db_cost := coalesce(v_price, 0);

    if new.unit_cost_snapshot is null then
      new.unit_cost_snapshot := v_db_cost;
    elsif new.client_id is null
      and round(new.unit_cost_snapshot::numeric, 4) is distinct from round(v_db_cost::numeric, 4) then
      -- Online path: client must not invent a different unit cost.
      raise exception 'UNIT_COST_MISMATCH' using errcode = 'P0001';
    end if;
    -- Offline path (client_id set): keep cached snapshot from capture time.

  elsif new.recipe_id is not null then
    select r.name into v_name
    from public.recipes r
    where r.id = new.recipe_id
      and r.workspace_id = new.workspace_id;

    if v_name is null then
      raise exception 'RECIPE_NOT_FOUND' using errcode = 'P0002';
    end if;

    if new.ingredient_name_snapshot is null or length(trim(new.ingredient_name_snapshot)) = 0 then
      new.ingredient_name_snapshot := v_name;
    end if;

    if new.unit is null or length(trim(new.unit)) = 0 then
      new.unit := 'kom';
    end if;

    select s.portion_cost into v_portion
    from public.recipe_cost_snapshot s
    where s.recipe_id = new.recipe_id;

    if v_portion is null then
      -- Attempt refresh once (F3 helper).
      perform public.refresh_recipe_cost_snapshot(new.recipe_id);
      select s.portion_cost into v_portion
      from public.recipe_cost_snapshot s
      where s.recipe_id = new.recipe_id;
    end if;

    if v_portion is null then
      raise exception 'RECIPE_COST_UNAVAILABLE' using errcode = 'P0001';
    end if;

    v_db_cost := v_portion;

    if new.unit_cost_snapshot is null then
      new.unit_cost_snapshot := v_db_cost;
    elsif new.client_id is null
      and round(new.unit_cost_snapshot::numeric, 4) is distinct from round(v_db_cost::numeric, 4) then
      raise exception 'UNIT_COST_MISMATCH' using errcode = 'P0001';
    end if;
  else
    raise exception 'SUBJECT_REQUIRED' using errcode = '22023';
  end if;

  if new.unit_cost_snapshot is null or new.unit_cost_snapshot < 0 then
    raise exception 'INVALID_UNIT_COST' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists waste_entries_before_insert on public.waste_entries;
create trigger waste_entries_before_insert
  before insert on public.waste_entries
  for each row
  execute function public.waste_entries_before_insert();
