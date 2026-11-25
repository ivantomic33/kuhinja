-- Keep the quantity change and its paid stock movement in one transaction.
create function public.record_stock_adjustment(
  p_venue_id uuid, p_type text, p_lines jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  feature text;
  line record;
  previous_qty numeric;
  delta numeric;
begin
  if p_type is null or p_type not in ('otpis', 'korekcija')
    or jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Invalid adjustment' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) = 0 or (p_type = 'otpis' and jsonb_array_length(p_lines) <> 1) then
    raise exception 'Invalid adjustment lines' using errcode = '22023';
  end if;
  feature := case p_type when 'otpis' then 'stockWriteOff' else 'stockInventory' end;
  if not coalesce((public.get_entitlements(auth.uid())->'features'->>feature)::boolean, false) then
    raise exception 'UPGRADE_REQUIRED' using errcode = '42501';
  end if;
  if not public.is_venue_owner(p_venue_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  for line in
    select * from jsonb_to_recordset(p_lines) as entry(
      ingredient_id uuid, qty numeric, unit_cost numeric, reason text, note text
    ) order by ingredient_id
  loop
    if line.qty is null or line.qty in ('NaN', 'Infinity', '-Infinity')
      or line.qty < 0 or (p_type = 'otpis' and line.qty = 0)
      or (line.unit_cost is not null and (line.unit_cost < 0 or line.unit_cost in ('NaN', 'Infinity'))) then
      raise exception 'Invalid adjustment amount' using errcode = '22023';
    end if;
    if not exists (select from public.ingredients where id = line.ingredient_id and venue_id = p_venue_id) then
      raise exception 'Ingredient not found' using errcode = '22023';
    end if;

    select qty into previous_qty from public.stock_levels
      where venue_id = p_venue_id and ingredient_id = line.ingredient_id for update;
    if not found then
      insert into public.stock_levels(venue_id, ingredient_id)
        values (p_venue_id, line.ingredient_id) on conflict (venue_id, ingredient_id) do nothing;
      select qty into strict previous_qty from public.stock_levels
        where venue_id = p_venue_id and ingredient_id = line.ingredient_id for update;
    end if;
    delta := round(case p_type when 'otpis' then -line.qty else line.qty - previous_qty end, 4);
    if delta <> 0 then
      update public.stock_levels set qty = previous_qty + delta
        where venue_id = p_venue_id and ingredient_id = line.ingredient_id;
      insert into public.stock_moves(venue_id, ingredient_id, type, qty_delta, unit_cost, reason, note, user_id)
        values (p_venue_id, line.ingredient_id, p_type, delta, line.unit_cost,
          case p_type when 'otpis' then line.reason else 'inventura' end,
          nullif(trim(line.note), ''), auth.uid());
    end if;
  end loop;
end
$$;
revoke all on function public.record_stock_adjustment(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_stock_adjustment(uuid, text, jsonb) to authenticated;

-- Existing clients update only the undo marker. Keep move type and amount immutable.
revoke update on public.stock_moves from public, anon, authenticated;
grant update (undone) on public.stock_moves to authenticated;
