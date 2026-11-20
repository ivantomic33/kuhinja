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

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Column-level grants: users may only update full_name
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

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

create trigger venues_set_updated_at
  before update on public.venues
  for each row
  execute function public.set_updated_at();

alter table public.venues enable row level security;

revoke all on table public.venues from anon, authenticated;
grant select, insert, update, delete on table public.venues to authenticated;

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

create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row
  execute function public.set_updated_at();

alter table public.ingredients enable row level security;

revoke all on table public.ingredients from anon, authenticated;
grant select, insert, update, delete on table public.ingredients to authenticated;

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

create trigger ingredients_log_price_change
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

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row
  execute function public.set_updated_at();

alter table public.recipes enable row level security;

revoke all on table public.recipes from anon, authenticated;
grant select, insert, update, delete on table public.recipes to authenticated;

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

create trigger recipe_items_set_updated_at
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

create trigger recipe_items_same_venue
  before insert or update on public.recipe_items
  for each row
  execute function public.enforce_recipe_item_same_venue();

alter table public.recipe_items enable row level security;

revoke all on table public.recipe_items from anon, authenticated;
grant select, insert, update, delete on table public.recipe_items to authenticated;

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

create trigger checklist_templates_set_updated_at
  before update on public.checklist_templates
  for each row
  execute function public.set_updated_at();

alter table public.checklist_templates enable row level security;

revoke all on table public.checklist_templates from anon, authenticated;
grant select, insert, update, delete on table public.checklist_templates
  to authenticated;

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

create trigger ingredients_enforce_free_limit
  before insert on public.ingredients
  for each row
  execute function public.enforce_free_limit();

create trigger recipes_enforce_free_limit
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
