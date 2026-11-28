begin;
select '1..1';

insert into auth.users (id, email, aud, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rls-user-a@example.test', 'authenticated', 'authenticated'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rls-user-b@example.test', 'authenticated', 'authenticated');

insert into public.subscriptions (user_id, paddle_customer_id, paddle_subscription_id, price_id, plan_key, status)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rls_a_customer', 'rls_a_subscription', 'fixture_price', 'pro', 'active'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rls_b_customer', 'rls_b_subscription', 'fixture_price', 'starter', 'active');

insert into public.venues (id, owner_id, name)
values ('a1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Venue A'),
       ('b2222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Venue B');

insert into public.ingredients (id, venue_id, name, unit, price)
values ('a3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'Flour A', 'kg', 100),
       ('b4444444-4444-4444-8444-444444444444', 'b2222222-2222-4222-8222-222222222222', 'Flour B', 'kg', 200);

alter table public.ingredient_price_history add constraint test_reject_history_record
  check (price <> 333.33) not valid;

insert into public.recipes (id, venue_id, name)
values ('a5555555-5555-4555-8555-555555555555', 'a1111111-1111-4111-8111-111111111111', 'Bread A'),
       ('b6666666-6666-4666-8666-666666666666', 'b2222222-2222-4222-8222-222222222222', 'Bread B');

insert into public.checklist_templates (id, venue_id, name)
values ('a7777777-7777-4777-8777-777777777777', 'a1111111-1111-4111-8111-111111111111', 'Template A'),
       ('b8888888-8888-4888-8888-888888888888', 'b2222222-2222-4222-8222-222222222222', 'Template B');

insert into public.checklist_runs (id, venue_id, template_id, user_id, checked_item_ids)
values ('a9999999-9999-4999-8999-999999999999', 'a1111111-1111-4111-8111-111111111111',
        'a7777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '["legacy"]'),
       ('b9999999-9999-4999-8999-999999999999', 'b2222222-2222-4222-8222-222222222222',
        'b8888888-8888-4888-8888-888888888888', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '["legacy"]');

set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;

do $$
declare
  own_ingredient constant uuid := 'a3333333-3333-4333-8333-333333333333';
  other_ingredient constant uuid := 'b4444444-4444-4444-8444-444444444444';
  own_recipe constant uuid := 'a5555555-5555-4555-8555-555555555555';
  other_recipe constant uuid := 'b6666666-6666-4666-8666-666666666666';
  own_run constant uuid := 'a9999999-9999-4999-8999-999999999999';
  other_run constant uuid := 'b9999999-9999-4999-8999-999999999999';
  invalid_price numeric;
begin
  if (select count(*) from public.ingredients where id in (own_ingredient, other_ingredient)) <> 1
     or not exists (select from public.ingredients where id = own_ingredient)
     or exists (select from public.ingredient_price_history where ingredient_id = other_ingredient)
     or exists (select from public.recipes where id = other_recipe)
     or exists (select from public.shift_checklist_items where run_id = other_run) then
    raise exception 'User A read isolation failed';
  end if;

  update public.ingredients set price = 999 where id = other_ingredient;
  if found then raise exception 'User A updated user B ingredient'; end if;
  delete from public.recipes where id = other_recipe;
  if found then raise exception 'User A deleted user B recipe'; end if;
  update public.shift_checklist_items set checked = false where run_id = other_run;
  if found then raise exception 'User A updated user B checklist'; end if;

  begin
    insert into public.checklist_runs (venue_id, template_id, user_id)
    values ('a1111111-1111-4111-8111-111111111111', 'b8888888-8888-4888-8888-888888888888', auth.uid());
    raise exception 'User A created a run referencing user B template';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.upsert_shift_checklist_item(other_run, 'legacy', false);
    raise exception 'User A upserted a user B checklist item';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.restock_ingredient(other_ingredient, 25, null);
    raise exception 'User A restocked a user B ingredient';
  exception when no_data_found then null;
  end;

  foreach invalid_price in array array[0::numeric, -1, 1.001, 'NaN', 'Infinity'] loop
    begin
      perform public.restock_ingredient(own_ingredient, invalid_price, null);
      raise exception 'Restock accepted invalid price %', invalid_price;
    exception when invalid_parameter_value then null;
    end;
  end loop;

  perform public.restock_ingredient(own_ingredient, 125.25, ' Delivery ');
  if not exists (select from public.ingredients where id = own_ingredient
                 and price = 125.25 and version = 2 and notes = 'Delivery')
     or (select count(*) from public.ingredient_price_history where ingredient_id = own_ingredient) <> 2 then
    raise exception 'Changed restock must update price and record exactly one history row';
  end if;

  perform public.restock_ingredient(own_ingredient, 125.25, null);
  if (select count(*) from public.ingredient_price_history where ingredient_id = own_ingredient) <> 3 then
    raise exception 'Unchanged restock must record one history row';
  end if;
  begin
    perform public.restock_ingredient(own_ingredient, 333.33, null);
    raise exception 'Expected the history constraint to reject this restock';
  exception when check_violation then null;
  end;
  if not exists (select from public.ingredients where id = own_ingredient
                 and price = 125.25 and version = 3) then
    raise exception 'The ingredient update was not rolled back with the history insert';
  end if;

  update public.ingredients set name = 'stale' where id = own_ingredient and version = 1;
  if found then raise exception 'Stale ingredient version was accepted'; end if;
  update public.recipes set selling_price = 100 where id = own_recipe and version = 1;
  if not found then raise exception 'Current recipe version was rejected'; end if;
  update public.recipes set selling_price = 200 where id = own_recipe and version = 1;
  if found then raise exception 'Stale recipe version was accepted'; end if;
  if not exists (select from public.recipes where id = own_recipe
                 and version = 2 and selling_price = 100) then
    raise exception 'Recipe version was not incremented';
  end if;

  perform public.upsert_shift_checklist_item(own_run, 'first', true);
  perform public.upsert_shift_checklist_item(own_run, 'second', true);
  perform public.upsert_shift_checklist_item(own_run, 'first', false);
  if (select count(*) from public.shift_checklist_items where run_id = own_run and checked) <> 2
     or not exists (select from public.shift_checklist_items where run_id = own_run and item_id = 'second' and checked)
     or not exists (select from public.shift_checklist_items where run_id = own_run
                    and item_id = 'first' and not checked and checked_by is null and checked_at is null) then
    raise exception 'A checklist delta changed an untouched item';
  end if;
end;
$$;

reset role;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;

do $$
begin
  if exists (select from public.ingredients where id = 'a3333333-3333-4333-8333-333333333333')
     or not exists (select from public.ingredients where id = 'b4444444-4444-4444-8444-444444444444' and price = 200)
     or not exists (select from public.shift_checklist_items where run_id = 'b9999999-9999-4999-8999-999999999999' and checked) then
    raise exception 'User B isolation or fixture state failed';
  end if;
  update public.ingredients set price = 1 where id = 'a3333333-3333-4333-8333-333333333333';
  if found then raise exception 'User B updated user A ingredient'; end if;
  perform public.restock_ingredient('b4444444-4444-4444-8444-444444444444', 250.50, null);
  if exists (select from public.ingredient_price_history
             where ingredient_id = 'b4444444-4444-4444-8444-444444444444') then
    raise exception 'Starter must not be able to read price history';
  end if;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.ingredient_price_history
      where ingredient_id = 'b4444444-4444-4444-8444-444444444444' and price = 250.50) <> 1 then
    raise exception 'Starter restock must record one history row';
  end if;
end;
$$;

select 'ok 1 - RLS isolation, restock history, optimistic versions and checklist deltas';
rollback;
