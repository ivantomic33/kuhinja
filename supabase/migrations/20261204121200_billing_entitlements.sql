-- Internal selection shared by the RPC, legacy profile projection and database guards.
create function public.billing_entitlement_row(p_user_id uuid)
returns table (plan text, subscription public.subscriptions, grace boolean)
language sql stable set search_path = public as $$
  select resolved.plan, s, resolved.in_grace and s.plan_key <> 'free'
  from public.subscriptions s
  cross join lateral (
    select coalesce(s.status = 'past_due' and now() >= s.current_period_end
      and now() < s.current_period_end + interval '168 hours', false) as in_grace
  ) timing
  cross join lateral (
    select case when s.status in ('active', 'trialing') or timing.in_grace
      then s.plan_key else 'free' end as plan, timing.in_grace
  ) resolved
  where s.user_id = p_user_id
  order by case resolved.plan when 'pro' then 2 when 'starter' then 1 else 0 end desc,
    (s.status in ('active', 'trialing')) desc,
    s.current_period_end desc nulls last, s.created_at desc, s.id
  limit 1
$$;
revoke all on function public.billing_entitlement_row(uuid) from public, anon, authenticated;

create function public.get_entitlements(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  entitlement record;
  effective text;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select * into entitlement from public.billing_entitlement_row(p_user_id);
  effective := coalesce(entitlement.plan, 'free');

  return jsonb_build_object(
    'plan', effective,
    'status', (entitlement.subscription).status,
    'trial_ends_at', (entitlement.subscription).trial_end,
    'grace', coalesce(entitlement.grace, false),
    'features', jsonb_build_object(
      'manageSubscription', effective <> 'free', 'schedule', effective <> 'free',
      'priceHistory', effective = 'pro', 'foodCostVariance', effective = 'pro',
      'basicReports', effective = 'pro', 'prepListPdf', effective <> 'free',
      'stockWriteOff', effective <> 'free', 'stockRestock', effective <> 'free',
      'stockInventory', effective = 'pro'
    ),
    'limits', jsonb_build_object(
      'recipes', case when effective = 'free' then 5 end,
      'ingredients', case when effective = 'free' then 20 end,
      'templates', case effective when 'free' then 1 when 'starter' then 3 end,
      'timers', case when effective <> 'pro' then 2 end,
      'stockItems', case effective when 'free' then 10 when 'starter' then 40 end,
      'locations', 1
    )
  );
end
$$;
revoke all on function public.get_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.get_entitlements(uuid) to authenticated;

create or replace function public.effective_owner_plan(p_owner_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when auth.uid() = p_owner_id or current_setting('role') in ('none', 'service_role')
    then coalesce((select plan from public.billing_entitlement_row(p_owner_id)), 'free')
    else 'free' end
$$;

-- Existing schedule RPCs can inspect the workspace owner's actual plan.
create or replace function public.schedule_rank(p_owner uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case (select plan from public.billing_entitlement_row(p_owner))
    when 'pro' then 2 when 'starter' then 1 else 0 end
$$;
revoke all on function public.schedule_rank(uuid) from public, anon, authenticated;

-- Fold plan checks into storage permissions for existing direct stock clients.
create policy stock_moves_check_billing on public.stock_moves as restrictive
  for insert to authenticated with check (
    (type <> 'otpis' or (select public.effective_owner_plan(auth.uid())) in ('starter', 'pro'))
    and (type <> 'korekcija' or (select public.effective_owner_plan(auth.uid())) = 'pro')
    and (type <> 'dopuna' or unit_cost is null
      or (select public.effective_owner_plan(auth.uid())) in ('starter', 'pro'))
  );
