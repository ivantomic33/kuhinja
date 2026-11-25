-- =============================================================================
-- Optimistic locking: version column on ingredients and recipes.
-- Trigger bumps version on every UPDATE; clients filter with version = $n.
-- =============================================================================

alter table public.ingredients
  add column if not exists version integer not null default 1;

alter table public.recipes
  add column if not exists version integer not null default 1;

alter table public.ingredients
  drop constraint if exists ingredients_version_positive;
alter table public.ingredients
  add constraint ingredients_version_positive check (version >= 1);

alter table public.recipes
  drop constraint if exists recipes_version_positive;
alter table public.recipes
  add constraint recipes_version_positive check (version >= 1);

create or replace function public.bump_row_version()
returns trigger
language plpgsql
as $$
begin
  new.version := coalesce(old.version, 1) + 1;
  return new;
end;
$$;

drop trigger if exists ingredients_bump_version on public.ingredients;
create trigger ingredients_bump_version
  before update on public.ingredients
  for each row
  execute function public.bump_row_version();

drop trigger if exists recipes_bump_version on public.recipes;
create trigger recipes_bump_version
  before update on public.recipes
  for each row
  execute function public.bump_row_version();
