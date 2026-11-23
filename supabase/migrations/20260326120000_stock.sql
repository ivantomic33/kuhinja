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

create trigger stock_levels_set_updated_at
  before update on public.stock_levels
  for each row
  execute function public.set_updated_at();

alter table public.stock_levels enable row level security;

revoke all on table public.stock_levels from anon, authenticated;
grant select, insert, update, delete on table public.stock_levels to authenticated;

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
