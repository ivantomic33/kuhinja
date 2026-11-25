-- =============================================================================
-- Missing foreign-key indexes + common filter composites.
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a migration transaction.
-- =============================================================================

-- stock_moves.user_id FK lacked a supporting index
create index if not exists idx_stock_moves_user_id
  on public.stock_moves (user_id);

-- schedule_employees.location_id is filtered often outside the composite unique
create index if not exists idx_schedule_employees_location_id
  on public.schedule_employees (location_id);

-- schedule_requests employee path (week composite already exists)
create index if not exists idx_schedule_requests_employee_id
  on public.schedule_requests (employee_id);

-- schedule_notifications employee path (member composite already exists)
create index if not exists idx_schedule_notifications_employee_id
  on public.schedule_notifications (employee_id);

-- schedule_share_links location
create index if not exists idx_schedule_share_links_location_id
  on public.schedule_share_links (location_id);

-- schedule_copy_undos location
create index if not exists idx_schedule_copy_undos_location_id
  on public.schedule_copy_undos (location_id);

-- Composite list filters: venue/user + recency
create index if not exists idx_ingredients_venue_id_updated_at
  on public.ingredients (venue_id, updated_at desc);

create index if not exists idx_recipes_venue_id_updated_at
  on public.recipes (venue_id, updated_at desc);

create index if not exists idx_checklist_templates_venue_id_updated_at
  on public.checklist_templates (venue_id, updated_at desc);

create index if not exists idx_checklist_runs_user_id_updated_at
  on public.checklist_runs (user_id, updated_at desc);

create index if not exists idx_stock_levels_venue_id_updated_at
  on public.stock_levels (venue_id, updated_at desc);
