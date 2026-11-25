-- P8 F3 food cost alerts regression (supabase test db)
begin;
select '1..1';

insert into auth.users (id, email, aud, role)
values
  ('c1111111-1111-4111-8111-111111111111', 'fc-owner@example.test', 'authenticated', 'authenticated'),
  ('c2222222-2222-4222-8222-222222222222', 'fc-other@example.test', 'authenticated', 'authenticated');

insert into public.subscriptions (user_id, paddle_customer_id, paddle_subscription_id, plan_key, status)
values
  ('c1111111-1111-4111-8111-111111111111', 'fc_owner_cust', 'fc_owner_sub', 'starter', 'active'),
  ('c2222222-2222-4222-8222-222222222222', 'fc_other_cust', 'fc_other_sub', 'starter', 'active');

insert into public.venues (id, owner_id, name)
values
  ('e1111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 'FC Venue A'),
  ('e2222222-2222-4222-8222-222222222222', 'c2222222-2222-4222-8222-222222222222', 'FC Venue B');

-- workspace_id backfilled by triggers / F1; ensure present
update public.venues v
set workspace_id = wm.workspace_id
from public.workspace_members wm
where v.owner_id = wm.user_id
  and wm.role = 'owner'
  and v.workspace_id is null;

insert into public.ingredients (id, venue_id, name, unit, price, waste_percent)
values
  ('f1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'FC Meso', 'kg', 10, 0),
  ('f2222222-2222-4222-8222-222222222222', 'e1111111-1111-4111-8111-111111111111', 'FC Ulje', 'l', 5, 0);

insert into public.recipes (
  id, venue_id, name, portions, selling_price, selling_price_net, target_food_cost_pct
)
values (
  'f3333333-3333-4333-8333-333333333333',
  'e1111111-1111-4111-8111-111111111111',
  'FC Recept',
  1,
  20,
  20,
  30
);

insert into public.recipe_items (recipe_id, ingredient_id, quantity)
values
  ('f3333333-3333-4333-8333-333333333333', 'f1111111-1111-4111-8111-111111111111', 0.5),
  ('f3333333-3333-4333-8333-333333333333', 'f2222222-2222-4222-8222-222222222222', 0.1);

insert into public.recipes (
  id, venue_id, name, portions, selling_price, selling_price_net, target_food_cost_pct
)
values (
  'f4444444-4444-4444-8444-444444444444',
  'e1111111-1111-4111-8111-111111111111',
  'FC Bez cene',
  1,
  0,
  null,
  30
);

insert into public.recipe_items (recipe_id, ingredient_id, quantity)
values (
  'f4444444-4444-4444-8444-444444444444',
  'f1111111-1111-4111-8111-111111111111',
  1
);

-- SQL ↔ TS parity (lib/calc/sql-parity.test.ts)
do $$
begin
  if abs(public.calc_line_cost(200, 'g', 500, 'kg', 10) - (0.2 * (500 / 0.9))) >= 0.000001 then
    raise exception 'SQL line cost parity failed (mass)';
  end if;
  if abs(public.calc_line_cost(50, 'ml', 200, 'l', 0) - 10) >= 0.000001 then
    raise exception 'SQL line cost parity failed (volume)';
  end if;
  if abs(
    (
      public.calc_line_cost(200, 'g', 500, 'kg', 10)
      + public.calc_line_cost(50, 'ml', 200, 'l', 0)
    ) / 2
    - ((0.2 * (500 / 0.9) + 10) / 2)
  ) >= 0.000001 then
    raise exception 'SQL portion cost parity failed';
  end if;
end $$;

set local "request.jwt.claim.sub" = 'c1111111-1111-4111-8111-111111111111';
set local role authenticated;

do $$
declare
  v_alert uuid;
  v_count int;
  v_ws uuid;
  v_before timestamptz;
begin
  -- 1) Restock over target → one alert
  perform public.restock_ingredient('f1111111-1111-4111-8111-111111111111', 50, 'up');
  select count(*)::int into v_count
  from public.alerts
  where kind = 'food_cost_over_target'
    and subject_id = 'f3333333-3333-4333-8333-333333333333'
    and read_at is null;
  if v_count <> 1 then
    raise exception 'expected 1 unread alert after over-target restock, got %', v_count;
  end if;

  -- 2) Higher restock while unread → still one row
  perform public.restock_ingredient('f1111111-1111-4111-8111-111111111111', 60, 'higher');
  select count(*)::int into v_count
  from public.alerts
  where kind = 'food_cost_over_target'
    and subject_id = 'f3333333-3333-4333-8333-333333333333';
  if v_count <> 1 then
    raise exception 'duplicate alert while unread: %', v_count;
  end if;

  -- 3) Mark read; still over target → no new unread
  select id into v_alert
  from public.alerts
  where subject_id = 'f3333333-3333-4333-8333-333333333333'
  order by created_at desc
  limit 1;
  perform public.mark_alert_read(v_alert);
  perform public.restock_ingredient('f1111111-1111-4111-8111-111111111111', 70, 'still-high');
  select count(*)::int into v_count
  from public.alerts
  where kind = 'food_cost_over_target'
    and subject_id = 'f3333333-3333-4333-8333-333333333333'
    and read_at is null;
  if v_count <> 0 then
    raise exception 'threshold rule failed: got unread % after mark-read while still over', v_count;
  end if;

  -- 4) Under then over → new unread
  perform public.restock_ingredient('f1111111-1111-4111-8111-111111111111', 8, 'down');
  perform public.restock_ingredient('f1111111-1111-4111-8111-111111111111', 50, 'up-again');
  select count(*)::int into v_count
  from public.alerts
  where kind = 'food_cost_over_target'
    and subject_id = 'f3333333-3333-4333-8333-333333333333'
    and read_at is null;
  if v_count <> 1 then
    raise exception 'expected new alert after under→over cross, got %', v_count;
  end if;

  -- 5) No selling_price_net → no alert
  perform public.restock_ingredient('f1111111-1111-4111-8111-111111111111', 99, 'no-sell');
  select count(*)::int into v_count
  from public.alerts
  where subject_id = 'f4444444-4444-4444-8444-444444444444';
  if v_count <> 0 then
    raise exception 'alert created without selling_price_net';
  end if;
end $$;

reset role;

-- 6) Ingredient without price → skip (no zero snapshot write for unpriced lines)
alter table public.ingredients alter column price drop not null;
update public.ingredients
set price = null
where id = 'f2222222-2222-4222-8222-222222222222';

do $$
declare
  v_before numeric;
  v_after numeric;
  v_before_at timestamptz;
begin
  select food_cost_pct, computed_at into v_before, v_before_at
  from public.recipe_cost_snapshot
  where recipe_id = 'f3333333-3333-4333-8333-333333333333';

  perform public.check_food_cost_alert('f3333333-3333-4333-8333-333333333333');

  select food_cost_pct into v_after
  from public.recipe_cost_snapshot
  where recipe_id = 'f3333333-3333-4333-8333-333333333333';

  if v_before is distinct from v_after then
    raise exception 'null ingredient price changed snapshot food_cost_pct';
  end if;
  if exists (
    select 1 from public.recipe_cost_snapshot
    where recipe_id = 'f3333333-3333-4333-8333-333333333333'
      and portion_cost = 0
      and computed_at > coalesce(v_before_at, '-infinity'::timestamptz)
  ) then
    raise exception 'null price wrote zero portion_cost';
  end if;
end $$;

update public.ingredients set price = 5 where id = 'f2222222-2222-4222-8222-222222222222';
alter table public.ingredients alter column price set not null;

-- 7) Foreign user cannot mark alert
do $$
declare
  v_alert uuid;
  v_ws uuid;
begin
  select workspace_id into v_ws
  from public.venues
  where id = 'e1111111-1111-4111-8111-111111111111';

  select id into v_alert
  from public.alerts
  where workspace_id = v_ws
    and read_at is null
  order by created_at desc
  limit 1;

  if v_alert is null then
    insert into public.alerts (workspace_id, kind, subject_id, payload)
    values (v_ws, 'food_cost_over_target', 'f3333333-3333-4333-8333-333333333333', '{}'::jsonb)
    returning id into v_alert;
  end if;

  perform set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);
  set local role authenticated;
  begin
    perform public.mark_alert_read(v_alert);
    raise exception 'other user marked foreign alert';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate <> '42501' and position('Access denied' in sqlerrm) = 0 then
        raise;
      end if;
  end;
  reset role;
end $$;

-- 8) digest_runs unique
do $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws
  from public.venues
  where id = 'e1111111-1111-4111-8111-111111111111';

  insert into public.digest_runs (workspace_id, run_date)
  values (v_ws, current_date);

  begin
    insert into public.digest_runs (workspace_id, run_date)
    values (v_ws, current_date);
    raise exception 'duplicate digest_runs allowed';
  exception
    when unique_violation then null;
  end;
end $$;

rollback;
