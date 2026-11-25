-- =============================================================================
-- P8 F1 step 3: is_member + workspace-scoped RLS (replaces P1 venue-owner policies)
-- =============================================================================

create or replace function public.workspace_role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'cook' then 1
    when 'chef' then 2
    when 'manager' then 3
    when 'owner' then 4
    else 0
  end;
$$;

revoke all on function public.workspace_role_rank(text) from public;
grant execute on function public.workspace_role_rank(text) to authenticated;

-- True when auth.uid() is a member of p_workspace_id with role rank >= p_min_role.
create or replace function public.is_member(p_workspace_id uuid, p_min_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_workspace_id is null then false
    when p_min_role is null or p_min_role not in ('cook', 'chef', 'manager', 'owner') then false
    when auth.uid() is null then false
    else exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = p_workspace_id
        and wm.user_id = auth.uid()
        and public.workspace_role_rank(wm.role) >= public.workspace_role_rank(p_min_role)
    )
  end;
$$;

revoke all on function public.is_member(uuid, text) from public;
grant execute on function public.is_member(uuid, text) to authenticated;

-- List members for a workspace the caller belongs to (avoids recursive RLS on members).
create or replace function public.list_workspace_members(p_workspace_id uuid)
returns table (
  workspace_id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  full_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_workspace_id, 'cook') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return query
  select
    wm.workspace_id,
    wm.user_id,
    wm.role,
    wm.created_at,
    coalesce(p.full_name, '') as full_name,
    coalesce(u.email, '') as email
  from public.workspace_members wm
  left join public.profiles p on p.id = wm.user_id
  left join auth.users u on u.id = wm.user_id
  where wm.workspace_id = p_workspace_id
  order by public.workspace_role_rank(wm.role) desc, wm.created_at, wm.user_id;
end;
$$;

revoke all on function public.list_workspace_members(uuid) from public;
grant execute on function public.list_workspace_members(uuid) to authenticated;

-- Prevent removing or demoting the last owner
create or replace function public.workspace_members_guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_owners integer;
begin
  v_workspace := coalesce(old.workspace_id, new.workspace_id);

  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      select count(*)::integer into v_owners
      from public.workspace_members
      where workspace_id = v_workspace and role = 'owner' and user_id <> old.user_id;
      if v_owners < 1 then
        raise exception 'LAST_OWNER' using errcode = 'P0001';
      end if;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.role = 'owner' and new.role is distinct from 'owner' then
    select count(*)::integer into v_owners
    from public.workspace_members
    where workspace_id = v_workspace and role = 'owner' and user_id <> old.user_id;
    if v_owners < 1 then
      raise exception 'LAST_OWNER' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_members_guard_last_owner on public.workspace_members;
create trigger workspace_members_guard_last_owner
  before update or delete on public.workspace_members
  for each row
  execute function public.workspace_members_guard_last_owner();

-- Signup: profile + workspace + owner membership + default venue
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_venue_name text;
  v_workspace_id uuid;
begin
  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_venue_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'venue_name', '')), '');

  insert into public.profiles (id, full_name)
  values (new.id, coalesce(v_full_name, ''))
  on conflict (id) do update
    set full_name = excluded.full_name,
        updated_at = now()
    where public.profiles.full_name is distinct from excluded.full_name;

  select wm.workspace_id into v_workspace_id
  from public.workspace_members wm
  where wm.user_id = new.id and wm.role = 'owner'
  order by wm.created_at
  limit 1;

  if v_workspace_id is null then
    insert into public.workspaces (name)
    values ('Moja kuhinja')
    returning id into v_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, new.id, 'owner')
    on conflict do nothing;
  end if;

  insert into public.venues (owner_id, name, workspace_id)
  select new.id, coalesce(v_venue_name, 'Moj lokal'), v_workspace_id
  where not exists (
    select 1 from public.venues v where v.owner_id = new.id
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to postgres, service_role;

-- Keep workspace_id in sync when inserting venue-scoped rows
create or replace function public.set_workspace_id_from_venue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select v.workspace_id into new.workspace_id
    from public.venues v
    where v.id = new.venue_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ingredients_set_workspace on public.ingredients;
create trigger ingredients_set_workspace
  before insert on public.ingredients
  for each row execute function public.set_workspace_id_from_venue();

drop trigger if exists recipes_set_workspace on public.recipes;
create trigger recipes_set_workspace
  before insert on public.recipes
  for each row execute function public.set_workspace_id_from_venue();

drop trigger if exists checklist_templates_set_workspace on public.checklist_templates;
create trigger checklist_templates_set_workspace
  before insert on public.checklist_templates
  for each row execute function public.set_workspace_id_from_venue();

drop trigger if exists checklist_runs_set_workspace on public.checklist_runs;
create trigger checklist_runs_set_workspace
  before insert on public.checklist_runs
  for each row execute function public.set_workspace_id_from_venue();

drop trigger if exists stock_levels_set_workspace on public.stock_levels;
create trigger stock_levels_set_workspace
  before insert on public.stock_levels
  for each row execute function public.set_workspace_id_from_venue();

drop trigger if exists stock_moves_set_workspace on public.stock_moves;
create trigger stock_moves_set_workspace
  before insert on public.stock_moves
  for each row execute function public.set_workspace_id_from_venue();

create or replace function public.set_workspace_id_from_recipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select r.workspace_id into new.workspace_id
    from public.recipes r where r.id = new.recipe_id;
  end if;
  return new;
end;
$$;

drop trigger if exists recipe_items_set_workspace on public.recipe_items;
create trigger recipe_items_set_workspace
  before insert on public.recipe_items
  for each row execute function public.set_workspace_id_from_recipe();

create or replace function public.set_workspace_id_from_ingredient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select i.workspace_id into new.workspace_id
    from public.ingredients i where i.id = new.ingredient_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ingredient_price_history_set_workspace on public.ingredient_price_history;
create trigger ingredient_price_history_set_workspace
  before insert on public.ingredient_price_history
  for each row execute function public.set_workspace_id_from_ingredient();

create or replace function public.set_workspace_id_from_run()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select r.workspace_id into new.workspace_id
    from public.checklist_runs r where r.id = new.run_id;
  end if;
  return new;
end;
$$;

drop trigger if exists shift_checklist_items_set_workspace on public.shift_checklist_items;
create trigger shift_checklist_items_set_workspace
  before insert on public.shift_checklist_items
  for each row execute function public.set_workspace_id_from_run();

create or replace function public.set_workspace_id_from_schedule_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select l.workspace_id into new.workspace_id
    from public.schedule_locations l where l.id = new.location_id;
  end if;
  return new;
end;
$$;

drop trigger if exists schedule_employees_set_workspace on public.schedule_employees;
create trigger schedule_employees_set_workspace
  before insert on public.schedule_employees
  for each row execute function public.set_workspace_id_from_schedule_location();

drop trigger if exists schedule_assignments_set_workspace on public.schedule_assignments;
create trigger schedule_assignments_set_workspace
  before insert on public.schedule_assignments
  for each row execute function public.set_workspace_id_from_schedule_location();

drop trigger if exists schedule_publications_set_workspace on public.schedule_publications;
create trigger schedule_publications_set_workspace
  before insert on public.schedule_publications
  for each row execute function public.set_workspace_id_from_schedule_location();

drop trigger if exists schedule_requests_set_workspace on public.schedule_requests;
create trigger schedule_requests_set_workspace
  before insert on public.schedule_requests
  for each row execute function public.set_workspace_id_from_schedule_location();

drop trigger if exists schedule_notifications_set_workspace on public.schedule_notifications;
create trigger schedule_notifications_set_workspace
  before insert on public.schedule_notifications
  for each row execute function public.set_workspace_id_from_schedule_location();

drop trigger if exists schedule_share_links_set_workspace on public.schedule_share_links;
create trigger schedule_share_links_set_workspace
  before insert on public.schedule_share_links
  for each row execute function public.set_workspace_id_from_schedule_location();

drop trigger if exists schedule_copy_undos_set_workspace on public.schedule_copy_undos;
create trigger schedule_copy_undos_set_workspace
  before insert on public.schedule_copy_undos
  for each row execute function public.set_workspace_id_from_schedule_location();

create or replace function public.set_venue_workspace_from_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select wm.workspace_id into new.workspace_id
    from public.workspace_members wm
    where wm.user_id = new.owner_id and wm.role = 'owner'
    order by wm.created_at
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists venues_set_workspace on public.venues;
create trigger venues_set_workspace
  before insert on public.venues
  for each row execute function public.set_venue_workspace_from_owner();

create or replace function public.set_schedule_location_workspace_from_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select wm.workspace_id into new.workspace_id
    from public.workspace_members wm
    where wm.user_id = new.owner_id and wm.role = 'owner'
    order by wm.created_at
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists schedule_locations_set_workspace on public.schedule_locations;
create trigger schedule_locations_set_workspace
  before insert on public.schedule_locations
  for each row execute function public.set_schedule_location_workspace_from_owner();

-- ---------------------------------------------------------------------------
-- restock_ingredient: require chef+ membership
-- ---------------------------------------------------------------------------
create or replace function public.restock_ingredient(
  p_ingredient_id uuid,
  p_new_price numeric,
  p_note text default null
)
returns public.ingredients
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.ingredients;
  v_workspace uuid;
begin
  if p_ingredient_id is null then
    raise exception 'INGREDIENT_REQUIRED' using errcode = '22023';
  end if;

  if p_new_price is null or p_new_price < 0 then
    raise exception 'INVALID_PRICE' using errcode = '22023';
  end if;

  if round(p_new_price, 2) <> p_new_price then
    raise exception 'INVALID_PRICE_PRECISION' using errcode = '22023';
  end if;

  select workspace_id into v_workspace
  from public.ingredients
  where id = p_ingredient_id;

  if v_workspace is null then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_member(v_workspace, 'chef') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  update public.ingredients
  set
    price = p_new_price,
    notes = case
      when p_note is null or length(trim(p_note)) = 0 then notes
      else left(trim(p_note), 500)
    end
  where id = p_ingredient_id
  returning * into v_row;

  if not found then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.ingredient_price_history (ingredient_id, price, workspace_id)
  values (p_ingredient_id, p_new_price, v_row.workspace_id);

  return v_row;
end;
$$;

revoke all on function public.restock_ingredient(uuid, numeric, text) from public;
grant execute on function public.restock_ingredient(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Workspace table policies (no is_member recursion on workspace_members)
-- ---------------------------------------------------------------------------
drop policy if exists workspaces_select_member on public.workspaces;
drop policy if exists workspaces_insert_authenticated on public.workspaces;
drop policy if exists workspaces_update_manager on public.workspaces;
drop policy if exists workspaces_delete_owner on public.workspaces;

create policy workspaces_select_member
  on public.workspaces for select to authenticated
  using (public.is_member(id, 'cook'));

create policy workspaces_insert_authenticated
  on public.workspaces for insert to authenticated
  with check (auth.uid() is not null);

create policy workspaces_update_manager
  on public.workspaces for update to authenticated
  using (public.is_member(id, 'manager'))
  with check (public.is_member(id, 'manager'));

create policy workspaces_delete_owner
  on public.workspaces for delete to authenticated
  using (public.is_member(id, 'owner'));

drop policy if exists workspace_members_select_own on public.workspace_members;
drop policy if exists workspace_members_insert_manager on public.workspace_members;
drop policy if exists workspace_members_update_manager on public.workspace_members;
drop policy if exists workspace_members_delete_manager on public.workspace_members;

-- CRITICAL: select only own rows to avoid is_member recursion
create policy workspace_members_select_own
  on public.workspace_members for select to authenticated
  using (user_id = auth.uid());

create policy workspace_members_insert_manager
  on public.workspace_members for insert to authenticated
  with check (
    -- bootstrap: first owner row for self
    (user_id = auth.uid() and role = 'owner')
    or exists (
      select 1 from public.workspace_members me
      where me.workspace_id = workspace_members.workspace_id
        and me.user_id = auth.uid()
        and public.workspace_role_rank(me.role) >= public.workspace_role_rank('manager')
    )
  );

create policy workspace_members_update_manager
  on public.workspace_members for update to authenticated
  using (
    exists (
      select 1 from public.workspace_members me
      where me.workspace_id = workspace_members.workspace_id
        and me.user_id = auth.uid()
        and (
          me.role = 'owner'
          or (me.role = 'manager' and workspace_members.role in ('chef', 'cook'))
        )
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members me
      where me.workspace_id = workspace_members.workspace_id
        and me.user_id = auth.uid()
        and (
          me.role = 'owner'
          or (me.role = 'manager' and workspace_members.role in ('chef', 'cook', 'manager'))
        )
    )
  );

create policy workspace_members_delete_manager
  on public.workspace_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members me
      where me.workspace_id = workspace_members.workspace_id
        and me.user_id = auth.uid()
        and (
          me.role = 'owner'
          or (me.role = 'manager' and workspace_members.role in ('chef', 'cook'))
        )
    )
  );

drop policy if exists workspace_invites_select_manager on public.workspace_invites;
drop policy if exists workspace_invites_insert_manager on public.workspace_invites;
drop policy if exists workspace_invites_update_manager on public.workspace_invites;
drop policy if exists workspace_invites_delete_manager on public.workspace_invites;

create policy workspace_invites_select_manager
  on public.workspace_invites for select to authenticated
  using (public.is_member(workspace_id, 'manager'));

create policy workspace_invites_insert_manager
  on public.workspace_invites for insert to authenticated
  with check (public.is_member(workspace_id, 'manager'));

create policy workspace_invites_update_manager
  on public.workspace_invites for update to authenticated
  using (public.is_member(workspace_id, 'manager'))
  with check (public.is_member(workspace_id, 'manager'));

create policy workspace_invites_delete_manager
  on public.workspace_invites for delete to authenticated
  using (public.is_member(workspace_id, 'manager'));

-- ---------------------------------------------------------------------------
-- Replace domain table policies (P1 venue-owner → workspace is_member)
-- ---------------------------------------------------------------------------

-- venues
drop policy if exists "Owners can select own venues" on public.venues;
drop policy if exists "Owners can insert own venues" on public.venues;
drop policy if exists "Owners can update own venues" on public.venues;
drop policy if exists "Owners can delete own venues" on public.venues;

create policy venues_select_member on public.venues
  for select to authenticated
  using (public.is_member(workspace_id, 'cook'));

create policy venues_insert_manager on public.venues
  for insert to authenticated
  with check (public.is_member(workspace_id, 'manager') and owner_id = auth.uid());

create policy venues_update_manager on public.venues
  for update to authenticated
  using (public.is_member(workspace_id, 'manager'))
  with check (public.is_member(workspace_id, 'manager'));

create policy venues_delete_owner on public.venues
  for delete to authenticated
  using (public.is_member(workspace_id, 'owner'));

-- ingredients
drop policy if exists "Owners can select venue ingredients" on public.ingredients;
drop policy if exists "Owners can insert venue ingredients" on public.ingredients;
drop policy if exists "Owners can update venue ingredients" on public.ingredients;
drop policy if exists "Owners can delete venue ingredients" on public.ingredients;

create policy ingredients_select_member on public.ingredients
  for select to authenticated using (public.is_member(workspace_id, 'cook'));
create policy ingredients_insert_chef on public.ingredients
  for insert to authenticated with check (public.is_member(workspace_id, 'chef'));
create policy ingredients_update_chef on public.ingredients
  for update to authenticated
  using (public.is_member(workspace_id, 'chef'))
  with check (public.is_member(workspace_id, 'chef'));
create policy ingredients_delete_chef on public.ingredients
  for delete to authenticated using (public.is_member(workspace_id, 'chef'));

-- ingredient_price_history
drop policy if exists "Owners can select ingredient price history" on public.ingredient_price_history;
drop policy if exists "Owners can insert ingredient price history" on public.ingredient_price_history;
drop policy if exists "Owners can update ingredient price history" on public.ingredient_price_history;
drop policy if exists "Owners can delete ingredient price history" on public.ingredient_price_history;

create policy ingredient_price_history_select_member on public.ingredient_price_history
  for select to authenticated using (public.is_member(workspace_id, 'cook'));
create policy ingredient_price_history_insert_chef on public.ingredient_price_history
  for insert to authenticated with check (public.is_member(workspace_id, 'chef'));
create policy ingredient_price_history_update_chef on public.ingredient_price_history
  for update to authenticated
  using (public.is_member(workspace_id, 'chef'))
  with check (public.is_member(workspace_id, 'chef'));
create policy ingredient_price_history_delete_chef on public.ingredient_price_history
  for delete to authenticated using (public.is_member(workspace_id, 'chef'));

-- recipes
drop policy if exists "Owners can select venue recipes" on public.recipes;
drop policy if exists "Owners can insert venue recipes" on public.recipes;
drop policy if exists "Owners can update venue recipes" on public.recipes;
drop policy if exists "Owners can delete venue recipes" on public.recipes;

create policy recipes_select_member on public.recipes
  for select to authenticated using (public.is_member(workspace_id, 'cook'));
create policy recipes_insert_chef on public.recipes
  for insert to authenticated with check (public.is_member(workspace_id, 'chef'));
create policy recipes_update_chef on public.recipes
  for update to authenticated
  using (public.is_member(workspace_id, 'chef'))
  with check (public.is_member(workspace_id, 'chef'));
create policy recipes_delete_chef on public.recipes
  for delete to authenticated using (public.is_member(workspace_id, 'chef'));

-- recipe_items
drop policy if exists "Owners can select recipe items" on public.recipe_items;
drop policy if exists "Owners can insert recipe items" on public.recipe_items;
drop policy if exists "Owners can update recipe items" on public.recipe_items;
drop policy if exists "Owners can delete recipe items" on public.recipe_items;

create policy recipe_items_select_member on public.recipe_items
  for select to authenticated using (public.is_member(workspace_id, 'cook'));
create policy recipe_items_insert_chef on public.recipe_items
  for insert to authenticated with check (public.is_member(workspace_id, 'chef'));
create policy recipe_items_update_chef on public.recipe_items
  for update to authenticated
  using (public.is_member(workspace_id, 'chef'))
  with check (public.is_member(workspace_id, 'chef'));
create policy recipe_items_delete_chef on public.recipe_items
  for delete to authenticated using (public.is_member(workspace_id, 'chef'));

-- checklist_templates
drop policy if exists "Owners can select venue checklist templates" on public.checklist_templates;
drop policy if exists "Owners can insert venue checklist templates" on public.checklist_templates;
drop policy if exists "Owners can update venue checklist templates" on public.checklist_templates;
drop policy if exists "Owners can delete venue checklist templates" on public.checklist_templates;

create policy checklist_templates_select_member on public.checklist_templates
  for select to authenticated using (public.is_member(workspace_id, 'cook'));
create policy checklist_templates_insert_chef on public.checklist_templates
  for insert to authenticated with check (public.is_member(workspace_id, 'chef'));
create policy checklist_templates_update_chef on public.checklist_templates
  for update to authenticated
  using (public.is_member(workspace_id, 'chef'))
  with check (public.is_member(workspace_id, 'chef'));
create policy checklist_templates_delete_chef on public.checklist_templates
  for delete to authenticated using (public.is_member(workspace_id, 'chef'));

-- checklist_runs: members can read; cook inserts/updates own run; chef deletes
drop policy if exists "Owners can select own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can insert own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can update own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can delete own checklist runs" on public.checklist_runs;

create policy checklist_runs_select_member on public.checklist_runs
  for select to authenticated using (public.is_member(workspace_id, 'cook'));
create policy checklist_runs_insert_cook on public.checklist_runs
  for insert to authenticated
  with check (
    public.is_member(workspace_id, 'cook')
    and user_id = auth.uid()
  );
create policy checklist_runs_update_cook on public.checklist_runs
  for update to authenticated
  using (
    public.is_member(workspace_id, 'cook')
    and (user_id = auth.uid() or public.is_member(workspace_id, 'chef'))
  )
  with check (
    public.is_member(workspace_id, 'cook')
    and (user_id = auth.uid() or public.is_member(workspace_id, 'chef'))
  );
create policy checklist_runs_delete_chef on public.checklist_runs
  for delete to authenticated using (public.is_member(workspace_id, 'chef'));

-- shift_checklist_items: cook can toggle items in workspace runs
drop policy if exists "Owners manage own shift checklist items" on public.shift_checklist_items;

create policy shift_checklist_items_select_member on public.shift_checklist_items
  for select to authenticated using (public.is_member(workspace_id, 'cook'));
create policy shift_checklist_items_insert_cook on public.shift_checklist_items
  for insert to authenticated with check (public.is_member(workspace_id, 'cook'));
create policy shift_checklist_items_update_cook on public.shift_checklist_items
  for update to authenticated
  using (public.is_member(workspace_id, 'cook'))
  with check (public.is_member(workspace_id, 'cook'));
create policy shift_checklist_items_delete_chef on public.shift_checklist_items
  for delete to authenticated using (public.is_member(workspace_id, 'chef'));

-- stock_levels
drop policy if exists "Owners can select venue stock levels" on public.stock_levels;
drop policy if exists "Owners can insert venue stock levels" on public.stock_levels;
drop policy if exists "Owners can update venue stock levels" on public.stock_levels;
drop policy if exists "Owners can delete venue stock levels" on public.stock_levels;

create policy stock_levels_select_member on public.stock_levels
  for select to authenticated using (public.is_member(workspace_id, 'cook'));
create policy stock_levels_insert_chef on public.stock_levels
  for insert to authenticated with check (public.is_member(workspace_id, 'chef'));
create policy stock_levels_update_chef on public.stock_levels
  for update to authenticated
  using (public.is_member(workspace_id, 'chef'))
  with check (public.is_member(workspace_id, 'chef'));
create policy stock_levels_delete_chef on public.stock_levels
  for delete to authenticated using (public.is_member(workspace_id, 'chef'));

-- stock_moves
drop policy if exists "Owners can select venue stock moves" on public.stock_moves;
drop policy if exists "Owners can insert venue stock moves" on public.stock_moves;
drop policy if exists "Owners can update venue stock moves" on public.stock_moves;
drop policy if exists "Owners can delete venue stock moves" on public.stock_moves;

create policy stock_moves_select_member on public.stock_moves
  for select to authenticated using (public.is_member(workspace_id, 'cook'));
create policy stock_moves_insert_chef on public.stock_moves
  for insert to authenticated with check (public.is_member(workspace_id, 'chef'));
create policy stock_moves_update_chef on public.stock_moves
  for update to authenticated
  using (public.is_member(workspace_id, 'chef'))
  with check (public.is_member(workspace_id, 'chef'));

-- Member-limit helper used by app + accept path
create or replace function public.workspace_member_seat_count(p_workspace_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    (select count(*)::integer from public.workspace_members where workspace_id = p_workspace_id)
    + (select count(*)::integer from public.workspace_invites
       where workspace_id = p_workspace_id
         and accepted_at is null
         and expires_at > now())
  );
$$;

revoke all on function public.workspace_member_seat_count(uuid) from public;
grant execute on function public.workspace_member_seat_count(uuid) to authenticated;

-- Entitlements: add members limit (Free 1, Starter 3, Pro 10)
create or replace function public.get_entitlements(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  entitlement record;
  effective text;
  member_limit integer;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select * into entitlement from public.billing_entitlement_row(p_user_id);
  effective := coalesce(entitlement.plan, 'free');
  member_limit := case effective
    when 'pro' then 10
    when 'starter' then 3
    else 1
  end;

  return jsonb_build_object(
    'plan', effective,
    'status', (entitlement.subscription).status,
    'trial_ends_at', (entitlement.subscription).trial_end,
    'grace', coalesce(entitlement.grace, false),
    'features', jsonb_build_object(
      'manageSubscription', effective <> 'free', 'schedule', effective <> 'free',
      'priceHistory', effective = 'pro', 'foodCostVariance', effective = 'pro',
      'basicReports', effective = 'pro', 'prepListPdf', effective <> 'free',
      'stockWriteOff', effective <> 'free', 'stockRestock', effective <> 'free',
      'stockInventory', effective = 'pro',
      'teamMembers', effective <> 'free'
    ),
    'limits', jsonb_build_object(
      'recipes', case when effective = 'free' then 5 end,
      'ingredients', case when effective = 'free' then 20 end,
      'templates', case effective when 'free' then 1 when 'starter' then 3 end,
      'timers', case when effective <> 'pro' then 2 end,
      'stockItems', case effective when 'free' then 10 when 'starter' then 40 end,
      'locations', 1,
      'members', member_limit
    )
  );
end
$$;

revoke all on function public.get_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.get_entitlements(uuid) to authenticated;
