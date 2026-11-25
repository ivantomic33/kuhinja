-- =============================================================================
-- Per-item checklist progress (last-write-wins per run_id + item_id).
-- Replaces whole-list overwrite for concurrent devices.
-- =============================================================================

create table if not exists public.shift_checklist_items (
  run_id uuid not null
    references public.checklist_runs (id) on delete cascade,
  item_id text not null,
  checked boolean not null default false,
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (run_id, item_id),
  constraint shift_checklist_items_item_id_len check (
    char_length(trim(item_id)) between 1 and 64
  )
);

create index if not exists idx_shift_checklist_items_run_id
  on public.shift_checklist_items (run_id);

create index if not exists idx_shift_checklist_items_checked_by
  on public.shift_checklist_items (checked_by)
  where checked_by is not null;

create index if not exists idx_shift_checklist_items_updated_at
  on public.shift_checklist_items (run_id, updated_at desc);

create or replace function public.shift_checklist_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.checked then
    new.checked_at := coalesce(new.checked_at, now());
    new.checked_by := coalesce(new.checked_by, auth.uid());
  else
    new.checked_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists shift_checklist_items_touch on public.shift_checklist_items;
create trigger shift_checklist_items_touch
  before insert or update on public.shift_checklist_items
  for each row
  execute function public.shift_checklist_items_set_updated_at();

alter table public.shift_checklist_items enable row level security;
alter table public.shift_checklist_items force row level security;

revoke all on table public.shift_checklist_items from public, anon, authenticated;
grant select, insert, update, delete on table public.shift_checklist_items
  to authenticated;

drop policy if exists "Owners manage own shift checklist items"
  on public.shift_checklist_items;

create policy "Owners manage own shift checklist items"
  on public.shift_checklist_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.checklist_runs r
      where r.id = run_id
        and r.user_id = auth.uid()
        and public.is_venue_owner(r.venue_id)
    )
  )
  with check (
    exists (
      select 1
      from public.checklist_runs r
      where r.id = run_id
        and r.user_id = auth.uid()
        and public.is_venue_owner(r.venue_id)
    )
  );

-- Upsert helper: last write per item wins without clobbering other items.
create or replace function public.upsert_shift_checklist_item(
  p_run_id uuid,
  p_item_id text,
  p_checked boolean
)
returns public.shift_checklist_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.shift_checklist_items;
begin
  insert into public.shift_checklist_items as sci (
    run_id,
    item_id,
    checked,
    checked_by,
    checked_at
  )
  values (
    p_run_id,
    p_item_id,
    coalesce(p_checked, false),
    case when coalesce(p_checked, false) then auth.uid() else null end,
    case when coalesce(p_checked, false) then now() else null end
  )
  on conflict (run_id, item_id) do update
    set
      checked = excluded.checked,
      checked_by = excluded.checked_by,
      checked_at = excluded.checked_at,
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_shift_checklist_item(uuid, text, boolean)
  from public;
grant execute on function public.upsert_shift_checklist_item(uuid, text, boolean)
  to authenticated;
