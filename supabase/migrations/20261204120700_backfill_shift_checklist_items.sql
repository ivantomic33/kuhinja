-- A materialized item (including an unchecked one) takes precedence.
alter table public.shift_checklist_items disable trigger shift_checklist_items_touch;
insert into public.shift_checklist_items (run_id, item_id, checked, checked_by, checked_at, updated_at)
select r.id, ids.item_id, true, r.user_id, r.updated_at, r.updated_at
from public.checklist_runs r
cross join lateral jsonb_array_elements(r.checked_item_ids) as j(value)
cross join lateral (select j.value #>> '{}' as item_id) as ids
where jsonb_typeof(j.value) = 'string'
  and length(ids.item_id) <= 64
  and length(trim(ids.item_id)) > 0
on conflict (run_id, item_id) do nothing;
alter table public.shift_checklist_items enable trigger shift_checklist_items_touch;

create or replace function public.shift_checklist_items_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  new.checked_at := case when new.checked then new.updated_at end;
  new.checked_by := case when new.checked then coalesce(auth.uid(), new.checked_by) end;
  return new;
end;
$$;

-- Replay old clients' snapshots as differences against their legacy baseline.
create function public.apply_legacy_checklist_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  baseline jsonb := '[]'::jsonb;
  baseline_at timestamptz := new.updated_at;
begin
  if tg_op = 'UPDATE' then
    baseline := old.checked_item_ids;
    baseline_at := old.updated_at;
  end if;
  if baseline = new.checked_item_ids then
    return null;
  end if;

  insert into public.shift_checklist_items (run_id, item_id, checked, checked_by, checked_at)
  select new.id, id, checked, case when checked then new.user_id end,
         case when checked then now() end
  from (
    select distinct value #>> '{}' as id, true as checked
    from jsonb_array_elements(new.checked_item_ids)
    where jsonb_typeof(value) = 'string' and not baseline @> jsonb_build_array(value)
    union all
    select distinct value #>> '{}', false
    from jsonb_array_elements(baseline)
    where jsonb_typeof(value) = 'string' and not new.checked_item_ids @> jsonb_build_array(value)
  ) as delta
  where length(id) <= 64 and length(trim(id)) > 0
  on conflict (run_id, item_id) do update
  set checked = excluded.checked, checked_by = excluded.checked_by, checked_at = excluded.checked_at
  where shift_checklist_items.checked = not excluded.checked
    and shift_checklist_items.updated_at <= baseline_at;
  return null;
end;
$$;

create trigger checklist_runs_sync_legacy_items
after insert or update of checked_item_ids on public.checklist_runs
for each row execute function public.apply_legacy_checklist_snapshot();
