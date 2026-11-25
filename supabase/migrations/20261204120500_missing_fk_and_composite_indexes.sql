-- =============================================================================
-- Missing foreign-key supporting indexes + remaining list composites.
--
-- Naming: idx_<table>_<column> (or idx_<table>_<col1>_<col2> for composites).
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a migration transaction.
-- For very large production tables, prefer a maintenance window or a manual
-- CONCURRENTLY operation outside migrations, then record the index here as
-- CREATE INDEX IF NOT EXISTS for fresh environments.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- schedule_publications.published_by → profiles(id)
-- ---------------------------------------------------------------------------
create index if not exists idx_schedule_publications_published_by
  on public.schedule_publications (published_by);

-- ---------------------------------------------------------------------------
-- schedule_requests.decided_by → profiles(id)
-- ---------------------------------------------------------------------------
create index if not exists idx_schedule_requests_decided_by
  on public.schedule_requests (decided_by)
  where decided_by is not null;

-- ---------------------------------------------------------------------------
-- schedule_requests composite FK (location_id, employee_id)
-- Partial unique on pending rows is not enough for cascade/lookup on all rows.
-- ---------------------------------------------------------------------------
create index if not exists idx_schedule_requests_location_id_employee_id
  on public.schedule_requests (location_id, employee_id);

-- ---------------------------------------------------------------------------
-- schedule_requests composite FK (location_id, with_employee_id)
-- ---------------------------------------------------------------------------
create index if not exists idx_schedule_requests_location_id_with_employee_id
  on public.schedule_requests (location_id, with_employee_id)
  where with_employee_id is not null;

-- ---------------------------------------------------------------------------
-- schedule_assignments composite FK (location_id, employee_id)
-- PK is (location_id, date, employee_id) — date sits between the FK columns.
-- ---------------------------------------------------------------------------
create index if not exists idx_schedule_assignments_location_id_employee_id
  on public.schedule_assignments (location_id, employee_id);

-- ---------------------------------------------------------------------------
-- schedule_employees.user_id → auth.users(id)
-- Existing partial index is WHERE active only; FK cascades need all rows.
-- ---------------------------------------------------------------------------
create index if not exists idx_schedule_employees_user_id
  on public.schedule_employees (user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- Composite list filters (owner/venue scope + recency)
-- ---------------------------------------------------------------------------
create index if not exists idx_checklist_runs_venue_id_updated_at
  on public.checklist_runs (venue_id, updated_at desc);

create index if not exists idx_venues_owner_id_updated_at
  on public.venues (owner_id, updated_at desc);

create index if not exists idx_stock_moves_venue_id_ingredient_id_created_at
  on public.stock_moves (venue_id, ingredient_id, created_at desc);

create index if not exists idx_schedule_publications_location_id_published_at
  on public.schedule_publications (location_id, published_at desc);
