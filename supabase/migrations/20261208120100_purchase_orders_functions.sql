-- =============================================================================
-- P8 F4: adjust_stock, low_stock alerts, PO number, mark sent, receive
-- =============================================================================

-- Feature flags: stockAlerts (Starter+), purchaseOrders (Pro+)
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

-- ---------------------------------------------------------------------------
-- check_low_stock_alert
-- ---------------------------------------------------------------------------
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

  -- Resolved: stock back at/above par → mark unread low_stock alerts read.
  if v_row.current_stock >= v_row.par_level then
    update public.alerts
    set read_at = now()
    where kind = 'low_stock'
      and subject_id = p_ingredient_id
      and read_at is null;
    return;
  end if;

  if not public.workspace_has_feature(v_row.workspace_id, 'stockAlerts') then
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

revoke all on function public.check_low_stock_alert(uuid) from public;
grant execute on function public.check_low_stock_alert(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- apply_ingredient_price_internal (restock_ingredient core without auth re-check)
-- Used inside receive_purchase_order after chef auth already verified.
-- ---------------------------------------------------------------------------
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

  update public.ingredients
  set
    price = p_new_price,
    notes = case
      when p_note is null or length(trim(p_note)) = 0 then notes
      else left(trim(p_note), 500)
    end
  where id = p_ingredient_id;

  insert into public.ingredient_price_history (ingredient_id, price, workspace_id)
  values (p_ingredient_id, p_new_price, v_workspace);

  for v_recipe_id in
    select distinct ri.recipe_id
    from public.recipe_items ri
    where ri.ingredient_id = p_ingredient_id
  loop
    perform public.check_food_cost_alert(v_recipe_id);
  end loop;
end;
$$;

revoke all on function public.apply_ingredient_price_internal(uuid, numeric, text) from public;
-- not granted to authenticated — internal only

-- ---------------------------------------------------------------------------
-- adjust_stock
-- SECURITY DEFINER so stock_movements insert works without direct grants.
-- Auth: chef+ membership. Task asked invoker; definer required for movement log.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_ingredient_id uuid,
  p_delta numeric,
  p_reason text,
  p_note text default null,
  p_purchase_order_id uuid default null,
  p_allow_negative boolean default false
)
returns public.ingredients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ingredients;
  v_prev numeric;
  v_next numeric;
  v_workspace uuid;
begin
  if p_ingredient_id is null then
    raise exception 'INGREDIENT_REQUIRED' using errcode = '22023';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'INVALID_DELTA' using errcode = '22023';
  end if;
  if p_delta in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or abs(p_delta) >= 10000000000
     or round(p_delta, 4) <> p_delta then
    raise exception 'INVALID_DELTA_PRECISION' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in (
    'prijem', 'potrosnja', 'popis', 'greska_popisa', 'otpad', 'korekcija'
  ) then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  if p_note is not null and char_length(trim(p_note)) > 500 then
    raise exception 'INVALID_NOTE' using errcode = '22023';
  end if;

  select * into v_row
  from public.ingredients
  where id = p_ingredient_id
  for update;

  if not found then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_workspace := v_row.workspace_id;
  if v_workspace is null or not public.is_member(v_workspace, 'chef') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  v_prev := coalesce(v_row.current_stock, 0);
  v_next := v_prev + p_delta;

  -- Default: never store negative stock. greska_popisa + allow_negative is an open
  -- owner decision and remains blocked by ingredients_current_stock_check.
  if v_next < 0 then
    raise exception 'NEGATIVE_STOCK' using errcode = 'P0001';
  end if;

  -- Expose previous stock to check_low_stock_alert (crossing rule).
  perform set_config('treuplate.stock_prev', v_prev::text, true);

  update public.ingredients
  set current_stock = v_next
  where id = p_ingredient_id
  returning * into v_row;

  insert into public.stock_movements (
    workspace_id,
    ingredient_id,
    delta,
    reason,
    note,
    purchase_order_id,
    created_by
  ) values (
    v_workspace,
    p_ingredient_id,
    p_delta,
    p_reason,
    nullif(trim(coalesce(p_note, '')), ''),
    p_purchase_order_id,
    auth.uid()
  );

  -- Mirror legacy stock_levels.qty when a row exists (trebovanje UI).
  update public.stock_levels sl
  set qty = v_row.current_stock,
      updated_at = now()
  where sl.ingredient_id = p_ingredient_id;

  perform public.check_low_stock_alert(p_ingredient_id);

  return v_row;
end;
$$;

revoke all on function public.adjust_stock(uuid, numeric, text, text, uuid, boolean) from public;
grant execute on function public.adjust_stock(uuid, numeric, text, text, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- allocate_purchase_order_number
-- ---------------------------------------------------------------------------
create or replace function public.allocate_purchase_order_number(p_workspace_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if p_workspace_id is null then
    raise exception 'WORKSPACE_REQUIRED' using errcode = '22023';
  end if;
  if not public.is_member(p_workspace_id, 'chef') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  insert into public.order_counters (workspace_id, last_number)
  values (p_workspace_id, 0)
  on conflict (workspace_id) do nothing;

  update public.order_counters
  set last_number = last_number + 1
  where workspace_id = p_workspace_id
  returning last_number into v_next;

  if v_next is null then
    raise exception 'COUNTER_FAILED' using errcode = 'P0001';
  end if;

  return v_next;
end;
$$;

revoke all on function public.allocate_purchase_order_number(uuid) from public;
grant execute on function public.allocate_purchase_order_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_purchase_order_sent (atomic nacrt → poslato)
-- ---------------------------------------------------------------------------
create or replace function public.mark_purchase_order_sent(
  p_order_id uuid,
  p_sent_to text default null
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.purchase_orders;
begin
  if p_order_id is null then
    raise exception 'ORDER_REQUIRED' using errcode = '22023';
  end if;

  select * into v_row
  from public.purchase_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_member(v_row.workspace_id, 'chef') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  update public.purchase_orders
  set
    status = 'poslato',
    sent_at = now(),
    sent_to = nullif(trim(coalesce(p_sent_to, '')), '')
  where id = p_order_id
    and status = 'nacrt'
  returning * into v_row;

  if not found then
    raise exception 'ORDER_NOT_DRAFT' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

revoke all on function public.mark_purchase_order_sent(uuid, text) from public;
grant execute on function public.mark_purchase_order_sent(uuid, text) to authenticated;

-- Compensate failed email send
create or replace function public.revert_purchase_order_sent(p_order_id uuid)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.purchase_orders;
begin
  if p_order_id is null then
    raise exception 'ORDER_REQUIRED' using errcode = '22023';
  end if;

  select * into v_row
  from public.purchase_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_member(v_row.workspace_id, 'chef') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  update public.purchase_orders
  set
    status = 'nacrt',
    sent_at = null,
    sent_to = null
  where id = p_order_id
    and status = 'poslato'
  returning * into v_row;

  if not found then
    raise exception 'ORDER_NOT_SENT' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

revoke all on function public.revert_purchase_order_sent(uuid) from public;
grant execute on function public.revert_purchase_order_sent(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- receive_purchase_order
-- ---------------------------------------------------------------------------
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

  select * into v_order
  from public.purchase_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_member(v_order.workspace_id, 'chef') then
    raise exception 'Access denied' using errcode = '42501';
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

revoke all on function public.receive_purchase_order(uuid, jsonb) from public;
grant execute on function public.receive_purchase_order(uuid, jsonb) to authenticated;
