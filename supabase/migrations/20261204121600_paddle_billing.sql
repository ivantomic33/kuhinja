-- Keep historical billing rows intact while Paddle starts with its own identities.
alter table public.profiles add column paddle_customer_id text unique;
alter table public.subscriptions
  alter column stripe_customer_id drop not null,
  alter column stripe_subscription_id drop not null,
  add column paddle_customer_id text,
  add column paddle_subscription_id text unique,
  add column paddle_price_id text,
  add column paddle_event_at timestamptz,
  add column paid_access_plan text check (paid_access_plan in ('starter', 'pro')),
  add column paid_access_until timestamptz,
  add constraint subscriptions_provider_identity check (
    (stripe_subscription_id is not null and stripe_customer_id is not null and
      paddle_subscription_id is null and paddle_customer_id is null)
    or
    (paddle_subscription_id is not null and paddle_customer_id is not null and
      stripe_subscription_id is null and stripe_customer_id is null)
  );

create table public.paddle_checkout_authorizations (
  transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null,
  price_id text not null,
  subscription_id text unique
);
alter table public.paddle_checkout_authorizations enable row level security;
revoke all on public.paddle_checkout_authorizations from public, anon, authenticated;
grant select, insert on public.paddle_checkout_authorizations to service_role;

create table public.paddle_released_customers (
  customer_id text primary key,
  former_user_id uuid not null
);
alter table public.paddle_released_customers enable row level security;
revoke all on public.paddle_released_customers from public, anon, authenticated;
grant select on public.paddle_released_customers to service_role;

create table public.paddle_events (
  id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.paddle_events enable row level security;
revoke all on public.paddle_events from public, anon, authenticated;

create or replace function public.billing_entitlement_row(p_user_id uuid)
returns table (plan text, subscription public.subscriptions, grace boolean)
language sql stable set search_path = public as $$
  select case
    when s.status in ('active', 'trialing') and s.paid_access_until > now()
      then coalesce(s.paid_access_plan, s.plan_key)
    when s.status in ('active', 'trialing') or timing.in_grace then s.plan_key
    else 'free'
  end as plan, s, timing.in_grace and s.plan_key <> 'free'
  from public.subscriptions s
  cross join lateral (
    select coalesce(s.status = 'past_due' and now() >= s.current_period_end
      and now() < s.current_period_end + interval '168 hours', false) as in_grace
  ) timing
  where s.user_id = p_user_id and s.paddle_subscription_id is not null
  order by
    case when s.status in ('active', 'trialing') and s.paid_access_until > now()
      then case s.paid_access_plan when 'pro' then 2 when 'starter' then 1 else 0 end
      when s.status in ('active', 'trialing') or timing.in_grace
      then case s.plan_key when 'pro' then 2 when 'starter' then 1 else 0 end
      else 0 end desc,
    (s.status in ('active', 'trialing')) desc,
    s.current_period_end desc nulls last, s.created_at desc, s.id
  limit 1
$$;

create function public.apply_paddle_subscription(
  p_event_id text, p_occurred_at timestamptz, p_transaction_id text, p_subscription jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  snapshot public.subscriptions;
  owner_id uuid;
  entitlement record;
begin
  if exists (select from public.paddle_events where id = p_event_id) then return 'duplicate'; end if;

  snapshot := jsonb_populate_record(null::public.subscriptions, p_subscription);
  select id into owner_id from public.profiles
    where paddle_customer_id = snapshot.paddle_customer_id;
  if not found then return 'unknown_customer'; end if;
  perform from auth.users where id = owner_id for key share;
  if not found then return 'unknown_customer'; end if;
  perform from public.profiles where id = owner_id
    and paddle_customer_id = snapshot.paddle_customer_id for update;
  if not found then return 'unknown_customer'; end if;

  if not exists (
    select from public.subscriptions where paddle_subscription_id = snapshot.paddle_subscription_id
      and user_id = owner_id and paddle_customer_id = snapshot.paddle_customer_id
  ) then
    if p_transaction_id is null then return 'awaiting_checkout'; end if;
    update public.paddle_checkout_authorizations set subscription_id = snapshot.paddle_subscription_id
      where transaction_id = p_transaction_id and customer_id = snapshot.paddle_customer_id
        and user_id = owner_id and price_id = snapshot.paddle_price_id
        and (subscription_id is null or subscription_id = snapshot.paddle_subscription_id);
    if not found then return 'unauthorized_checkout'; end if;
  end if;

  insert into public.paddle_events(id) values (p_event_id) on conflict (id) do nothing;
  if not found then return 'duplicate'; end if;

  insert into public.subscriptions as existing (
    user_id, paddle_customer_id, paddle_subscription_id, paddle_price_id, paddle_event_at,
    plan_key, status, current_period_start, current_period_end, trial_end,
    cancel_at_period_end, paid_access_plan, paid_access_until
  ) values (
    owner_id, snapshot.paddle_customer_id, snapshot.paddle_subscription_id, snapshot.paddle_price_id,
    p_occurred_at, snapshot.plan_key, snapshot.status, snapshot.current_period_start,
    snapshot.current_period_end, snapshot.trial_end, snapshot.cancel_at_period_end,
    snapshot.paid_access_plan, snapshot.paid_access_until
  )
  on conflict (paddle_subscription_id) do update set
    paddle_event_at = excluded.paddle_event_at,
    paddle_price_id = excluded.paddle_price_id,
    plan_key = excluded.plan_key,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    trial_end = excluded.trial_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    paid_access_plan = excluded.paid_access_plan,
    paid_access_until = excluded.paid_access_until
  where existing.paddle_event_at < excluded.paddle_event_at
    and existing.user_id = excluded.user_id
    and existing.paddle_customer_id = excluded.paddle_customer_id;

  if found then
    select * into entitlement from public.billing_entitlement_row(owner_id);
    update public.profiles set plan = coalesce(entitlement.plan, 'free'),
      plan_expires_at = case when entitlement.grace
        then (entitlement.subscription).current_period_end + interval '168 hours'
        when entitlement.plan <> 'free' then (entitlement.subscription).current_period_end end
    where id = owner_id;
  end if;
  return 'processed';
end
$$;

revoke all on function public.apply_paddle_subscription(text, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_paddle_subscription(text, timestamptz, text, jsonb) to service_role;

-- Release the account binding only within the same transaction that removes the verified user.
create or replace function public.delete_billing_account(
  p_user_id uuid, p_session_id uuid, p_token uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform from public.billing_locks
    where key = 'customer:' || p_user_id::text and token = p_token
      and authorized_session_id = p_session_id and expires_at > clock_timestamp() for update;
  if not found then return false; end if;

  perform from auth.users where id = p_user_id for update;
  if not found then return false; end if;
  perform from auth.sessions where id = p_session_id and user_id = p_user_id
    and (not_after is null or not_after > clock_timestamp()) for update;
  if not found then return false; end if;

  insert into public.paddle_released_customers(customer_id, former_user_id)
    select paddle_customer_id, id from public.profiles
    where id = p_user_id and paddle_customer_id is not null
    on conflict (customer_id) do update set former_user_id = excluded.former_user_id;

  set constraints public.recipe_items_ingredient_id_fkey deferred;
  delete from auth.users where id = p_user_id;
  set constraints public.recipe_items_ingredient_id_fkey immediate;
  return true;
end
$$;
