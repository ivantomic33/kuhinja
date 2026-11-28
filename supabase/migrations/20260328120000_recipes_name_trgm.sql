-- =============================================================================
-- Recipe list search/sort indexes for server-side pagination.
-- pg_trgm speeds ILIKE '%term%' on recipes.name; venue composites help sort.
-- Idempotent. Does not change RLS or optimistic locking.
-- =============================================================================

create extension if not exists pg_trgm;

create index if not exists idx_recipes_name_trgm
  on public.recipes
  using gin (name gin_trgm_ops);

create index if not exists idx_recipes_venue_id_name
  on public.recipes (venue_id, name);

create index if not exists idx_recipes_venue_id_portions
  on public.recipes (venue_id, portions);

create index if not exists idx_recipes_venue_id_selling_price
  on public.recipes (venue_id, selling_price);
