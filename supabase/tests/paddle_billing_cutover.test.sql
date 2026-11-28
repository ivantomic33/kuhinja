begin;
select '1..1';

insert into auth.users (id, email, aud, role)
values ('d5010000-0000-4000-8000-000000000001', 'paddle-cutover@example.test', 'authenticated', 'authenticated'),
       ('d5010000-0000-4000-8000-000000000002', 'paddle-outsider@example.test', 'authenticated', 'authenticated');
update public.profiles set paddle_customer_id = 'cutover_customer'
where id = 'd5010000-0000-4000-8000-000000000001';
insert into public.paddle_checkout_authorizations (transaction_id, user_id, customer_id, price_id)
values ('cutover_txn', 'd5010000-0000-4000-8000-000000000001', 'cutover_customer', 'cutover_price');

set local role service_role;

do $$
declare
  snapshot jsonb := jsonb_build_object(
    'user_id', 'd5010000-0000-4000-8000-000000000001',
    'paddle_customer_id', 'cutover_customer',
    'paddle_subscription_id', 'cutover_subscription',
    'price_id', 'cutover_price',
    'plan_key', 'pro',
    'status', 'active',
    'current_period_end', now() + interval '1 day',
    'cancel_at_period_end', false
  );
begin
  assert public.apply_paddle_subscription('cutover_wrong_owner', now(), 'cutover_txn',
    snapshot || '{"user_id":"d5010000-0000-4000-8000-000000000002"}', 'subscription.created') = 'unauthorized_checkout';

  begin
    perform public.apply_paddle_subscription('cutover_retry', now(), 'cutover_txn',
      snapshot || '{"status":"invalid"}', 'subscription.created');
    raise exception 'Invalid subscription state was accepted';
  exception when check_violation then null;
  end;

  assert not exists (select from public.billing_events where id = 'cutover_retry');
  assert public.apply_paddle_subscription('cutover_retry', now(), 'cutover_txn',
    snapshot, 'subscription.created') = 'processed';
  assert public.apply_paddle_subscription('cutover_retry', now(), 'cutover_txn',
    snapshot, 'subscription.created') = 'duplicate';
  assert public.apply_paddle_subscription('cutover_canceled', now() + interval '1 second', null,
    snapshot || '{"status":"canceled","current_period_end":null}', 'subscription.canceled') = 'processed';
  assert (select current_period_end > now() and canceled_at is not null
    from public.subscriptions where paddle_subscription_id = 'cutover_subscription');
  perform public.apply_paddle_subscription('cutover_old', now() - interval '1 second', null, snapshot, 'subscription.updated');
  assert (select status from public.subscriptions where paddle_subscription_id = 'cutover_subscription') = 'canceled';
end
$$;

reset role;
set local "request.jwt.claim.sub" = 'd5010000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
begin
  assert public.get_entitlements(auth.uid()) @> '{"plan":"pro","status":"canceled","paddle_customer_id":"cutover_customer"}';
  begin
    perform from public.billing_events;
    raise exception 'A user could read billing events';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

update public.subscriptions set status = 'past_due', current_period_end = now() - interval '71 hours'
where paddle_subscription_id = 'cutover_subscription';
set local role authenticated;
do $$ begin
  assert public.get_entitlements(auth.uid()) @> '{"plan":"pro","grace":true}';
end $$;
reset role;

update public.subscriptions set current_period_end = now() - interval '72 hours'
where paddle_subscription_id = 'cutover_subscription';
set local role authenticated;
do $$ begin
  assert public.get_entitlements(auth.uid()) @> '{"plan":"free","grace":false}';
end $$;
reset role;

set local "request.jwt.claim.sub" = 'd5010000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
  assert not exists (select from public.subscriptions where paddle_subscription_id = 'cutover_subscription');
end $$;

select 'ok 1 - Paddle replay rollback, cancellation access, grace and ownership';
rollback;
