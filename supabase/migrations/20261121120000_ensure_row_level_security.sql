-- =============================================================================
-- Ensure Row Level Security on every public table.
-- Idempotent hardening: ENABLE + FORCE RLS, revoke broad grants, (re)create
-- owner/membership policies. Do not edit older migrations — apply this one.
--
-- Public share path for /r/[token] is schedule_public(token) only (safe preview
-- JSON). Base share tables stay locked; never grant anon SELECT on full rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: venue ownership (security definer avoids RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_venue_owner(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venues v
    where v.id = p_venue_id
      and v.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_venue_owner(uuid) from public;
grant execute on function public.is_venue_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

drop policy if exists "Users can select own profile" on public.profiles;
drop policy if exists "Users can update own full_name" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can delete own profile" on public.profiles;

create policy "Users can select own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own full_name"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete for authenticated: signup trigger + service role only.

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------

alter table public.venues enable row level security;
alter table public.venues force row level security;

revoke all on table public.venues from public, anon, authenticated;
grant select, insert, update, delete on table public.venues to authenticated;

drop policy if exists "Owners can select own venues" on public.venues;
drop policy if exists "Owners can insert own venues" on public.venues;
drop policy if exists "Owners can update own venues" on public.venues;
drop policy if exists "Owners can delete own venues" on public.venues;

create policy "Owners can select own venues"
  on public.venues
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can insert own venues"
  on public.venues
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update own venues"
  on public.venues
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can delete own venues"
  on public.venues
  for delete
  to authenticated
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- ingredients
-- ---------------------------------------------------------------------------

alter table public.ingredients enable row level security;
alter table public.ingredients force row level security;

revoke all on table public.ingredients from public, anon, authenticated;
grant select, insert, update, delete on table public.ingredients to authenticated;

drop policy if exists "Owners can select venue ingredients" on public.ingredients;
drop policy if exists "Owners can insert venue ingredients" on public.ingredients;
drop policy if exists "Owners can update venue ingredients" on public.ingredients;
drop policy if exists "Owners can delete venue ingredients" on public.ingredients;

create policy "Owners can select venue ingredients"
  on public.ingredients
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue ingredients"
  on public.ingredients
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue ingredients"
  on public.ingredients
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "Owners can delete venue ingredients"
  on public.ingredients
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- ingredient_price_history
-- ---------------------------------------------------------------------------

alter table public.ingredient_price_history enable row level security;
alter table public.ingredient_price_history force row level security;

revoke all on table public.ingredient_price_history from public, anon, authenticated;
grant select, insert, update, delete on table public.ingredient_price_history
  to authenticated;

drop policy if exists "Owners can select ingredient price history"
  on public.ingredient_price_history;
drop policy if exists "Owners can insert ingredient price history"
  on public.ingredient_price_history;
drop policy if exists "Owners can update ingredient price history"
  on public.ingredient_price_history;
drop policy if exists "Owners can delete ingredient price history"
  on public.ingredient_price_history;

create policy "Owners can select ingredient price history"
  on public.ingredient_price_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

create policy "Owners can insert ingredient price history"
  on public.ingredient_price_history
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

create policy "Owners can update ingredient price history"
  on public.ingredient_price_history
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  )
  with check (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

create policy "Owners can delete ingredient price history"
  on public.ingredient_price_history
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------

alter table public.recipes enable row level security;
alter table public.recipes force row level security;

revoke all on table public.recipes from public, anon, authenticated;
grant select, insert, update, delete on table public.recipes to authenticated;

drop policy if exists "Owners can select venue recipes" on public.recipes;
drop policy if exists "Owners can insert venue recipes" on public.recipes;
drop policy if exists "Owners can update venue recipes" on public.recipes;
drop policy if exists "Owners can delete venue recipes" on public.recipes;

create policy "Owners can select venue recipes"
  on public.recipes
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue recipes"
  on public.recipes
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue recipes"
  on public.recipes
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "Owners can delete venue recipes"
  on public.recipes
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- recipe_items
-- ---------------------------------------------------------------------------

alter table public.recipe_items enable row level security;
alter table public.recipe_items force row level security;

revoke all on table public.recipe_items from public, anon, authenticated;
grant select, insert, update, delete on table public.recipe_items to authenticated;

drop policy if exists "Owners can select recipe items" on public.recipe_items;
drop policy if exists "Owners can insert recipe items" on public.recipe_items;
drop policy if exists "Owners can update recipe items" on public.recipe_items;
drop policy if exists "Owners can delete recipe items" on public.recipe_items;

create policy "Owners can select recipe items"
  on public.recipe_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

create policy "Owners can insert recipe items"
  on public.recipe_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

create policy "Owners can update recipe items"
  on public.recipe_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

create policy "Owners can delete recipe items"
  on public.recipe_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

-- ---------------------------------------------------------------------------
-- checklist_templates
-- ---------------------------------------------------------------------------

alter table public.checklist_templates enable row level security;
alter table public.checklist_templates force row level security;

revoke all on table public.checklist_templates from public, anon, authenticated;
grant select, insert, update, delete on table public.checklist_templates
  to authenticated;

drop policy if exists "Owners can select venue checklist templates"
  on public.checklist_templates;
drop policy if exists "Owners can insert venue checklist templates"
  on public.checklist_templates;
drop policy if exists "Owners can update venue checklist templates"
  on public.checklist_templates;
drop policy if exists "Owners can delete venue checklist templates"
  on public.checklist_templates;

create policy "Owners can select venue checklist templates"
  on public.checklist_templates
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue checklist templates"
  on public.checklist_templates
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue checklist templates"
  on public.checklist_templates
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "Owners can delete venue checklist templates"
  on public.checklist_templates
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- checklist_runs (own rows + venue ownership)
-- ---------------------------------------------------------------------------

alter table public.checklist_runs enable row level security;
alter table public.checklist_runs force row level security;

revoke all on table public.checklist_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.checklist_runs
  to authenticated;

drop policy if exists "Owners can select own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can insert own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can update own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can delete own checklist runs" on public.checklist_runs;

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
-- stock_levels
-- ---------------------------------------------------------------------------

alter table public.stock_levels enable row level security;
alter table public.stock_levels force row level security;

revoke all on table public.stock_levels from public, anon, authenticated;
grant select, insert, update, delete on table public.stock_levels to authenticated;

drop policy if exists "Owners can select venue stock levels" on public.stock_levels;
drop policy if exists "Owners can insert venue stock levels" on public.stock_levels;
drop policy if exists "Owners can update venue stock levels" on public.stock_levels;
drop policy if exists "Owners can delete venue stock levels" on public.stock_levels;

create policy "Owners can select venue stock levels"
  on public.stock_levels
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue stock levels"
  on public.stock_levels
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue stock levels"
  on public.stock_levels
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "Owners can delete venue stock levels"
  on public.stock_levels
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- stock_moves (append-only: no delete grant)
-- ---------------------------------------------------------------------------

alter table public.stock_moves enable row level security;
alter table public.stock_moves force row level security;

revoke all on table public.stock_moves from public, anon, authenticated;
grant select, insert, update on table public.stock_moves to authenticated;

drop policy if exists "Owners can select venue stock moves" on public.stock_moves;
drop policy if exists "Owners can insert venue stock moves" on public.stock_moves;
drop policy if exists "Owners can update venue stock moves" on public.stock_moves;
drop policy if exists "Owners can delete venue stock moves" on public.stock_moves;

create policy "Owners can select venue stock moves"
  on public.stock_moves
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue stock moves"
  on public.stock_moves
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue stock moves"
  on public.stock_moves
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- stripe_webhook_events (service role / bypassrls only — no client access)
-- ---------------------------------------------------------------------------

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

revoke all on table public.stripe_webhook_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule domain
-- Access is via security-definer RPCs (schedule_load / schedule_command /
-- schedule_report / schedule_public). Tables stay ungranted to anon &
-- authenticated. RLS + FORCE still deny any accidental direct grants.
-- Membership: location owner_id = auth.uid(), or active employee.user_id.
-- ---------------------------------------------------------------------------

alter table public.schedule_locations enable row level security;
alter table public.schedule_employees enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.schedule_publications enable row level security;
alter table public.schedule_requests enable row level security;
alter table public.schedule_notifications enable row level security;
alter table public.schedule_share_links enable row level security;
alter table public.schedule_copy_undos enable row level security;

alter table public.schedule_locations force row level security;
alter table public.schedule_employees force row level security;
alter table public.schedule_assignments force row level security;
alter table public.schedule_publications force row level security;
alter table public.schedule_requests force row level security;
alter table public.schedule_notifications force row level security;
alter table public.schedule_share_links force row level security;
alter table public.schedule_copy_undos force row level security;

revoke all on table public.schedule_locations from public, anon, authenticated;
revoke all on table public.schedule_employees from public, anon, authenticated;
revoke all on table public.schedule_assignments from public, anon, authenticated;
revoke all on table public.schedule_publications from public, anon, authenticated;
revoke all on table public.schedule_requests from public, anon, authenticated;
revoke all on table public.schedule_notifications from public, anon, authenticated;
revoke all on table public.schedule_share_links from public, anon, authenticated;
revoke all on table public.schedule_copy_undos from public, anon, authenticated;

-- Owner / member policies (defense in depth if grants are ever added later)

drop policy if exists "Schedule location owners manage" on public.schedule_locations;
drop policy if exists "Schedule location members select" on public.schedule_locations;

create policy "Schedule location owners manage"
  on public.schedule_locations
  for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Schedule location members select"
  on public.schedule_locations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = id
        and e.user_id = auth.uid()
        and e.active
    )
  );

drop policy if exists "Schedule employees owner all" on public.schedule_employees;
drop policy if exists "Schedule employees self select" on public.schedule_employees;

create policy "Schedule employees owner all"
  on public.schedule_employees
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule employees self select"
  on public.schedule_employees
  for select
  to authenticated
  using (user_id = auth.uid() and active);

drop policy if exists "Schedule assignments owner all" on public.schedule_assignments;
drop policy if exists "Schedule assignments member select" on public.schedule_assignments;

create policy "Schedule assignments owner all"
  on public.schedule_assignments
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule assignments member select"
  on public.schedule_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_assignments.location_id
        and e.id = schedule_assignments.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  );

drop policy if exists "Schedule publications owner all" on public.schedule_publications;
drop policy if exists "Schedule publications member select" on public.schedule_publications;

create policy "Schedule publications owner all"
  on public.schedule_publications
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule publications member select"
  on public.schedule_publications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_publications.location_id
        and e.user_id = auth.uid()
        and e.active
    )
  );

drop policy if exists "Schedule requests owner all" on public.schedule_requests;
drop policy if exists "Schedule requests member select insert" on public.schedule_requests;

create policy "Schedule requests owner all"
  on public.schedule_requests
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule requests member select insert"
  on public.schedule_requests
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_requests.location_id
        and e.id = schedule_requests.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_requests.location_id
        and e.id = schedule_requests.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  );

drop policy if exists "Schedule notifications owner all" on public.schedule_notifications;
drop policy if exists "Schedule notifications member select delete"
  on public.schedule_notifications;

create policy "Schedule notifications owner all"
  on public.schedule_notifications
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule notifications member select delete"
  on public.schedule_notifications
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_notifications.location_id
        and e.id = schedule_notifications.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_notifications.location_id
        and e.id = schedule_notifications.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  );

-- Share links + copy undos: owners only at table level. Public read is NOT
-- granted here — use schedule_public(token) / public_schedule_shares view.
drop policy if exists "Schedule share links owner all" on public.schedule_share_links;
drop policy if exists "Schedule copy undos owner all" on public.schedule_copy_undos;

create policy "Schedule share links owner all"
  on public.schedule_share_links
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule copy undos owner all"
  on public.schedule_copy_undos
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Public share for /r/[token]: safe columns only (token + preview payload).
-- Never expose location_id or other internals via anon table grants.
-- ---------------------------------------------------------------------------

-- Safe-column projection (token + preview only). Not granted to anon/authenticated.
create or replace view public.public_schedule_shares
with (security_invoker = false)
as
select
  s.token,
  s.monday,
  s.preview
from public.schedule_share_links s
join public.schedule_locations l on l.id = s.location_id
where public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;

revoke all on table public.public_schedule_shares from public, anon, authenticated;

-- /r/[token] entry point: returns preview JSON only for a known token.
-- Does not expose location_id or other share-link internals.
create or replace function public.schedule_public(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.preview
  from public.schedule_share_links s
  join public.schedule_locations l on l.id = s.location_id
  where s.token = p_token
    and public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;
$$;

revoke all on function public.schedule_public(uuid) from public;
grant execute on function public.schedule_public(uuid) to anon, authenticated;

-- Keep authenticated schedule RPCs callable; internal helpers stay revoked.
revoke all on function public.schedule_rank(uuid) from public, anon, authenticated;
revoke all on function public.schedule_scope(uuid, boolean) from public, anon, authenticated;
revoke all on function public.schedule_shifts(uuid, date, date, uuid[])
  from public, anon, authenticated;
revoke all on function public.schedule_staff(uuid, integer) from public, anon, authenticated;
revoke all on function public.schedule_preview(uuid, date) from public, anon, authenticated;
revoke all on function public.schedule_put(uuid, uuid, date, jsonb)
  from public, anon, authenticated;

grant execute on function public.schedule_load(uuid, date) to authenticated;
grant execute on function public.schedule_command(text, uuid, date, jsonb)
  to authenticated;
grant execute on function public.schedule_report(uuid, date) to authenticated;
