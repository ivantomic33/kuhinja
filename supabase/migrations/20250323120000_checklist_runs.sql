-- =============================================================================
-- checklist_runs + free-plan template limit
-- =============================================================================

-- ---------------------------------------------------------------------------
-- checklist_runs: per-shift progress against a template
-- ---------------------------------------------------------------------------

create table if not exists public.checklist_runs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  template_id uuid not null references public.checklist_templates (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active'
    constraint checklist_runs_status_check check (status in ('active', 'completed')),
  checked_item_ids jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_runs_checked_is_array check (jsonb_typeof(checked_item_ids) = 'array')
);

create index if not exists checklist_runs_venue_id_idx
  on public.checklist_runs (venue_id);

create index if not exists checklist_runs_template_id_idx
  on public.checklist_runs (template_id);

create index if not exists checklist_runs_user_id_idx
  on public.checklist_runs (user_id);

-- At most one active run per user + template
create unique index if not exists checklist_runs_one_active_per_user_template
  on public.checklist_runs (user_id, template_id)
  where (status = 'active');

create trigger checklist_runs_set_updated_at
  before update on public.checklist_runs
  for each row
  execute function public.set_updated_at();

alter table public.checklist_runs enable row level security;

revoke all on table public.checklist_runs from anon, authenticated;
grant select, insert, update, delete on table public.checklist_runs
  to authenticated;

create policy "Owners can select own checklist runs"
  on public.checklist_runs
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

create policy "Owners can insert own checklist runs"
  on public.checklist_runs
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

create policy "Owners can update own checklist runs"
  on public.checklist_runs
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

create policy "Owners can delete own checklist runs"
  on public.checklist_runs
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

-- ---------------------------------------------------------------------------
-- Free-plan limits: max 1 checklist template per venue
-- ---------------------------------------------------------------------------

create or replace function public.enforce_free_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_plan text;
  v_count integer;
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  select p.plan
  into v_plan
  from public.profiles p
  where p.id = v_owner_id;

  if coalesce(v_plan, 'free') <> 'free' then
    return new;
  end if;

  if tg_table_name = 'ingredients' then
    select count(*)::integer
    into v_count
    from public.ingredients i
    where i.venue_id = new.venue_id;

    if v_count >= 20 then
      raise exception
        'Free plan limit exceeded: maximum 20 ingredients per venue';
    end if;
  elsif tg_table_name = 'recipes' then
    select count(*)::integer
    into v_count
    from public.recipes r
    where r.venue_id = new.venue_id;

    if v_count >= 5 then
      raise exception
        'Free plan limit exceeded: maximum 5 recipes per venue';
    end if;
  elsif tg_table_name = 'checklist_templates' then
    select count(*)::integer
    into v_count
    from public.checklist_templates t
    where t.venue_id = new.venue_id;

    if v_count >= 1 then
      raise exception
        'Free plan limit exceeded: maximum 1 checklist template per venue';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists checklist_templates_enforce_free_limit
  on public.checklist_templates;

create trigger checklist_templates_enforce_free_limit
  before insert on public.checklist_templates
  for each row
  execute function public.enforce_free_limit();
