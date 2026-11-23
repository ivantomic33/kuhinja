-- =============================================================================
-- Stripe billing: profile fields + webhook idempotency
-- Plan changes must only happen via service role (webhook).
-- =============================================================================

-- Expand plan values (app uses premium; legacy pro still valid)
alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'premium'));

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
