-- =============================================================================
-- Advanced plan support + entitlement ranking/features for paid tiers
-- Premium checkout writes plan_key from Paddle price IDs (starter|pro|advanced).
-- Without these constraints/features, Advanced purchases fail and Pro+ gates miss.
-- =============================================================================

-- Allow Advanced on subscription snapshots and paid-access holdovers.
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_key_check;
alter table public.subscriptions
  add constraint subscriptions_plan_key_check
  check (plan_key in ('free', 'starter', 'pro', 'advanced'));

alter table public.subscriptions
  drop constraint if exists subscriptions_paid_access_plan_check;
alter table public.subscriptions
  add constraint subscriptions_paid_access_plan_check
  check (paid_access_plan is null or paid_access_plan in ('starter', 'pro', 'advanced'));

-- Profile projection used by legacy guards and settings UI.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'starter', 'pro', 'premium', 'team', 'business', 'advanced'));

-- Rank Advanced above Pro so the best active entitlement wins.
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
      then case s.paid_access_plan
        when 'advanced' then 3 when 'pro' then 2 when 'starter' then 1 else 0 end
      when s.status in ('active', 'trialing') or timing.in_grace
      then case s.plan_key
        when 'advanced' then 3 when 'pro' then 2 when 'starter' then 1 else 0 end
      else 0 end desc,
    (s.status in ('active', 'trialing')) desc,
    s.current_period_end desc nulls last, s.created_at desc, s.id
  limit 1
$$;

revoke all on function public.billing_entitlement_row(uuid) from public, anon, authenticated;

create or replace function public.schedule_rank(p_owner uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case (select plan from public.billing_entitlement_row(p_owner))
    when 'advanced' then 3 when 'pro' then 2 when 'starter' then 1 else 0 end
$$;
revoke all on function public.schedule_rank(uuid) from public, anon, authenticated;

-- Pro features for Pro + Advanced; multi-location + 10 seats for Advanced.
create or replace function public.get_entitlements(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  entitlement record;
  effective text;
  pro_plus boolean;
  member_limit integer;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select * into entitlement from public.billing_entitlement_row(p_user_id);
  effective := coalesce(entitlement.plan, 'free');
  pro_plus := effective in ('pro', 'advanced');
  member_limit := case effective
    when 'advanced' then 10
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
      'basicReports', pro_plus,
      'prepListPdf', effective <> 'free',
      'stockWriteOff', effective <> 'free',
      'stockRestock', effective <> 'free',
      'stockInventory', pro_plus,
      'teamMembers', effective <> 'free'
    ),
    'limits', jsonb_build_object(
      'recipes', case when effective = 'free' then 5 end,
      'ingredients', case when effective = 'free' then 20 end,
      'templates', case effective when 'free' then 1 when 'starter' then 3 end,
      'timers', case when not pro_plus then 2 end,
      'stockItems', case effective when 'free' then 10 when 'starter' then 40 end,
      'locations', case when effective = 'advanced' then null else 1 end,
      'members', member_limit
    )
  );
end
$$;

revoke all on function public.get_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.get_entitlements(uuid) to authenticated;

-- Direct stock inserts: Advanced has the same paid stock rights as Pro.
drop policy if exists stock_moves_check_billing on public.stock_moves;
create policy stock_moves_check_billing on public.stock_moves as restrictive
  for insert to authenticated with check (
    (type <> 'otpis' or (select public.effective_owner_plan(auth.uid())) in ('starter', 'pro', 'advanced'))
    and (type <> 'korekcija' or (select public.effective_owner_plan(auth.uid())) in ('pro', 'advanced'))
    and (type <> 'dopuna' or unit_cost is null
      or (select public.effective_owner_plan(auth.uid())) in ('starter', 'pro', 'advanced'))
  );

-- Invite accept seat caps must match get_entitlements members limit.
create or replace function public.accept_workspace_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.workspace_invites%rowtype;
  v_limit integer;
  v_seats integer;
  v_owner uuid;
  v_plan text;
begin
  if v_uid is null then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null or v_email = '' then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  select * into v_invite
  from public.workspace_invites i
  where i.token_hash = p_token_hash
  for update;

  if not found
     or v_invite.accepted_at is not null
     or v_invite.expires_at <= now() then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  if lower(trim(v_invite.email)) is distinct from v_email then
    raise exception 'INVITE_EMAIL_MISMATCH' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = v_invite.workspace_id and wm.user_id = v_uid
  ) then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  select wm.user_id into v_owner
  from public.workspace_members wm
  where wm.workspace_id = v_invite.workspace_id and wm.role = 'owner'
  order by wm.created_at
  limit 1;

  v_plan := coalesce((select plan from public.billing_entitlement_row(v_owner)), 'free');
  v_limit := case v_plan
    when 'advanced' then 10
    when 'pro' then 10
    when 'starter' then 3
    else 1
  end;

  v_seats := public.workspace_member_seat_count(v_invite.workspace_id);
  if v_seats >= v_limit then
    raise exception 'MEMBER_LIMIT' using errcode = 'P0001';
  end if;

  update public.workspace_invites
  set accepted_at = now(), accepted_by = v_uid
  where id = v_invite.id
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, v_uid, v_invite.role);

  return v_invite.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(text) from public;
grant execute on function public.accept_workspace_invite(text) to authenticated;
