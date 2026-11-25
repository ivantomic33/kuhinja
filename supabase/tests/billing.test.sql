begin;
select '1..1';

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'billing-a@example.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'billing-b@example.test', 'authenticated', 'authenticated');

insert into public.venues(id, owner_id, name) values
  ('bbbb1111-bbbb-4111-8111-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Billing venue');
insert into public.ingredients(id, venue_id, name, unit, price) values
  ('bbbb2222-bbbb-4222-8222-bbbbbbbbbbbb', 'bbbb1111-bbbb-4111-8111-bbbbbbbbbbbb', 'Flour', 'kg', 50);

-- The legacy flag alone grants no access.
update public.profiles set plan = 'pro' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

update public.profiles set paddle_customer_id = 'fixture_customer'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set local role service_role;
do $$
declare
  owner_id constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  payload jsonb := jsonb_build_object(
    'paddle_customer_id', 'fixture_customer', 'paddle_subscription_id', 'fixture_subscription',
    'paddle_price_id', 'fixture_price', 'plan_key', 'pro', 'status', 'past_due',
    'cancel_at_period_end', false, 'current_period_end', now() - interval '167 hours'
  );
begin
  assert public.apply_paddle_subscription('invented_checkout', now(), 'unknown_transaction', payload)
    = 'unauthorized_checkout';
  assert public.apply_paddle_subscription('later_event', now() + interval '1 second', null, payload)
    = 'awaiting_checkout';
  assert public.apply_paddle_subscription('fixture_event', now(), 'fixture_transaction', payload)
    = 'processed';
  perform public.apply_paddle_subscription('fixture_event', now() + interval '1 second', null,
    payload || '{"status":"canceled"}');
  perform public.apply_paddle_subscription('older_event', now() - interval '1 second', null,
    payload || '{"status":"canceled"}');
  perform public.apply_paddle_subscription('unknown_customer', now() + interval '2 seconds', null,
    payload || '{"paddle_customer_id":"other_customer","status":"canceled"}');
  assert (select count(*) from public.subscriptions where user_id = owner_id) = 1;
  assert (select status from public.subscriptions where user_id = owner_id) = 'past_due';
end $$;
reset role;

set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
do $$
declare
  result jsonb;
begin
  result := public.get_entitlements(auth.uid());
  assert result @> '{"plan":"pro","status":"past_due","grace":true,"features":{"priceHistory":true}}';
  assert (select count(*) from public.subscriptions) = 1;
  begin
    perform public.get_entitlements('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'Cross-user entitlements read succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.subscriptions(user_id, paddle_customer_id, paddle_subscription_id, plan_key, status)
      values (auth.uid(), 'client_customer', 'client_subscription', 'pro', 'active');
    raise exception 'Authenticated subscription insert succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set plan = 'starter' where id = auth.uid();
    raise exception 'Authenticated profile plan update succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set full_name = 'Updated by owner' where id = auth.uid();
  assert found;
  begin
    perform from public.paddle_events;
    raise exception 'Authenticated user read event ledger';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

update public.subscriptions set
  plan_key = 'starter', status = 'active', paid_access_plan = 'pro',
  paid_access_until = now() + interval '1 day';
set local role authenticated;
do $$ begin
  assert public.get_entitlements(auth.uid()) @> '{"plan":"pro","features":{"priceHistory":true}}';
end $$;
reset role;
update public.subscriptions set paid_access_until = now() - interval '1 second';
set local role authenticated;
do $$ begin
  assert public.get_entitlements(auth.uid()) @> '{"plan":"starter","features":{"priceHistory":false}}';
end $$;
reset role;
update public.subscriptions set status = 'past_due', current_period_end = now() - interval '168 hours';
set local role authenticated;
do $$
begin
  assert public.get_entitlements(auth.uid()) @> '{"plan":"free","grace":false,"features":{"priceHistory":false}}';
end $$;
reset role;

set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
do $$
begin
  assert public.get_entitlements(auth.uid()) @> '{"plan":"free","status":null,"features":{"manageSubscription":false},"limits":{"recipes":5}}';
  assert not exists (select from public.subscriptions);
  begin
    perform public.record_stock_adjustment('bbbb1111-bbbb-4111-8111-bbbbbbbbbbbb', 'otpis',
      '[{"ingredient_id":"bbbb2222-bbbb-4222-8222-bbbbbbbbbbbb","qty":1}]');
    raise exception 'Free account applied a premium stock adjustment';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select from public.stock_levels);
  begin
    insert into public.stock_moves(venue_id, ingredient_id, type, qty_delta, unit_cost)
      values ('bbbb1111-bbbb-4111-8111-bbbbbbbbbbbb', 'bbbb2222-bbbb-4222-8222-bbbbbbbbbbbb', 'dopuna', 1, 42);
    raise exception 'Free account recorded a priced restock';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

insert into auth.sessions(id, user_id, created_at) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    clock_timestamp() - interval '4 minutes');
set local role service_role;
do $$
declare
  user_id constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  session_id constant uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  token constant uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
begin
  assert public.claim_billing_lock('customer:' || user_id::text, token);
  assert not public.delete_billing_account(user_id, session_id, token);
  assert public.authorize_billing_account_deletion(user_id, session_id, token);
end $$;
reset role;
update auth.sessions set created_at = now() - interval '6 minutes'
where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role service_role;
do $$
begin
  assert public.delete_billing_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
end $$;
reset role;
do $$ begin
  assert not exists (select from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
end $$;
select 'ok 1 - billing event idempotency, access, grace and deletion';
rollback;
