-- Server-side recipe list pagination under RLS (supabase test db).
-- Mirrors the app query: filter venue_id, count exact, order + id tie-break, range.
begin;
select '1..1';

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'recipes-page-a@example.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'recipes-page-b@example.test', 'authenticated', 'authenticated');

-- Paid plans so free-limit triggers allow bulk inserts.
insert into public.profiles (id, full_name, plan)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Owner A', 'pro'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Owner B', 'pro')
on conflict (id) do update
set plan = excluded.plan,
    full_name = excluded.full_name;

insert into public.subscriptions (user_id, paddle_customer_id, paddle_subscription_id, price_id, plan_key, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rp_a_customer', 'rp_a_subscription', 'fixture_price', 'pro', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rp_b_customer', 'rp_b_subscription', 'fixture_price', 'pro', 'active');

insert into public.venues (id, owner_id, name)
values
  ('a1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venue A'),
  ('b2222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Venue B');

-- ~1000 recipes across 2 venues (500 each). Fixed updated_at for stable sort ties.
insert into public.recipes (id, venue_id, name, portions, selling_price, updated_at)
select
  ('a0000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid,
  'a1111111-1111-4111-8111-111111111111',
  'Recipe A ' || lpad(g::text, 4, '0'),
  1,
  100,
  timestamptz '2026-03-01 12:00:00+00'
from generate_series(1, 500) as g;

insert into public.recipes (id, venue_id, name, portions, selling_price, updated_at)
select
  ('b0000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid,
  'b2222222-2222-4222-8222-222222222222',
  'Recipe B ' || lpad(g::text, 4, '0'),
  1,
  100,
  timestamptz '2026-03-01 12:00:00+00'
from generate_series(1, 500) as g;

-- Extra tie rows for secondary id ordering (same name prefix sort key via updated_at).
insert into public.recipes (id, venue_id, name, portions, selling_price, updated_at)
values
  (
    'a1111111-aaaa-4aaa-8aaa-000000000001',
    'a1111111-1111-4111-8111-111111111111',
    'Tie sort low',
    1,
    50,
    timestamptz '2026-03-02 00:00:00+00'
  ),
  (
    'a1111111-aaaa-4aaa-8aaa-000000000002',
    'a1111111-1111-4111-8111-111111111111',
    'Tie sort high',
    1,
    50,
    timestamptz '2026-03-02 00:00:00+00'
  );

set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;

do $$
declare
  page_size constant int := 25;
  venue_a constant uuid := 'a1111111-1111-4111-8111-111111111111';
  total_a int;
  total_visible int;
  page1_count int;
  last_page int;
  last_page_count int;
  out_of_range_count int;
  expected_last_count int;
  tie_first uuid;
  tie_second uuid;
  page1_ids uuid[];
  page2_ids uuid[];
  overlap int;
begin
  -- Count under RLS must only include the caller's venue rows.
  select count(*)::int into total_a
  from public.recipes
  where venue_id = venue_a;

  select count(*)::int into total_visible
  from public.recipes;

  if total_a <> 502 then
    raise exception 'Expected 502 recipes for venue A, got %', total_a;
  end if;

  if total_visible <> 502 then
    raise exception 'RLS count leaked other venues: visible % (expected 502)', total_visible;
  end if;

  -- Page 1 (offset 0).
  select count(*)::int into page1_count
  from (
    select id
    from public.recipes
    where venue_id = venue_a
    order by updated_at desc nulls last, id asc
    limit page_size offset 0
  ) p;

  if page1_count <> page_size then
    raise exception 'Page 1 expected % rows, got %', page_size, page1_count;
  end if;

  select array_agg(id order by updated_at desc nulls last, id asc)
  into page1_ids
  from (
    select id, updated_at
    from public.recipes
    where venue_id = venue_a
    order by updated_at desc nulls last, id asc
    limit page_size offset 0
  ) p;

  -- Last page (partial).
  last_page := ceil(total_a::numeric / page_size)::int - 1;
  expected_last_count := total_a - (last_page * page_size);

  select count(*)::int into last_page_count
  from (
    select id
    from public.recipes
    where venue_id = venue_a
    order by updated_at desc nulls last, id asc
    limit page_size offset (last_page * page_size)
  ) p;

  if last_page_count <> expected_last_count then
    raise exception 'Last page expected % rows, got % (page %)', expected_last_count, last_page_count, last_page;
  end if;

  -- Out-of-range page (past the end) returns no rows; app reclamps client-side.
  select count(*)::int into out_of_range_count
  from (
    select id
    from public.recipes
    where venue_id = venue_a
    order by updated_at desc nulls last, id asc
    limit page_size offset ((last_page + 5) * page_size)
  ) p;

  if out_of_range_count <> 0 then
    raise exception 'Out-of-range page expected 0 rows, got %', out_of_range_count;
  end if;

  -- Non-overlapping adjacent pages.
  select array_agg(id order by updated_at desc nulls last, id asc)
  into page2_ids
  from (
    select id, updated_at
    from public.recipes
    where venue_id = venue_a
    order by updated_at desc nulls last, id asc
    limit page_size offset page_size
  ) p;

  select count(*)::int into overlap
  from unnest(page1_ids) id1
  join unnest(page2_ids) id2 on id1 = id2;

  if overlap <> 0 then
    raise exception 'Page 1 and page 2 overlap by % ids', overlap;
  end if;

  -- Stable ordering when sort keys tie: id ascending secondary.
  select id into tie_first
  from public.recipes
  where venue_id = venue_a
    and updated_at = timestamptz '2026-03-02 00:00:00+00'
  order by updated_at desc nulls last, id asc
  limit 1;

  select id into tie_second
  from public.recipes
  where venue_id = venue_a
    and updated_at = timestamptz '2026-03-02 00:00:00+00'
  order by updated_at desc nulls last, id asc
  offset 1
  limit 1;

  if tie_first is distinct from 'a1111111-aaaa-4aaa-8aaa-000000000001'::uuid then
    raise exception 'Tie-break first id expected ...0001, got %', tie_first;
  end if;

  if tie_second is distinct from 'a1111111-aaaa-4aaa-8aaa-000000000002'::uuid then
    raise exception 'Tie-break second id expected ...0002, got %', tie_second;
  end if;

  if tie_first >= tie_second then
    raise exception 'Secondary id sort is not ascending: % >= %', tie_first, tie_second;
  end if;
end;
$$;

-- User B must not count venue A rows.
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;

do $$
declare
  total_b int;
  leaked int;
begin
  select count(*)::int into total_b from public.recipes;
  if total_b <> 500 then
    raise exception 'User B expected 500 own recipes, got %', total_b;
  end if;

  select count(*)::int into leaked
  from public.recipes
  where venue_id = 'a1111111-1111-4111-8111-111111111111';

  if leaked <> 0 then
    raise exception 'User B counted % venue A recipes under RLS', leaked;
  end if;
end;
$$;

reset role;

select 'ok 1 - recipe list count under RLS, page boundaries, and stable id tie-break';
rollback;
