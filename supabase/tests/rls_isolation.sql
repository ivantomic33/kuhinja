-- Pokretanje nad lokalnim Supabase okruženjem: supabase test db.
begin;
select '1..1';

insert into auth.users (id, email, aud, role, email_confirmed_at)
values ('75400000-0000-4000-8000-00000000000a', 'isolation-a@example.test', 'authenticated', 'authenticated', now()),
       ('75400000-0000-4000-8000-00000000000b', 'isolation-b@example.test', 'authenticated', 'authenticated', now());

create temp table isolation_fixtures (table_name text primary key, tenant_key jsonb not null, update_column text not null);
grant select on isolation_fixtures to authenticated;

do $$
<<seed>>
declare
  user_id uuid;
  workspace_id uuid;
  venue_id uuid;
  ingredient_id uuid;
  recipe_id uuid;
  template_id uuid;
  run_id uuid;
  supplier_id uuid;
  order_id uuid;
  location_id uuid;
  employee_id uuid;
  v_token uuid;
  v_tag text;
begin
  for user_id, v_tag in
    select * from (values ('75400000-0000-4000-8000-00000000000a'::uuid, 'a'),
                          ('75400000-0000-4000-8000-00000000000b'::uuid, 'b')) as users(id, tag)
  loop
    select wm.workspace_id into workspace_id from public.workspace_members wm
    where wm.user_id = seed.user_id and wm.role = 'owner';
    select v.id into venue_id from public.venues v where v.owner_id = seed.user_id;
    insert into public.subscriptions (user_id, paddle_customer_id, paddle_subscription_id, price_id, plan_key, status)
    values (user_id, 'isolation_cus_' || v_tag, 'isolation_sub_' || v_tag, 'isolation_price', 'advanced', 'active');
    insert into public.suppliers (workspace_id, name) values (workspace_id, 'Isolation supplier') returning id into supplier_id;
    insert into public.ingredients (venue_id, name, unit, price, supplier_id)
    values (venue_id, 'Isolation ingredient', 'kg', 20, supplier_id) returning id into ingredient_id;
    insert into public.ingredient_allergens (ingredient_id, allergen_code) values (ingredient_id, 'gluten');
    insert into public.ingredient_price_history (ingredient_id, price) values (ingredient_id, 20);
    insert into public.recipes (venue_id, name, portions) values (venue_id, 'Isolation recipe', 1) returning id into recipe_id;
    insert into public.recipe_items (recipe_id, ingredient_id, quantity) values (recipe_id, ingredient_id, 1);
    insert into public.checklist_templates (venue_id, name) values (venue_id, 'Isolation checklist') returning id into template_id;
    insert into public.checklist_runs (venue_id, template_id, user_id)
    values (venue_id, template_id, user_id) returning id into run_id;
    insert into public.shift_checklist_items (run_id, item_id) values (run_id, 'isolation-item');
    insert into public.stock_levels (venue_id, ingredient_id) values (venue_id, ingredient_id);
    insert into public.stock_moves (venue_id, ingredient_id, type, qty_delta, user_id)
    values (venue_id, ingredient_id, 'dopuna', 1, user_id);
    insert into public.stock_movements (workspace_id, ingredient_id, delta, reason)
    values (workspace_id, ingredient_id, 1, 'prijem');
    insert into public.purchase_orders (workspace_id, supplier_id, number) values (workspace_id, supplier_id, 1)
    returning id into order_id;
    insert into public.purchase_order_items (purchase_order_id, ingredient_id, ingredient_name_snapshot, unit, qty_ordered)
    values (order_id, ingredient_id, 'Isolation ingredient', 'kg', 1);
    insert into public.order_counters (workspace_id) values (workspace_id);
    insert into public.recipe_cost_snapshot (recipe_id, workspace_id, portion_cost) values (recipe_id, workspace_id, 20);
    insert into public.alerts (workspace_id, kind, subject_id) values (workspace_id, 'low_stock', ingredient_id);
    insert into public.digest_runs (workspace_id, run_date) values (workspace_id, date '2026-12-14');
    insert into public.waste_entries (workspace_id, ingredient_id, quantity, reason, created_by)
    values (workspace_id, ingredient_id, 1, 'istek', user_id);
    insert into public.legal_consents (user_id, document, version) values (user_id, 'terms', 'isolation');
    insert into public.workspace_invites (workspace_id, email, role, token_hash, expires_at)
    values (workspace_id, 'isolation-a@example.test', 'cook', repeat(v_tag, 64), now() + interval '1 day');
    insert into public.paddle_checkout_authorizations (transaction_id, user_id, customer_id, price_id)
    values ('isolation_tx_' || v_tag, user_id, 'isolation_cus_' || v_tag, 'isolation_price');
    insert into public.paddle_released_customers (customer_id, former_user_id)
    values ('isolation_former_' || v_tag, user_id);
    insert into public.billing_events (id, event_type) values ('isolation_evt_' || v_tag, 'subscription.legacy');
    insert into public.billing_locks (key, token, expires_at)
    values ('isolation_lock_' || v_tag, gen_random_uuid(), now());

    insert into public.schedule_locations (owner_id, name, is_default) values (user_id, 'Isolation location', true)
    returning id into location_id;
    insert into public.schedule_employees (location_id, full_name, role)
    values (location_id, 'Isolation employee', 'Kuhinja') returning id into employee_id;
    insert into public.schedule_assignments (location_id, employee_id, date, code)
    values (location_id, employee_id, date '2026-12-14', 'J');
    insert into public.schedule_publications (location_id, monday, assignments, published_by)
    values (location_id, date '2026-12-14', '[]', user_id);
    insert into public.schedule_requests (location_id, employee_id, date, type, source)
    values (location_id, employee_id, date '2026-12-14', 'slobodan', '{}');
    insert into public.schedule_notifications (location_id, employee_id, monday, kind)
    values (location_id, employee_id, date '2026-12-14', 'published');
    insert into public.schedule_copy_undos (location_id, monday, previous, copied)
    values (location_id, date '2026-12-14', '[]', '[]');
    insert into public.schedule_share_links (location_id, monday, preview)
    values (location_id, date '2026-12-14', jsonb_build_object(
      'venueName', 'Isolation location', 'monday', '2026-12-14',
      'employees', jsonb_build_array(jsonb_build_object('id', employee_id, 'full_name', 'Isolation employee', 'role', 'private')),
      'assignments', public.schedule_shifts(location_id, date '2026-12-14', date '2026-12-15', null)
    )) returning token into v_token;

    perform set_config('test.venue_' || v_tag, venue_id::text, true);
    perform set_config('test.ingredient_' || v_tag, ingredient_id::text, true);
    perform set_config('test.order_' || v_tag, order_id::text, true);
    if v_tag = 'b' then
      insert into public.workspace_invites (workspace_id, email, role, token_hash, expires_at)
      select workspace_id, 'pending-' || pending.n || '@example.test', 'cook',
        'isolation-pending-seat-' || pending.n, now() + interval '1 day'
      from generate_series(1, 8) as pending(n);
      perform set_config('test.workspace_b', workspace_id::text, true);
      perform set_config('test.recipe_b', recipe_id::text, true);
      perform set_config('test.location_b', location_id::text, true);
      perform set_config('test.share_b', v_token::text, true);

      insert into isolation_fixtures values
        ('workspaces', jsonb_build_object('id', workspace_id), 'name'),
        ('workspace_members', jsonb_build_object('workspace_id', workspace_id), 'role'),
        ('workspace_invites', jsonb_build_object('workspace_id', workspace_id), 'role'),
        ('venues', jsonb_build_object('id', venue_id), 'name'),
        ('profiles', jsonb_build_object('id', user_id), 'full_name'),
        ('subscriptions', jsonb_build_object('user_id', user_id), 'status'),
        ('legal_consents', jsonb_build_object('user_id', user_id), 'version'),
        ('paddle_checkout_authorizations', jsonb_build_object('user_id', user_id), 'price_id'),
        ('paddle_released_customers', jsonb_build_object('former_user_id', user_id), 'customer_id'),
        ('billing_events', '{"id":"isolation_evt_b"}', 'event_type'),
        ('billing_locks', '{"key":"isolation_lock_b"}', 'expires_at'),
        ('ingredients', jsonb_build_object('id', ingredient_id), 'name'),
        ('ingredient_allergens', jsonb_build_object('ingredient_id', ingredient_id), 'presence'),
        ('ingredient_price_history', jsonb_build_object('ingredient_id', ingredient_id), 'price'),
        ('recipes', jsonb_build_object('id', recipe_id), 'name'),
        ('recipe_items', jsonb_build_object('recipe_id', recipe_id), 'quantity'),
        ('checklist_templates', jsonb_build_object('id', template_id), 'name'),
        ('checklist_runs', jsonb_build_object('id', run_id), 'status'),
        ('shift_checklist_items', jsonb_build_object('run_id', run_id), 'checked'),
        ('stock_levels', jsonb_build_object('ingredient_id', ingredient_id), 'qty'),
        ('stock_moves', jsonb_build_object('ingredient_id', ingredient_id), 'undone'),
        ('stock_movements', jsonb_build_object('ingredient_id', ingredient_id), 'note'),
        ('suppliers', jsonb_build_object('id', supplier_id), 'name'),
        ('order_counters', jsonb_build_object('workspace_id', workspace_id), 'last_number'),
        ('purchase_orders', jsonb_build_object('id', order_id), 'number'),
        ('purchase_order_items', jsonb_build_object('purchase_order_id', order_id), 'qty_ordered'),
        ('recipe_cost_snapshot', jsonb_build_object('recipe_id', recipe_id), 'portion_cost'),
        ('alerts', jsonb_build_object('workspace_id', workspace_id), 'read_at'),
        ('digest_runs', jsonb_build_object('workspace_id', workspace_id), 'run_date'),
        ('waste_entries', jsonb_build_object('workspace_id', workspace_id), 'note'),
        ('schedule_locations', jsonb_build_object('id', location_id), 'name'),
        ('schedule_employees', jsonb_build_object('location_id', location_id), 'role'),
        ('schedule_assignments', jsonb_build_object('location_id', location_id), 'code'),
        ('schedule_publications', jsonb_build_object('location_id', location_id), 'assignments'),
        ('schedule_requests', jsonb_build_object('location_id', location_id), 'note'),
        ('schedule_notifications', jsonb_build_object('location_id', location_id), 'kind'),
        ('schedule_copy_undos', jsonb_build_object('location_id', location_id), 'previous'),
        ('schedule_share_links', jsonb_build_object('location_id', location_id), 'preview');
    end if;
  end loop;
end;
$$;

-- Materialize each foreign fixture as the trusted test runner. The client
-- cannot read B's rows to build the record used in the insert assertion.
alter table isolation_fixtures add column insert_row jsonb;
do $$
declare
  v_fixture record;
  v_row jsonb;
begin
  for v_fixture in select * from isolation_fixtures loop
    execute format('select to_jsonb(t) from public.%I t where to_jsonb(t) @> $1 limit 1', v_fixture.table_name)
      into v_row using v_fixture.tenant_key;
    if v_row is null then
      raise exception 'Missing target row for %', v_fixture.table_name;
    end if;
    update isolation_fixtures set insert_row = v_row where table_name = v_fixture.table_name;
  end loop;

  if exists (
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    except select f.table_name from isolation_fixtures f
  ) then
    raise exception 'A public table is missing an isolation fixture';
  end if;
end;
$$;

-- Test RLS independently of plan quotas, which run before insert policies.
-- These fixture changes roll back with the test transaction.
alter table public.checklist_templates disable trigger checklist_templates_enforce_free_limit;
alter table public.ingredients disable trigger ingredients_enforce_free_limit;
alter table public.recipes disable trigger recipes_enforce_free_limit;
alter table public.recipe_items disable trigger recipe_items_same_venue;
alter table public.stock_levels disable trigger stock_levels_enforce_free_limit;

set local "request.jwt.claims" = '{"sub":"75400000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

do $$
declare
  workspace_b uuid := current_setting('test.workspace_b')::uuid;
begin
  begin
    insert into public.workspace_members (workspace_id, user_id, role)
    values (workspace_b, auth.uid(), 'owner');
    raise exception 'Workspace isolation allowed self-enrollment as owner';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

do $$
declare
  v_fixture record;
  v_count bigint;
  v_cols text;
  v_preview jsonb;
  v_workspace uuid;
  workspace_b uuid := current_setting('test.workspace_b')::uuid;
  recipe_b uuid := current_setting('test.recipe_b')::uuid;
  ingredient_b uuid := current_setting('test.ingredient_b')::uuid;
  order_b uuid := current_setting('test.order_b')::uuid;
  venue_b uuid := current_setting('test.venue_b')::uuid;
begin
  if not exists (select from public.venues where id = current_setting('test.venue_a')::uuid) then
    raise exception 'User A must be able to read their own venue';
  end if;

  for v_fixture in select * from isolation_fixtures order by table_name loop
    begin
      execute format('select count(*) from public.%I t where to_jsonb(t) @> $1', v_fixture.table_name)
        into v_count using v_fixture.tenant_key;
      if v_count <> 0 then
        raise exception 'Cross-tenant SELECT allowed on %', v_fixture.table_name;
      end if;
    exception when insufficient_privilege then
      null; -- Tables with no authenticated grant are also inaccessible.
    end;

    begin
      execute format('update public.%I t set %I = t.%I where to_jsonb(t) @> $1',
        v_fixture.table_name, v_fixture.update_column, v_fixture.update_column)
        using v_fixture.tenant_key;
      get diagnostics v_count = row_count;
      if v_count <> 0 then
        raise exception 'Cross-tenant UPDATE allowed on %', v_fixture.table_name;
      end if;
    exception when insufficient_privilege then null;
    end;

    begin
      execute format('delete from public.%I t where to_jsonb(t) @> $1', v_fixture.table_name)
        using v_fixture.tenant_key;
      get diagnostics v_count = row_count;
      if v_count <> 0 then
        raise exception 'Cross-tenant DELETE allowed on %', v_fixture.table_name;
      end if;
    exception when insufficient_privilege then null;
    end;

    select string_agg(quote_ident(attname), ', ' order by attnum) into v_cols
    from pg_attribute
    where attrelid = format('public.%I', v_fixture.table_name)::regclass
      and attnum > 0 and not attisdropped and attgenerated = '';

    begin
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
        v_fixture.table_name, v_cols, v_cols, v_fixture.table_name) using v_fixture.insert_row;
      raise exception 'Cross-tenant INSERT allowed on %', v_fixture.table_name;
    exception when insufficient_privilege then null;
    end;
  end loop;

  begin
    insert into public.venues (owner_id, name, workspace_id) values (auth.uid(), 'Foreign venue', workspace_b);
    raise exception 'Legacy venue policy still bypasses tenant membership';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.ingredients (venue_id, workspace_id, name, unit, price)
    values (venue_b, (select v.workspace_id from public.venues v where v.id = current_setting('test.venue_a')::uuid),
            'Foreign parent', 'kg', 1);
    raise exception 'Ingredient can be attached to a venue outside its workspace';
  exception when insufficient_privilege then null;
  end;

  if public.workspace_member_seat_count(workspace_b) <> 0
     or public.workspace_member_limit(workspace_b) <> 0
     or public.workspace_has_feature(workspace_b, 'allergens')
     or public.schedule_location_access(current_setting('test.location_b')::uuid, false) then
    raise exception 'Foreign workspace metadata was disclosed';
  end if;

  begin
    insert into public.purchase_order_items (
      purchase_order_id, ingredient_id, ingredient_name_snapshot, unit, qty_ordered
    )
    values (current_setting('test.order_a')::uuid, ingredient_b, 'Foreign ingredient', 'kg', 1);
    raise exception 'Purchase order accepted an ingredient from a different workspace';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.refresh_recipe_cost_snapshot(recipe_b);
    raise exception 'Foreign recipe cost refresh was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.check_food_cost_alert(recipe_b);
    raise exception 'Foreign food cost alert evaluation was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.check_low_stock_alert(ingredient_b);
    raise exception 'Internal low-stock helper can be called by an API role';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.apply_ingredient_price_internal(ingredient_b, 30);
    raise exception 'Internal ingredient price helper can be called by an API role';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.allocate_purchase_order_number(workspace_b);
    raise exception 'Foreign purchase order number allocation was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.receive_purchase_order(order_b, '[{}]');
    raise exception 'Foreign receipt was allowed';
  exception when no_data_found then null;
  end;

  v_preview := public.schedule_public(current_setting('test.share_b')::uuid);
  if v_preview->'assignments'->0->>'code' is distinct from 'J'
     or v_preview->'assignments'->0 ? 'workspace_id'
     or v_preview->'employees'->0 ? 'role' then
    raise exception 'Public preview did not apply its JSON allowlist';
  end if;

  v_workspace := public.create_workspace('Isolation workspace');
  if not exists (
    select from public.workspaces w join public.workspace_members wm on wm.workspace_id = w.id
    where w.id = v_workspace and w.created_by = auth.uid() and wm.user_id = auth.uid() and wm.role = 'owner'
  ) then
    raise exception 'Workspace creation failed to bootstrap its owner';
  end if;

  v_workspace := public.accept_workspace_invite(repeat('b', 64));
  if v_workspace is distinct from workspace_b
     or not public.is_member(workspace_b, 'cook') or public.is_member(workspace_b, 'chef') then
    raise exception 'Valid invitation did not grant its restricted member role';
  end if;
end;
$$;

reset role;

set local "request.jwt.claims" = '{"sub":"75400000-0000-4000-8000-00000000000b","role":"authenticated"}';
set local role authenticated;

do $$
declare
  workspace_b uuid := current_setting('test.workspace_b')::uuid;
  user_a constant uuid := '75400000-0000-4000-8000-00000000000a';
begin
  begin
    update public.workspace_members set role = 'owner'
    where workspace_id = workspace_b and user_id = user_a;
    raise exception 'Membership update granted owner status outside workspace creation';
  exception when insufficient_privilege then null;
  end;

  update public.workspace_members set role = 'chef'
  where workspace_id = workspace_b and user_id = user_a;
  if not found then
    raise exception 'Workspace owner could not update a member to chef';
  end if;
  update public.workspace_members set role = 'manager'
  where workspace_id = workspace_b and user_id = user_a;
end;
$$;

reset role;
set local "request.jwt.claims" = '{"sub":"75400000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

do $$
declare
  workspace_b uuid := current_setting('test.workspace_b')::uuid;
begin
  if public.workspace_member_limit(workspace_b) <> 10
     or public.workspace_member_seat_count(workspace_b) <> 10 then
    raise exception 'Workspace manager did not receive the owner plan seat limit';
  end if;

  begin
    insert into public.workspace_invites (workspace_id, email, role, token_hash, expires_at)
    values (workspace_b, 'overbooked@example.test', 'cook', 'isolation-overbooked', now() + interval '1 day');
    raise exception 'Workspace accepted an invite beyond the seat limit';
  exception when raise_exception then
    if sqlerrm <> 'MEMBER_LIMIT' then raise; end if;
  end;

  delete from public.workspace_invites where token_hash = 'isolation-pending-seat-1';
  insert into public.workspace_invites (workspace_id, email, role, token_hash, expires_at)
  values (workspace_b, 'new-invite@example.test', 'cook', 'isolation-manager-invite', now() + interval '1 day');
end;
$$;

reset role;

-- Verify employee read policies with transaction-local grants. Production
-- schedule tables remain accessible through the existing RPCs.
update public.schedule_employees
set user_id = '75400000-0000-4000-8000-00000000000a'
where location_id = current_setting('test.location_b')::uuid;

with private_location as (
  insert into public.schedule_locations (owner_id, name)
  values ('75400000-0000-4000-8000-00000000000b', 'Separate B location') returning id
)
insert into public.schedule_publications (location_id, monday, assignments, published_by)
select id, date '2026-12-14', '[]', '75400000-0000-4000-8000-00000000000b' from private_location;

grant select on public.schedule_locations, public.schedule_publications to authenticated;
set local "request.jwt.claims" = '{"sub":"75400000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;

do $$
declare
  user_b constant uuid := '75400000-0000-4000-8000-00000000000b';
  location_b uuid := current_setting('test.location_b')::uuid;
begin
  if (select array_agg(l.id) from public.schedule_locations l where l.owner_id = user_b)
       is distinct from array[location_b]
     or (select array_agg(p.location_id) from public.schedule_publications p where p.published_by = user_b)
       is distinct from array[location_b] then
    raise exception 'Employee can see the wrong schedule location or publication';
  end if;
end;
$$;

reset role;
select 'ok 1 - cross-tenant CRUD, privileged routines and authorized sharing';
rollback;
