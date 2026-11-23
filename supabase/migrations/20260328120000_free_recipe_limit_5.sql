-- Free plan: recipes cap 1 → 5 (align with app entitlements)

create or replace function public.enforce_free_limit()
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

  -- paid plans: anything other than free bypasses caps
  if coalesce(v_plan, 'free') not in ('free') then
    return new;
  end if;

  if tg_table_name = 'ingredients' then
    select count(*)::integer
    into v_count
    from public.ingredients i
    where i.venue_id = new.venue_id;

    if v_count >= 20 then
      raise exception 'FREE_LIMIT_INGREDIENTS: maximum 20 ingredients per venue';
    end if;
  elsif tg_table_name = 'recipes' then
    select count(*)::integer
    into v_count
    from public.recipes r
    where r.venue_id = new.venue_id;

    if v_count >= 5 then
      raise exception 'FREE_LIMIT_RECIPES: maximum 5 recipes per venue';
    end if;
  elsif tg_table_name = 'checklist_templates' then
    select count(*)::integer
    into v_count
    from public.checklist_templates t
    where t.venue_id = new.venue_id;

    if v_count >= 1 then
      raise exception 'FREE_LIMIT_TEMPLATES: maximum 1 checklist template per venue';
    end if;
  end if;

  return new;
end;
$$;
