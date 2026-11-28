-- Run against local Supabase: supabase test db.
begin;
select '1..1';

insert into auth.users (id, email, aud, role) values
  ('81500000-0000-4000-8000-00000000000a', 'billing-free@example.test', 'authenticated', 'authenticated'),
  ('81500000-0000-4000-8000-00000000000b', 'billing-paid@example.test', 'authenticated', 'authenticated');

insert into public.subscriptions (user_id, paddle_customer_id, paddle_subscription_id, price_id, plan_key, status)
values ('81500000-0000-4000-8000-00000000000b', 'premium_fixture_customer', 'premium_fixture_subscription',
  'fixture_price', 'advanced', 'active');

do $$
declare
  v_user uuid := '81500000-0000-4000-8000-00000000000a';
  v_ingredient uuid;
  v_workspace uuid;
begin
  insert into public.ingredients (venue_id, name, unit, price)
  select id, 'Billing fixture', 'kg', 12 from public.venues where owner_id = v_user
  returning id, workspace_id into v_ingredient, v_workspace;
  insert into public.purchase_orders (workspace_id, number) values (v_workspace, 1);
  perform set_config('test.premium_ingredient', v_ingredient::text, true);
  perform set_config('test.premium_workspace', v_workspace::text, true);
  if public.schedule_rank('81500000-0000-4000-8000-00000000000b') <> 4 then
    raise exception 'Advanced must have the server-side Business schedule rank';
  end if;
end;
$$;

set local "request.jwt.claims" = '{"sub":"81500000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_workspace uuid := current_setting('test.premium_workspace')::uuid;
  v_ingredient uuid := current_setting('test.premium_ingredient')::uuid;
  v_call text;
begin
  if exists (select from public.subscriptions)
     or exists (select from public.purchase_orders where workspace_id = v_workspace) then
    raise exception 'Free client read a foreign subscription or a paid order';
  end if;
  if has_table_privilege('authenticated', 'public.subscriptions', 'INSERT, UPDATE, DELETE') then
    raise exception 'Authenticated clients can write subscriptions';
  end if;

  foreach v_call in array array[
    format('select public.allocate_purchase_order_number(%L)', v_workspace),
    format('select public.restock_ingredient(%L, 20)', v_ingredient),
    format('select public.adjust_stock(%L, 1, %L)', v_ingredient, 'popis')
  ] loop
    begin
      execute v_call;
      raise exception 'Free client passed a paid RPC guard';
    exception when raise_exception then
      if sqlerrm <> 'UPGRADE_REQUIRED' then raise; end if;
    end;
  end loop;
end;
$$;

reset role;
insert into public.subscriptions (user_id, paddle_customer_id, paddle_subscription_id, price_id, plan_key, status)
values ('81500000-0000-4000-8000-00000000000a', 'premium_starter_customer', 'premium_starter_subscription',
  'fixture_price', 'starter', 'active');

set local role authenticated;
do $$
declare
  v_workspace uuid := current_setting('test.premium_workspace')::uuid;
  v_ingredient uuid := current_setting('test.premium_ingredient')::uuid;
begin
  perform public.allocate_purchase_order_number(v_workspace);
  perform public.restock_ingredient(v_ingredient, 20);
  perform public.adjust_stock(v_ingredient, 1, 'prijem');

  begin
    perform public.adjust_stock(v_ingredient, 1, 'popis');
    raise exception 'Starter client passed the Pro inventory guard';
  exception when raise_exception then
    if sqlerrm <> 'UPGRADE_REQUIRED' then raise; end if;
  end;
end;
$$;

reset role;
select 'ok 1 - paid workspace features and subscription write privileges';
rollback;
