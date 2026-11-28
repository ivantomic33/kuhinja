-- Enforce paid workspace features for direct API calls as well as Next.js.
-- Billing continues to use the canonical Paddle subscription and grace period.

alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from public, anon, authenticated;
grant select on table public.subscriptions to authenticated;
grant select, insert, update, delete on table public.subscriptions to service_role;

-- Advanced uses the Business schedule capabilities (multiple locations and
-- monthly export). Admission still uses the same authoritative subscription.
create or replace function public.schedule_rank(p_owner uuid)
returns integer language sql stable security definer set search_path = public
as $$
  select case (select plan from public.billing_entitlement_row(p_owner))
    when 'advanced' then 4 when 'pro' then 2 when 'starter' then 1 else 0 end;
$$;
revoke all on function public.schedule_rank(uuid) from public, anon, authenticated;

-- Scheduled Edge jobs have no user JWT. Only the service role may check an
-- arbitrary workspace. User requests still need active workspace membership.
create or replace function public.workspace_has_feature(p_workspace_id uuid, p_feature text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case when current_setting('role') = 'service_role'
                   or public.is_member(p_workspace_id, 'cook')
    then tenant_private.workspace_has_feature(p_workspace_id, p_feature)
    else false end;
$$;
revoke all on function public.workspace_has_feature(uuid, text) from public, anon, authenticated;
grant execute on function public.workspace_has_feature(uuid, text) to authenticated, service_role;

create or replace function tenant_private.require_billing_feature(p_workspace_id uuid, p_feature text)
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not tenant_private.workspace_has_feature(p_workspace_id, p_feature) then
    raise exception 'UPGRADE_REQUIRED' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function tenant_private.require_billing_feature(uuid, text) from public, anon, authenticated;

-- Starter can manage orders from stock alerts. Creating orders from a recipe
-- plan and PDF export still have a separate Pro feature gate in the app.
drop policy if exists purchase_orders_require_paid_access on public.purchase_orders;
create policy purchase_orders_require_paid_access on public.purchase_orders as restrictive
  for all to authenticated
  using (public.workspace_has_feature(workspace_id, 'stockAlerts'))
  with check (public.workspace_has_feature(workspace_id, 'stockAlerts'));

-- Item policies query their parent order and inherit its restrictive policy.
drop policy if exists suppliers_require_paid_access on public.suppliers;
create policy suppliers_require_paid_access on public.suppliers as restrictive
  for all to authenticated
  using (public.workspace_has_feature(workspace_id, 'stockAlerts'))
  with check (public.workspace_has_feature(workspace_id, 'stockAlerts'));

drop policy if exists stock_movements_require_paid_access on public.stock_movements;
create policy stock_movements_require_paid_access on public.stock_movements as restrictive
  for select to authenticated using (public.workspace_has_feature(workspace_id, 'stockAlerts'));

drop policy if exists alerts_require_paid_access on public.alerts;
create policy alerts_require_paid_access on public.alerts as restrictive
  for select to authenticated using (
    public.workspace_has_feature(workspace_id, case kind
      when 'low_stock' then 'stockAlerts'
      when 'food_cost_over_target' then 'foodCostAlarm'
    end)
  );

drop policy if exists recipe_cost_snapshot_require_paid_access on public.recipe_cost_snapshot;
create policy recipe_cost_snapshot_require_paid_access on public.recipe_cost_snapshot as restrictive
  for select to authenticated using (public.workspace_has_feature(workspace_id, 'foodCostAlarm'));

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

  perform tenant_private.require_billing_feature(p_workspace_id, 'stockAlerts');

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

  perform tenant_private.require_billing_feature(v_row.workspace_id, 'stockAlerts');

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

  perform tenant_private.require_billing_feature(v_row.workspace_id, 'stockAlerts');

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

  perform tenant_private.require_billing_feature(v_order.workspace_id, 'stockAlerts');

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

  perform tenant_private.require_billing_feature(v_workspace, case
    when p_reason in ('popis', 'greska_popisa', 'korekcija') then 'stockInventory'
    else 'stockAlerts'
  end);

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

create or replace function public.mark_alert_read(p_alert_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_updated int;
  v_kind text;
begin
  if p_alert_id is null then
    raise exception 'INVALID_ALERT_ID' using errcode = '22023';
  end if;

  select workspace_id, kind into v_workspace, v_kind
  from public.alerts
  where id = p_alert_id;

  if v_workspace is null then
    return false;
  end if;

  if not public.is_member(v_workspace, 'cook') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  perform tenant_private.require_billing_feature(v_workspace, case v_kind when 'low_stock' then 'stockAlerts' else 'foodCostAlarm' end);

  update public.alerts
  set read_at = now()
  where id = p_alert_id
    and read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
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

  if current_setting('role') = 'authenticated' then
    perform tenant_private.require_billing_feature(v_workspace, 'foodCostAlarm');
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

  if not public.workspace_has_feature(v_workspace, 'stockRestock') then
    raise exception 'UPGRADE_REQUIRED' using errcode = 'P0001';
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
  if v_old_price is not distinct from p_new_price then
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
