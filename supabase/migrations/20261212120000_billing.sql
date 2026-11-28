-- Retire the former provider from the public schema while preserving financial history.
create schema billing_archive;
revoke all on schema billing_archive from public, anon, authenticated, service_role;

create table billing_archive.legacy_subscriptions as
select id, to_jsonb(s) as snapshot
from public.subscriptions s where paddle_subscription_id is null or paddle_price_id is null;
create table billing_archive.legacy_customers as
select id as user_id, stripe_customer_id as customer_id
from public.profiles where stripe_customer_id is not null;

drop function public.begin_stripe_event(text, text, jsonb);
drop function public.finish_stripe_event(text, text, uuid, uuid, text, jsonb);
alter table public.stripe_events set schema billing_archive;
alter table billing_archive.stripe_events rename to legacy_events;
alter table public.stripe_webhook_events set schema billing_archive;
alter table billing_archive.stripe_webhook_events rename to legacy_webhook_events;

delete from public.subscriptions where paddle_subscription_id is null or paddle_price_id is null;
alter table public.subscriptions drop constraint subscriptions_provider_identity;
alter table public.subscriptions
  drop column stripe_customer_id, drop column stripe_subscription_id, drop column stripe_price_id,
  alter column paddle_customer_id set not null, alter column paddle_subscription_id set not null,
  add column canceled_at timestamptz;
alter table public.subscriptions rename column paddle_price_id to price_id;
alter table public.subscriptions alter column price_id set not null;
alter table public.subscriptions drop constraint subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled'));
alter table public.profiles drop column stripe_customer_id;

alter table public.paddle_events rename to billing_events;
alter table public.billing_events rename column processed_at to received_at;
alter table public.billing_events add column event_type text not null default 'subscription.legacy';
alter table public.billing_events alter column event_type drop default;
alter table public.billing_events enable row level security;
revoke all on public.billing_events from public, anon, authenticated;
grant select, insert on public.billing_events to service_role;

-- All server and workspace gates consume the same authoritative entitlement.
create or replace function public.billing_entitlement_row(p_user_id uuid)
returns table (plan text, subscription public.subscriptions, grace boolean)
language sql stable set search_path = public as $$
  select effective.plan, s, timing.in_grace and effective.plan <> 'free'
  from public.subscriptions s
  cross join lateral (
    select coalesce(s.status = 'past_due' and now() < s.current_period_end + interval '72 hours', false) as in_grace,
           coalesce(s.status = 'canceled' and now() < s.current_period_end, false) as paid_canceled
  ) timing
  cross join lateral (
    select case
      when s.status in ('active', 'trialing') and s.paid_access_until > now()
        then coalesce(s.paid_access_plan, s.plan_key)
      when s.status in ('active', 'trialing') or timing.in_grace or timing.paid_canceled then s.plan_key
      else 'free'
    end as plan
  ) effective
  where s.user_id = p_user_id
  order by case effective.plan when 'advanced' then 3 when 'pro' then 2 when 'starter' then 1 else 0 end desc,
    (s.status in ('active', 'trialing')) desc,
    s.paddle_event_at desc nulls last, s.current_period_end desc nulls last, s.created_at desc, s.id
  limit 1
$$;

-- A single transaction owns the event marker, authorization and snapshot write.
-- A failed snapshot rolls back its marker, so a delivery retry can apply it.
drop function public.apply_paddle_subscription(text, timestamptz, text, jsonb);
create function public.apply_paddle_subscription(
  p_event_id text, p_occurred_at timestamptz, p_transaction_id text, p_subscription jsonb,
  p_event_type text default 'subscription.legacy'
) returns text language plpgsql security definer set search_path = '' as $$
declare
  snapshot public.subscriptions;
  owner_id uuid;
  entitlement record;
begin
  if exists (select from public.billing_events where id = p_event_id) then return 'duplicate'; end if;

  snapshot := jsonb_populate_record(null::public.subscriptions, p_subscription);
  snapshot.price_id := coalesce(snapshot.price_id, p_subscription ->> 'paddle_price_id');
  select id into owner_id from public.profiles where paddle_customer_id = snapshot.paddle_customer_id;
  if not found then return 'unknown_customer'; end if;
  if snapshot.user_id is not null and snapshot.user_id <> owner_id then return 'unauthorized_checkout'; end if;
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
        and user_id = owner_id and price_id = snapshot.price_id
        and (subscription_id is null or subscription_id = snapshot.paddle_subscription_id);
    if not found then return 'unauthorized_checkout'; end if;
  end if;

  if snapshot.price_id is null then
    select price_id, plan_key into snapshot.price_id, snapshot.plan_key
      from public.subscriptions where paddle_subscription_id = snapshot.paddle_subscription_id
        and user_id = owner_id and paddle_customer_id = snapshot.paddle_customer_id;
  end if;

  insert into public.billing_events(id, event_type) values (p_event_id, p_event_type)
  on conflict (id) do nothing;
  if not found then return 'duplicate'; end if;

  insert into public.subscriptions as existing (
    user_id, paddle_customer_id, paddle_subscription_id, price_id, paddle_event_at,
    plan_key, status, current_period_start, current_period_end, trial_end, canceled_at,
    cancel_at_period_end, paid_access_plan, paid_access_until
  ) values (
    owner_id, snapshot.paddle_customer_id, snapshot.paddle_subscription_id, snapshot.price_id,
    p_occurred_at, snapshot.plan_key, snapshot.status, snapshot.current_period_start,
    snapshot.current_period_end, snapshot.trial_end,
    case when snapshot.status = 'canceled' then coalesce(snapshot.canceled_at, p_occurred_at) end,
    snapshot.cancel_at_period_end, snapshot.paid_access_plan, snapshot.paid_access_until
  )
  on conflict (paddle_subscription_id) do update set
    paddle_event_at = excluded.paddle_event_at,
    price_id = excluded.price_id,
    plan_key = excluded.plan_key,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = case
      when excluded.status = 'canceled' and existing.status <> 'trialing'
        then greatest(excluded.current_period_end, existing.current_period_end)
      when excluded.status = 'past_due' and existing.status <> 'trialing'
        then coalesce(excluded.current_period_end, existing.current_period_end)
      else excluded.current_period_end end,
    trial_end = excluded.trial_end,
    canceled_at = excluded.canceled_at,
    cancel_at_period_end = excluded.cancel_at_period_end,
    paid_access_plan = excluded.paid_access_plan,
    paid_access_until = excluded.paid_access_until
  where (existing.paddle_event_at is null or existing.paddle_event_at < excluded.paddle_event_at)
    and existing.user_id = excluded.user_id and existing.paddle_customer_id = excluded.paddle_customer_id;

  if found then
    select * into entitlement from public.billing_entitlement_row(owner_id);
    update public.profiles set plan = coalesce(entitlement.plan, 'free'),
      plan_expires_at = case when entitlement.grace
        then (entitlement.subscription).current_period_end + interval '72 hours'
        when entitlement.plan <> 'free' then (entitlement.subscription).current_period_end end
    where id = owner_id;
  end if;
  return 'processed';
end
$$;

revoke all on function public.apply_paddle_subscription(text, timestamptz, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.apply_paddle_subscription(text, timestamptz, text, jsonb, text) to service_role;

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
    'current_period_end', (entitlement.subscription).current_period_end,
    'paddle_customer_id', (entitlement.subscription).paddle_customer_id,
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

-- Allow account deletion to cascade through a workspace with no remaining members.
create or replace function public.workspace_members_guard_last_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
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
