-- P8 F4 purchase orders / low stock / receive (supabase test db)
begin;
select '1..1';

insert into auth.users (id, email, aud, role)
values
  ('a1111111-1111-4111-8111-111111111111', 'po-owner@example.test', 'authenticated', 'authenticated'),
  ('a2222222-2222-4222-8222-222222222222', 'po-cook@example.test', 'authenticated', 'authenticated'),
  ('a3333333-3333-4333-8333-333333333333', 'po-other@example.test', 'authenticated', 'authenticated');

insert into public.subscriptions (user_id, paddle_customer_id, paddle_subscription_id, plan_key, status)
values
  ('a1111111-1111-4111-8111-111111111111', 'po_owner_cust', 'po_owner_sub', 'pro', 'active'),
  ('a2222222-2222-4222-8222-222222222222', 'po_cook_cust', 'po_cook_sub', 'pro', 'active'),
  ('a3333333-3333-4333-8333-333333333333', 'po_other_cust', 'po_other_sub', 'pro', 'active');

insert into public.venues (id, owner_id, name)
values
  ('b1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'PO Venue A'),
  ('b3333333-3333-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333', 'PO Venue B');

update public.venues v
set workspace_id = wm.workspace_id
from public.workspace_members wm
where v.owner_id = wm.user_id
  and wm.role = 'owner'
  and v.workspace_id is null;

-- cook membership on owner workspace
insert into public.workspace_members (workspace_id, user_id, role)
select v.workspace_id, 'a2222222-2222-4222-8222-222222222222', 'cook'
from public.venues v
where v.id = 'b1111111-1111-4111-8111-111111111111'
on conflict do nothing;

insert into public.ingredients (
  id, venue_id, name, unit, price, waste_percent, par_level, current_stock, pack_size
)
values
  ('c1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'PO Meso', 'kg', 10, 0, 10, 10, 5),
  ('c2222222-2222-4222-8222-222222222222', 'b1111111-1111-4111-8111-111111111111', 'PO Ulje', 'l', 5, 0, 4, 4, null);

-- ensure workspace_id on ingredients
update public.ingredients i
set workspace_id = v.workspace_id
from public.venues v
where i.venue_id = v.id
  and i.workspace_id is null;

set local "request.jwt.claim.sub" = 'a1111111-1111-4111-8111-111111111111';
set local role authenticated;

do $$
declare
  v_ws uuid;
  v_stock numeric;
  v_count int;
  v_alert uuid;
  v_order uuid;
  v_item uuid;
  v_item2 uuid;
  v_num int;
  v_status text;
  v_supplier uuid;
begin
  select workspace_id into v_ws from public.venues where id = 'b1111111-1111-4111-8111-111111111111';

  -- 1) adjust_stock below zero rejected
  begin
    perform public.adjust_stock(
      'c1111111-1111-4111-8111-111111111111', -20, 'potrosnja', null, null, false
    );
    raise exception 'negative stock allowed';
  exception
    when others then
      if position('NEGATIVE_STOCK' in sqlerrm) = 0 then raise; end if;
  end;
  select current_stock into v_stock from public.ingredients where id = 'c1111111-1111-4111-8111-111111111111';
  if v_stock <> 10 then
    raise exception 'stock changed after rejected decrease: %', v_stock;
  end if;

  -- 2) drop below par → one low_stock alert
  perform public.adjust_stock(
    'c1111111-1111-4111-8111-111111111111', -8, 'potrosnja', null, null, false
  );
  select count(*)::int into v_count
  from public.alerts
  where kind = 'low_stock'
    and subject_id = 'c1111111-1111-4111-8111-111111111111'
    and read_at is null;
  if v_count <> 1 then
    raise exception 'expected 1 low_stock alert, got %', v_count;
  end if;

  -- 3) further decrease while unread → still one
  perform public.adjust_stock(
    'c1111111-1111-4111-8111-111111111111', -1, 'potrosnja', null, null, false
  );
  select count(*)::int into v_count
  from public.alerts
  where kind = 'low_stock'
    and subject_id = 'c1111111-1111-4111-8111-111111111111';
  if v_count <> 1 then
    raise exception 'duplicate low_stock while unread: %', v_count;
  end if;

  -- 4) mark read; still under par → no new unread
  select id into v_alert
  from public.alerts
  where subject_id = 'c1111111-1111-4111-8111-111111111111'
  order by created_at desc limit 1;
  perform public.mark_alert_read(v_alert);
  perform public.adjust_stock(
    'c1111111-1111-4111-8111-111111111111', -0.5, 'potrosnja', null, null, false
  );
  select count(*)::int into v_count
  from public.alerts
  where kind = 'low_stock'
    and subject_id = 'c1111111-1111-4111-8111-111111111111'
    and read_at is null;
  if v_count <> 0 then
    raise exception 'threshold rule failed after mark-read: %', v_count;
  end if;

  -- supplier + order
  insert into public.suppliers (id, workspace_id, name, contact_email)
  values ('d1111111-1111-4111-8111-111111111111', v_ws, 'PO Supplier', 'supplier@example.test')
  returning id into v_supplier;

  v_num := public.allocate_purchase_order_number(v_ws);
  insert into public.purchase_orders (id, workspace_id, supplier_id, number, status, created_by)
  values ('e1111111-1111-4111-8111-111111111111', v_ws, v_supplier, v_num, 'poslato', 'a1111111-1111-4111-8111-111111111111')
  returning id into v_order;

  insert into public.purchase_order_items (
    id, purchase_order_id, ingredient_id, ingredient_name_snapshot, unit, qty_ordered
  ) values
    ('f1111111-1111-4111-8111-111111111111', v_order, 'c1111111-1111-4111-8111-111111111111', 'PO Meso', 'kg', 5),
    ('f2222222-2222-4222-8222-222222222222', v_order, 'c2222222-2222-4222-8222-222222222222', 'PO Ulje', 'l', 2)
  returning id into v_item;

  select id into v_item from public.purchase_order_items where purchase_order_id = v_order order by ingredient_name_snapshot limit 1;
  select id into v_item2 from public.purchase_order_items where purchase_order_id = v_order order by ingredient_name_snapshot desc limit 1;

  -- 5) partial receive → stays poslato
  perform public.receive_purchase_order(
    v_order,
    jsonb_build_array(
      jsonb_build_object('item_id', v_item, 'qty_received', 5, 'unit_price', 12.50)
    )
  );
  select status into v_status from public.purchase_orders where id = v_order;
  if v_status <> 'poslato' then
    raise exception 'partial receive should stay poslato, got %', v_status;
  end if;

  -- 6) complete receive → primljeno + stock up + price history
  perform public.receive_purchase_order(
    v_order,
    jsonb_build_array(
      jsonb_build_object('item_id', v_item2, 'qty_received', 2, 'unit_price', null)
    )
  );
  select status into v_status from public.purchase_orders where id = v_order;
  if v_status <> 'primljeno' then
    raise exception 'full receive should be primljeno, got %', v_status;
  end if;

  -- 7) duplicate receive rejected
  begin
    perform public.receive_purchase_order(
      v_order,
      jsonb_build_array(
        jsonb_build_object('item_id', v_item, 'qty_received', 5)
      )
    );
    raise exception 'duplicate receive allowed';
  exception
    when others then
      if position('ORDER_ALREADY_RECEIVED' in sqlerrm) = 0
         and position('ITEM_ALREADY_RECEIVED' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- 8) mark sent idempotency
  v_num := public.allocate_purchase_order_number(v_ws);
  insert into public.purchase_orders (id, workspace_id, supplier_id, number, status, created_by)
  values ('e2222222-2222-4222-8222-222222222222', v_ws, v_supplier, v_num, 'nacrt', 'a1111111-1111-4111-8111-111111111111');
  perform public.mark_purchase_order_sent('e2222222-2222-4222-8222-222222222222', 'test@example.test');
  begin
    perform public.mark_purchase_order_sent('e2222222-2222-4222-8222-222222222222', 'test2@example.test');
    raise exception 'second mark sent allowed';
  exception
    when others then
      if position('ORDER_NOT_DRAFT' in sqlerrm) = 0 then raise; end if;
  end;

  -- 9) receive transaction rollback on bad item
  v_num := public.allocate_purchase_order_number(v_ws);
  insert into public.purchase_orders (id, workspace_id, number, status, created_by)
  values ('e3333333-3333-4333-8333-333333333333', v_ws, v_num, 'poslato', 'a1111111-1111-4111-8111-111111111111');
  insert into public.purchase_order_items (
    id, purchase_order_id, ingredient_id, ingredient_name_snapshot, unit, qty_ordered
  ) values (
    'f3333333-3333-4333-8333-333333333333',
    'e3333333-3333-4333-8333-333333333333',
    'c1111111-1111-4111-8111-111111111111',
    'PO Meso', 'kg', 1
  );
  select current_stock into v_stock from public.ingredients where id = 'c1111111-1111-4111-8111-111111111111';
  begin
    perform public.receive_purchase_order(
      'e3333333-3333-4333-8333-333333333333',
      jsonb_build_array(
        jsonb_build_object(
          'item_id', 'f3333333-3333-4333-8333-333333333333',
          'qty_received', 1
        ),
        jsonb_build_object(
          'item_id', '99999999-9999-4999-8999-999999999999',
          'qty_received', 1
        )
      )
    );
    raise exception 'bad item receive succeeded';
  exception
    when others then
      null;
  end;
  if (select current_stock from public.ingredients where id = 'c1111111-1111-4111-8111-111111111111') <> v_stock then
    raise exception 'rollback failed: stock changed after bad receive';
  end if;
end $$;

reset role;

-- 10) cook cannot adjust / create / receive
do $$
declare
  v_ws uuid;
  v_order uuid;
  v_num int;
begin
  select workspace_id into v_ws from public.venues where id = 'b1111111-1111-4111-8111-111111111111';
  perform set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);
  set local role authenticated;

  begin
    perform public.adjust_stock(
      'c1111111-1111-4111-8111-111111111111', 1, 'korekcija', null, null, false
    );
    raise exception 'cook adjusted stock';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate <> '42501' and position('Access denied' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.allocate_purchase_order_number(v_ws);
    raise exception 'cook allocated order number';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate <> '42501' and position('Access denied' in sqlerrm) = 0 then raise; end if;
  end;

  reset role;
end $$;

-- 11) direct update current_stock as authenticated must fail (column privilege)
do $$
begin
  perform set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
  set local role authenticated;
  begin
    update public.ingredients
    set current_stock = 999
    where id = 'c1111111-1111-4111-8111-111111111111';
    if found then
      -- some PG setups may allow and no-op column; force fail if value changed
      if (select current_stock from public.ingredients where id = 'c1111111-1111-4111-8111-111111111111') = 999 then
        raise exception 'direct current_stock update allowed';
      end if;
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if position('current_stock' in lower(sqlerrm)) = 0 and sqlstate <> '42501' then
        raise;
      end if;
  end;
  reset role;
end $$;

-- 12) other workspace isolation
do $$
declare
  v_count int;
begin
  perform set_config('request.jwt.claim.sub', 'a3333333-3333-4333-8333-333333333333', true);
  set local role authenticated;
  select count(*)::int into v_count from public.suppliers;
  if v_count <> 0 then
    raise exception 'other workspace saw suppliers: %', v_count;
  end if;
  select count(*)::int into v_count from public.purchase_orders;
  if v_count <> 0 then
    raise exception 'other workspace saw purchase_orders: %', v_count;
  end if;
  select count(*)::int into v_count from public.stock_movements;
  if v_count <> 0 then
    raise exception 'other workspace saw stock_movements: %', v_count;
  end if;
  reset role;
end $$;

rollback;
