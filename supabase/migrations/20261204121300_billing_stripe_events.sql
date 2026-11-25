-- A single lease covers each external Stripe read or customer lifecycle operation.
create table public.billing_locks (
  key text primary key,
  token uuid not null,
  expires_at timestamptz not null,
  authorized_session_id uuid
);
alter table public.billing_locks enable row level security;
revoke all on public.billing_locks from public, anon, authenticated;

create function public.claim_billing_lock(p_key text, p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.billing_locks as held(key, token, expires_at)
    values (p_key, p_token, clock_timestamp() + interval '5 minutes')
  on conflict (key) do update
    set token = excluded.token, expires_at = excluded.expires_at, authorized_session_id = null
    where held.expires_at <= clock_timestamp();
  return found;
end
$$;

create function public.release_billing_lock(p_key text, p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.billing_locks where key = p_key and token = p_token
$$;

revoke all on function public.claim_billing_lock(text, uuid) from public, anon, authenticated;
revoke all on function public.release_billing_lock(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_billing_lock(text, uuid) to service_role;
grant execute on function public.release_billing_lock(text, uuid) to service_role;

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb,
  attempts integer not null default 0
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from public, anon, authenticated;
grant select, insert, update, delete on public.stripe_events to service_role;

-- Event attempts are durable even when Stripe or the following transaction fails.
create function public.begin_stripe_event(p_id text, p_type text, p_payload jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  attempt integer;
begin
  insert into public.stripe_events(id, type, payload) values (p_id, p_type, p_payload)
    on conflict (id) do nothing;
  update public.stripe_events set attempts = attempts + 1
    where id = p_id and processed_at is null returning attempts into attempt;
  if not found then return null; end if;
  return attempt;
end
$$;

create function public.finish_stripe_event(
  p_id text, p_lock_key text, p_token uuid, p_user_id uuid, p_customer_id text, p_subscription jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  event_processed_at timestamptz;
  snapshot public.subscriptions;
  entitlement record;
  outcome text := 'ignored';
begin
  select processed_at into strict event_processed_at
    from public.stripe_events where id = p_id for update;
  if event_processed_at is not null then return 'duplicate'; end if;

  if p_lock_key is not null then
    perform from public.billing_locks where key = p_lock_key and token = p_token
      and expires_at > clock_timestamp() for update;
    if not found then raise exception 'Billing lock expired'; end if;
  elsif p_subscription is not null then
    raise exception 'Billing lock required';
  end if;

  if p_user_id is not null then
    perform from auth.users where id = p_user_id for update;
    if found then
      update public.profiles set stripe_customer_id = p_customer_id
        where id = p_user_id and p_customer_id is not null
        and (stripe_customer_id is null or stripe_customer_id = p_customer_id);
      if not found then
        update public.stripe_events set processed_at = now() where id = p_id;
        return 'ignored';
      end if;

      if p_subscription is not null then
        snapshot := jsonb_populate_record(null::public.subscriptions, p_subscription);
        insert into public.subscriptions as existing (
          user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_key, status,
          current_period_start, current_period_end, trial_end, cancel_at_period_end
        ) values (
          p_user_id, p_customer_id, snapshot.stripe_subscription_id, snapshot.stripe_price_id,
          snapshot.plan_key, snapshot.status, snapshot.current_period_start, snapshot.current_period_end,
          snapshot.trial_end, snapshot.cancel_at_period_end
        )
        on conflict (stripe_subscription_id) do update set
          stripe_price_id = excluded.stripe_price_id, plan_key = excluded.plan_key,
          status = excluded.status, current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end, trial_end = excluded.trial_end,
          cancel_at_period_end = excluded.cancel_at_period_end
        where existing.user_id = excluded.user_id
          and existing.stripe_customer_id = excluded.stripe_customer_id;

        if found then
          select * into entitlement from public.billing_entitlement_row(p_user_id);
          update public.profiles set
            plan = coalesce(entitlement.plan, 'free'),
            plan_expires_at = case when entitlement.grace
              then (entitlement.subscription).current_period_end + interval '168 hours'
              when entitlement.plan <> 'free' then (entitlement.subscription).current_period_end end
          where id = p_user_id;
          outcome := 'processed';
        end if;
      else
        outcome := 'processed';
      end if;
    end if;
  end if;
  update public.stripe_events set processed_at = now() where id = p_id;
  return outcome;
end
$$;

revoke all on function public.begin_stripe_event(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.finish_stripe_event(text, text, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.begin_stripe_event(text, text, jsonb) to service_role;
grant execute on function public.finish_stripe_event(text, text, uuid, uuid, text, jsonb) to service_role;
