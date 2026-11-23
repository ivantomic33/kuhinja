-- =============================================================================
-- Server-side plan limits (defense in depth for direct REST inserts).
-- Messages use LIMIT_REACHED:<FREE_LIMIT_*> so the app can open the upsell sheet.
-- Plan is always read from profiles (owner of the venue), never from the client.
-- Expired paid plans (plan_expires_at < now()) are treated as free.
-- =============================================================================

create or replace function public.effective_owner_plan(p_owner_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.plan is null then 'free'
    when p.plan in ('pro', 'premium', 'starter', 'team', 'business')
      and p.plan_expires_at is not null
      and p.plan_expires_at < now()
      then 'free'
    when p.plan = 'premium' then 'pro'
    else coalesce(p.plan, 'free')
  end
  from public.profiles p
  where p.id = p_owner_id;
$$;

revoke all on function public.effective_owner_plan(uuid) from public;
grant execute on function public.effective_owner_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ingredients / recipes / checklist_templates
-- ---------------------------------------------------------------------------

create or replace function public.enforce_free_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_plan text;
  v_count integer;
  v_max integer;
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  v_plan := coalesce(public.effective_owner_plan(v_owner_id), 'free');

  if tg_table_name = 'ingredients' then
    -- Free only: 20. Paid plans unlimited.
    if v_plan <> 'free' then
      return new;
    end if;

    select count(*)::integer
    into v_count
    from public.ingredients i
    where i.venue_id = new.venue_id;

    if v_count >= 20 then
      raise exception 'LIMIT_REACHED:FREE_LIMIT_INGREDIENTS: maximum 20 ingredients per venue';
    end if;

  elsif tg_table_name = 'recipes' then
    if v_plan <> 'free' then
      return new;
    end if;

    select count(*)::integer
    into v_count
    from public.recipes r
    where r.venue_id = new.venue_id;

    if v_count >= 5 then
      raise exception 'LIMIT_REACHED:FREE_LIMIT_RECIPES: maximum 5 recipes per venue';
    end if;

  elsif tg_table_name = 'checklist_templates' then
    -- Free: 1, Starter: 3, Pro+: unlimited
    if v_plan in ('pro', 'team', 'business') then
      return new;
    end if;

    v_max := case when v_plan = 'starter' then 3 else 1 end;

    select count(*)::integer
    into v_count
    from public.checklist_templates t
    where t.venue_id = new.venue_id;

    if v_count >= v_max then
      raise exception 'LIMIT_REACHED:FREE_LIMIT_TEMPLATES: maximum % checklist templates per venue', v_max;
    end if;
  end if;

  return new;
end;
$$;

-- Ensure triggers exist (idempotent)
drop trigger if exists ingredients_enforce_free_limit on public.ingredients;
create trigger ingredients_enforce_free_limit
  before insert on public.ingredients
  for each row
  execute function public.enforce_free_limit();

drop trigger if exists recipes_enforce_free_limit on public.recipes;
create trigger recipes_enforce_free_limit
  before insert on public.recipes
  for each row
  execute function public.enforce_free_limit();

drop trigger if exists checklist_templates_enforce_free_limit
  on public.checklist_templates;
create trigger checklist_templates_enforce_free_limit
  before insert on public.checklist_templates
  for each row
  execute function public.enforce_free_limit();

-- ---------------------------------------------------------------------------
-- stock_levels: Free 10, Starter 40, Pro+ unlimited
-- ---------------------------------------------------------------------------

create or replace function public.enforce_stock_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_plan text;
  v_count integer;
  v_max integer;
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  v_plan := coalesce(public.effective_owner_plan(v_owner_id), 'free');

  if v_plan in ('pro', 'team', 'business') then
    return new;
  end if;

  v_max := case when v_plan = 'starter' then 40 else 10 end;

  select count(*)::integer
  into v_count
  from public.stock_levels s
  where s.venue_id = new.venue_id;

  if v_count >= v_max then
    raise exception 'LIMIT_REACHED:FREE_LIMIT_STOCK_ITEMS: maximum % stock items per venue', v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists stock_levels_enforce_free_limit on public.stock_levels;
create trigger stock_levels_enforce_free_limit
  before insert on public.stock_levels
  for each row
  execute function public.enforce_stock_item_limit();

-- ---------------------------------------------------------------------------
-- ingredient_price_history: Pro+ only
-- ---------------------------------------------------------------------------

create or replace function public.enforce_price_history_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_plan text;
begin
  select v.owner_id
  into v_owner_id
  from public.ingredients i
  join public.venues v on v.id = i.venue_id
  where i.id = new.ingredient_id;

  if v_owner_id is null then
    raise exception 'Ingredient venue not found';
  end if;

  v_plan := coalesce(public.effective_owner_plan(v_owner_id), 'free');

  -- Pro / team / business (legacy premium normalized in effective_owner_plan)
  if v_plan in ('pro', 'team', 'business') then
    return new;
  end if;

  raise exception 'LIMIT_REACHED:FREE_LIMIT_PRICE_HISTORY: price history requires Pro';
end;
$$;

drop trigger if exists ingredient_price_history_enforce_plan
  on public.ingredient_price_history;

create trigger ingredient_price_history_enforce_plan
  before insert on public.ingredient_price_history
  for each row
  execute function public.enforce_price_history_plan();

-- Auto-log only for Pro+ (skip free/starter so inserts do not fail the ingredient write)
create or replace function public.log_ingredient_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_plan text;
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  v_plan := coalesce(public.effective_owner_plan(v_owner_id), 'free');

  if v_plan not in ('pro', 'team', 'business') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.ingredient_price_history (ingredient_id, price)
    values (new.id, new.price);
  elsif tg_op = 'UPDATE' and new.price is distinct from old.price then
    insert into public.ingredient_price_history (ingredient_id, price)
    values (new.id, new.price);
  end if;

  return new;
end;
$$;
