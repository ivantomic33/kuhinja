-- =============================================================================
-- P8 F3: food cost alerts — schema (recipes targets, snapshot, alerts, digest)
-- =============================================================================

-- Target food cost % (default 30) and net selling price (without VAT).
alter table public.recipes
  add column if not exists target_food_cost_pct numeric(5, 2) not null default 30;

alter table public.recipes
  drop constraint if exists recipes_target_food_cost_pct_check;

alter table public.recipes
  add constraint recipes_target_food_cost_pct_check
  check (target_food_cost_pct > 0 and target_food_cost_pct <= 100);

alter table public.recipes
  add column if not exists selling_price_net numeric(12, 2);

alter table public.recipes
  drop constraint if exists recipes_selling_price_net_check;

alter table public.recipes
  add constraint recipes_selling_price_net_check
  check (selling_price_net is null or selling_price_net > 0);

-- Backfill net price from legacy selling_price when positive.
update public.recipes
set selling_price_net = selling_price
where selling_price_net is null
  and selling_price is not null
  and selling_price > 0;

-- ---------------------------------------------------------------------------
-- recipe_cost_snapshot (table preferred over matview — see docs/food-cost-alerts.md)
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_cost_snapshot (
  recipe_id uuid primary key references public.recipes (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  portion_cost numeric(14, 6) not null,
  selling_price_net numeric(12, 2),
  food_cost_pct numeric(10, 4),
  target_food_cost_pct numeric(5, 2) not null default 30,
  computed_at timestamptz not null default now(),
  constraint recipe_cost_snapshot_portion_cost_nonnegative check (portion_cost >= 0),
  constraint recipe_cost_snapshot_food_cost_pct_check
    check (food_cost_pct is null or food_cost_pct >= 0)
);

create unique index if not exists recipe_cost_snapshot_recipe_id_uidx
  on public.recipe_cost_snapshot (recipe_id);

create index if not exists recipe_cost_snapshot_workspace_over_target_idx
  on public.recipe_cost_snapshot (workspace_id, food_cost_pct desc)
  where food_cost_pct is not null;

alter table public.recipe_cost_snapshot enable row level security;

revoke all on table public.recipe_cost_snapshot from anon, authenticated;
grant select on table public.recipe_cost_snapshot to authenticated;

drop policy if exists recipe_cost_snapshot_select_member on public.recipe_cost_snapshot;
create policy recipe_cost_snapshot_select_member
  on public.recipe_cost_snapshot
  for select to authenticated
  using (public.is_member(workspace_id, 'cook'));

-- Writes only via SECURITY DEFINER helpers / service role.
revoke insert, update, delete on table public.recipe_cost_snapshot from authenticated;

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null,
  subject_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint alerts_kind_check check (kind in ('food_cost_over_target')),
  constraint alerts_payload_object check (jsonb_typeof(payload) = 'object')
);

-- One unread alert per kind+subject.
create unique index if not exists alerts_active_kind_subject_uidx
  on public.alerts (kind, subject_id)
  where read_at is null;

create index if not exists alerts_workspace_created_at_idx
  on public.alerts (workspace_id, created_at desc);

create index if not exists alerts_workspace_unread_idx
  on public.alerts (workspace_id)
  where read_at is null;

alter table public.alerts enable row level security;

revoke all on table public.alerts from anon, authenticated;
grant select on table public.alerts to authenticated;
-- read_at updates go through mark_alert_read RPC (no direct update grant).

drop policy if exists alerts_select_member on public.alerts;
create policy alerts_select_member
  on public.alerts
  for select to authenticated
  using (public.is_member(workspace_id, 'cook'));

-- ---------------------------------------------------------------------------
-- digest_runs (idempotent daily digest per workspace)
-- ---------------------------------------------------------------------------
create table if not exists public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  run_date date not null,
  sent_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  constraint digest_runs_workspace_run_date_unique unique (workspace_id, run_date)
);

create index if not exists digest_runs_workspace_id_idx
  on public.digest_runs (workspace_id, run_date desc);

alter table public.digest_runs enable row level security;

revoke all on table public.digest_runs from anon, authenticated;
-- service_role / security definer only

grant select on table public.digest_runs to authenticated;
drop policy if exists digest_runs_select_manager on public.digest_runs;
create policy digest_runs_select_manager
  on public.digest_runs
  for select to authenticated
  using (public.is_member(workspace_id, 'manager'));
