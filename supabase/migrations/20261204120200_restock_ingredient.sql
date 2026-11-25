-- =============================================================================
-- Atomic ingredient price restock: update ingredients + price_history together.
-- security invoker so RLS (venue ownership) still applies.
-- =============================================================================

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
  v_row public.ingredients;
begin
  if p_ingredient_id is null then
    raise exception 'INGREDIENT_REQUIRED' using errcode = '22023';
  end if;

  if p_new_price is null or p_new_price < 0 then
    raise exception 'INVALID_PRICE' using errcode = '22023';
  end if;

  -- At most two decimal places for money-like restock prices
  if round(p_new_price, 2) <> p_new_price then
    raise exception 'INVALID_PRICE_PRECISION' using errcode = '22023';
  end if;

  update public.ingredients
  set
    price = p_new_price,
    notes = case
      when p_note is null or length(trim(p_note)) = 0 then notes
      else left(trim(p_note), 500)
    end
  where id = p_ingredient_id
  returning * into v_row;

  if not found then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Explicit history row (trigger also logs price changes; this keeps a
  -- restock-originated audit even if price is unchanged).
  insert into public.ingredient_price_history (ingredient_id, price)
  values (p_ingredient_id, p_new_price);

  return v_row;
end;
$$;

revoke all on function public.restock_ingredient(uuid, numeric, text) from public;
grant execute on function public.restock_ingredient(uuid, numeric, text)
  to authenticated;
