-- =============================================================================
-- P8 F5: feature flags, add_waste_entry, correction, waste_report
-- =============================================================================

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
      'stockAlerts', starter_plus,
      'purchaseOrders', pro_plus,
      'basicReports', pro_plus,
      'prepListPdf', effective <> 'free',
      'stockWriteOff', effective <> 'free',
      'stockRestock', effective <> 'free',
      'stockInventory', pro_plus,
      'teamMembers', effective <> 'free',
      'allergens', pro_plus,
      'wasteLog', starter_plus,
      'waste_log', starter_plus,
      'wasteExportCsv', starter_plus,
      'waste_export_csv', starter_plus,
      'wasteExportPdfXlsx', pro_plus,
      'waste_export_pdf_xlsx', pro_plus
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

-- ---------------------------------------------------------------------------
-- add_waste_entry
-- ---------------------------------------------------------------------------
create or replace function public.add_waste_entry(
  p_ingredient_id uuid default null,
  p_recipe_id uuid default null,
  p_quantity numeric default null,
  p_unit text default null,
  p_reason text default null,
  p_note text default null,
  p_adjust_stock boolean default false,
  p_client_id uuid default null,
  p_unit_cost_snapshot numeric default null
)
returns public.waste_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace uuid;
  v_row public.waste_entries;
  v_existing public.waste_entries;
  v_name text;
  v_unit text;
  v_cost numeric;
  v_portion numeric;
begin
  if auth.uid() is null then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if (p_ingredient_id is not null) = (p_recipe_id is not null) then
    raise exception 'SUBJECT_XOR_REQUIRED' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 or abs(p_quantity) > 1000000
     or round(p_quantity, 3) <> p_quantity then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;

  if p_reason is null or p_reason not in ('istek', 'pokvareno', 'ostatak', 'greška', 'ostalo') then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'INVALID_NOTE' using errcode = '22023';
  end if;

  if p_unit is not null and p_unit not in ('g', 'kg', 'ml', 'l', 'kom', 'pak') then
    raise exception 'INVALID_UNIT' using errcode = '22023';
  end if;

  if p_client_id is not null then
    select * into v_existing
    from public.waste_entries
    where client_id = p_client_id;
    if found then
      return v_existing;
    end if;
  end if;

  if p_ingredient_id is not null then
    select i.workspace_id, i.name, i.unit, coalesce(i.price, 0)
      into v_workspace, v_name, v_unit, v_cost
    from public.ingredients i
    where i.id = p_ingredient_id;

    if v_workspace is null then
      raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0002';
    end if;
  else
    select r.workspace_id, r.name
      into v_workspace, v_name
    from public.recipes r
    where r.id = p_recipe_id;

    if v_workspace is null then
      raise exception 'RECIPE_NOT_FOUND' using errcode = 'P0002';
    end if;

    v_unit := 'kom';

    select s.portion_cost into v_portion
    from public.recipe_cost_snapshot s
    where s.recipe_id = p_recipe_id;

    if v_portion is null then
      perform public.refresh_recipe_cost_snapshot(p_recipe_id);
      select s.portion_cost into v_portion
      from public.recipe_cost_snapshot s
      where s.recipe_id = p_recipe_id;
    end if;

    if v_portion is null then
      raise exception 'RECIPE_COST_UNAVAILABLE' using errcode = 'P0001';
    end if;
    v_cost := v_portion;
  end if;

  if not public.is_member(v_workspace, 'cook') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if not public.workspace_has_feature(v_workspace, 'waste_log') then
    raise exception 'UPGRADE_REQUIRED' using errcode = 'P0001';
  end if;

  -- Offline: prefer cached unit cost captured at discard time.
  if p_client_id is not null and p_unit_cost_snapshot is not null then
    if p_unit_cost_snapshot < 0
       or p_unit_cost_snapshot <> p_unit_cost_snapshot
       or abs(p_unit_cost_snapshot) >= 10000000000 then
      raise exception 'INVALID_UNIT_COST' using errcode = '22023';
    end if;
    v_cost := p_unit_cost_snapshot;
  end if;

  if p_unit is not null then
    v_unit := p_unit;
  end if;

  begin
    insert into public.waste_entries (
      workspace_id,
      ingredient_id,
      recipe_id,
      ingredient_name_snapshot,
      quantity,
      unit,
      reason,
      unit_cost_snapshot,
      is_correction,
      note,
      created_by,
      client_id
    ) values (
      v_workspace,
      p_ingredient_id,
      p_recipe_id,
      v_name,
      p_quantity,
      v_unit,
      p_reason,
      v_cost,
      false,
      nullif(trim(coalesce(p_note, '')), ''),
      auth.uid(),
      p_client_id
    )
    returning * into v_row;
  exception
    when unique_violation then
      if p_client_id is not null then
        select * into v_existing
        from public.waste_entries
        where client_id = p_client_id;
        if found then
          return v_existing;
        end if;
      end if;
      raise;
  end;

  if coalesce(p_adjust_stock, false) then
    if p_ingredient_id is null then
      raise exception 'ADJUST_STOCK_INGREDIENT_ONLY' using errcode = '22023';
    end if;
    -- F4 present: adjust_stock with reason otpad (negative delta).
    perform public.adjust_stock(
      p_ingredient_id,
      -p_quantity,
      'otpad',
      nullif(trim(coalesce(p_note, '')), ''),
      null,
      false
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.add_waste_entry(
  uuid, uuid, numeric, text, text, text, boolean, uuid, numeric
) from public;
grant execute on function public.add_waste_entry(
  uuid, uuid, numeric, text, text, text, boolean, uuid, numeric
) to authenticated;

-- ---------------------------------------------------------------------------
-- add_waste_correction
-- ---------------------------------------------------------------------------
create or replace function public.add_waste_correction(
  p_entry_id uuid,
  p_note text default null
)
returns public.waste_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_orig public.waste_entries;
  v_row public.waste_entries;
begin
  if auth.uid() is null then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_entry_id is null then
    raise exception 'ENTRY_REQUIRED' using errcode = '22023';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'INVALID_NOTE' using errcode = '22023';
  end if;

  select * into v_orig
  from public.waste_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'ENTRY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_orig.is_correction then
    raise exception 'CANNOT_CORRECT_CORRECTION' using errcode = 'P0001';
  end if;

  if not public.is_member(v_orig.workspace_id, 'cook') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if not public.workspace_has_feature(v_orig.workspace_id, 'waste_log') then
    raise exception 'UPGRADE_REQUIRED' using errcode = 'P0001';
  end if;

  if v_orig.created_at < (now() - interval '24 hours') then
    raise exception 'CORRECTION_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.waste_entries w
    where w.corrects_entry_id = p_entry_id and w.is_correction
  ) then
    raise exception 'CORRECTION_ALREADY_EXISTS' using errcode = 'P0001';
  end if;

  insert into public.waste_entries (
    workspace_id,
    ingredient_id,
    recipe_id,
    ingredient_name_snapshot,
    quantity,
    unit,
    reason,
    unit_cost_snapshot,
    is_correction,
    corrects_entry_id,
    note,
    created_by
  ) values (
    v_orig.workspace_id,
    v_orig.ingredient_id,
    v_orig.recipe_id,
    v_orig.ingredient_name_snapshot,
    -v_orig.quantity,
    v_orig.unit,
    'greška',
    v_orig.unit_cost_snapshot,
    true,
    v_orig.id,
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.add_waste_correction(uuid, text) from public;
grant execute on function public.add_waste_correction(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- waste_report — single source of truth for widget + export
-- Period bounds are calendar dates in Europe/Belgrade.
-- ---------------------------------------------------------------------------
create or replace function public.waste_report(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns table (
  entry_id uuid,
  created_at timestamptz,
  local_date date,
  subject_name text,
  ingredient_id uuid,
  recipe_id uuid,
  quantity numeric,
  unit text,
  reason text,
  unit_cost_snapshot numeric,
  cost_rsd numeric,
  is_correction boolean,
  note text,
  total_net numeric,
  total_gross numeric,
  total_corrections numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_net numeric;
  v_gross numeric;
  v_corr numeric;
begin
  if p_workspace_id is null or p_from is null or p_to is null then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;

  if p_from > p_to then
    raise exception 'INVALID_PERIOD_ORDER' using errcode = '22023';
  end if;

  if (p_to - p_from) > 370 then
    raise exception 'PERIOD_TOO_LONG' using errcode = '22023';
  end if;

  if not public.is_member(p_workspace_id, 'cook') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if not public.workspace_has_feature(p_workspace_id, 'waste_log') then
    raise exception 'UPGRADE_REQUIRED' using errcode = 'P0001';
  end if;

  -- Inclusive Belgrade calendar day → UTC timestamptz range.
  v_from_ts := (p_from::timestamp at time zone 'Europe/Belgrade');
  v_to_ts := ((p_to + 1)::timestamp at time zone 'Europe/Belgrade');

  select
    round(coalesce(sum(w.cost_rsd), 0), 2),
    round(coalesce(sum(w.cost_rsd) filter (where not w.is_correction), 0), 2),
    round(coalesce(sum(w.cost_rsd) filter (where w.is_correction), 0), 2)
  into v_net, v_gross, v_corr
  from public.waste_entries w
  where w.workspace_id = p_workspace_id
    and w.created_at >= v_from_ts
    and w.created_at < v_to_ts;

  return query
  select
    w.id,
    w.created_at,
    (w.created_at at time zone 'Europe/Belgrade')::date,
    w.ingredient_name_snapshot,
    w.ingredient_id,
    w.recipe_id,
    w.quantity,
    w.unit,
    w.reason,
    w.unit_cost_snapshot,
    w.cost_rsd,
    w.is_correction,
    w.note,
    v_net,
    v_gross,
    v_corr
  from public.waste_entries w
  where w.workspace_id = p_workspace_id
    and w.created_at >= v_from_ts
    and w.created_at < v_to_ts
  order by w.created_at asc, w.id asc;
end;
$$;

revoke all on function public.waste_report(uuid, date, date) from public;
grant execute on function public.waste_report(uuid, date, date) to authenticated;

-- Summary helper for widget (reasons + top ingredients) — same rounding.
create or replace function public.waste_report_summary(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_net numeric;
  v_gross numeric;
  v_corr numeric;
  v_reasons jsonb;
  v_top jsonb;
begin
  if p_workspace_id is null or p_from is null or p_to is null then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  if p_from > p_to then
    raise exception 'INVALID_PERIOD_ORDER' using errcode = '22023';
  end if;
  if (p_to - p_from) > 370 then
    raise exception 'PERIOD_TOO_LONG' using errcode = '22023';
  end if;
  if not public.is_member(p_workspace_id, 'cook') then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if not public.workspace_has_feature(p_workspace_id, 'waste_log') then
    raise exception 'UPGRADE_REQUIRED' using errcode = 'P0001';
  end if;

  v_from_ts := (p_from::timestamp at time zone 'Europe/Belgrade');
  v_to_ts := ((p_to + 1)::timestamp at time zone 'Europe/Belgrade');

  select
    round(coalesce(sum(w.cost_rsd), 0), 2),
    round(coalesce(sum(w.cost_rsd) filter (where not w.is_correction), 0), 2),
    round(coalesce(sum(w.cost_rsd) filter (where w.is_correction), 0), 2)
  into v_net, v_gross, v_corr
  from public.waste_entries w
  where w.workspace_id = p_workspace_id
    and w.created_at >= v_from_ts
    and w.created_at < v_to_ts;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.amount desc), '[]'::jsonb)
  into v_reasons
  from (
    select
      w.reason,
      round(coalesce(sum(w.cost_rsd), 0), 2) as amount
    from public.waste_entries w
    where w.workspace_id = p_workspace_id
      and w.created_at >= v_from_ts
      and w.created_at < v_to_ts
    group by w.reason
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.amount desc), '[]'::jsonb)
  into v_top
  from (
    select
      w.ingredient_name_snapshot as name,
      w.ingredient_id,
      round(coalesce(sum(w.cost_rsd), 0), 2) as amount
    from public.waste_entries w
    where w.workspace_id = p_workspace_id
      and w.created_at >= v_from_ts
      and w.created_at < v_to_ts
      and w.ingredient_id is not null
    group by w.ingredient_name_snapshot, w.ingredient_id
    order by round(coalesce(sum(w.cost_rsd), 0), 2) desc
    limit 5
  ) t;

  return jsonb_build_object(
    'total_net', v_net,
    'total_gross', v_gross,
    'total_corrections', v_corr,
    'reasons', v_reasons,
    'top_ingredients', v_top
  );
end;
$$;

revoke all on function public.waste_report_summary(uuid, date, date) from public;
grant execute on function public.waste_report_summary(uuid, date, date) to authenticated;
