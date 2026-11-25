-- =============================================================================
-- Idempotent RLS verification for every public application table.
-- Older migrations already enable RLS; this pass re-asserts ENABLE + FORCE and
-- keeps owner/membership policies in place without rewriting history.
-- =============================================================================

-- Core kitchen domain
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.venues enable row level security;
alter table public.venues force row level security;

alter table public.ingredients enable row level security;
alter table public.ingredients force row level security;

alter table public.ingredient_price_history enable row level security;
alter table public.ingredient_price_history force row level security;

alter table public.recipes enable row level security;
alter table public.recipes force row level security;

alter table public.recipe_items enable row level security;
alter table public.recipe_items force row level security;

alter table public.checklist_templates enable row level security;
alter table public.checklist_templates force row level security;

alter table public.checklist_runs enable row level security;
alter table public.checklist_runs force row level security;

alter table public.stock_levels enable row level security;
alter table public.stock_levels force row level security;

alter table public.stock_moves enable row level security;
alter table public.stock_moves force row level security;

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

-- Schedule domain
alter table public.schedule_locations enable row level security;
alter table public.schedule_locations force row level security;

alter table public.schedule_employees enable row level security;
alter table public.schedule_employees force row level security;

alter table public.schedule_assignments enable row level security;
alter table public.schedule_assignments force row level security;

alter table public.schedule_publications enable row level security;
alter table public.schedule_publications force row level security;

alter table public.schedule_requests enable row level security;
alter table public.schedule_requests force row level security;

alter table public.schedule_notifications enable row level security;
alter table public.schedule_notifications force row level security;

alter table public.schedule_share_links enable row level security;
alter table public.schedule_share_links force row level security;

alter table public.schedule_copy_undos enable row level security;
alter table public.schedule_copy_undos force row level security;
