-- Tenant isolation. Workspace data is shared by role within a workspace.
-- Personal profiles, subscriptions and consent history remain scoped to the user.
-- Billing, audit history and schedule mutations retain their restricted entry points.
-- Venues, recipes, ingredients, checklists, stock, suppliers, purchase orders,
-- waste and derived reporting rows are intentionally shared by workspace role.
-- Workspaces share their roster and active invitations with authorized managers.
-- Schedule owners share assigned locations with active employees. Public reads
-- remain limited to token-based schedule previews and opted-in recipe allergens.

create schema if not exists tenant_private;
revoke all on schema tenant_private from public, anon, authenticated;

alter table public.workspaces add column if not exists created_by uuid
  references auth.users (id) on delete set null;

-- Signup provisions a workspace through its trusted trigger. Authenticated
-- creation uses the same atomic workspace + owner membership pattern.
create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  insert into public.workspaces (name, created_by)
  values (trim(p_name), v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');

  return v_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text) from public, anon, authenticated;
grant execute on function public.create_workspace(text) to authenticated;

-- Existing workspace membership is created only by acceptance of an invite.
drop policy if exists workspace_members_insert_manager on public.workspace_members;
revoke insert on public.workspace_members from public, anon, authenticated;
drop policy if exists workspaces_insert_authenticated on public.workspaces;
revoke insert, update on public.workspaces from public, anon, authenticated;
grant update (name) on public.workspaces to authenticated;

-- Managers need to see roster rows to manage them. Member identities and
-- workspace IDs are fixed. Only an owner may manage owner/manager roles.
drop policy if exists workspace_members_select_manager on public.workspace_members;
create policy workspace_members_select_manager on public.workspace_members
  for select to authenticated using (public.is_member(workspace_id, 'manager'));

drop policy if exists workspace_members_update_manager on public.workspace_members;
create policy workspace_members_update_manager on public.workspace_members
  for update to authenticated
  using (
    user_id <> (select auth.uid()) and (
      public.is_member(workspace_id, 'owner')
      or (public.is_member(workspace_id, 'manager') and role in ('chef', 'cook'))
    )
  )
  with check (
    user_id <> (select auth.uid()) and (
      public.is_member(workspace_id, 'owner')
      or (public.is_member(workspace_id, 'manager') and role in ('chef', 'cook'))
    )
  );

drop policy if exists workspace_members_delete_manager on public.workspace_members;
create policy workspace_members_delete_manager on public.workspace_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_member(workspace_id, 'owner')
    or (public.is_member(workspace_id, 'manager') and role in ('chef', 'cook'))
  );

revoke update on public.workspace_members from public, anon, authenticated;
grant update (role) on public.workspace_members to authenticated;

create or replace function public.workspace_members_guard_last_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_setting('role') = 'authenticated'
     and old.role <> 'owner' and new.role = 'owner' then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if old.role <> 'owner' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' then return new; end if;

  perform from public.workspaces w where w.id = old.workspace_id for update;
  if found and not exists (
    select from public.workspace_members wm
    where wm.workspace_id = old.workspace_id and wm.user_id <> old.user_id and wm.role = 'owner'
  ) then
    if tg_op <> 'DELETE' or exists (select from auth.users u where u.id = old.user_id)
       or exists (
         select from public.workspace_members wm
         where wm.workspace_id = old.workspace_id and wm.user_id <> old.user_id
       ) then
      raise exception 'LAST_OWNER';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

drop policy if exists "Owners can select own venues" on public.venues;
drop policy if exists "Owners can insert own venues" on public.venues;
drop policy if exists "Owners can update own venues" on public.venues;
drop policy if exists "Owners can delete own venues" on public.venues;
drop policy if exists "Owners can select own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can insert own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can update own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can delete own checklist runs" on public.checklist_runs;

-- Keep venue ownership fixed for API clients. A venue manager may edit its name.
revoke update on public.venues from public, anon, authenticated;
grant update (name) on public.venues to authenticated;

create or replace function public.is_venue_owner(p_venue_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select from public.venues v
    where v.id = p_venue_id and v.owner_id = (select auth.uid())
      and public.is_member(v.workspace_id, 'cook')
  );
$$;

drop policy if exists checklist_runs_insert_cook on public.checklist_runs;
create policy checklist_runs_insert_cook on public.checklist_runs
  for insert to authenticated with check (
    public.is_member(workspace_id, 'cook') and user_id = (select auth.uid())
    and exists (
      select from public.checklist_templates t
      where t.id = checklist_runs.template_id
        and t.venue_id = checklist_runs.venue_id
    )
  );

drop policy if exists checklist_runs_update_cook on public.checklist_runs;
create policy checklist_runs_update_cook on public.checklist_runs
  for update to authenticated
  using (
    public.is_member(workspace_id, 'cook')
    and (user_id = (select auth.uid()) or public.is_member(workspace_id, 'chef'))
  )
  with check (
    public.is_member(workspace_id, 'cook')
    and (user_id = (select auth.uid()) or public.is_member(workspace_id, 'chef'))
    and exists (
      select from public.checklist_templates t
      where t.id = checklist_runs.template_id
        and t.venue_id = checklist_runs.venue_id
    )
  );

-- Each trigger receives pairs of foreign key column and parent table. For rows
-- without workspace_id, the first parent supplies the workspace for checks.
-- Workspace identifiers are fixed so later parent updates cannot split a tenant.
create or replace function public.assert_same_workspace()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_workspace uuid := (v_new->>'workspace_id')::uuid;
  v_parent_workspace uuid;
  v_parent_id uuid;
  v_pos integer;
begin
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    if v_new ? 'workspace_id' then
      if (v_old->>'workspace_id')::uuid is distinct from v_workspace then
        raise exception 'WORKSPACE_MISMATCH' using errcode = '42501';
      end if;
    else
      execute format('select workspace_id from public.%I where id = $1', tg_argv[1])
        into v_workspace using (v_old->>tg_argv[0])::uuid;
    end if;
  end if;

  for v_pos in 0..(tg_nargs - 1) by 2 loop
    v_parent_id := (v_new->>tg_argv[v_pos])::uuid;
    if v_parent_id is null then
      continue;
    end if;

    execute format('select workspace_id from public.%I where id = $1 for key share', tg_argv[v_pos + 1])
      into v_parent_workspace using v_parent_id;
    if v_parent_workspace is null or
       (v_workspace is not null and v_workspace <> v_parent_workspace) then
      raise exception 'WORKSPACE_MISMATCH' using errcode = '42501';
    end if;
    v_workspace := v_parent_workspace;
  end loop;

  if v_new ? 'workspace_id' then
    new.workspace_id := v_workspace;
  end if;
  return new;
end;
$$;

revoke all on function public.assert_same_workspace() from public, anon, authenticated;

do $$
declare
  v_spec record;
  v_column text;
  v_parent text;
  v_offset integer;
  v_scope text;
  v_mismatch boolean;
begin
  for v_spec in
    select * from (values
      ('venues', true, array[]::text[]),
      ('suppliers', true, array[]::text[]),
      ('ingredients', true, array['venue_id', 'venues', 'supplier_id', 'suppliers']),
      ('ingredient_price_history', true, array['ingredient_id', 'ingredients']),
      ('recipes', true, array['venue_id', 'venues']),
      ('recipe_items', true, array['recipe_id', 'recipes', 'ingredient_id', 'ingredients']),
      ('checklist_templates', true, array['venue_id', 'venues']),
      ('checklist_runs', true, array['venue_id', 'venues', 'template_id', 'checklist_templates']),
      ('shift_checklist_items', true, array['run_id', 'checklist_runs']),
      ('stock_levels', true, array['venue_id', 'venues', 'ingredient_id', 'ingredients']),
      ('stock_moves', true, array['venue_id', 'venues', 'ingredient_id', 'ingredients']),
      ('purchase_orders', true, array['supplier_id', 'suppliers']),
      ('purchase_order_items', false, array['purchase_order_id', 'purchase_orders', 'ingredient_id', 'ingredients']),
      ('stock_movements', true, array['ingredient_id', 'ingredients', 'purchase_order_id', 'purchase_orders']),
      ('recipe_cost_snapshot', true, array['recipe_id', 'recipes']),
      ('waste_entries', true, array['ingredient_id', 'ingredients', 'recipe_id', 'recipes', 'corrects_entry_id', 'waste_entries'])
    ) as rules(child, has_workspace, parents)
  loop
    execute format('lock table public.%I in share row exclusive mode', v_spec.child);

    -- A pre-existing mismatch needs review before declaring the data isolated.
    v_scope := case when v_spec.has_workspace then 'child.workspace_id' else format(
      '(select workspace_id from public.%I where id = child.%I)',
      v_spec.parents[2], v_spec.parents[1]) end;

    for v_offset in 1..cardinality(v_spec.parents) by 2 loop
      v_column := v_spec.parents[v_offset];
      v_parent := v_spec.parents[v_offset + 1];
      execute format(
        'select exists (select from public.%I child join public.%I parent on parent.id = child.%I
          where %s is distinct from parent.workspace_id)',
        v_spec.child, v_parent, v_column, v_scope
      ) into v_mismatch;
      if v_mismatch then
        raise exception 'Existing workspace mismatch in %.%', v_spec.child, v_column;
      end if;
    end loop;

    execute format('drop trigger if exists enforce_workspace_scope on public.%I', v_spec.child);
    execute format(
      'create trigger enforce_workspace_scope before insert or update on public.%I
        for each row execute function public.assert_same_workspace(%s)',
      v_spec.child, coalesce(
        (select string_agg(quote_literal(arg), ', ' order by pos)
         from unnest(v_spec.parents) with ordinality as args(arg, pos)), '')
    );
  end loop;
end;
$$;

-- An allergen row inherits its workspace solely from ingredient_id. The
-- ingredient_allergens policies check the associated ingredient on all writes.
-- A supplier has no parent in the kitchen domain and its workspace is fixed.

alter table billing_archive.legacy_customers enable row level security;
alter table billing_archive.legacy_subscriptions enable row level security;

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
    insert into public.workspaces (name, created_by)
    values ('Moja kuhinja', new.id)
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

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Invite acceptance needs the seat count before the invitee becomes a member.
create or replace function tenant_private.workspace_member_seat_count(p_workspace_id uuid)
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

revoke all on function tenant_private.workspace_member_seat_count(uuid) from public, anon, authenticated;

create or replace function tenant_private.workspace_member_limit(p_workspace_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case (select ent.plan from public.billing_entitlement_row(wm.user_id) ent)
    when 'advanced' then 10
    when 'pro' then 10
    when 'starter' then 3
    else 1
  end
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id and wm.role = 'owner'
  order by wm.created_at, wm.user_id
  limit 1;
$$;

revoke all on function tenant_private.workspace_member_limit(uuid) from public, anon, authenticated;

create or replace function public.workspace_member_limit(p_workspace_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case when public.is_member(p_workspace_id, 'cook')
    then coalesce(tenant_private.workspace_member_limit(p_workspace_id), 1)
    else 0 end;
$$;

revoke all on function public.workspace_member_limit(uuid) from public, anon, authenticated;
grant execute on function public.workspace_member_limit(uuid) to authenticated;

-- Invite creation and acceptance serialize on the same workspace row. Direct
-- changes to accepted_at/accepted_by are reserved for the acceptance function.
drop policy if exists workspace_invites_update_manager on public.workspace_invites;
revoke update on public.workspace_invites from public, anon, authenticated;

create or replace function public.enforce_workspace_invite_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('role') = 'authenticated' then
    if not public.is_member(new.workspace_id, 'manager')
       or new.accepted_at is not null or new.accepted_by is not null then
      raise exception 'Access denied' using errcode = '42501';
    end if;
    perform from public.workspaces w where w.id = new.workspace_id for update;
    if tenant_private.workspace_member_seat_count(new.workspace_id)
         >= coalesce(tenant_private.workspace_member_limit(new.workspace_id), 1) then
      raise exception 'MEMBER_LIMIT' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_workspace_invite_limit() from public, anon, authenticated;
drop trigger if exists workspace_invite_limit on public.workspace_invites;
create trigger workspace_invite_limit before insert on public.workspace_invites
  for each row execute function public.enforce_workspace_invite_limit();

create or replace function public.workspace_member_seat_count(p_workspace_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case when public.is_member(p_workspace_id, 'cook')
    then tenant_private.workspace_member_seat_count(p_workspace_id)
    else 0 end;
$$;

revoke all on function public.workspace_member_seat_count(uuid) from public, anon, authenticated;
grant execute on function public.workspace_member_seat_count(uuid) to authenticated;

create or replace function public.accept_workspace_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.workspace_invites%rowtype;
  v_limit integer;
  v_seats integer;
  v_workspace_id uuid;
begin
  if v_uid is null then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null or v_email = '' then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  select i.workspace_id into v_workspace_id
  from public.workspace_invites i
  where i.token_hash = p_token_hash;

  perform from public.workspaces w where w.id = v_workspace_id for update;

  select * into v_invite
  from public.workspace_invites i
  where i.token_hash = p_token_hash and i.workspace_id = v_workspace_id
  for update;

  if not found
     or v_invite.accepted_at is not null
     or v_invite.expires_at <= now() then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  if lower(trim(v_invite.email)) is distinct from v_email then
    raise exception 'INVITE_EMAIL_MISMATCH' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = v_invite.workspace_id and wm.user_id = v_uid
  ) then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  v_limit := coalesce(tenant_private.workspace_member_limit(v_invite.workspace_id), 1);

  -- The pending invitation already occupies the seat being converted to membership.
  v_seats := tenant_private.workspace_member_seat_count(v_invite.workspace_id);
  if v_seats > v_limit then
    raise exception 'MEMBER_LIMIT' using errcode = 'P0001';
  end if;

  update public.workspace_invites
  set accepted_at = now(), accepted_by = v_uid
  where id = v_invite.id
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, v_uid, v_invite.role);

  return v_invite.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(text) from public, anon, authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;

-- Published allergens have their own opt-in gate and can check plan features internally.
create or replace function tenant_private.workspace_has_feature(
  p_workspace_id uuid,
  p_feature text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan text;
  v_pro_plus boolean;
  v_starter_plus boolean;
begin
  if p_workspace_id is null or p_feature is null or length(trim(p_feature)) = 0 then
    return false;
  end if;

  select wm.user_id into v_owner
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.role = 'owner'
  order by wm.created_at asc, wm.user_id
  limit 1;

  if v_owner is null then
    return false;
  end if;

  v_plan := coalesce((select plan from public.billing_entitlement_row(v_owner)), 'free');
  v_pro_plus := v_plan in ('pro', 'advanced', 'team', 'business');
  v_starter_plus := v_plan in ('starter', 'pro', 'advanced', 'team', 'business');

  return case p_feature
    when 'allergens' then v_pro_plus
    when 'manageSubscription' then v_plan <> 'free'
    when 'schedule' then v_plan <> 'free'
    when 'priceHistory' then v_pro_plus
    when 'foodCostVariance' then v_pro_plus
    when 'foodCostAlarm' then v_starter_plus
    when 'food_cost_alarm' then v_starter_plus
    when 'stockAlerts' then v_starter_plus
    when 'stock_alerts' then v_starter_plus
    when 'purchaseOrders' then v_pro_plus
    when 'purchase_orders' then v_pro_plus
    when 'basicReports' then v_pro_plus
    when 'prepListPdf' then v_plan <> 'free'
    when 'stockWriteOff' then v_plan <> 'free'
    when 'stockRestock' then v_plan <> 'free'
    when 'stockInventory' then v_pro_plus
    when 'teamMembers' then v_plan <> 'free'
    when 'waste_log' then v_starter_plus
    when 'wasteLog' then v_starter_plus
    when 'waste_export_csv' then v_starter_plus
    when 'wasteExportCsv' then v_starter_plus
    when 'waste_export_pdf_xlsx' then v_pro_plus
    when 'wasteExportPdfXlsx' then v_pro_plus
    else false
  end;
end;
$$;

revoke all on function tenant_private.workspace_has_feature(uuid, text) from public, anon, authenticated;

create or replace function public.workspace_has_feature(p_workspace_id uuid, p_feature text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case when public.is_member(p_workspace_id, 'cook')
    then tenant_private.workspace_has_feature(p_workspace_id, p_feature)
    else false end;
$$;

revoke all on function public.workspace_has_feature(uuid, text) from public, anon, authenticated;
grant execute on function public.workspace_has_feature(uuid, text) to authenticated;

create or replace function public.published_recipe_allergens(p_recipe_id uuid)
returns table (
  allergen_code text,
  presence text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_published boolean;
  v_show boolean;
begin
  if p_recipe_id is null then
    return;
  end if;

  select r.workspace_id, r.published, r.show_allergens_public
  into v_workspace, v_published, v_show
  from public.recipes r
  where r.id = p_recipe_id;

  if v_workspace is null then
    return;
  end if;

  if not coalesce(v_published, false) then
    return;
  end if;

  if not coalesce(v_show, false) then
    return;
  end if;

  if not tenant_private.workspace_has_feature(v_workspace, 'allergens') then
    return;
  end if;

  return query
  select
    ia.allergen_code,
    case
      when bool_or(ia.presence = 'contains') then 'contains'
      else 'trace'
    end as presence
  from public.recipe_items ri
  join public.ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id
  where ri.recipe_id = p_recipe_id
  group by ia.allergen_code
  order by ia.allergen_code;
end;
$$;

create or replace function public.refresh_recipe_cost_snapshot(p_recipe_id uuid)
returns table (
  recipe_id uuid,
  workspace_id uuid,
  portion_cost numeric,
  selling_price_net numeric,
  food_cost_pct numeric,
  target_food_cost_pct numeric,
  old_food_cost_pct numeric,
  skipped boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_portions numeric;
  v_selling numeric;
  v_target numeric;
  v_name text;
  v_old_pct numeric;
  v_batch numeric := 0;
  v_line numeric;
  v_has_items boolean := false;
  v_portion numeric;
  v_pct numeric;
  v_item record;
begin
  if p_recipe_id is null then
    return;
  end if;

  select r.workspace_id, r.portions, r.selling_price_net, r.target_food_cost_pct, r.name
  into v_workspace, v_portions, v_selling, v_target, v_name
  from public.recipes r
  where r.id = p_recipe_id and (
    current_setting('role') in ('none', 'service_role')
    or public.is_member(r.workspace_id, 'cook')
  );

  if v_workspace is null then
    if current_setting('role') not in ('none', 'service_role') then
      raise exception 'Access denied' using errcode = '42501';
    end if;
    return;
  end if;

  select s.food_cost_pct into v_old_pct
  from public.recipe_cost_snapshot s
  where s.recipe_id = p_recipe_id;

  if v_portions is null or v_portions <= 0 then
    recipe_id := p_recipe_id;
    workspace_id := v_workspace;
    portion_cost := null;
    selling_price_net := v_selling;
    food_cost_pct := null;
    target_food_cost_pct := v_target;
    old_food_cost_pct := v_old_pct;
    skipped := true;
    return next;
    return;
  end if;

  for v_item in
    select ri.quantity, i.unit, i.price, i.waste_percent
    from public.recipe_items ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = p_recipe_id
  loop
    v_has_items := true;
    -- Stored recipe quantities use the ingredient unit (app convention).
    v_line := public.calc_line_cost(
      v_item.quantity,
      v_item.unit,
      v_item.price,
      v_item.unit,
      coalesce(v_item.waste_percent, 0)
    );
    if v_line is null then
      -- Unpriced / invalid ingredient → skip entire recipe (do not write zeros).
      recipe_id := p_recipe_id;
      workspace_id := v_workspace;
      portion_cost := null;
      selling_price_net := v_selling;
      food_cost_pct := null;
      target_food_cost_pct := v_target;
      old_food_cost_pct := v_old_pct;
      skipped := true;
      return next;
      return;
    end if;
    v_batch := v_batch + v_line;
  end loop;

  if not v_has_items then
    recipe_id := p_recipe_id;
    workspace_id := v_workspace;
    portion_cost := null;
    selling_price_net := v_selling;
    food_cost_pct := null;
    target_food_cost_pct := v_target;
    old_food_cost_pct := v_old_pct;
    skipped := true;
    return next;
    return;
  end if;

  v_portion := v_batch / v_portions;

  if v_selling is not null and v_selling > 0 then
    v_pct := (v_portion / v_selling) * 100;
  else
    v_pct := null;
  end if;

  insert into public.recipe_cost_snapshot as s (
    recipe_id,
    workspace_id,
    portion_cost,
    selling_price_net,
    food_cost_pct,
    target_food_cost_pct,
    computed_at
  )
  values (
    p_recipe_id,
    v_workspace,
    v_portion,
    v_selling,
    v_pct,
    coalesce(v_target, 30),
    now()
  )
  on conflict on constraint recipe_cost_snapshot_pkey do update
  set
    workspace_id = excluded.workspace_id,
    portion_cost = excluded.portion_cost,
    selling_price_net = excluded.selling_price_net,
    food_cost_pct = excluded.food_cost_pct,
    target_food_cost_pct = excluded.target_food_cost_pct,
    computed_at = excluded.computed_at;

  recipe_id := p_recipe_id;
  workspace_id := v_workspace;
  portion_cost := v_portion;
  selling_price_net := v_selling;
  food_cost_pct := v_pct;
  target_food_cost_pct := coalesce(v_target, 30);
  old_food_cost_pct := v_old_pct;
  skipped := false;
  return next;
end;
$$;

revoke all on function public.refresh_recipe_cost_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.refresh_recipe_cost_snapshot(uuid) to authenticated;

create or replace function public.check_food_cost_alert(p_recipe_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snap record;
  v_name text;
  v_diff numeric;
begin
  if p_recipe_id is null then
    return;
  end if;

  if current_setting('role') not in ('none', 'service_role') and not exists (
    select from public.recipes r where r.id = p_recipe_id
      and public.is_member(r.workspace_id, 'chef')
  ) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select * into v_snap
  from public.refresh_recipe_cost_snapshot(p_recipe_id)
  limit 1;

  if v_snap is null or v_snap.skipped or v_snap.food_cost_pct is null then
    return;
  end if;

  if v_snap.selling_price_net is null or v_snap.selling_price_net <= 0 then
    return;
  end if;

  if not tenant_private.workspace_has_feature(v_snap.workspace_id, 'foodCostAlarm') then
    return;
  end if;

  if v_snap.food_cost_pct <= v_snap.target_food_cost_pct then
    return;
  end if;

  -- Crossing rule: previous must be null or at/under target.
  if v_snap.old_food_cost_pct is not null
     and v_snap.old_food_cost_pct > v_snap.target_food_cost_pct then
    return;
  end if;

  -- Already has an active unread alert.
  if exists (
    select 1
    from public.alerts a
    where a.kind = 'food_cost_over_target'
      and a.subject_id = p_recipe_id
      and a.read_at is null
  ) then
    return;
  end if;

  select name into v_name from public.recipes where id = p_recipe_id;
  v_diff := v_snap.food_cost_pct - v_snap.target_food_cost_pct;

  insert into public.alerts (workspace_id, kind, subject_id, payload)
  values (
    v_snap.workspace_id,
    'food_cost_over_target',
    p_recipe_id,
    jsonb_build_object(
      'recipe_name', coalesce(v_name, ''),
      'portion_cost', v_snap.portion_cost,
      'selling_price_net', v_snap.selling_price_net,
      'food_cost_pct', v_snap.food_cost_pct,
      'target_food_cost_pct', v_snap.target_food_cost_pct,
      'diff_pct', v_diff
    )
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.check_food_cost_alert(uuid) from public, anon, authenticated;
grant execute on function public.check_food_cost_alert(uuid) to authenticated;

create or replace function public.check_low_stock_alert(p_ingredient_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_prev numeric;
begin
  if p_ingredient_id is null then
    return;
  end if;

  select
    i.id,
    i.workspace_id,
    i.name,
    i.unit,
    i.par_level,
    i.current_stock
  into v_row
  from public.ingredients i
  where i.id = p_ingredient_id;

  if v_row.id is null or v_row.par_level is null then
    return;
  end if;

  if current_setting('role') not in ('none', 'service_role')
     and not public.is_member(v_row.workspace_id, 'chef') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- Resolved: stock back at/above par → mark unread low_stock alerts read.
  if v_row.current_stock >= v_row.par_level then
    update public.alerts
    set read_at = now()
    where kind = 'low_stock'
      and subject_id = p_ingredient_id
      and read_at is null;
    return;
  end if;

  if not tenant_private.workspace_has_feature(v_row.workspace_id, 'stockAlerts') then
    return;
  end if;

  -- Crossing detection uses session GUC set by adjust_stock before update.
  begin
    v_prev := nullif(current_setting('treuplate.stock_prev', true), '')::numeric;
  exception
    when others then
      v_prev := null;
  end;

  -- If previous was already under par, do not open a new alert.
  if v_prev is not null and v_prev < v_row.par_level then
    return;
  end if;

  if exists (
    select 1
    from public.alerts a
    where a.kind = 'low_stock'
      and a.subject_id = p_ingredient_id
      and a.read_at is null
  ) then
    return;
  end if;

  insert into public.alerts (workspace_id, kind, subject_id, payload)
  values (
    v_row.workspace_id,
    'low_stock',
    p_ingredient_id,
    jsonb_build_object(
      'ingredient_name', coalesce(v_row.name, ''),
      'current_stock', v_row.current_stock,
      'par_level', v_row.par_level,
      'unit', coalesce(v_row.unit, '')
    )
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.check_low_stock_alert(uuid) from public, anon, authenticated;

create or replace function public.apply_ingredient_price_internal(
  p_ingredient_id uuid,
  p_new_price numeric,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_recipe_id uuid;
  v_old_price numeric;
begin
  if p_ingredient_id is null then
    raise exception 'INGREDIENT_REQUIRED' using errcode = '22023';
  end if;
  if p_new_price is null or p_new_price < 0 then
    raise exception 'INVALID_PRICE' using errcode = '22023';
  end if;
  if p_new_price in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_new_price >= 10000000000
     or round(p_new_price, 2) <> p_new_price then
    raise exception 'INVALID_PRICE_PRECISION' using errcode = '22023';
  end if;
  if p_note is not null and char_length(trim(p_note)) > 500 then
    raise exception 'INVALID_RESTOCK_INPUT' using errcode = '22023';
  end if;

  select workspace_id, price into v_workspace, v_old_price
  from public.ingredients
  where id = p_ingredient_id
  for update;

  if v_workspace is null then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if current_setting('role') not in ('none', 'service_role')
     and not public.is_member(v_workspace, 'chef') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  update public.ingredients
  set
    price = p_new_price,
    notes = case
      when p_note is null or length(trim(p_note)) = 0 then notes
      else left(trim(p_note), 500)
    end
  where id = p_ingredient_id;

  if v_old_price is not distinct from p_new_price
     or not tenant_private.workspace_has_feature(v_workspace, 'stockRestock') then
    insert into public.ingredient_price_history (ingredient_id, price, workspace_id)
    values (p_ingredient_id, p_new_price, v_workspace);
  end if;

  for v_recipe_id in
    select distinct ri.recipe_id
    from public.recipe_items ri
    where ri.ingredient_id = p_ingredient_id
  loop
    perform public.check_food_cost_alert(v_recipe_id);
  end loop;
end;
$$;

revoke all on function public.apply_ingredient_price_internal(uuid, numeric, text) from public, anon, authenticated;

create or replace function public.receive_purchase_order(
  p_order_id uuid,
  p_lines jsonb
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.purchase_orders;
  v_line jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_price numeric;
  v_item record;
  v_all_received boolean;
  v_count int;
begin
  if p_order_id is null then
    raise exception 'ORDER_REQUIRED' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'INVALID_LINES' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 200 then
    raise exception 'INVALID_LINE_COUNT' using errcode = '22023';
  end if;

  select po.* into v_order
  from public.purchase_orders po
  where po.id = p_order_id and public.is_member(po.workspace_id, 'chef')
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_order.status = 'primljeno' then
    raise exception 'ORDER_ALREADY_RECEIVED' using errcode = 'P0001';
  end if;

  if v_order.status not in ('poslato', 'nacrt') then
    raise exception 'ORDER_NOT_RECEIVABLE' using errcode = 'P0001';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    begin
      v_item_id := (v_line ->> 'item_id')::uuid;
    exception
      when others then
        raise exception 'INVALID_ITEM_ID' using errcode = '22023';
    end;

    begin
      v_qty := (v_line ->> 'qty_received')::numeric;
    exception
      when others then
        raise exception 'INVALID_QTY' using errcode = '22023';
    end;

    if v_qty is null or v_qty < 0 or round(v_qty, 4) <> v_qty then
      raise exception 'INVALID_QTY' using errcode = '22023';
    end if;

    if v_line ? 'unit_price' and nullif(v_line ->> 'unit_price', '') is not null then
      begin
        v_price := (v_line ->> 'unit_price')::numeric;
      exception
        when others then
          raise exception 'INVALID_PRICE' using errcode = '22023';
      end;
      if v_price is null or v_price < 0 or round(v_price, 2) <> v_price then
        raise exception 'INVALID_PRICE' using errcode = '22023';
      end if;
    else
      v_price := null;
    end if;

    select poi.*
    into v_item
    from public.purchase_order_items poi
    where poi.id = v_item_id
      and poi.purchase_order_id = p_order_id
    for update;

    if not found then
      raise exception 'ITEM_NOT_FOUND' using errcode = 'P0002';
    end if;

    if v_item.ingredient_id is not null and not exists (
      select from public.ingredients i
      where i.id = v_item.ingredient_id and i.workspace_id = v_order.workspace_id
    ) then
      raise exception 'WORKSPACE_MISMATCH' using errcode = '42501';
    end if;

    -- Idempotent line: if already fully recorded with same qty, skip stock again.
    if v_item.qty_received is not null and v_item.qty_received = v_qty then
      if v_price is not null and v_item.unit_price_received is distinct from v_price then
        update public.purchase_order_items
        set unit_price_received = v_price
        where id = v_item_id;
        if v_item.ingredient_id is not null and v_price > 0 then
          perform public.apply_ingredient_price_internal(
            v_item.ingredient_id,
            v_price,
            'prijem narudžbenice'
          );
        end if;
      end if;
      continue;
    end if;

    -- Prevent double-adding stock on partial re-entry: only apply delta of new receipt.
    if v_item.qty_received is not null then
      raise exception 'ITEM_ALREADY_RECEIVED' using errcode = 'P0001';
    end if;

    update public.purchase_order_items
    set
      qty_received = v_qty,
      unit_price_received = v_price
    where id = v_item_id;

    if v_qty > 0 then
      if v_item.ingredient_id is null then
        raise exception 'INGREDIENT_REQUIRED' using errcode = '22023';
      end if;

      perform public.adjust_stock(
        v_item.ingredient_id,
        v_qty,
        'prijem',
        'prijem narudžbenice',
        p_order_id,
        false
      );

      if v_price is not null and v_price > 0 then
        perform public.apply_ingredient_price_internal(
          v_item.ingredient_id,
          v_price,
          'prijem narudžbenice'
        );
      end if;
    end if;
  end loop;

  select bool_and(qty_received is not null), count(*)::int
  into v_all_received, v_count
  from public.purchase_order_items
  where purchase_order_id = p_order_id;

  if v_count = 0 then
    raise exception 'ORDER_EMPTY' using errcode = 'P0001';
  end if;

  if v_all_received then
    update public.purchase_orders
    set
      status = 'primljeno',
      received_at = now()
    where id = p_order_id
    returning * into v_order;
  else
    -- Partial: ensure at least poslato
    update public.purchase_orders
    set status = case when status = 'nacrt' then 'poslato' else status end
    where id = p_order_id
    returning * into v_order;
  end if;

  return v_order;
end;
$$;

revoke execute on function public.receive_purchase_order(uuid, jsonb) from public, anon;

-- Reassert narrower grants for public-schema routines with inherited API grants.
revoke execute on function public.is_venue_owner(uuid),
  public.is_member(uuid, text), public.list_workspace_members(uuid),
  public.lookup_workspace_invite(text), public.mark_alert_read(uuid),
  public.adjust_stock(uuid, numeric, text, text, uuid, boolean),
  public.allocate_purchase_order_number(uuid),
  public.mark_purchase_order_sent(uuid, text), public.revert_purchase_order_sent(uuid),
  public.set_ingredient_allergens(uuid, jsonb)
  from public, anon;

-- Schedule tables keep their direct grants revoked. This helper avoids
-- recursive RLS between employees and locations if policies are evaluated.
create or replace function public.schedule_location_access(p_location_id uuid, p_owner_only boolean)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select from public.schedule_locations l
    where l.id = p_location_id and l.owner_id = (select auth.uid())
  ) or (
    not p_owner_only and exists (
      select from public.schedule_employees e
      where e.location_id = p_location_id and e.user_id = (select auth.uid()) and e.active
    )
  );
$$;

revoke all on function public.schedule_location_access(uuid, boolean) from public, anon, authenticated;
grant execute on function public.schedule_location_access(uuid, boolean) to authenticated;

drop policy if exists "Schedule location members select" on public.schedule_locations;
create policy "Schedule location members select"
  on public.schedule_locations for select to authenticated
  using (public.schedule_location_access(schedule_locations.id, false));

drop policy if exists "Schedule employees owner all" on public.schedule_employees;
create policy "Schedule employees owner all"
  on public.schedule_employees for all to authenticated
  using (public.schedule_location_access(schedule_employees.location_id, true))
  with check (public.schedule_location_access(schedule_employees.location_id, true));

drop policy if exists "Schedule publications member select" on public.schedule_publications;
create policy "Schedule publications member select"
  on public.schedule_publications for select to authenticated
  using (public.schedule_location_access(schedule_publications.location_id, false));

-- Apply the same allowlist to old stored previews and to new ones.
create or replace function tenant_private.schedule_share_payload(p_preview jsonb)
returns jsonb
language sql immutable set search_path = public
as $$
  select case when p_preview is not null then jsonb_build_object(
    'venueName', p_preview->'venueName',
    'monday', p_preview->'monday',
    'employees', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', employee->'id',
        'full_name', employee->'full_name'
      ) order by pos), '[]'::jsonb)
      from jsonb_array_elements(p_preview->'employees') with ordinality as e(employee, pos)
    ),
    'assignments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'employee_id', assignment->'employee_id',
        'date', assignment->'date',
        'code', assignment->'code',
        'custom_start', assignment->'custom_start',
        'custom_end', assignment->'custom_end'
      ) order by pos), '[]'::jsonb)
      from jsonb_array_elements(p_preview->'assignments') with ordinality as a(assignment, pos)
    )
  ) end;
$$;

revoke all on function tenant_private.schedule_share_payload(jsonb) from public, anon, authenticated;

create or replace function public.schedule_preview(p_location uuid, p_week date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select tenant_private.schedule_share_payload(jsonb_build_object(
    'venueName', l.name,
    'monday', p_week,
    'employees', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'full_name', case
              when cardinality(parts.names) > 1
                then parts.names[1] || ' ' || left(parts.names[cardinality(parts.names)], 1) || '.'
              else parts.names[1]
            end
          )
          order by e.created_at, e.id
        ),
        '[]'::jsonb
      )
      from public.schedule_staff(l.id) e
      cross join lateral (
        select regexp_split_to_array(trim(e.full_name), '\s+') as names
      ) parts
    ),
    -- schedule_shifts already strips location_id from each assignment row
    'assignments', public.schedule_shifts(
      l.id,
      p_week,
      p_week + 7,
      array(select e.id from public.schedule_staff(l.id) e)
    )
  ))
  from public.schedule_locations l
  where l.id = p_location;
$$;

revoke all on function public.schedule_preview(uuid, date) from public, anon, authenticated;

create or replace function public.schedule_public(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_private.schedule_share_payload(s.preview)
  from public.schedule_share_links s
  join public.schedule_locations l on l.id = s.location_id
  where s.token = p_token
    and s.revoked_at is null
    and public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;
$$;

-- Preserve the owner plan's history permissions for shared workspaces.
drop policy if exists ingredient_price_history_select_member on public.ingredient_price_history;
create policy ingredient_price_history_select_member on public.ingredient_price_history
  for select to authenticated using (
    public.is_member(workspace_id, 'cook')
    and public.workspace_has_feature(workspace_id, 'priceHistory')
  );

create or replace function public.log_ingredient_price_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.price is not null
     and tenant_private.workspace_has_feature(new.workspace_id, 'stockRestock')
     and (tg_op = 'INSERT' or new.price is distinct from old.price) then
    insert into public.ingredient_price_history (ingredient_id, price, workspace_id)
    values (new.id, new.price, new.workspace_id);
  end if;
  return new;
end;
$$;

revoke all on function public.log_ingredient_price_change() from public, anon, authenticated;

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
  v_recipe_id uuid;
  v_old_price numeric;
begin
  if p_ingredient_id is null then
    raise exception 'INGREDIENT_REQUIRED' using errcode = '22023';
  end if;

  if p_new_price is null or p_new_price <= 0 then
    raise exception 'INVALID_PRICE' using errcode = '22023';
  end if;

  if p_new_price in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_new_price >= 10000000000
     or round(p_new_price, 2) <> p_new_price then
    raise exception 'INVALID_PRICE_PRECISION' using errcode = '22023';
  end if;

  if p_note is not null and char_length(trim(p_note)) > 500 then
    raise exception 'INVALID_RESTOCK_INPUT' using errcode = '22023';
  end if;

  select workspace_id, price into v_workspace, v_old_price
  from public.ingredients
  where id = p_ingredient_id
  for update;

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

  -- A changed price in a paid workspace is already recorded by the trigger.
  if v_old_price is not distinct from p_new_price
     or not public.workspace_has_feature(v_workspace, 'stockRestock') then
    insert into public.ingredient_price_history (ingredient_id, price, workspace_id)
    values (p_ingredient_id, p_new_price, v_row.workspace_id);
  end if;

  -- Refresh every recipe that uses this ingredient (same transaction).
  for v_recipe_id in
    select distinct ri.recipe_id
    from public.recipe_items ri
    where ri.ingredient_id = p_ingredient_id
  loop
    perform public.check_food_cost_alert(v_recipe_id);
  end loop;

  return v_row;
end;
$$;

revoke execute on function public.restock_ingredient(uuid, numeric, text) from public, anon;

-- These routines execute as triggers. Direct client roles need no EXECUTE.
revoke execute on function public.enforce_free_limit(), public.enforce_price_history_plan(),
  public.enforce_stock_item_limit(), public.set_schedule_location_workspace_from_owner(),
  public.set_venue_workspace_from_owner(), public.set_workspace_id_from_ingredient(),
  public.set_workspace_id_from_recipe(), public.set_workspace_id_from_run(),
  public.set_workspace_id_from_schedule_location(), public.set_workspace_id_from_venue(),
  public.waste_entries_before_insert(), public.waste_entries_reject_mutation(),
  public.workspace_members_guard_last_owner()
  from public, anon, authenticated;
