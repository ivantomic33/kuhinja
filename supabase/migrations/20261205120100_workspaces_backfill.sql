-- =============================================================================
-- P8 F1 step 2: one workspace per existing user + workspace_id on domain tables
-- =============================================================================

-- 1) One owner workspace per auth user (including users with no domain data).
with users_needing as (
  select u.id as user_id,
         row_number() over (order by u.created_at nulls last, u.id) as rn
  from auth.users u
  where not exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = u.id
      and wm.role = 'owner'
  )
),
created as (
  insert into public.workspaces (name)
  select 'Moja kuhinja'
  from users_needing
  returning id, created_at
),
created_numbered as (
  select id as workspace_id,
         row_number() over (order by created_at, id) as rn
  from created
)
insert into public.workspace_members (workspace_id, user_id, role)
select c.workspace_id, u.user_id, 'owner'
from users_needing u
join created_numbered c on c.rn = u.rn
on conflict do nothing;

-- Helper: each user's primary owner workspace (earliest membership)
create temporary table tmp_user_owner_workspace on commit drop as
select distinct on (wm.user_id)
  wm.user_id,
  wm.workspace_id
from public.workspace_members wm
where wm.role = 'owner'
order by wm.user_id, wm.created_at asc, wm.workspace_id;

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------
alter table public.venues
  add column if not exists workspace_id uuid;

update public.venues v
set workspace_id = t.workspace_id
from tmp_user_owner_workspace t
where v.owner_id = t.user_id
  and v.workspace_id is null;

do $$
begin
  if exists (select 1 from public.venues where workspace_id is null) then
    raise exception 'venues backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.venues
  alter column workspace_id set not null;

alter table public.venues
  drop constraint if exists venues_workspace_id_fkey;
alter table public.venues
  add constraint venues_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;

create index if not exists venues_workspace_id_idx on public.venues (workspace_id);
create index if not exists venues_workspace_id_created_at_idx
  on public.venues (workspace_id, created_at);

-- ---------------------------------------------------------------------------
-- ingredients
-- ---------------------------------------------------------------------------
alter table public.ingredients
  add column if not exists workspace_id uuid;

update public.ingredients i
set workspace_id = v.workspace_id
from public.venues v
where i.venue_id = v.id
  and i.workspace_id is null;

do $$
begin
  if exists (select 1 from public.ingredients where workspace_id is null) then
    raise exception 'ingredients backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.ingredients alter column workspace_id set not null;
alter table public.ingredients drop constraint if exists ingredients_workspace_id_fkey;
alter table public.ingredients
  add constraint ingredients_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists ingredients_workspace_id_idx on public.ingredients (workspace_id);
create index if not exists ingredients_workspace_id_name_idx
  on public.ingredients (workspace_id, name);

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------
alter table public.recipes
  add column if not exists workspace_id uuid;

update public.recipes r
set workspace_id = v.workspace_id
from public.venues v
where r.venue_id = v.id
  and r.workspace_id is null;

do $$
begin
  if exists (select 1 from public.recipes where workspace_id is null) then
    raise exception 'recipes backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.recipes alter column workspace_id set not null;
alter table public.recipes drop constraint if exists recipes_workspace_id_fkey;
alter table public.recipes
  add constraint recipes_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists recipes_workspace_id_idx on public.recipes (workspace_id);
create index if not exists recipes_workspace_id_name_idx
  on public.recipes (workspace_id, name);

-- ---------------------------------------------------------------------------
-- recipe_items
-- ---------------------------------------------------------------------------
alter table public.recipe_items
  add column if not exists workspace_id uuid;

update public.recipe_items ri
set workspace_id = r.workspace_id
from public.recipes r
where ri.recipe_id = r.id
  and ri.workspace_id is null;

do $$
begin
  if exists (select 1 from public.recipe_items where workspace_id is null) then
    raise exception 'recipe_items backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.recipe_items alter column workspace_id set not null;
alter table public.recipe_items drop constraint if exists recipe_items_workspace_id_fkey;
alter table public.recipe_items
  add constraint recipe_items_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists recipe_items_workspace_id_idx on public.recipe_items (workspace_id);

-- ---------------------------------------------------------------------------
-- ingredient_price_history
-- ---------------------------------------------------------------------------
alter table public.ingredient_price_history
  add column if not exists workspace_id uuid;

update public.ingredient_price_history h
set workspace_id = i.workspace_id
from public.ingredients i
where h.ingredient_id = i.id
  and h.workspace_id is null;

do $$
begin
  if exists (select 1 from public.ingredient_price_history where workspace_id is null) then
    raise exception 'ingredient_price_history backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.ingredient_price_history alter column workspace_id set not null;
alter table public.ingredient_price_history drop constraint if exists ingredient_price_history_workspace_id_fkey;
alter table public.ingredient_price_history
  add constraint ingredient_price_history_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists ingredient_price_history_workspace_id_idx
  on public.ingredient_price_history (workspace_id);

-- ---------------------------------------------------------------------------
-- checklist_templates
-- ---------------------------------------------------------------------------
alter table public.checklist_templates
  add column if not exists workspace_id uuid;

update public.checklist_templates t
set workspace_id = v.workspace_id
from public.venues v
where t.venue_id = v.id
  and t.workspace_id is null;

do $$
begin
  if exists (select 1 from public.checklist_templates where workspace_id is null) then
    raise exception 'checklist_templates backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.checklist_templates alter column workspace_id set not null;
alter table public.checklist_templates drop constraint if exists checklist_templates_workspace_id_fkey;
alter table public.checklist_templates
  add constraint checklist_templates_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists checklist_templates_workspace_id_idx
  on public.checklist_templates (workspace_id);
create index if not exists checklist_templates_workspace_id_name_idx
  on public.checklist_templates (workspace_id, name);

-- ---------------------------------------------------------------------------
-- checklist_runs
-- ---------------------------------------------------------------------------
alter table public.checklist_runs
  add column if not exists workspace_id uuid;

update public.checklist_runs r
set workspace_id = v.workspace_id
from public.venues v
where r.venue_id = v.id
  and r.workspace_id is null;

do $$
begin
  if exists (select 1 from public.checklist_runs where workspace_id is null) then
    raise exception 'checklist_runs backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.checklist_runs alter column workspace_id set not null;
alter table public.checklist_runs drop constraint if exists checklist_runs_workspace_id_fkey;
alter table public.checklist_runs
  add constraint checklist_runs_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists checklist_runs_workspace_id_idx on public.checklist_runs (workspace_id);

-- Soften user delete so historical runs stay in the workspace
alter table public.checklist_runs
  drop constraint if exists checklist_runs_user_id_fkey;
alter table public.checklist_runs
  alter column user_id drop not null;
alter table public.checklist_runs
  add constraint checklist_runs_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- shift_checklist_items
-- ---------------------------------------------------------------------------
alter table public.shift_checklist_items
  add column if not exists workspace_id uuid;

update public.shift_checklist_items sci
set workspace_id = r.workspace_id
from public.checklist_runs r
where sci.run_id = r.id
  and sci.workspace_id is null;

do $$
begin
  if exists (select 1 from public.shift_checklist_items where workspace_id is null) then
    raise exception 'shift_checklist_items backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.shift_checklist_items alter column workspace_id set not null;
alter table public.shift_checklist_items drop constraint if exists shift_checklist_items_workspace_id_fkey;
alter table public.shift_checklist_items
  add constraint shift_checklist_items_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists shift_checklist_items_workspace_id_idx
  on public.shift_checklist_items (workspace_id);

-- ---------------------------------------------------------------------------
-- stock_levels / stock_moves
-- ---------------------------------------------------------------------------
alter table public.stock_levels
  add column if not exists workspace_id uuid;

update public.stock_levels s
set workspace_id = v.workspace_id
from public.venues v
where s.venue_id = v.id
  and s.workspace_id is null;

do $$
begin
  if exists (select 1 from public.stock_levels where workspace_id is null) then
    raise exception 'stock_levels backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.stock_levels alter column workspace_id set not null;
alter table public.stock_levels drop constraint if exists stock_levels_workspace_id_fkey;
alter table public.stock_levels
  add constraint stock_levels_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists stock_levels_workspace_id_idx on public.stock_levels (workspace_id);

alter table public.stock_moves
  add column if not exists workspace_id uuid;

update public.stock_moves s
set workspace_id = v.workspace_id
from public.venues v
where s.venue_id = v.id
  and s.workspace_id is null;

do $$
begin
  if exists (select 1 from public.stock_moves where workspace_id is null) then
    raise exception 'stock_moves backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.stock_moves alter column workspace_id set not null;
alter table public.stock_moves drop constraint if exists stock_moves_workspace_id_fkey;
alter table public.stock_moves
  add constraint stock_moves_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists stock_moves_workspace_id_idx on public.stock_moves (workspace_id);

-- ---------------------------------------------------------------------------
-- schedule_locations (+ children)
-- ---------------------------------------------------------------------------
alter table public.schedule_locations
  add column if not exists workspace_id uuid;

update public.schedule_locations l
set workspace_id = t.workspace_id
from tmp_user_owner_workspace t
where l.owner_id = t.user_id
  and l.workspace_id is null;

do $$
begin
  if exists (select 1 from public.schedule_locations where workspace_id is null) then
    raise exception 'schedule_locations backfill failed: rows without workspace_id remain';
  end if;
end $$;

alter table public.schedule_locations alter column workspace_id set not null;
alter table public.schedule_locations drop constraint if exists schedule_locations_workspace_id_fkey;
alter table public.schedule_locations
  add constraint schedule_locations_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists schedule_locations_workspace_id_idx
  on public.schedule_locations (workspace_id);

alter table public.schedule_employees
  add column if not exists workspace_id uuid;
update public.schedule_employees e
set workspace_id = l.workspace_id
from public.schedule_locations l
where e.location_id = l.id and e.workspace_id is null;
do $$ begin
  if exists (select 1 from public.schedule_employees where workspace_id is null) then
    raise exception 'schedule_employees backfill failed';
  end if;
end $$;
alter table public.schedule_employees alter column workspace_id set not null;
alter table public.schedule_employees drop constraint if exists schedule_employees_workspace_id_fkey;
alter table public.schedule_employees
  add constraint schedule_employees_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;
create index if not exists schedule_employees_workspace_id_idx
  on public.schedule_employees (workspace_id);

alter table public.schedule_assignments
  add column if not exists workspace_id uuid;
update public.schedule_assignments a
set workspace_id = l.workspace_id
from public.schedule_locations l
where a.location_id = l.id and a.workspace_id is null;
do $$ begin
  if exists (select 1 from public.schedule_assignments where workspace_id is null) then
    raise exception 'schedule_assignments backfill failed';
  end if;
end $$;
alter table public.schedule_assignments alter column workspace_id set not null;
alter table public.schedule_assignments drop constraint if exists schedule_assignments_workspace_id_fkey;
alter table public.schedule_assignments
  add constraint schedule_assignments_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;

alter table public.schedule_publications
  add column if not exists workspace_id uuid;
update public.schedule_publications p
set workspace_id = l.workspace_id
from public.schedule_locations l
where p.location_id = l.id and p.workspace_id is null;
do $$ begin
  if exists (select 1 from public.schedule_publications where workspace_id is null) then
    raise exception 'schedule_publications backfill failed';
  end if;
end $$;
alter table public.schedule_publications alter column workspace_id set not null;
alter table public.schedule_publications drop constraint if exists schedule_publications_workspace_id_fkey;
alter table public.schedule_publications
  add constraint schedule_publications_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;

alter table public.schedule_requests
  add column if not exists workspace_id uuid;
update public.schedule_requests r
set workspace_id = l.workspace_id
from public.schedule_locations l
where r.location_id = l.id and r.workspace_id is null;
do $$ begin
  if exists (select 1 from public.schedule_requests where workspace_id is null) then
    raise exception 'schedule_requests backfill failed';
  end if;
end $$;
alter table public.schedule_requests alter column workspace_id set not null;
alter table public.schedule_requests drop constraint if exists schedule_requests_workspace_id_fkey;
alter table public.schedule_requests
  add constraint schedule_requests_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;

alter table public.schedule_notifications
  add column if not exists workspace_id uuid;
update public.schedule_notifications n
set workspace_id = l.workspace_id
from public.schedule_locations l
where n.location_id = l.id and n.workspace_id is null;
do $$ begin
  if exists (select 1 from public.schedule_notifications where workspace_id is null) then
    raise exception 'schedule_notifications backfill failed';
  end if;
end $$;
alter table public.schedule_notifications alter column workspace_id set not null;
alter table public.schedule_notifications drop constraint if exists schedule_notifications_workspace_id_fkey;
alter table public.schedule_notifications
  add constraint schedule_notifications_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;

alter table public.schedule_share_links
  add column if not exists workspace_id uuid;
update public.schedule_share_links s
set workspace_id = l.workspace_id
from public.schedule_locations l
where s.location_id = l.id and s.workspace_id is null;
do $$ begin
  if exists (select 1 from public.schedule_share_links where workspace_id is null) then
    raise exception 'schedule_share_links backfill failed';
  end if;
end $$;
alter table public.schedule_share_links alter column workspace_id set not null;
alter table public.schedule_share_links drop constraint if exists schedule_share_links_workspace_id_fkey;
alter table public.schedule_share_links
  add constraint schedule_share_links_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;

alter table public.schedule_copy_undos
  add column if not exists workspace_id uuid;
update public.schedule_copy_undos c
set workspace_id = l.workspace_id
from public.schedule_locations l
where c.location_id = l.id and c.workspace_id is null;
do $$ begin
  if exists (select 1 from public.schedule_copy_undos where workspace_id is null) then
    raise exception 'schedule_copy_undos backfill failed';
  end if;
end $$;
alter table public.schedule_copy_undos alter column workspace_id set not null;
alter table public.schedule_copy_undos drop constraint if exists schedule_copy_undos_workspace_id_fkey;
alter table public.schedule_copy_undos
  add constraint schedule_copy_undos_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete restrict;

-- Integrity: venue owner must be a member of the venue workspace
do $$
begin
  if exists (
    select 1
    from public.venues v
    where not exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = v.workspace_id and wm.user_id = v.owner_id
    )
  ) then
    raise exception 'venue owner is not a member of venue workspace';
  end if;
end $$;
