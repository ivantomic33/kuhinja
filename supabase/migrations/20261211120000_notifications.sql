create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null
    constraint notifications_kind_check
    check (kind in ('ingredient_price_change', 'recipe_cost_change')),
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb
    constraint notifications_data_object_check
    check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

revoke all on table public.notifications from public, anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.notification_recipe_portion_cost(
  p_recipe_id uuid,
  p_override_ingredient_id uuid default null,
  p_override_price numeric default null,
  p_override_waste_percent numeric default null,
  p_override_unit text default null,
  p_override_portions numeric default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_portions numeric;
  v_total numeric := 0;
  v_line numeric;
  v_has_items boolean := false;
  r record;
begin
  select coalesce(p_override_portions, recipes.portions)
    into v_portions
  from public.recipes
  where id = p_recipe_id;

  if v_portions is null or v_portions <= 0 then
    return null;
  end if;

  for r in
    select ri.quantity, i.id as ingredient_id, i.unit, i.price, i.waste_percent
    from public.recipe_items ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = p_recipe_id
  loop
    v_has_items := true;
    v_line := public.calc_line_cost(
      r.quantity,
      case
        when r.ingredient_id = p_override_ingredient_id
          then coalesce(p_override_unit, r.unit)
        else r.unit
      end,
      case
        when r.ingredient_id = p_override_ingredient_id
          then coalesce(p_override_price, r.price)
        else r.price
      end,
      case
        when r.ingredient_id = p_override_ingredient_id
          then coalesce(p_override_unit, r.unit)
        else r.unit
      end,
      case
        when r.ingredient_id = p_override_ingredient_id
          then coalesce(p_override_waste_percent, r.waste_percent)
        else r.waste_percent
      end
    );

    if v_line is null then
      return null;
    end if;
    v_total := v_total + v_line;
  end loop;

  if not v_has_items then
    return null;
  end if;

  return v_total / v_portions;
end;
$$;

revoke all on function public.notification_recipe_portion_cost(
  uuid, uuid, numeric, numeric, text, numeric
) from public, anon, authenticated;

create or replace function public.notify_ingredient_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change_percent numeric;
begin
  if old.price is null or old.price <= 0 or new.price is not distinct from old.price then
    return new;
  end if;

  v_change_percent := abs(new.price - old.price) / old.price * 100;
  if v_change_percent <= 10 then
    return new;
  end if;

  insert into public.notifications (
    user_id, workspace_id, kind, title, message, data
  )
  select
    wm.user_id,
    new.workspace_id,
    'ingredient_price_change',
    'Promena cene sastojka',
    format(
      'Cena sastojka %s promenjena je za %s%%.',
      new.name,
      round(v_change_percent, 1)
    ),
    jsonb_build_object(
      'ingredient_id', new.id,
      'ingredient_name', new.name,
      'old_price', old.price,
      'new_price', new.price,
      'change_percent', round(v_change_percent, 4)
    )
  from public.workspace_members wm
  where wm.workspace_id = new.workspace_id;

  return new;
end;
$$;

revoke all on function public.notify_ingredient_price_change()
  from public, anon, authenticated;

drop trigger if exists ingredients_notify_price_change on public.ingredients;
create trigger ingredients_notify_price_change
  after update of price on public.ingredients
  for each row
  when (old.price is distinct from new.price)
  execute function public.notify_ingredient_price_change();

create or replace function public.notify_affected_recipe_cost_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe record;
  v_old_cost numeric;
  v_new_cost numeric;
  v_change_percent numeric;
begin
  if old.price is not distinct from new.price
     and old.waste_percent is not distinct from new.waste_percent
     and old.unit is not distinct from new.unit then
    return new;
  end if;

  for v_recipe in
    select distinct r.id, r.workspace_id, r.name, r.portions
    from public.recipe_items ri
    join public.recipes r on r.id = ri.recipe_id
    where ri.ingredient_id = new.id
  loop
    v_old_cost := public.notification_recipe_portion_cost(
      v_recipe.id,
      new.id,
      old.price,
      old.waste_percent,
      old.unit,
      null
    );
    v_new_cost := public.notification_recipe_portion_cost(v_recipe.id);

    if v_old_cost is null or v_new_cost is null or v_old_cost <= 0 then
      continue;
    end if;

    v_change_percent := abs(v_new_cost - v_old_cost) / v_old_cost * 100;
    if v_change_percent <= 5 then
      continue;
    end if;

    insert into public.notifications (
      user_id, workspace_id, kind, title, message, data
    )
    select
      wm.user_id,
      v_recipe.workspace_id,
      'recipe_cost_change',
      'Promena troška recepta',
      format(
        'Trošak recepta %s promenjen je za %s%%.',
        v_recipe.name,
        round(v_change_percent, 1)
      ),
      jsonb_build_object(
        'recipe_id', v_recipe.id,
        'recipe_name', v_recipe.name,
        'ingredient_id', new.id,
        'ingredient_name', new.name,
        'old_cost', round(v_old_cost, 6),
        'new_cost', round(v_new_cost, 6),
        'change_percent', round(v_change_percent, 4)
      )
    from public.workspace_members wm
    where wm.workspace_id = v_recipe.workspace_id;
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_affected_recipe_cost_changes()
  from public, anon, authenticated;

drop trigger if exists ingredients_notify_recipe_cost_change on public.ingredients;
create trigger ingredients_notify_recipe_cost_change
  after update of price, waste_percent, unit on public.ingredients
  for each row
  when (
    old.price is distinct from new.price
    or old.waste_percent is distinct from new.waste_percent
    or old.unit is distinct from new.unit
  )
  execute function public.notify_affected_recipe_cost_changes();

create or replace function public.notify_recipe_portion_cost_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_cost numeric;
  v_new_cost numeric;
  v_change_percent numeric;
begin
  if old.portions is not distinct from new.portions then
    return new;
  end if;

  v_old_cost := public.notification_recipe_portion_cost(
    new.id, null, null, null, null, old.portions
  );
  v_new_cost := public.notification_recipe_portion_cost(new.id);

  if v_old_cost is null or v_new_cost is null or v_old_cost <= 0 then
    return new;
  end if;

  v_change_percent := abs(v_new_cost - v_old_cost) / v_old_cost * 100;
  if v_change_percent <= 5 then
    return new;
  end if;

  insert into public.notifications (
    user_id, workspace_id, kind, title, message, data
  )
  select
    wm.user_id,
    new.workspace_id,
    'recipe_cost_change',
    'Promena troška recepta',
    format(
      'Trošak recepta %s promenjen je za %s%%.',
      new.name,
      round(v_change_percent, 1)
    ),
    jsonb_build_object(
      'recipe_id', new.id,
      'recipe_name', new.name,
      'old_cost', round(v_old_cost, 6),
      'new_cost', round(v_new_cost, 6),
      'change_percent', round(v_change_percent, 4),
      'cause', 'portions'
    )
  from public.workspace_members wm
  where wm.workspace_id = new.workspace_id;

  return new;
end;
$$;

revoke all on function public.notify_recipe_portion_cost_change()
  from public, anon, authenticated;

drop trigger if exists recipes_notify_portion_cost_change on public.recipes;
create trigger recipes_notify_portion_cost_change
  after update of portions on public.recipes
  for each row
  when (old.portions is distinct from new.portions)
  execute function public.notify_recipe_portion_cost_change();
