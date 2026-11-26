-- Per-user RLS and threshold-triggered price / recipe-cost notifications.
begin;
select '1..1';

insert into auth.users (id, email, aud, role)
values
  ('e1111111-1111-4111-8111-111111111111', 'notifications-owner@example.test', 'authenticated', 'authenticated'),
  ('e2222222-2222-4222-8222-222222222222', 'notifications-chef@example.test', 'authenticated', 'authenticated'),
  ('e3333333-3333-4333-8333-333333333333', 'notifications-outsider@example.test', 'authenticated', 'authenticated');

insert into public.profiles (id, full_name)
values
  ('e1111111-1111-4111-8111-111111111111', 'Owner'),
  ('e2222222-2222-4222-8222-222222222222', 'Chef'),
  ('e3333333-3333-4333-8333-333333333333', 'Outsider')
on conflict (id) do nothing;

insert into public.workspaces (id, name)
values
  ('e4444444-4444-4444-8444-444444444444', 'Notifications Workspace'),
  ('e5555555-5555-4555-8555-555555555555', 'Other Workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('e4444444-4444-4444-8444-444444444444', 'e1111111-1111-4111-8111-111111111111', 'owner'),
  ('e4444444-4444-4444-8444-444444444444', 'e2222222-2222-4222-8222-222222222222', 'chef'),
  ('e5555555-5555-4555-8555-555555555555', 'e3333333-3333-4333-8333-333333333333', 'owner');

insert into public.venues (id, owner_id, workspace_id, name)
values
  ('e6666666-6666-4666-8666-666666666666', 'e1111111-1111-4111-8111-111111111111', 'e4444444-4444-4444-8444-444444444444', 'Notify Venue'),
  ('e7777777-7777-4777-8777-777777777777', 'e3333333-3333-4333-8333-333333333333', 'e5555555-5555-4555-8555-555555555555', 'Other Venue');

insert into public.ingredients (id, venue_id, workspace_id, name, unit, price, waste_percent)
values
  ('e8888888-8888-4888-8888-888888888888', 'e6666666-6666-4666-8666-666666666666', 'e4444444-4444-4444-8444-444444444444', 'Notification Flour', 'kg', 100, 0);

insert into public.recipes (id, venue_id, workspace_id, name, portions, selling_price)
values
  ('e9999999-9999-4999-8999-999999999999', 'e6666666-6666-4666-8666-666666666666', 'e4444444-4444-4444-8444-444444444444', 'Notification Bread', 1, 300);

insert into public.recipe_items (recipe_id, ingredient_id, quantity)
values ('e9999999-9999-4999-8999-999999999999', 'e8888888-8888-4888-8888-888888888888', 1);

-- A 12% increase creates both kinds; exactly 10% creates no price notice.
update public.ingredients
set price = 112
where id = 'e8888888-8888-4888-8888-888888888888';

update public.ingredients
set price = 123.2
where id = 'e8888888-8888-4888-8888-888888888888';

-- Exactly 5% cost increase does not create another cost notice.
update public.ingredients
set price = 129.36
where id = 'e8888888-8888-4888-8888-888888888888';

-- Portion changes also alter recipe cost and should notify workspace members.
update public.recipes
set portions = 2
where id = 'e9999999-9999-4999-8999-999999999999';

set local "request.jwt.claim.sub" = 'e1111111-1111-4111-8111-111111111111';
set local role authenticated;

do $$
declare
  v_price_count integer;
  v_cost_count integer;
  v_total integer;
begin
  select count(*) into v_price_count
  from public.notifications
  where kind = 'ingredient_price_change';
  select count(*) into v_cost_count
  from public.notifications
  where kind = 'recipe_cost_change';
  select count(*) into v_total from public.notifications;

  if v_price_count <> 1 then
    raise exception 'Expected one >10%% price notification, got %', v_price_count;
  end if;
  if v_cost_count <> 3 then
    raise exception 'Expected three >5%% recipe-cost notifications, got %', v_cost_count;
  end if;
  if v_total <> 4 then
    raise exception 'Expected four notifications for workspace owner, got %', v_total;
  end if;

  update public.notifications
  set read_at = now()
  where id = (select id from public.notifications limit 1);
end;
$$;

reset role;
set local "request.jwt.claim.sub" = 'e2222222-2222-4222-8222-222222222222';
set local role authenticated;

do $$
begin
  if (select count(*) from public.notifications) <> 4 then
    raise exception 'Workspace member should see only their four notifications';
  end if;
end;
$$;

reset role;
set local "request.jwt.claim.sub" = 'e3333333-3333-4333-8333-333333333333';
set local role authenticated;

do $$
begin
  if exists (select from public.notifications) then
    raise exception 'Unrelated user can read another user notifications';
  end if;
end;
$$;

select 'ok 1 - threshold notifications are generated and isolated by RLS';
rollback;
