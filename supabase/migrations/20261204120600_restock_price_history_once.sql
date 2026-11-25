-- Starter can restock with a price (one history row per restock).
-- History remains readable only on Pro+.
-- Replaces the always-insert path from 20261204120200 (which double-logged
-- when the price-change trigger also fired).

alter policy "Owners can select ingredient price history"
on public.ingredient_price_history
using (
  (select public.effective_owner_plan(auth.uid())) in ('pro', 'team', 'business')
  and exists (
    select 1 from public.ingredients i
    where i.id = ingredient_id and public.is_venue_owner(i.venue_id)
  )
);

alter policy "Owners can insert ingredient price history"
on public.ingredient_price_history
with check (
  (select public.effective_owner_plan(auth.uid())) in ('starter', 'pro', 'team', 'business')
  and exists (
    select 1 from public.ingredients i
    where i.id = ingredient_id and public.is_venue_owner(i.venue_id)
  )
);

-- Starter+ may insert history via restock; free stays blocked by RLS above.
drop trigger if exists ingredient_price_history_enforce_plan
  on public.ingredient_price_history;

-- Auto-log price on ingredient insert/change for Starter+ (Pro+ can still read).
create or replace function public.log_ingredient_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.venues v
    where v.id = new.venue_id
      and public.effective_owner_plan(v.owner_id) in ('starter', 'pro', 'team', 'business')
  ) and (tg_op = 'INSERT' or new.price is distinct from old.price) then
    insert into public.ingredient_price_history (ingredient_id, price)
    values (new.id, new.price);
  end if;
  return new;
end;
$$;

create or replace function public.restock_ingredient(
  p_ingredient_id uuid,
  p_new_price numeric,
  p_note text default null
)
returns public.ingredients
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old_price numeric;
  v_venue_id uuid;
  v_owner_id uuid;
  v_row public.ingredients;
  v_note text;
begin
  v_note := nullif(trim(coalesce(p_note, '')), '');

  if p_ingredient_id is null
     or p_new_price is null
     or p_new_price in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_new_price <= 0
     or p_new_price >= 10000000000
     or round(p_new_price, 2) <> p_new_price
     or (v_note is not null and char_length(v_note) > 500) then
    raise exception 'INVALID_RESTOCK_INPUT' using errcode = '22023';
  end if;

  select i.price, i.venue_id, v.owner_id
  into v_old_price, v_venue_id, v_owner_id
  from public.ingredients i
  join public.venues v on v.id = i.venue_id
  where i.id = p_ingredient_id
  for update of i;

  if not found then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Plan follows venue owner (same rule as limit triggers), not a bare client claim.
  if coalesce(public.effective_owner_plan(v_owner_id), 'free')
       not in ('starter', 'pro', 'team', 'business') then
    raise exception 'LIMIT_REACHED: price restock requires Starter' using errcode = '42501';
  end if;

  if not public.is_venue_owner(v_venue_id) then
    raise exception 'NOT_VENUE_OWNER' using errcode = '42501';
  end if;

  update public.ingredients
  set
    price = p_new_price,
    notes = case when v_note is null then notes else left(v_note, 500) end
  where id = p_ingredient_id
  returning * into strict v_row;

  -- Trigger already logs when price changes. Same-price restock still needs one row.
  if v_old_price is not distinct from v_row.price then
    insert into public.ingredient_price_history (ingredient_id, price)
    values (v_row.id, v_row.price);
  end if;

  return v_row;
end;
$$;

revoke all on function public.restock_ingredient(uuid, numeric, text) from public;
grant execute on function public.restock_ingredient(uuid, numeric, text)
  to authenticated;
