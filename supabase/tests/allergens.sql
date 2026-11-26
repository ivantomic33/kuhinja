-- Allergen catalogue, RLS, ingredient assignment, and automatic recipe union.
begin;
select '1..1';

insert into auth.users (id, email, aud, role)
values
  ('d1111111-1111-4111-8111-111111111111', 'allergen-owner@example.test', 'authenticated', 'authenticated'),
  ('d2222222-2222-4222-8222-222222222222', 'allergen-other@example.test', 'authenticated', 'authenticated');

insert into public.subscriptions (user_id, paddle_customer_id, paddle_subscription_id, plan_key, status)
values
  ('d1111111-1111-4111-8111-111111111111', 'allergen_owner_customer', 'allergen_owner_sub', 'pro', 'active'),
  ('d2222222-2222-4222-8222-222222222222', 'allergen_other_customer', 'allergen_other_sub', 'pro', 'active');

insert into public.venues (id, owner_id, name)
values
  ('d3333333-3333-4333-8333-333333333333', 'd1111111-1111-4111-8111-111111111111', 'Allergen Venue A'),
  ('d4444444-4444-4444-8444-444444444444', 'd2222222-2222-4222-8222-222222222222', 'Allergen Venue B');

insert into public.ingredients (id, venue_id, name, unit, price)
values
  ('d5555555-5555-4555-8555-555555555555', 'd3333333-3333-4333-8333-333333333333', 'Ingredient A', 'kg', 10),
  ('d6666666-6666-4666-8666-666666666666', 'd3333333-3333-4333-8333-333333333333', 'Ingredient B', 'kg', 10),
  ('d7777777-7777-4777-8777-777777777777', 'd4444444-4444-4444-8444-444444444444', 'Ingredient Other', 'kg', 10);

insert into public.recipes (id, venue_id, name)
values ('d8888888-8888-4888-8888-888888888888', 'd3333333-3333-4333-8333-333333333333', 'Allergen Test Recipe');

insert into public.recipe_items (recipe_id, ingredient_id, quantity)
values
  ('d8888888-8888-4888-8888-888888888888', 'd5555555-5555-4555-8555-555555555555', 1),
  ('d8888888-8888-4888-8888-888888888888', 'd6666666-6666-4666-8666-666666666666', 1);

set local "request.jwt.claim.sub" = 'd1111111-1111-4111-8111-111111111111';
set local role authenticated;

do $$
declare
  v_count integer;
  v_presence text;
begin
  select count(*) into v_count from public.allergens;
  if v_count <> 14 then
    raise exception 'Expected 14 catalogue allergens, got %', v_count;
  end if;

  perform public.set_ingredient_allergens(
    'd5555555-5555-4555-8555-555555555555',
    '[{"code":"gluten","presence":"trace"}]'::jsonb
  );
  perform public.set_ingredient_allergens(
    'd6666666-6666-4666-8666-666666666666',
    '[{"code":"gluten","presence":"contains"},{"code":"mleko","presence":"trace"}]'::jsonb
  );

  select presence into v_presence
  from public.recipe_allergens
  where recipe_id = 'd8888888-8888-4888-8888-888888888888'
    and allergen_code = 'gluten';
  if v_presence <> 'contains' then
    raise exception 'Recipe union did not prefer contains over trace';
  end if;

  if not exists (
    select from public.recipe_allergens
    where recipe_id = 'd8888888-8888-4888-8888-888888888888'
      and allergen_code = 'mleko' and presence = 'trace'
  ) then
    raise exception 'Recipe union omitted an ingredient allergen';
  end if;

  if exists (
    select from public.ingredient_allergens
    where ingredient_id = 'd7777777-7777-4777-8777-777777777777'
  ) then
    raise exception 'RLS exposed another workspace allergen';
  end if;

  begin
    perform public.set_ingredient_allergens(
      'd7777777-7777-4777-8777-777777777777',
      '[{"code":"jaja","presence":"contains"}]'::jsonb
    );
    raise exception 'Cross-workspace allergen update was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local "request.jwt.claim.sub" = 'd2222222-2222-4222-8222-222222222222';
set local role authenticated;

do $$
begin
  if exists (
    select from public.ingredient_allergens
    where ingredient_id = 'd5555555-5555-4555-8555-555555555555'
  ) then
    raise exception 'Second workspace can read first workspace allergens';
  end if;
end;
$$;

select 'ok 1 - catalogue, RLS and automatic recipe allergen union';
rollback;
