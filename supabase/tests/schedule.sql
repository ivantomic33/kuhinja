begin;
select '1..1';

insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-4111-8111-111111111111', 'schedule-owner@example.test', now()),
  ('22222222-2222-4222-8222-222222222222', 'schedule-employee@example.test', now()),
  ('33333333-3333-4333-8333-333333333333', 'schedule-outsider@example.test', now())
on conflict (id) do nothing;

insert into public.profiles (id, full_name, plan) values
  ('11111111-1111-4111-8111-111111111111', 'Šef Test', 'free'),
  ('22222222-2222-4222-8222-222222222222', 'Radnik Test', 'free'),
  ('33333333-3333-4333-8333-333333333333', 'Treći Test', 'free')
on conflict (id) do update set full_name = excluded.full_name, plan = excluded.plan;

-- Exercise future Team and Business schedule behavior with test-only ranks.
-- The production resolver still handles Free, Starter and Pro from subscriptions.
alter function public.schedule_rank(uuid) rename to schedule_billing_rank;
create function public.schedule_rank(p_owner uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case (select plan from public.profiles
    where id = p_owner and (plan_expires_at is null or plan_expires_at >= now()))
    when 'team' then 3 when 'business' then 4
    else public.schedule_billing_rank(p_owner) end
$$;
revoke all on function public.schedule_rank(uuid) from public, anon, authenticated;

do $$
<<fixture>>
declare
  owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  member_id constant uuid := '22222222-2222-4222-8222-222222222222';
  outsider_id constant uuid := '33333333-3333-4333-8333-333333333333';
  location_id uuid;
  employee_id uuid;
  coworker_id uuid;
  second_location uuid;
  next_monday date;
  current_monday date := date_trunc('week', timezone('Europe/Belgrade', now()))::date;
  data jsonb;
  share_token uuid;
  undo_token uuid;
  request_id uuid;
  i integer;
begin
  assert not has_function_privilege('anon', 'public.schedule_load(uuid,date)', 'execute');
  assert not has_function_privilege('anon', 'public.schedule_command(text,uuid,date,jsonb)', 'execute');
  assert not has_function_privilege('authenticated', 'public.schedule_scope(uuid,boolean)', 'execute');
  assert not has_table_privilege('authenticated', 'public.schedule_assignments', 'select');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  next_monday := current_monday + 7;
  assert public.schedule_load(null, next_monday) is null, 'Free account opened Raspored';
  assert not exists (select from public.schedule_locations l where l.owner_id = fixture.owner_id),
    'Free account created a schedule location';

  insert into public.subscriptions (user_id, paddle_customer_id, paddle_subscription_id, price_id, plan_key, status)
    values (owner_id, 'schedule_fixture_customer', 'schedule_fixture_subscription', 'fixture_price', 'starter', 'active');
  data := public.schedule_load(null, next_monday);
  assert (data->>'monday')::date = next_monday;
  location_id := (data->'venue'->>'id')::uuid;

  for i in 1..4 loop
    perform public.schedule_command('employee', location_id, current_monday,
      jsonb_build_object('full_name', 'Test ' || i, 'role', 'Kuvar', 'hourly_rate_rsd', 500));
  end loop;
  data := public.schedule_load(location_id, current_monday);
  assert jsonb_array_length(data->'employees') = 4;
  update public.subscriptions set status = 'canceled' where user_id = owner_id;
  assert public.schedule_load(location_id, current_monday) is null;
  begin
    perform public.schedule_command('publish', location_id, current_monday, '{}');
    raise exception 'Free account could publish its own schedule';
  exception when sqlstate '42501' then null;
  end;

  update public.profiles set plan = 'team' where id = owner_id;
  data := public.schedule_command('employee', location_id, next_monday,
    '{"full_name":"Radnik Test","role":"Kuvar","hourly_rate_rsd":650,"login_email":"schedule-employee@example.test"}');
  employee_id := (data->>'id')::uuid;
  data := public.schedule_load(location_id, current_monday);
  select (person->>'id')::uuid into coworker_id
    from jsonb_array_elements(data->'employees') person
    where (person->>'id')::uuid <> employee_id limit 1;
  perform public.schedule_command('assignment', location_id, current_monday,
    jsonb_build_object('employee_id', employee_id, 'date', current_monday, 'code', 'N'));
  data := public.schedule_command('copy', location_id, next_monday, '{}');
  undo_token := (data->>'token')::uuid;
  data := public.schedule_load(location_id, next_monday);
  assert data->'assignments'->0->>'code' = 'N';
  perform public.schedule_command('undo', location_id, next_monday, jsonb_build_object('token', undo_token));
  data := public.schedule_load(location_id, next_monday);
  assert jsonb_array_length(data->'assignments') = 0;

  perform public.schedule_command('assignment', location_id, next_monday,
    jsonb_build_object('employee_id', employee_id, 'date', next_monday, 'code', 'J'));
  data := public.schedule_command('share', location_id, next_monday, '{}');
  share_token := (data->>'token')::uuid;
  data := public.schedule_public(share_token);
  assert not (data::text like '%hourly_rate_rsd%' or data::text like '%login_email%');
  assert data::text like '%Radnik T.%';

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  data := public.schedule_load(location_id, next_monday);
  assert data->>'mode' = 'employee';
  assert jsonb_array_length(data->'employees') = 1;
  assert jsonb_array_length(data->'assignments') = 0;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  data := public.schedule_load(location_id, next_monday);
  assert data is null;
  begin
    perform public.schedule_command('publish', location_id, next_monday, '{}');
    raise exception 'Outsider could publish';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.schedule_command('publish', location_id, next_monday, '{}');
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  data := public.schedule_load(location_id, next_monday);
  assert data->'assignments'->0->>'code' = 'J';
  assert jsonb_array_length(data->'notifications') = 1;
  update auth.users set email = 'schedule-employee-renamed@example.test' where id = member_id;
  update auth.users set email = 'schedule-employee@example.test' where id = outsider_id;
  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  assert public.schedule_load(location_id, next_monday) is null;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  assert public.schedule_load(location_id, next_monday)->>'mode' = 'employee';
  data := public.schedule_command('request', location_id, next_monday,
    jsonb_build_object('type','slobodan','date',next_monday));
  request_id := (data->>'id')::uuid;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.schedule_command('decide', location_id, next_monday,
    jsonb_build_object('id',request_id,'status','odobreno'));
  data := public.schedule_load(location_id, next_monday);
  assert data->'assignments'->0->>'code' = 'O';
  assert data->'requests'->0->>'status' = 'odobreno';
  assert public.schedule_public(share_token)->'assignments'->0->>'code' = 'J';

  perform public.schedule_command('assignment', location_id, next_monday,
    jsonb_build_object('employee_id', employee_id, 'date', next_monday + 1, 'code', 'J'));
  perform public.schedule_command('assignment', location_id, next_monday,
    jsonb_build_object('employee_id', coworker_id, 'date', next_monday + 1, 'code', 'P'));

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  data := public.schedule_load(location_id, next_monday);
  assert jsonb_array_length(data->'assignments') = 1;
  assert data->'assignments'->0->>'code' = 'O';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.schedule_command('publish', location_id, next_monday, '{}');
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  data := public.schedule_command('request', location_id, next_monday,
    jsonb_build_object('type','zamena','date',next_monday + 1, 'with_employee_id',coworker_id));
  request_id := (data->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.schedule_command('decide', location_id, next_monday,
    jsonb_build_object('id',request_id,'status','odobreno'));
  data := public.schedule_load(location_id, next_monday);
  assert exists (select from jsonb_array_elements(data->'assignments') a
    where a->>'employee_id'=employee_id::text and (a->>'date')::date = next_monday + 1 and a->>'code'='P');
  assert exists (select from jsonb_array_elements(data->'assignments') a
    where a->>'employee_id'=coworker_id::text and (a->>'date')::date = next_monday + 1 and a->>'code'='J');

  begin
    perform public.schedule_report(location_id, next_monday);
    raise exception 'Team account could access Business report';
  exception when sqlstate '42501' then null;
  end;
  update public.profiles set plan = 'business' where id = owner_id;
  data := public.schedule_report(location_id, next_monday);
  assert jsonb_array_length(data->'assignments') >= 1;
  data := public.schedule_command('location', location_id, next_monday, '{"name":"Drugi lokal"}');
  second_location := (data->>'id')::uuid;
  data := public.schedule_load(second_location, next_monday);
  assert jsonb_array_length(data->'employees') = 0;
  assert jsonb_array_length(data->'assignments') = 0;

  update public.profiles set plan_expires_at = now() - interval '1 second' where id = owner_id;
  assert public.schedule_public(share_token) is null;
  assert public.schedule_load(second_location, next_monday) is null;
  assert public.schedule_load(null, next_monday) is null;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  assert public.schedule_load(location_id, next_monday) is null;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  update public.profiles set plan_expires_at = null where id = owner_id;
  data := public.schedule_load(location_id, next_monday);
  assert data->'assignments'->0->>'code' = 'O';

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  data := public.schedule_load(null, current_monday);
  assert data->>'mode' = 'employee';
  assert jsonb_array_length(data->'notifications') = 4;
end;
$$;

select 'ok 1 - schedule roles, publication, sharing and requests';
rollback;
