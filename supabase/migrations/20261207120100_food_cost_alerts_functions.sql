-- =============================================================================
-- P8 F3: food cost calc helpers, snapshot refresh, alerts, restock hook
-- Mirrors lib/calc/foodcost.ts line math (normalize + waste + portion / portions).
-- =============================================================================

-- Unit family + normalize quantity into price unit (same rules as TypeScript).
create or replace function public.calc_unit_family(p_unit text)
returns text
language sql
immutable
as $$
  select case p_unit
    when 'g' then 'mass'
    when 'kg' then 'mass'
    when 'ml' then 'volume'
    when 'l' then 'volume'
    when 'kom' then 'kom'
    when 'pak' then 'pak'
    else null
  end;
$$;

create or replace function public.calc_to_base(p_quantity numeric, p_unit text)
returns numeric
language sql
immutable
as $$
  select case p_unit
    when 'g' then p_quantity / 1000
    when 'kg' then p_quantity
    when 'ml' then p_quantity / 1000
    when 'l' then p_quantity
    when 'kom' then p_quantity
    when 'pak' then p_quantity
    else null
  end;
$$;

create or replace function public.normalize_quantity_to_price_unit(
  p_quantity numeric,
  p_from_unit text,
  p_to_unit text
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_from_family text;
  v_to_family text;
  v_from_base numeric;
  v_to_base numeric;
begin
  if p_quantity is null or p_from_unit is null or p_to_unit is null then
    return null;
  end if;
  if p_quantity <> p_quantity then -- NaN guard
    return null;
  end if;

  v_from_family := public.calc_unit_family(p_from_unit);
  v_to_family := public.calc_unit_family(p_to_unit);
  if v_from_family is null or v_to_family is null or v_from_family is distinct from v_to_family then
    return null;
  end if;

  v_from_base := public.calc_to_base(p_quantity, p_from_unit);
  v_to_base := public.calc_to_base(1, p_to_unit);
  if v_from_base is null or v_to_base is null or v_to_base = 0 then
    return null;
  end if;

  return v_from_base / v_to_base;
end;
$$;

-- Single line cost. Returns null when unpriced / invalid (do not treat as 0).
create or replace function public.calc_line_cost(
  p_quantity numeric,
  p_quantity_unit text,
  p_price numeric,
  p_price_unit text,
  p_loss_percent numeric
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_qty numeric;
  v_unit_price numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    return 0;
  end if;
  if p_price is null then
    return null;
  end if;
  if p_price < 0 then
    return null;
  end if;
  if p_loss_percent is null or p_loss_percent < 0 or p_loss_percent >= 100 then
    return null;
  end if;

  v_qty := public.normalize_quantity_to_price_unit(p_quantity, p_quantity_unit, p_price_unit);
  if v_qty is null then
    return null;
  end if;

  v_unit_price := p_price / (1 - p_loss_percent / 100);
  return v_qty * v_unit_price;
end;
$$;

revoke all on function public.calc_unit_family(text) from public;
revoke all on function public.calc_to_base(numeric, text) from public;
revoke all on function public.normalize_quantity_to_price_unit(numeric, text, text) from public;
revoke all on function public.calc_line_cost(numeric, text, numeric, text, numeric) from public;
grant execute on function public.calc_unit_family(text) to authenticated;
grant execute on function public.calc_to_base(numeric, text) to authenticated;
grant execute on function public.normalize_quantity_to_price_unit(numeric, text, text) to authenticated;
grant execute on function public.calc_line_cost(numeric, text, numeric, text, numeric) to authenticated;

-- Refresh one recipe snapshot. Returns food_cost_pct (nullable).
-- p_old_food_cost_pct OUT via table return for threshold logic.
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
  r record;
begin
  if p_recipe_id is null then
    return;
  end if;

  select r.workspace_id, r.portions, r.selling_price_net, r.target_food_cost_pct, r.name
  into v_workspace, v_portions, v_selling, v_target, v_name
  from public.recipes r
  where r.id = p_recipe_id;

  if v_workspace is null then
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

  for r in
    select ri.quantity, i.unit, i.price, i.waste_percent
    from public.recipe_items ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = p_recipe_id
  loop
    v_has_items := true;
    -- Stored recipe quantities use the ingredient unit (app convention).
    v_line := public.calc_line_cost(
      r.quantity,
      r.unit,
      r.price,
      r.unit,
      coalesce(r.waste_percent, 0)
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
  on conflict (recipe_id) do update
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

revoke all on function public.refresh_recipe_cost_snapshot(uuid) from public;
grant execute on function public.refresh_recipe_cost_snapshot(uuid) to authenticated;

-- Create alert only on threshold crossing (see docs/food-cost-alerts.md).
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

  select * into v_snap
  from public.refresh_recipe_cost_snapshot(p_recipe_id)
  limit 1;

  if v_snap is null or v_snap.skipped or v_snap.food_cost_pct is null then
    return;
  end if;

  if v_snap.selling_price_net is null or v_snap.selling_price_net <= 0 then
    return;
  end if;

  if not public.workspace_has_feature(v_snap.workspace_id, 'foodCostAlarm') then
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

revoke all on function public.check_food_cost_alert(uuid) from public;
grant execute on function public.check_food_cost_alert(uuid) to authenticated;

-- Mark alert read (cook+). Idempotent.
create or replace function public.mark_alert_read(p_alert_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_updated int;
begin
  if p_alert_id is null then
    raise exception 'INVALID_ALERT_ID' using errcode = '22023';
  end if;

  select workspace_id into v_workspace
  from public.alerts
  where id = p_alert_id;

  if v_workspace is null then
    return false;
  end if;

  if not public.is_member(v_workspace, 'cook') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  update public.alerts
  set read_at = now()
  where id = p_alert_id
    and read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.mark_alert_read(uuid) from public;
grant execute on function public.mark_alert_read(uuid) to authenticated;

-- Guard: authenticated must not change alert rows except via mark_alert_read.
-- No UPDATE/INSERT/DELETE grants on alerts for authenticated.

-- ---------------------------------------------------------------------------
-- restock_ingredient: after price history, refresh affected recipes + alerts
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
  v_recipe_id uuid;
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

  select workspace_id into v_workspace
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

  insert into public.ingredient_price_history (ingredient_id, price, workspace_id)
  values (p_ingredient_id, p_new_price, v_row.workspace_id);

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

revoke all on function public.restock_ingredient(uuid, numeric, text) from public;
grant execute on function public.restock_ingredient(uuid, numeric, text) to authenticated;

-- Feature gate + entitlements: foodCostAlarm on Starter+
create or replace function public.workspace_has_feature(
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
    when 'basicReports' then v_pro_plus
    when 'prepListPdf' then v_plan <> 'free'
    when 'stockWriteOff' then v_plan <> 'free'
    when 'stockRestock' then v_plan <> 'free'
    when 'stockInventory' then v_pro_plus
    when 'teamMembers' then v_plan <> 'free'
    else false
  end;
end;
$$;

revoke all on function public.workspace_has_feature(uuid, text) from public;
grant execute on function public.workspace_has_feature(uuid, text) to authenticated;

create or replace function public.get_entitlements(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  entitlement record;
  effective text;
  pro_plus boolean;
  starter_plus boolean;
  member_limit integer;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select * into entitlement from public.billing_entitlement_row(p_user_id);
  effective := coalesce(entitlement.plan, 'free');
  pro_plus := effective in ('pro', 'advanced', 'team', 'business');
  starter_plus := effective in ('starter', 'pro', 'advanced', 'team', 'business');
  member_limit := case effective
    when 'advanced' then 10
    when 'business' then 10
    when 'team' then 10
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
      'manageSubscription', effective <> 'free',
      'schedule', effective <> 'free',
      'priceHistory', pro_plus,
      'foodCostVariance', pro_plus,
      'foodCostAlarm', starter_plus,
      'basicReports', pro_plus,
      'prepListPdf', effective <> 'free',
      'stockWriteOff', effective <> 'free',
      'stockRestock', effective <> 'free',
      'stockInventory', pro_plus,
      'teamMembers', effective <> 'free',
      'allergens', pro_plus
    ),
    'limits', jsonb_build_object(
      'recipes', case when effective = 'free' then 5 end,
      'ingredients', case when effective = 'free' then 20 end,
      'templates', case effective when 'free' then 1 when 'starter' then 3 end,
      'timers', case when not pro_plus then 2 end,
      'stockItems', case effective when 'free' then 10 when 'starter' then 40 end,
      'locations', 1,
      'members', member_limit
    )
  );
end;
$$;

revoke all on function public.get_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.get_entitlements(uuid) to authenticated;
