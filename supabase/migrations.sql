-- Apply to a fresh Supabase database or one with earlier migrations from this project.
-- Run the entire file so intermediate schema changes stay within one transaction.

begin;

-- 20250322000000_initial_schema.sql
-- =============================================================================
-- Initial schema: profiles, venues, ingredients, recipes, checklists
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  plan text not null default 'free'
    constraint profiles_plan_check check (plan in ('free', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Column-level grants: users may only update full_name
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

drop policy if exists "Users can select own profile" on public.profiles;
create policy "Users can select own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own full_name" on public.profiles;
create policy "Users can update own full_name"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_name_not_blank check (char_length(trim(name)) > 0)
);

create index if not exists venues_owner_id_idx on public.venues (owner_id);

create or replace trigger venues_set_updated_at
  before update on public.venues
  for each row
  execute function public.set_updated_at();

alter table public.venues enable row level security;

revoke all on table public.venues from anon, authenticated;
grant select, insert, update, delete on table public.venues to authenticated;

drop policy if exists "Owners can select own venues" on public.venues;
create policy "Owners can select own venues"
  on public.venues
  for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Owners can insert own venues" on public.venues;
create policy "Owners can insert own venues"
  on public.venues
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can update own venues" on public.venues;
create policy "Owners can update own venues"
  on public.venues
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can delete own venues" on public.venues;
create policy "Owners can delete own venues"
  on public.venues
  for delete
  to authenticated
  using (auth.uid() = owner_id);

-- True when the current user owns the given venue.
-- Must be created after public.venues (SQL functions resolve relations at create time).
create or replace function public.is_venue_owner(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venues v
    where v.id = p_venue_id
      and v.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_venue_owner(uuid) from public;
grant execute on function public.is_venue_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ingredients
-- ---------------------------------------------------------------------------

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  unit text not null,
  price numeric(14, 4) not null default 0,
  waste_percent numeric(5, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredients_name_not_blank check (char_length(trim(name)) > 0),
  constraint ingredients_unit_check check (
    unit in ('g', 'kg', 'ml', 'l', 'kom', 'pak')
  ),
  constraint ingredients_price_nonnegative check (price >= 0),
  constraint ingredients_waste_percent_range check (
    waste_percent >= 0 and waste_percent < 100
  ),
  constraint ingredients_venue_name_unique unique (venue_id, name)
);

create index if not exists ingredients_venue_id_idx
  on public.ingredients (venue_id);

create or replace trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row
  execute function public.set_updated_at();

alter table public.ingredients enable row level security;

revoke all on table public.ingredients from anon, authenticated;
grant select, insert, update, delete on table public.ingredients to authenticated;

drop policy if exists "Owners can select venue ingredients" on public.ingredients;
create policy "Owners can select venue ingredients"
  on public.ingredients
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

drop policy if exists "Owners can insert venue ingredients" on public.ingredients;
create policy "Owners can insert venue ingredients"
  on public.ingredients
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

drop policy if exists "Owners can update venue ingredients" on public.ingredients;
create policy "Owners can update venue ingredients"
  on public.ingredients
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

drop policy if exists "Owners can delete venue ingredients" on public.ingredients;
create policy "Owners can delete venue ingredients"
  on public.ingredients
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- ingredient_price_history
-- ---------------------------------------------------------------------------

create table if not exists public.ingredient_price_history (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null
    references public.ingredients (id) on delete cascade,
  price numeric(14, 4) not null,
  recorded_at timestamptz not null default now(),
  constraint ingredient_price_history_price_nonnegative check (price >= 0)
);

create index if not exists ingredient_price_history_ingredient_id_idx
  on public.ingredient_price_history (ingredient_id);

create index if not exists ingredient_price_history_recorded_at_idx
  on public.ingredient_price_history (ingredient_id, recorded_at desc);

alter table public.ingredient_price_history enable row level security;

revoke all on table public.ingredient_price_history from anon, authenticated;
grant select, insert, update, delete on table public.ingredient_price_history
  to authenticated;

drop policy if exists "Owners can select ingredient price history" on public.ingredient_price_history;
create policy "Owners can select ingredient price history"
  on public.ingredient_price_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

drop policy if exists "Owners can insert ingredient price history" on public.ingredient_price_history;
create policy "Owners can insert ingredient price history"
  on public.ingredient_price_history
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

drop policy if exists "Owners can update ingredient price history" on public.ingredient_price_history;
create policy "Owners can update ingredient price history"
  on public.ingredient_price_history
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  )
  with check (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

drop policy if exists "Owners can delete ingredient price history" on public.ingredient_price_history;
create policy "Owners can delete ingredient price history"
  on public.ingredient_price_history
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

-- Auto-log price on insert and when price changes
create or replace function public.log_ingredient_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create or replace trigger ingredients_log_price_change
  after insert or update of price on public.ingredients
  for each row
  execute function public.log_ingredient_price_change();

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  description text,
  portions numeric(10, 2) not null default 1,
  selling_price numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_name_not_blank check (char_length(trim(name)) > 0),
  constraint recipes_portions_positive check (portions > 0),
  constraint recipes_selling_price_nonnegative check (selling_price >= 0),
  constraint recipes_venue_name_unique unique (venue_id, name)
);

create index if not exists recipes_venue_id_idx on public.recipes (venue_id);

create or replace trigger recipes_set_updated_at
  before update on public.recipes
  for each row
  execute function public.set_updated_at();

alter table public.recipes enable row level security;

revoke all on table public.recipes from anon, authenticated;
grant select, insert, update, delete on table public.recipes to authenticated;

drop policy if exists "Owners can select venue recipes" on public.recipes;
create policy "Owners can select venue recipes"
  on public.recipes
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

drop policy if exists "Owners can insert venue recipes" on public.recipes;
create policy "Owners can insert venue recipes"
  on public.recipes
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

drop policy if exists "Owners can update venue recipes" on public.recipes;
create policy "Owners can update venue recipes"
  on public.recipes
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

drop policy if exists "Owners can delete venue recipes" on public.recipes;
create policy "Owners can delete venue recipes"
  on public.recipes
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- recipe_items
-- ---------------------------------------------------------------------------

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity numeric(14, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_items_quantity_positive check (quantity > 0),
  constraint recipe_items_recipe_ingredient_unique unique (recipe_id, ingredient_id)
);

create index if not exists recipe_items_recipe_id_idx
  on public.recipe_items (recipe_id);

create index if not exists recipe_items_ingredient_id_idx
  on public.recipe_items (ingredient_id);

create or replace trigger recipe_items_set_updated_at
  before update on public.recipe_items
  for each row
  execute function public.set_updated_at();

-- Ingredient and recipe must belong to the same venue
create or replace function public.enforce_recipe_item_same_venue()
returns trigger
language plpgsql
as $$
declare
  recipe_venue uuid;
  ingredient_venue uuid;
begin
  select r.venue_id into recipe_venue
  from public.recipes r
  where r.id = new.recipe_id;

  select i.venue_id into ingredient_venue
  from public.ingredients i
  where i.id = new.ingredient_id;

  if recipe_venue is null then
    raise exception 'Recipe not found';
  end if;

  if ingredient_venue is null then
    raise exception 'Ingredient not found';
  end if;

  if recipe_venue <> ingredient_venue then
    raise exception 'Ingredient and recipe must belong to the same venue';
  end if;

  return new;
end;
$$;

create or replace trigger recipe_items_same_venue
  before insert or update on public.recipe_items
  for each row
  execute function public.enforce_recipe_item_same_venue();

alter table public.recipe_items enable row level security;

revoke all on table public.recipe_items from anon, authenticated;
grant select, insert, update, delete on table public.recipe_items to authenticated;

drop policy if exists "Owners can select recipe items" on public.recipe_items;
create policy "Owners can select recipe items"
  on public.recipe_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

drop policy if exists "Owners can insert recipe items" on public.recipe_items;
create policy "Owners can insert recipe items"
  on public.recipe_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

drop policy if exists "Owners can update recipe items" on public.recipe_items;
create policy "Owners can update recipe items"
  on public.recipe_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

drop policy if exists "Owners can delete recipe items" on public.recipe_items;
create policy "Owners can delete recipe items"
  on public.recipe_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

-- ---------------------------------------------------------------------------
-- checklist_templates
-- ---------------------------------------------------------------------------

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_templates_name_not_blank check (char_length(trim(name)) > 0),
  constraint checklist_templates_items_is_array check (jsonb_typeof(items) = 'array'),
  constraint checklist_templates_venue_name_unique unique (venue_id, name)
);

create index if not exists checklist_templates_venue_id_idx
  on public.checklist_templates (venue_id);

create or replace trigger checklist_templates_set_updated_at
  before update on public.checklist_templates
  for each row
  execute function public.set_updated_at();

alter table public.checklist_templates enable row level security;

revoke all on table public.checklist_templates from anon, authenticated;
grant select, insert, update, delete on table public.checklist_templates
  to authenticated;

drop policy if exists "Owners can select venue checklist templates" on public.checklist_templates;
create policy "Owners can select venue checklist templates"
  on public.checklist_templates
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

drop policy if exists "Owners can insert venue checklist templates" on public.checklist_templates;
create policy "Owners can insert venue checklist templates"
  on public.checklist_templates
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

drop policy if exists "Owners can update venue checklist templates" on public.checklist_templates;
create policy "Owners can update venue checklist templates"
  on public.checklist_templates
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

drop policy if exists "Owners can delete venue checklist templates" on public.checklist_templates;
create policy "Owners can delete venue checklist templates"
  on public.checklist_templates
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- Free-plan limits: max 20 ingredients and 5 recipes per venue
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
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  select p.plan
  into v_plan
  from public.profiles p
  where p.id = v_owner_id;

  if coalesce(v_plan, 'free') <> 'free' then
    return new;
  end if;

  if tg_table_name = 'ingredients' then
    select count(*)::integer
    into v_count
    from public.ingredients i
    where i.venue_id = new.venue_id;

    if v_count >= 20 then
      raise exception
        'Free plan limit exceeded: maximum 20 ingredients per venue';
    end if;
  elsif tg_table_name = 'recipes' then
    select count(*)::integer
    into v_count
    from public.recipes r
    where r.venue_id = new.venue_id;

    if v_count >= 5 then
      raise exception
        'Free plan limit exceeded: maximum 5 recipes per venue';
    end if;
  end if;

  return new;
end;
$$;

create or replace trigger ingredients_enforce_free_limit
  before insert on public.ingredients
  for each row
  execute function public.enforce_free_limit();

create or replace trigger recipes_enforce_free_limit
  before insert on public.recipes
  for each row
  execute function public.enforce_free_limit();

-- ---------------------------------------------------------------------------
-- Signup: create profile + default venue
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_venue_name text;
begin
  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_venue_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'venue_name', '')), '');

  insert into public.profiles (id, full_name)
  values (new.id, coalesce(v_full_name, ''));

  insert into public.venues (owner_id, name)
  values (new.id, coalesce(v_venue_name, 'Moj lokal'));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- 20250323120000_checklist_runs.sql
-- =============================================================================
-- checklist_runs + free-plan template limit
-- =============================================================================

-- ---------------------------------------------------------------------------
-- checklist_runs: per-shift progress against a template
-- ---------------------------------------------------------------------------

create table if not exists public.checklist_runs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  template_id uuid not null references public.checklist_templates (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active'
    constraint checklist_runs_status_check check (status in ('active', 'completed')),
  checked_item_ids jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_runs_checked_is_array check (jsonb_typeof(checked_item_ids) = 'array')
);

create index if not exists checklist_runs_venue_id_idx
  on public.checklist_runs (venue_id);

create index if not exists checklist_runs_template_id_idx
  on public.checklist_runs (template_id);

create index if not exists checklist_runs_user_id_idx
  on public.checklist_runs (user_id);

-- At most one active run per user + template
create unique index if not exists checklist_runs_one_active_per_user_template
  on public.checklist_runs (user_id, template_id)
  where (status = 'active');

create or replace trigger checklist_runs_set_updated_at
  before update on public.checklist_runs
  for each row
  execute function public.set_updated_at();

alter table public.checklist_runs enable row level security;

revoke all on table public.checklist_runs from anon, authenticated;
grant select, insert, update, delete on table public.checklist_runs
  to authenticated;

drop policy if exists "Owners can select own checklist runs" on public.checklist_runs;
create policy "Owners can select own checklist runs"
  on public.checklist_runs
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

drop policy if exists "Owners can insert own checklist runs" on public.checklist_runs;
create policy "Owners can insert own checklist runs"
  on public.checklist_runs
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

drop policy if exists "Owners can update own checklist runs" on public.checklist_runs;
create policy "Owners can update own checklist runs"
  on public.checklist_runs
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

drop policy if exists "Owners can delete own checklist runs" on public.checklist_runs;
create policy "Owners can delete own checklist runs"
  on public.checklist_runs
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

-- ---------------------------------------------------------------------------
-- Free-plan limits: max 1 checklist template per venue
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
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  select p.plan
  into v_plan
  from public.profiles p
  where p.id = v_owner_id;

  if coalesce(v_plan, 'free') <> 'free' then
    return new;
  end if;

  if tg_table_name = 'ingredients' then
    select count(*)::integer
    into v_count
    from public.ingredients i
    where i.venue_id = new.venue_id;

    if v_count >= 20 then
      raise exception
        'Free plan limit exceeded: maximum 20 ingredients per venue';
    end if;
  elsif tg_table_name = 'recipes' then
    select count(*)::integer
    into v_count
    from public.recipes r
    where r.venue_id = new.venue_id;

    if v_count >= 5 then
      raise exception
        'Free plan limit exceeded: maximum 5 recipes per venue';
    end if;
  elsif tg_table_name = 'checklist_templates' then
    select count(*)::integer
    into v_count
    from public.checklist_templates t
    where t.venue_id = new.venue_id;

    if v_count >= 1 then
      raise exception
        'Free plan limit exceeded: maximum 1 checklist template per venue';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists checklist_templates_enforce_free_limit
  on public.checklist_templates;

drop trigger if exists checklist_templates_enforce_free_limit on public.checklist_templates;
create trigger checklist_templates_enforce_free_limit
  before insert on public.checklist_templates
  for each row
  execute function public.enforce_free_limit();


-- 20250324100000_free_limit_codes.sql
-- =============================================================================
-- Free-limit trigger messages use FREE_LIMIT_* codes for client gating
-- =============================================================================

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
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  select p.plan
  into v_plan
  from public.profiles p
  where p.id = v_owner_id;

  -- paid plans: legacy `pro` and app-facing `premium`
  if coalesce(v_plan, 'free') not in ('free') then
    return new;
  end if;

  if tg_table_name = 'ingredients' then
    select count(*)::integer
    into v_count
    from public.ingredients i
    where i.venue_id = new.venue_id;

    if v_count >= 20 then
      raise exception 'FREE_LIMIT_INGREDIENTS: maximum 20 ingredients per venue';
    end if;
  elsif tg_table_name = 'recipes' then
    select count(*)::integer
    into v_count
    from public.recipes r
    where r.venue_id = new.venue_id;

    if v_count >= 5 then
      raise exception 'FREE_LIMIT_RECIPES: maximum 5 recipes per venue';
    end if;
  elsif tg_table_name = 'checklist_templates' then
    select count(*)::integer
    into v_count
    from public.checklist_templates t
    where t.venue_id = new.venue_id;

    if v_count >= 1 then
      raise exception 'FREE_LIMIT_TEMPLATES: maximum 1 checklist template per venue';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists checklist_templates_enforce_free_limit
  on public.checklist_templates;

drop trigger if exists checklist_templates_enforce_free_limit on public.checklist_templates;
create trigger checklist_templates_enforce_free_limit
  before insert on public.checklist_templates
  for each row
  execute function public.enforce_free_limit();


-- 20250325120000_stripe_billing.sql
-- =============================================================================
-- Stripe billing: profile fields + webhook idempotency
-- Plan changes must only happen via service role (webhook).
-- =============================================================================

-- The schedule migration below installs the final plan constraint.
alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists plan_expires_at timestamptz;

-- One Stripe customer per profile
create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Users may read billing fields; they cannot update plan / stripe columns
-- (existing grant update is only on full_name)

-- Idempotent Stripe webhook processing (service role only)
create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from public, anon, authenticated;


-- 20260326120000_stock.sql
-- =============================================================================
-- Stock / Trebovanje: on-hand levels + append-only movement log
-- =============================================================================

create table if not exists public.stock_levels (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  qty numeric(14, 4) not null default 0,
  min_qty numeric(14, 4) not null default 0,
  used_today numeric(14, 4) not null default 0,
  used_on date not null default ((timezone('Europe/Belgrade', now()))::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_levels_min_qty_nonnegative check (min_qty >= 0),
  constraint stock_levels_used_today_nonnegative check (used_today >= 0),
  constraint stock_levels_venue_ingredient_unique unique (venue_id, ingredient_id)
);

create index if not exists stock_levels_venue_id_idx
  on public.stock_levels (venue_id);

create index if not exists stock_levels_ingredient_id_idx
  on public.stock_levels (ingredient_id);

create or replace trigger stock_levels_set_updated_at
  before update on public.stock_levels
  for each row
  execute function public.set_updated_at();

alter table public.stock_levels enable row level security;

revoke all on table public.stock_levels from anon, authenticated;
grant select, insert, update, delete on table public.stock_levels to authenticated;

drop policy if exists "Owners can select venue stock levels" on public.stock_levels;
create policy "Owners can select venue stock levels"
  on public.stock_levels
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

drop policy if exists "Owners can insert venue stock levels" on public.stock_levels;
create policy "Owners can insert venue stock levels"
  on public.stock_levels
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

drop policy if exists "Owners can update venue stock levels" on public.stock_levels;
create policy "Owners can update venue stock levels"
  on public.stock_levels
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

drop policy if exists "Owners can delete venue stock levels" on public.stock_levels;
create policy "Owners can delete venue stock levels"
  on public.stock_levels
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- stock_moves (append-only log; undo flags rows instead of deleting)
-- ---------------------------------------------------------------------------

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  type text not null
    constraint stock_moves_type_check check (
      type in ('dopuna', 'prodaja', 'otpis', 'korekcija')
    ),
  qty_delta numeric(14, 4) not null,
  unit_cost numeric(14, 4),
  reason text,
  note text,
  sale_id uuid,
  user_id uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  created_at timestamptz not null default now(),
  constraint stock_moves_unit_cost_nonnegative check (
    unit_cost is null or unit_cost >= 0
  )
);

create index if not exists stock_moves_venue_id_idx
  on public.stock_moves (venue_id);

create index if not exists stock_moves_ingredient_id_idx
  on public.stock_moves (ingredient_id);

create index if not exists stock_moves_sale_id_idx
  on public.stock_moves (sale_id)
  where sale_id is not null;

create index if not exists stock_moves_created_at_idx
  on public.stock_moves (venue_id, created_at desc);

alter table public.stock_moves enable row level security;

revoke all on table public.stock_moves from anon, authenticated;
grant select, insert, update on table public.stock_moves to authenticated;

drop policy if exists "Owners can select venue stock moves" on public.stock_moves;
create policy "Owners can select venue stock moves"
  on public.stock_moves
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

drop policy if exists "Owners can insert venue stock moves" on public.stock_moves;
create policy "Owners can insert venue stock moves"
  on public.stock_moves
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

drop policy if exists "Owners can update venue stock moves" on public.stock_moves;
create policy "Owners can update venue stock moves"
  on public.stock_moves
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- Free plan: max 10 stock_levels rows per venue (Starter+ enforced client-side)
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
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  select p.plan
  into v_plan
  from public.profiles p
  where p.id = v_owner_id;

  -- Only hard-cap free; paid / starter+ skip here
  if coalesce(v_plan, 'free') not in ('free') then
    return new;
  end if;

  select count(*)::integer
  into v_count
  from public.stock_levels s
  where s.venue_id = new.venue_id;

  if v_count >= 10 then
    raise exception 'FREE_LIMIT_STOCK_ITEMS: maximum 10 stock items per venue';
  end if;

  return new;
end;
$$;

drop trigger if exists stock_levels_enforce_free_limit on public.stock_levels;

create trigger stock_levels_enforce_free_limit
  before insert on public.stock_levels
  for each row
  execute function public.enforce_stock_item_limit();


-- 20260327120000_free_recipe_limit_1.sql
-- Free plan: recipes cap 5 → 1 (align with app entitlements)

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
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  select p.plan
  into v_plan
  from public.profiles p
  where p.id = v_owner_id;

  -- paid plans: anything other than free bypasses caps
  if coalesce(v_plan, 'free') not in ('free') then
    return new;
  end if;

  if tg_table_name = 'ingredients' then
    select count(*)::integer
    into v_count
    from public.ingredients i
    where i.venue_id = new.venue_id;

    if v_count >= 20 then
      raise exception 'FREE_LIMIT_INGREDIENTS: maximum 20 ingredients per venue';
    end if;
  elsif tg_table_name = 'recipes' then
    select count(*)::integer
    into v_count
    from public.recipes r
    where r.venue_id = new.venue_id;

    if v_count >= 1 then
      raise exception 'FREE_LIMIT_RECIPES: maximum 1 recipe per venue';
    end if;
  elsif tg_table_name = 'checklist_templates' then
    select count(*)::integer
    into v_count
    from public.checklist_templates t
    where t.venue_id = new.venue_id;

    if v_count >= 1 then
      raise exception 'FREE_LIMIT_TEMPLATES: maximum 1 checklist template per venue';
    end if;
  end if;

  return new;
end;
$$;


-- 20260328120000_free_recipe_limit_5.sql
-- Free plan: recipes cap 1 → 5 (align with app entitlements)

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
begin
  select v.owner_id
  into v_owner_id
  from public.venues v
  where v.id = new.venue_id;

  if v_owner_id is null then
    raise exception 'Venue not found';
  end if;

  select p.plan
  into v_plan
  from public.profiles p
  where p.id = v_owner_id;

  -- paid plans: anything other than free bypasses caps
  if coalesce(v_plan, 'free') not in ('free') then
    return new;
  end if;

  if tg_table_name = 'ingredients' then
    select count(*)::integer
    into v_count
    from public.ingredients i
    where i.venue_id = new.venue_id;

    if v_count >= 20 then
      raise exception 'FREE_LIMIT_INGREDIENTS: maximum 20 ingredients per venue';
    end if;
  elsif tg_table_name = 'recipes' then
    select count(*)::integer
    into v_count
    from public.recipes r
    where r.venue_id = new.venue_id;

    if v_count >= 5 then
      raise exception 'FREE_LIMIT_RECIPES: maximum 5 recipes per venue';
    end if;
  elsif tg_table_name = 'checklist_templates' then
    select count(*)::integer
    into v_count
    from public.checklist_templates t
    where t.venue_id = new.venue_id;

    if v_count >= 1 then
      raise exception 'FREE_LIMIT_TEMPLATES: maximum 1 checklist template per venue';
    end if;
  end if;

  return new;
end;
$$;


-- 20260329120000_stock_realtime.sql
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stock_levels'
  ) then
    alter publication supabase_realtime add table public.stock_levels;
  end if;
end;
$$;


-- 20261120120000_schedule.sql
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free','starter','pro','premium','team','business'));

create table if not exists public.schedule_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists schedule_default_location_idx on public.schedule_locations (owner_id) where is_default;
create index if not exists schedule_locations_owner_idx on public.schedule_locations (owner_id, created_at);

create table if not exists public.schedule_employees (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.schedule_locations (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  role text not null check (length(trim(role)) between 1 and 100),
  hourly_rate_rsd numeric(10,2) check (hourly_rate_rsd >= 0 and hourly_rate_rsd <= 99999999),
  login_email text check (length(login_email) <= 254 and login_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  user_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (location_id, id),
  unique (location_id, login_email),
  unique (location_id, user_id)
);

create index if not exists schedule_employees_user_idx on public.schedule_employees (user_id) where active;

create table if not exists public.schedule_assignments (
  location_id uuid not null,
  employee_id uuid not null,
  date date not null check (isfinite(date)),
  code text not null check (code in ('J','P','N','D','X','O','B','G')),
  custom_start time,
  custom_end time,
  primary key (location_id, date, employee_id),
  foreign key (location_id, employee_id) references public.schedule_employees (location_id, id) on delete cascade,
  check (case when code = 'X' then
    custom_start is not null and custom_end is not null
    and custom_start < time '24:00' and custom_end < time '24:00'
    and extract(epoch from custom_start) % 1800 = 0 and extract(epoch from custom_end) % 1800 = 0
    else custom_start is null and custom_end is null end)
);

create table if not exists public.schedule_publications (
  location_id uuid not null references public.schedule_locations (id) on delete cascade,
  monday date not null check (extract(isodow from monday) = 1),
  assignments jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references public.profiles (id) on delete cascade,
  primary key (location_id, monday)
);

create table if not exists public.schedule_requests (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  employee_id uuid not null,
  date date not null check (isfinite(date)),
  type text not null check (type in ('slobodan','zamena','promena')),
  with_employee_id uuid check (with_employee_id <> employee_id),
  to_template_code text check (to_template_code in ('J','P','N','D')),
  source jsonb not null,
  replacement jsonb,
  note text check (length(note) <= 500),
  status text not null default 'novo' check (status in ('novo','odobreno','odbijeno')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  foreign key (location_id, employee_id) references public.schedule_employees (location_id, id) on delete cascade,
  foreign key (location_id, with_employee_id) references public.schedule_employees (location_id, id) on delete cascade,
  check ((type = 'zamena') = (with_employee_id is not null)),
  check ((type = 'promena') = (to_template_code is not null))
);

create index if not exists schedule_requests_week_idx on public.schedule_requests (location_id, date, created_at desc);
create unique index if not exists schedule_pending_requests_idx on public.schedule_requests (location_id, date, employee_id) where status = 'novo';

create table if not exists public.schedule_notifications (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  employee_id uuid not null,
  monday date not null,
  kind text not null check (kind in ('published','odobreno','odbijeno')),
  created_at timestamptz not null default now(),
  foreign key (location_id, employee_id) references public.schedule_employees (location_id, id) on delete cascade
);

create index if not exists schedule_notifications_member_idx on public.schedule_notifications (location_id, employee_id, created_at desc);

create table if not exists public.schedule_share_links (
  token uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.schedule_locations (id) on delete cascade,
  monday date not null check (extract(isodow from monday) = 1),
  preview jsonb not null,
  created_at timestamptz not null default now(),
  unique (location_id, monday)
);

create table if not exists public.schedule_copy_undos (
  token uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.schedule_locations (id) on delete cascade,
  monday date not null,
  previous jsonb not null,
  copied jsonb not null,
  expires_at timestamptz not null default now() + interval '10 minutes',
  unique (location_id, monday)
);

alter table public.schedule_locations enable row level security;
alter table public.schedule_employees enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.schedule_publications enable row level security;
alter table public.schedule_requests enable row level security;
alter table public.schedule_notifications enable row level security;
alter table public.schedule_share_links enable row level security;
alter table public.schedule_copy_undos enable row level security;

revoke all on public.schedule_locations, public.schedule_employees, public.schedule_assignments,
  public.schedule_publications, public.schedule_requests, public.schedule_notifications,
  public.schedule_share_links, public.schedule_copy_undos from public, anon, authenticated;

create or replace function public.schedule_rank(p_owner uuid) returns integer
language sql stable set search_path = '' as $$
  select coalesce((select case
    when p.plan_expires_at < now() then 0
    when p.plan = 'business' then 4
    when p.plan = 'team' then 3
    when p.plan in ('pro', 'premium') then 2
    when p.plan = 'starter' then 1
    else 0 end from public.profiles p where p.id = p_owner), 0);
$$;

create or replace function public.schedule_scope(p_location uuid, p_initialize boolean)
returns table (location_id uuid, account_id uuid, name text, plan_rank integer, member_id uuid)
language plpgsql set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  viewer_rank integer := public.schedule_rank(viewer);
begin
  if viewer is null then return; end if;

  if p_location is null or viewer_rank < 4 then
    return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
      from public.schedule_locations l
      where l.owner_id = viewer and l.is_default and (
        p_location = l.id or (p_location is null and exists (
          select from public.schedule_employees e where e.location_id = l.id and e.active
        ))
      );
  else
    return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
      from public.schedule_locations l where l.id = p_location and l.owner_id = viewer;
  end if;
  if found then return; end if;

  return query select l.id, l.owner_id, l.name, public.schedule_rank(l.owner_id), e.id
    from public.schedule_employees e
    join public.schedule_locations l on l.id = e.location_id
    where e.user_id = viewer and e.active and l.owner_id <> viewer
      and (p_location is null or l.id = p_location)
      and public.schedule_rank(l.owner_id) >= case when l.is_default then 3 else 4 end
    order by e.created_at, e.id limit 1;
  if found then return; end if;

  if p_location is not null then
    if viewer_rank < 4 and exists (
      select from public.schedule_locations l where l.id = p_location and l.owner_id = viewer
    ) then
      return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
        from public.schedule_locations l where l.owner_id = viewer and l.is_default;
    end if;
    return;
  end if;

  if p_initialize then
    insert into public.schedule_locations (owner_id, name, is_default)
    values (viewer, coalesce((select left(trim(v.name),120) from public.venues v where v.owner_id = viewer
      order by v.created_at, v.id limit 1), 'Lokal'), true)
    on conflict (owner_id) where is_default do nothing;
  end if;
  return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
    from public.schedule_locations l where l.owner_id = viewer and l.is_default;
end;
$$;

create or replace function public.schedule_shifts(p_location uuid, p_from date, p_until date, p_employees uuid[])
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(a) - 'location_id' order by a.date, a.employee_id), '[]'::jsonb)
  from public.schedule_assignments a
  where a.location_id = p_location and a.date >= p_from and a.date < p_until
    and (p_employees is null or a.employee_id = any(p_employees));
$$;

create or replace function public.schedule_staff(p_location uuid, p_limit integer default null)
returns setof public.schedule_employees language sql stable set search_path = '' as $$
  select e.* from public.schedule_employees e
  where e.location_id = p_location and e.active order by e.created_at, e.id limit p_limit;
$$;

create or replace function public.schedule_preview(p_location uuid, p_week date)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('venueName',l.name,'monday',p_week,
    'employees',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'full_name',
      case when cardinality(parts.names) > 1 then parts.names[1] || ' ' || left(parts.names[cardinality(parts.names)],1) || '.'
      else parts.names[1] end) order by e.created_at,e.id),'[]'::jsonb)
      from public.schedule_staff(l.id) e
      cross join lateral (select regexp_split_to_array(trim(e.full_name),'\s+') as names) parts),
    'assignments',public.schedule_shifts(l.id,p_week,p_week+7,array(select e.id from public.schedule_staff(l.id) e)))
  from public.schedule_locations l where l.id=p_location;
$$;

create or replace function public.schedule_load(p_location uuid default null, p_week date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  scope record;
  today date := timezone('Europe/Belgrade', now())::date;
  selected_monday date;
  staff_ids uuid[];
  publication jsonb;
  published_assignments jsonb;
begin
  select * into scope from public.schedule_scope(p_location, true);
  if not found then return null; end if;
  selected_monday := date_trunc('week', case when scope.plan_rank = 0 or p_week is null or not isfinite(p_week)
    then today else p_week end)::date;

  if scope.member_id is not null then
    staff_ids := array[scope.member_id];
  else
    staff_ids := array(select e.id from public.schedule_staff(scope.location_id,
      case when scope.plan_rank = 0 then 3 end) e);
  end if;

  select jsonb_build_object('publishedAt', p.published_at, 'publisherName', profile.full_name), p.assignments
    into publication, published_assignments
    from public.schedule_publications p join public.profiles profile on profile.id = p.published_by
    where p.location_id = scope.location_id and p.monday = selected_monday;

  return jsonb_build_object(
    'mode', case when scope.member_id is null then 'owner' else 'employee' end,
    'plan', (array['free','starter','pro','team','business'])[scope.plan_rank + 1],
    'venue', jsonb_build_object('id',scope.location_id,'name',scope.name),
    'today', today, 'monday', selected_monday, 'publication', publication,
    'locations', case when scope.member_id is null and scope.plan_rank = 4 then
      (select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'employeeCount',
        (select count(*) from public.schedule_staff(l.id))) order by l.is_default desc,l.created_at,l.id)
        from public.schedule_locations l where l.owner_id=scope.account_id) else '[]'::jsonb end,
    'employees', (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'full_name',e.full_name,'role',e.role,
      'hourly_rate_rsd',case when scope.member_id is null and scope.plan_rank >= 2 then e.hourly_rate_rsd end,
      'login_email',case when scope.member_id is null and scope.plan_rank >= 3 then e.login_email end)
      order by e.created_at,e.id), '[]'::jsonb) from public.schedule_employees e where e.id=any(staff_ids)),
    'assignments', case when scope.member_id is null then
      public.schedule_shifts(scope.location_id,selected_monday,selected_monday+7,staff_ids) else (
        select coalesce(jsonb_agg(a order by a->>'date'),'[]'::jsonb) from jsonb_array_elements(published_assignments) a
        where (a->>'employee_id')::uuid = scope.member_id
      ) end,
    'publishedAssignments', case when scope.member_id is null and scope.plan_rank >= 3 then
      coalesce(published_assignments,'[]'::jsonb) end,
    'requests', case when scope.plan_rank >= 3 then (select coalesce(jsonb_agg(
      (to_jsonb(r) - 'location_id' - 'replacement' - 'decided_by') || jsonb_build_object(
        'employee_name',e.full_name,'with_employee_name',w.full_name) order by r.created_at desc),'[]'::jsonb)
      from public.schedule_requests r join public.schedule_employees e on e.id=r.employee_id
      left join public.schedule_employees w on w.id=r.with_employee_id
      where r.location_id=scope.location_id and r.date >= selected_monday and r.date < selected_monday+7
        and r.employee_id=any(staff_ids)) else '[]'::jsonb end,
    'coworkers', case when scope.member_id is not null and publication is not null then
      (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'full_name',e.full_name) order by e.full_name),'[]'::jsonb)
        from public.schedule_staff(scope.location_id) e where e.id <> scope.member_id) else '[]'::jsonb end,
    'notifications', case when scope.member_id is not null then
      (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb) from (
        select id,kind,monday,created_at from public.schedule_notifications inbox
        where inbox.location_id=scope.location_id and inbox.employee_id=scope.member_id
        order by inbox.created_at desc,inbox.id limit 10
      ) n)
      else '[]'::jsonb end
  );
end;
$$;

create or replace function public.schedule_put(p_location uuid, p_employee uuid, p_date date, p_data jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  if p_data->>'code' is null then
    delete from public.schedule_assignments a
      where a.location_id=p_location and a.employee_id=p_employee and a.date=p_date;
  else
    insert into public.schedule_assignments (location_id,employee_id,date,code,custom_start,custom_end)
    values (p_location,p_employee,p_date,p_data->>'code',(p_data->>'custom_start')::time,(p_data->>'custom_end')::time)
    on conflict (location_id,date,employee_id) do update set code=excluded.code,
      custom_start=excluded.custom_start, custom_end=excluded.custom_end;
  end if;
end;
$$;

create or replace function public.schedule_command(p_action text, p_location uuid, p_week date, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  scope record;
  today date := timezone('Europe/Belgrade',now())::date;
  selected_monday date := date_trunc('week',p_week)::date;
  employee uuid;
  other_employee uuid;
  linked_email text;
  linked_user uuid;
  day date;
  result_id uuid;
  before_shifts jsonb;
  after_shifts jsonb;
  source_shift jsonb;
  other_shift jsonb;
  published_assignments jsonb;
  shared_preview jsonb;
  pending public.schedule_requests%rowtype;
  undo public.schedule_copy_undos%rowtype;
  decision text;
  notified integer := 0;
begin
  select * into scope from public.schedule_scope(p_location, false);
  if not found or scope.location_id is distinct from p_location or p_week is null or not isfinite(p_week)
    or (scope.plan_rank=0 and selected_monday <> date_trunc('week',today)::date)
    or (scope.member_id is not null and p_action <> 'request')
  then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;

  -- Serialize mutations per location for the Free limit, swaps, and copy/undo.
  perform 1 from public.schedule_locations l where l.id=scope.location_id for update;

  case p_action
  when 'location' then
    if scope.plan_rank < 4 then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    insert into public.schedule_locations (owner_id,name) values (scope.account_id,trim(p_payload->>'name')) returning id into result_id;

  when 'employee' then
    employee := (p_payload->>'id')::uuid;
    linked_email := case when scope.plan_rank >= 3 then nullif(lower(trim(p_payload->>'login_email')),'') end;
    if linked_email is not null then
      select e.user_id into linked_user from public.schedule_employees e
        where e.location_id=p_location and e.id=employee and e.login_email=linked_email;
      if linked_user is null then
        select u.id into linked_user from auth.users u
          where lower(u.email)=linked_email and u.email_confirmed_at is not null;
        if not found then raise exception 'SCHEDULE_LOGIN_MISSING'; end if;
      end if;
    end if;
    if employee is null then
      if scope.plan_rank = 0 and (select count(*) from public.schedule_staff(p_location,3)) = 3
        then raise exception 'SCHEDULE_EMPLOYEE_LIMIT'; end if;
      insert into public.schedule_employees (location_id,full_name,role,hourly_rate_rsd,login_email,user_id)
      values (p_location,trim(p_payload->>'full_name'),trim(p_payload->>'role'),
        case when scope.plan_rank >= 2 then (p_payload->>'hourly_rate_rsd')::numeric end,linked_email,linked_user) returning id into result_id;
    else
      if not exists (select from public.schedule_staff(p_location,case when scope.plan_rank=0 then 3 end) e where e.id=employee)
        then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
      update public.schedule_employees e set full_name=trim(p_payload->>'full_name'), role=trim(p_payload->>'role'),
        hourly_rate_rsd=case when scope.plan_rank >=2 then (p_payload->>'hourly_rate_rsd')::numeric else e.hourly_rate_rsd end,
        login_email=case when scope.plan_rank >=3 then linked_email else e.login_email end,
        user_id=case when scope.plan_rank >=3 then linked_user else e.user_id end
      where e.location_id=p_location and e.id=employee returning e.id into result_id;
    end if;

  when 'assignment' then
    employee := (p_payload->>'employee_id')::uuid;
    day := (p_payload->>'date')::date;
    if day is null or day < selected_monday or day >= selected_monday+7 or not exists (
      select from public.schedule_staff(p_location,case when scope.plan_rank=0 then 3 end) e where e.id=employee
    ) then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    perform public.schedule_put(p_location,employee,day,p_payload);

  when 'publish' then
    insert into public.schedule_publications (location_id,monday,published_by,assignments)
    values (p_location,selected_monday,auth.uid(),public.schedule_shifts(p_location,selected_monday,selected_monday+7,null))
    on conflict on constraint schedule_publications_pkey do update
      set published_at=now(), published_by=excluded.published_by, assignments=excluded.assignments;
    if scope.plan_rank >= 3 then
      insert into public.schedule_notifications (location_id,employee_id,monday,kind)
      select p_location,e.id,selected_monday,'published' from public.schedule_staff(p_location) e
      where e.user_id <> auth.uid();
      get diagnostics notified = row_count;
    end if;
    return jsonb_build_object('notified',notified);

  when 'copy' then
    if scope.plan_rank < 1 then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    before_shifts := public.schedule_shifts(p_location,selected_monday,selected_monday+7,null);
    delete from public.schedule_assignments a where a.location_id=p_location and a.date >= selected_monday and a.date < selected_monday+7;
    insert into public.schedule_assignments (location_id,employee_id,date,code,custom_start,custom_end)
    select p_location,a.employee_id,a.date+7,a.code,a.custom_start,a.custom_end from public.schedule_assignments a
      join public.schedule_employees e on e.location_id=a.location_id and e.id=a.employee_id and e.active
      where a.location_id=p_location and a.date >= selected_monday-7 and a.date < selected_monday;
    after_shifts := public.schedule_shifts(p_location,selected_monday,selected_monday+7,null);
    insert into public.schedule_copy_undos (location_id,monday,previous,copied)
      values (p_location,selected_monday,before_shifts,after_shifts)
      on conflict on constraint schedule_copy_undos_location_id_monday_key do update
      set token=gen_random_uuid(), previous=excluded.previous, copied=excluded.copied, expires_at=excluded.expires_at
      returning token into result_id;
    return jsonb_build_object('token',result_id);

  when 'undo' then
    if scope.plan_rank < 1 then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    select u.* into undo from public.schedule_copy_undos u
      where u.token=(p_payload->>'token')::uuid and u.location_id=p_location and u.monday=selected_monday and u.expires_at>=now();
    if not found or public.schedule_shifts(p_location,selected_monday,selected_monday+7,null) <> undo.copied
      then raise exception 'SCHEDULE_STALE'; end if;
    delete from public.schedule_assignments a where a.location_id=p_location and a.date >= selected_monday and a.date < selected_monday+7;
    insert into public.schedule_assignments (location_id,employee_id,date,code,custom_start,custom_end)
    select p_location,a.employee_id,a.date,a.code,a.custom_start,a.custom_end
    from jsonb_to_recordset(undo.previous) as a(employee_id uuid,date date,code text,custom_start time,custom_end time);
    delete from public.schedule_copy_undos u where u.token=undo.token;

  when 'share' then
    if scope.plan_rank < 1 then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    shared_preview := public.schedule_preview(p_location,selected_monday);
    insert into public.schedule_share_links (location_id,monday,preview) values (p_location,selected_monday,shared_preview)
      on conflict on constraint schedule_share_links_location_id_monday_key do update set preview=excluded.preview
      returning token into result_id;
    return jsonb_build_object('token',result_id,'preview',shared_preview);

  when 'request' then
    day := (p_payload->>'date')::date;
    other_employee := (p_payload->>'with_employee_id')::uuid;
    select p.assignments into published_assignments from public.schedule_publications p
      where p.location_id=p_location and p.monday=selected_monday;
    if scope.member_id is null or day is null or day < greatest(today,selected_monday) or day >= selected_monday+7
      or p_payload->>'type' not in ('slobodan','zamena','promena')
      or published_assignments is null
      then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    select a into source_shift from jsonb_array_elements(published_assignments) a
      where (a->>'employee_id')::uuid=scope.member_id and (a->>'date')::date=day and a->>'code' in ('J','P','N','D','X');
    if not found then raise exception 'SCHEDULE_STALE'; end if;
    if other_employee is not null then
      if not exists (select from public.schedule_staff(p_location) e where e.id=other_employee and e.id<>scope.member_id)
        then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
      select a into other_shift from jsonb_array_elements(published_assignments) a
        where (a->>'employee_id')::uuid=other_employee and (a->>'date')::date=day;
    end if;
    insert into public.schedule_requests (location_id,employee_id,date,type,with_employee_id,to_template_code,note,source,replacement)
    values (p_location,scope.member_id,day,p_payload->>'type',other_employee,p_payload->>'to_template_code',
      nullif(trim(p_payload->>'note'),''),source_shift,other_shift) returning id into result_id;

  when 'decide' then
    decision := p_payload->>'status';
    if scope.plan_rank < 3 or decision is null or decision not in ('odobreno','odbijeno')
      then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    select r.* into pending from public.schedule_requests r
      where r.id=(p_payload->>'id')::uuid and r.location_id=p_location and r.status='novo'
        and r.date >= selected_monday and r.date < selected_monday+7;
    if not found then raise exception 'SCHEDULE_STALE'; end if;
    if decision='odobreno' then
      select to_jsonb(a)-'location_id' into source_shift from public.schedule_assignments a
        where a.location_id=p_location and a.date=pending.date and a.employee_id=pending.employee_id;
      if source_shift is distinct from pending.source then raise exception 'SCHEDULE_STALE'; end if;
      case pending.type
      when 'slobodan' then perform public.schedule_put(p_location,pending.employee_id,pending.date,'{"code":"O"}');
      when 'promena' then perform public.schedule_put(p_location,pending.employee_id,pending.date,
        jsonb_build_object('code',pending.to_template_code));
      when 'zamena' then
        select to_jsonb(a)-'location_id' into other_shift from public.schedule_assignments a
          where a.location_id=p_location and a.date=pending.date and a.employee_id=pending.with_employee_id;
        if other_shift is distinct from pending.replacement then raise exception 'SCHEDULE_STALE'; end if;
        perform public.schedule_put(p_location,pending.employee_id,pending.date,coalesce(other_shift,'{"code":"O"}'));
        perform public.schedule_put(p_location,pending.with_employee_id,pending.date,source_shift);
      end case;
      -- Apply the approved cells to the published week without exposing unrelated drafts.
      update public.schedule_publications p set assignments = (
        select coalesce(jsonb_agg(a),'[]'::jsonb) from jsonb_array_elements(p.assignments) a
        where (a->>'date')::date <> pending.date or (a->>'employee_id')::uuid <> all(
          array_remove(array[pending.employee_id,pending.with_employee_id],null)
        )
      ) || public.schedule_shifts(p_location,pending.date,pending.date+1,
        array_remove(array[pending.employee_id,pending.with_employee_id],null))
      where p.location_id=p_location and p.monday=selected_monday;
    end if;
    update public.schedule_requests r set status=decision,decided_at=now(),decided_by=auth.uid() where r.id=pending.id;
    insert into public.schedule_notifications (location_id,employee_id,monday,kind)
    values (p_location,pending.employee_id,selected_monday,decision);

  else raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501';
  end case;
  return jsonb_build_object('id',result_id);
end;
$$;

create or replace function public.schedule_report(p_location uuid,p_month date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  scope record;
  month_start date := date_trunc('month',p_month)::date;
  next_month date := (month_start + interval '1 month')::date;
begin
  select l.id, l.owner_id into scope from public.schedule_locations l
    where l.id=p_location and l.owner_id=auth.uid() and public.schedule_rank(l.owner_id)=4;
  if not found or p_month is null or not isfinite(p_month) then
    raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501';
  end if;
  return jsonb_build_object('employees',(select coalesce(jsonb_agg(
    jsonb_build_object('id',e.id,'full_name',e.full_name,'role',e.role,'hourly_rate_rsd',e.hourly_rate_rsd)
      order by e.created_at,e.id),'[]'::jsonb) from public.schedule_employees e
    where e.location_id=p_location and (e.active or exists (
      select from public.schedule_assignments a where a.location_id=p_location and a.employee_id=e.id
        and a.date >= month_start and a.date < next_month
    ))),'assignments',public.schedule_shifts(p_location,month_start,next_month,null));
end;
$$;

create or replace function public.schedule_public(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select s.preview
  from public.schedule_share_links s join public.schedule_locations l on l.id=s.location_id
  where s.token=p_token and public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;
$$;

revoke all on function public.schedule_rank(uuid),public.schedule_scope(uuid,boolean),
  public.schedule_shifts(uuid,date,date,uuid[]),public.schedule_staff(uuid,integer),
  public.schedule_preview(uuid,date),public.schedule_put(uuid,uuid,date,jsonb),public.schedule_load(uuid,date),
  public.schedule_command(text,uuid,date,jsonb),public.schedule_report(uuid,date),public.schedule_public(uuid)
  from public, anon, authenticated;

grant execute on function public.schedule_load(uuid,date),public.schedule_command(text,uuid,date,jsonb),
  public.schedule_report(uuid,date) to authenticated;
grant execute on function public.schedule_public(uuid) to anon, authenticated;


-- 20261120120100_schedule_starter.sql
create or replace function public.schedule_scope(p_location uuid, p_initialize boolean)
returns table (location_id uuid, account_id uuid, name text, plan_rank integer, member_id uuid)
language plpgsql set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  viewer_rank integer := public.schedule_rank(viewer);
begin
  if viewer is null then return; end if;

  if viewer_rank >= 1 then
    if p_location is null or viewer_rank < 4 then
      return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
        from public.schedule_locations l
        where l.owner_id = viewer and l.is_default and (
          p_location = l.id or (p_location is null and exists (
            select from public.schedule_employees e where e.location_id = l.id and e.active
          ))
        );
    else
      return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
        from public.schedule_locations l where l.id = p_location and l.owner_id = viewer;
    end if;
    if found then return; end if;
  end if;

  -- Employee access uses the plan of the location they belong to.
  return query select l.id, l.owner_id, l.name, public.schedule_rank(l.owner_id), e.id
    from public.schedule_employees e
    join public.schedule_locations l on l.id = e.location_id
    where e.user_id = viewer and e.active and l.owner_id <> viewer
      and (p_location is null or l.id = p_location)
      and public.schedule_rank(l.owner_id) >= case when l.is_default then 3 else 4 end
    order by e.created_at, e.id limit 1;
  if found or viewer_rank < 1 then return; end if;

  if p_location is not null then
    if viewer_rank < 4 and exists (
      select from public.schedule_locations l where l.id = p_location and l.owner_id = viewer
    ) then
      return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
        from public.schedule_locations l where l.owner_id = viewer and l.is_default;
    end if;
    return;
  end if;

  if p_initialize then
    insert into public.schedule_locations (owner_id, name, is_default)
    values (viewer, coalesce((select left(trim(v.name),120) from public.venues v where v.owner_id = viewer
      order by v.created_at, v.id limit 1), 'Lokal'), true)
    on conflict (owner_id) where is_default do nothing;
  end if;
  return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
    from public.schedule_locations l where l.owner_id = viewer and l.is_default;
end;
$$;


-- 20261121120000_ensure_row_level_security.sql
-- =============================================================================
-- Ensure Row Level Security on every public table.
-- Idempotent hardening: ENABLE + FORCE RLS, revoke broad grants, (re)create
-- owner/membership policies. Do not edit older migrations — apply this one.
--
-- Public share path for /r/[token] is schedule_public(token) only (safe preview
-- JSON). Base share tables stay locked; never grant anon SELECT on full rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: venue ownership (security definer avoids RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_venue_owner(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venues v
    where v.id = p_venue_id
      and v.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_venue_owner(uuid) from public;
grant execute on function public.is_venue_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

drop policy if exists "Users can select own profile" on public.profiles;
drop policy if exists "Users can update own full_name" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can delete own profile" on public.profiles;

create policy "Users can select own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own full_name"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete for authenticated: signup trigger + service role only.

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------

alter table public.venues enable row level security;
alter table public.venues force row level security;

revoke all on table public.venues from public, anon, authenticated;
grant select, insert, update, delete on table public.venues to authenticated;

drop policy if exists "Owners can select own venues" on public.venues;
drop policy if exists "Owners can insert own venues" on public.venues;
drop policy if exists "Owners can update own venues" on public.venues;
drop policy if exists "Owners can delete own venues" on public.venues;

create policy "Owners can select own venues"
  on public.venues
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can insert own venues"
  on public.venues
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update own venues"
  on public.venues
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can delete own venues"
  on public.venues
  for delete
  to authenticated
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- ingredients
-- ---------------------------------------------------------------------------

alter table public.ingredients enable row level security;
alter table public.ingredients force row level security;

revoke all on table public.ingredients from public, anon, authenticated;
grant select, insert, update, delete on table public.ingredients to authenticated;

drop policy if exists "Owners can select venue ingredients" on public.ingredients;
drop policy if exists "Owners can insert venue ingredients" on public.ingredients;
drop policy if exists "Owners can update venue ingredients" on public.ingredients;
drop policy if exists "Owners can delete venue ingredients" on public.ingredients;

create policy "Owners can select venue ingredients"
  on public.ingredients
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue ingredients"
  on public.ingredients
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue ingredients"
  on public.ingredients
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "Owners can delete venue ingredients"
  on public.ingredients
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- ingredient_price_history
-- ---------------------------------------------------------------------------

alter table public.ingredient_price_history enable row level security;
alter table public.ingredient_price_history force row level security;

revoke all on table public.ingredient_price_history from public, anon, authenticated;
grant select, insert, update, delete on table public.ingredient_price_history
  to authenticated;

drop policy if exists "Owners can select ingredient price history"
  on public.ingredient_price_history;
drop policy if exists "Owners can insert ingredient price history"
  on public.ingredient_price_history;
drop policy if exists "Owners can update ingredient price history"
  on public.ingredient_price_history;
drop policy if exists "Owners can delete ingredient price history"
  on public.ingredient_price_history;

create policy "Owners can select ingredient price history"
  on public.ingredient_price_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

create policy "Owners can insert ingredient price history"
  on public.ingredient_price_history
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

create policy "Owners can update ingredient price history"
  on public.ingredient_price_history
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  )
  with check (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

create policy "Owners can delete ingredient price history"
  on public.ingredient_price_history
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_venue_owner(i.venue_id)
    )
  );

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------

alter table public.recipes enable row level security;
alter table public.recipes force row level security;

revoke all on table public.recipes from public, anon, authenticated;
grant select, insert, update, delete on table public.recipes to authenticated;

drop policy if exists "Owners can select venue recipes" on public.recipes;
drop policy if exists "Owners can insert venue recipes" on public.recipes;
drop policy if exists "Owners can update venue recipes" on public.recipes;
drop policy if exists "Owners can delete venue recipes" on public.recipes;

create policy "Owners can select venue recipes"
  on public.recipes
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue recipes"
  on public.recipes
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue recipes"
  on public.recipes
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "Owners can delete venue recipes"
  on public.recipes
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- recipe_items
-- ---------------------------------------------------------------------------

alter table public.recipe_items enable row level security;
alter table public.recipe_items force row level security;

revoke all on table public.recipe_items from public, anon, authenticated;
grant select, insert, update, delete on table public.recipe_items to authenticated;

drop policy if exists "Owners can select recipe items" on public.recipe_items;
drop policy if exists "Owners can insert recipe items" on public.recipe_items;
drop policy if exists "Owners can update recipe items" on public.recipe_items;
drop policy if exists "Owners can delete recipe items" on public.recipe_items;

create policy "Owners can select recipe items"
  on public.recipe_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

create policy "Owners can insert recipe items"
  on public.recipe_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

create policy "Owners can update recipe items"
  on public.recipe_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

create policy "Owners can delete recipe items"
  on public.recipe_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and public.is_venue_owner(r.venue_id)
    )
  );

-- ---------------------------------------------------------------------------
-- checklist_templates
-- ---------------------------------------------------------------------------

alter table public.checklist_templates enable row level security;
alter table public.checklist_templates force row level security;

revoke all on table public.checklist_templates from public, anon, authenticated;
grant select, insert, update, delete on table public.checklist_templates
  to authenticated;

drop policy if exists "Owners can select venue checklist templates"
  on public.checklist_templates;
drop policy if exists "Owners can insert venue checklist templates"
  on public.checklist_templates;
drop policy if exists "Owners can update venue checklist templates"
  on public.checklist_templates;
drop policy if exists "Owners can delete venue checklist templates"
  on public.checklist_templates;

create policy "Owners can select venue checklist templates"
  on public.checklist_templates
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue checklist templates"
  on public.checklist_templates
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue checklist templates"
  on public.checklist_templates
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "Owners can delete venue checklist templates"
  on public.checklist_templates
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- checklist_runs (own rows + venue ownership)
-- ---------------------------------------------------------------------------

alter table public.checklist_runs enable row level security;
alter table public.checklist_runs force row level security;

revoke all on table public.checklist_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.checklist_runs
  to authenticated;

drop policy if exists "Owners can select own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can insert own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can update own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can delete own checklist runs" on public.checklist_runs;

create policy "Owners can select own checklist runs"
  on public.checklist_runs
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

create policy "Owners can insert own checklist runs"
  on public.checklist_runs
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

create policy "Owners can update own checklist runs"
  on public.checklist_runs
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

create policy "Owners can delete own checklist runs"
  on public.checklist_runs
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_venue_owner(venue_id)
  );

-- ---------------------------------------------------------------------------
-- stock_levels
-- ---------------------------------------------------------------------------

alter table public.stock_levels enable row level security;
alter table public.stock_levels force row level security;

revoke all on table public.stock_levels from public, anon, authenticated;
grant select, insert, update, delete on table public.stock_levels to authenticated;

drop policy if exists "Owners can select venue stock levels" on public.stock_levels;
drop policy if exists "Owners can insert venue stock levels" on public.stock_levels;
drop policy if exists "Owners can update venue stock levels" on public.stock_levels;
drop policy if exists "Owners can delete venue stock levels" on public.stock_levels;

create policy "Owners can select venue stock levels"
  on public.stock_levels
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue stock levels"
  on public.stock_levels
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue stock levels"
  on public.stock_levels
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "Owners can delete venue stock levels"
  on public.stock_levels
  for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- stock_moves (append-only: no delete grant)
-- ---------------------------------------------------------------------------

alter table public.stock_moves enable row level security;
alter table public.stock_moves force row level security;

revoke all on table public.stock_moves from public, anon, authenticated;
grant select, insert, update on table public.stock_moves to authenticated;

drop policy if exists "Owners can select venue stock moves" on public.stock_moves;
drop policy if exists "Owners can insert venue stock moves" on public.stock_moves;
drop policy if exists "Owners can update venue stock moves" on public.stock_moves;
drop policy if exists "Owners can delete venue stock moves" on public.stock_moves;

create policy "Owners can select venue stock moves"
  on public.stock_moves
  for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Owners can insert venue stock moves"
  on public.stock_moves
  for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Owners can update venue stock moves"
  on public.stock_moves
  for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

-- ---------------------------------------------------------------------------
-- stripe_webhook_events (service role / bypassrls only — no client access)
-- ---------------------------------------------------------------------------

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

revoke all on table public.stripe_webhook_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule domain
-- Access is via security-definer RPCs (schedule_load / schedule_command /
-- schedule_report / schedule_public). Tables stay ungranted to anon &
-- authenticated. RLS + FORCE still deny any accidental direct grants.
-- Membership: location owner_id = auth.uid(), or active employee.user_id.
-- ---------------------------------------------------------------------------

alter table public.schedule_locations enable row level security;
alter table public.schedule_employees enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.schedule_publications enable row level security;
alter table public.schedule_requests enable row level security;
alter table public.schedule_notifications enable row level security;
alter table public.schedule_share_links enable row level security;
alter table public.schedule_copy_undos enable row level security;

alter table public.schedule_locations force row level security;
alter table public.schedule_employees force row level security;
alter table public.schedule_assignments force row level security;
alter table public.schedule_publications force row level security;
alter table public.schedule_requests force row level security;
alter table public.schedule_notifications force row level security;
alter table public.schedule_share_links force row level security;
alter table public.schedule_copy_undos force row level security;

revoke all on table public.schedule_locations from public, anon, authenticated;
revoke all on table public.schedule_employees from public, anon, authenticated;
revoke all on table public.schedule_assignments from public, anon, authenticated;
revoke all on table public.schedule_publications from public, anon, authenticated;
revoke all on table public.schedule_requests from public, anon, authenticated;
revoke all on table public.schedule_notifications from public, anon, authenticated;
revoke all on table public.schedule_share_links from public, anon, authenticated;
revoke all on table public.schedule_copy_undos from public, anon, authenticated;

-- Owner / member policies (defense in depth if grants are ever added later)

drop policy if exists "Schedule location owners manage" on public.schedule_locations;
drop policy if exists "Schedule location members select" on public.schedule_locations;

create policy "Schedule location owners manage"
  on public.schedule_locations
  for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Schedule location members select"
  on public.schedule_locations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = id
        and e.user_id = auth.uid()
        and e.active
    )
  );

drop policy if exists "Schedule employees owner all" on public.schedule_employees;
drop policy if exists "Schedule employees self select" on public.schedule_employees;

create policy "Schedule employees owner all"
  on public.schedule_employees
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule employees self select"
  on public.schedule_employees
  for select
  to authenticated
  using (user_id = auth.uid() and active);

drop policy if exists "Schedule assignments owner all" on public.schedule_assignments;
drop policy if exists "Schedule assignments member select" on public.schedule_assignments;

create policy "Schedule assignments owner all"
  on public.schedule_assignments
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule assignments member select"
  on public.schedule_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_assignments.location_id
        and e.id = schedule_assignments.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  );

drop policy if exists "Schedule publications owner all" on public.schedule_publications;
drop policy if exists "Schedule publications member select" on public.schedule_publications;

create policy "Schedule publications owner all"
  on public.schedule_publications
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule publications member select"
  on public.schedule_publications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_publications.location_id
        and e.user_id = auth.uid()
        and e.active
    )
  );

drop policy if exists "Schedule requests owner all" on public.schedule_requests;
drop policy if exists "Schedule requests member select insert" on public.schedule_requests;

create policy "Schedule requests owner all"
  on public.schedule_requests
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule requests member select insert"
  on public.schedule_requests
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_requests.location_id
        and e.id = schedule_requests.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_requests.location_id
        and e.id = schedule_requests.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  );

drop policy if exists "Schedule notifications owner all" on public.schedule_notifications;
drop policy if exists "Schedule notifications member select delete"
  on public.schedule_notifications;

create policy "Schedule notifications owner all"
  on public.schedule_notifications
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule notifications member select delete"
  on public.schedule_notifications
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_notifications.location_id
        and e.id = schedule_notifications.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_employees e
      where e.location_id = schedule_notifications.location_id
        and e.id = schedule_notifications.employee_id
        and e.user_id = auth.uid()
        and e.active
    )
  );

-- Share links + copy undos: owners only at table level. Public read is NOT
-- granted here — use schedule_public(token) / public_schedule_shares view.
drop policy if exists "Schedule share links owner all" on public.schedule_share_links;
drop policy if exists "Schedule copy undos owner all" on public.schedule_copy_undos;

create policy "Schedule share links owner all"
  on public.schedule_share_links
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

create policy "Schedule copy undos owner all"
  on public.schedule_copy_undos
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Public share for /r/[token]: safe columns only (token + preview payload).
-- Never expose location_id or other internals via anon table grants.
-- ---------------------------------------------------------------------------

-- Safe-column projection (token + preview only). Not granted to anon/authenticated.
create or replace view public.public_schedule_shares
with (security_invoker = false)
as
select
  s.token,
  s.monday,
  s.preview
from public.schedule_share_links s
join public.schedule_locations l on l.id = s.location_id
where public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;

revoke all on table public.public_schedule_shares from public, anon, authenticated;

-- /r/[token] entry point: returns preview JSON only for a known token.
-- Does not expose location_id or other share-link internals.
create or replace function public.schedule_public(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.preview
  from public.schedule_share_links s
  join public.schedule_locations l on l.id = s.location_id
  where s.token = p_token
    and public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;
$$;

revoke all on function public.schedule_public(uuid) from public;
grant execute on function public.schedule_public(uuid) to anon, authenticated;

-- Keep authenticated schedule RPCs callable; internal helpers stay revoked.
revoke all on function public.schedule_rank(uuid) from public, anon, authenticated;
revoke all on function public.schedule_scope(uuid, boolean) from public, anon, authenticated;
revoke all on function public.schedule_shifts(uuid, date, date, uuid[])
  from public, anon, authenticated;
revoke all on function public.schedule_staff(uuid, integer) from public, anon, authenticated;
revoke all on function public.schedule_preview(uuid, date) from public, anon, authenticated;
revoke all on function public.schedule_put(uuid, uuid, date, jsonb)
  from public, anon, authenticated;

grant execute on function public.schedule_load(uuid, date) to authenticated;
grant execute on function public.schedule_command(text, uuid, date, jsonb)
  to authenticated;
grant execute on function public.schedule_report(uuid, date) to authenticated;


-- 20261201120000_enforce_plan_limits.sql
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


-- 20261202120000_public_share_revoke_whitelist.sql
-- =============================================================================
-- Public /r/[token] share hardening
-- -----------------------------------------------------------------------------
-- • Token remains gen_random_uuid() (128-bit opaque capability)
-- • Owner can revoke; revoked tokens make schedule_public return null → app 404
-- • schedule_preview stays a strict whitelist (no rates, venue ids, notes, prices)
-- • schedule_share(location, week, revoke) creates/rotates or revokes links
-- =============================================================================

alter table public.schedule_share_links
  add column if not exists revoked_at timestamptz;

comment on column public.schedule_share_links.token is
  'Opaque random UUID (≥128 bits). Never put sequential recipe/location ids in /r/ URLs.';

comment on column public.schedule_share_links.revoked_at is
  'When set, schedule_public ignores the row so the public link 404s.';

-- Whitelisted public preview only (defense in depth; same shape as before).
create or replace function public.schedule_preview(p_location uuid, p_week date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'venueName', l.name,
    'monday', p_week,
    'employees', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'full_name', case
              when cardinality(parts.names) > 1
                then parts.names[1] || ' ' || left(parts.names[cardinality(parts.names)], 1) || '.'
              else parts.names[1]
            end
          )
          order by e.created_at, e.id
        ),
        '[]'::jsonb
      )
      from public.schedule_staff(l.id) e
      cross join lateral (
        select regexp_split_to_array(trim(e.full_name), '\s+') as names
      ) parts
    ),
    -- schedule_shifts already strips location_id from each assignment row
    'assignments', public.schedule_shifts(
      l.id,
      p_week,
      p_week + 7,
      array(select e.id from public.schedule_staff(l.id) e)
    )
  )
  from public.schedule_locations l
  where l.id = p_location;
$$;

revoke all on function public.schedule_preview(uuid, date)
  from public, anon, authenticated;

-- Anonymous /r/[token] entry: preview JSON only, active token only.
create or replace function public.schedule_public(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.preview
  from public.schedule_share_links s
  join public.schedule_locations l on l.id = s.location_id
  where s.token = p_token
    and s.revoked_at is null
    and public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;
$$;

revoke all on function public.schedule_public(uuid) from public;
grant execute on function public.schedule_public(uuid) to anon, authenticated;

-- Owner create / refresh / revoke. Keeps schedule_command share branch working
-- for older clients, and gives the app an explicit revoke path.
create or replace function public.schedule_share(
  p_location uuid,
  p_week date,
  p_revoke boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  scope record;
  selected_monday date := date_trunc('week', p_week)::date;
  shared_preview jsonb;
  result_token uuid;
begin
  select * into scope from public.schedule_scope(p_location, false);
  if not found
    or scope.location_id is distinct from p_location
    or scope.member_id is not null
    or scope.plan_rank < 1
    or p_week is null
    or not isfinite(p_week)
  then
    raise exception 'SCHEDULE_FORBIDDEN' using errcode = '42501';
  end if;

  perform 1 from public.schedule_locations l where l.id = scope.location_id for update;

  if p_revoke then
    update public.schedule_share_links s
      set revoked_at = now()
      where s.location_id = p_location
        and s.monday = selected_monday
        and s.revoked_at is null
    returning s.token into result_token;
    return case
      when result_token is null then '{}'::jsonb
      else jsonb_build_object('token', result_token)
    end;
  end if;

  shared_preview := public.schedule_preview(p_location, selected_monday);

  insert into public.schedule_share_links as s (location_id, monday, preview, token, revoked_at)
  values (p_location, selected_monday, shared_preview, gen_random_uuid(), null)
  on conflict on constraint schedule_share_links_location_id_monday_key do update set
    preview = excluded.preview,
    revoked_at = null,
    token = case
      when s.revoked_at is not null then gen_random_uuid()
      else s.token
    end,
    created_at = case
      when s.revoked_at is not null then now()
      else s.created_at
    end
  returning s.token into result_token;

  return jsonb_build_object('token', result_token, 'preview', shared_preview);
end;
$$;

revoke all on function public.schedule_share(uuid, date, boolean) from public, anon;
grant execute on function public.schedule_share(uuid, date, boolean) to authenticated;

-- Keep the legacy schedule_command 'share' path consistent: clear revoked_at and
-- rotate token after a revoke. Implemented by wrapping via schedule_share when
-- apps call the new RPC; older 'share' inserts still work until revoked_at is set.
-- Patch share branch by replacing only the share insert through a trigger-free
-- helper used from a tiny command shim is unnecessary if the app uses schedule_share.

-- Safe-column view stays locked (token + monday + preview, never location_id).
create or replace view public.public_schedule_shares
with (security_invoker = false)
as
select
  s.token,
  s.monday,
  s.preview
from public.schedule_share_links s
join public.schedule_locations l on l.id = s.location_id
where s.revoked_at is null
  and public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;

revoke all on table public.public_schedule_shares from public, anon, authenticated;

-- 20261203120000_delete_account.sql
-- Allow account deletion to check ingredient references after all cascades finish.
alter table public.recipe_items
  drop constraint recipe_items_ingredient_id_fkey,
  add constraint recipe_items_ingredient_id_fkey
    foreign key (ingredient_id) references public.ingredients (id)
    on delete no action deferrable initially immediate;

create function public.delete_account(p_user_id uuid, p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  signed_in_at timestamptz;
  expires_at timestamptz;
  checked_at timestamptz;
begin
  -- Serialize deletes started from different sessions of the same account.
  perform 1 from auth.users where id = p_user_id for update;
  if not found then
    return false;
  end if;

  select created_at, not_after into signed_in_at, expires_at
    from auth.sessions
    where id = p_session_id and user_id = p_user_id
    for update;

  checked_at := clock_timestamp();
  if signed_in_at is null
    or signed_in_at > checked_at
    or signed_in_at < checked_at - interval '5 minutes'
    or expires_at <= checked_at then
    return false;
  end if;

  -- Sessions, profiles, venues, and owned workspace data cascade from this row.
  set constraints public.recipe_items_ingredient_id_fkey deferred;
  delete from auth.users where id = p_user_id;
  set constraints public.recipe_items_ingredient_id_fkey immediate;
  return true;
end;
$$;

revoke all on function public.delete_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid, uuid) to service_role;

commit;
