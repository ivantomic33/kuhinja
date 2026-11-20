create or replace function public.schedule_scope(p_location uuid, p_initialize boolean)
returns table (location_id uuid, account_id uuid, name text, plan_rank integer, member_id uuid)
language plpgsql set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  viewer_rank integer := public.schedule_rank(viewer);
begin
  if viewer is null then return; end if;

  if viewer_rank >= 1 then
    if p_location is null or viewer_rank < 4 then
      return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
        from public.schedule_locations l
        where l.owner_id = viewer and l.is_default and (
          p_location = l.id or (p_location is null and exists (
            select from public.schedule_employees e where e.location_id = l.id and e.active
          ))
        );
    else
      return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
        from public.schedule_locations l where l.id = p_location and l.owner_id = viewer;
    end if;
    if found then return; end if;
  end if;

  -- Employee access uses the plan of the location they belong to.
  return query select l.id, l.owner_id, l.name, public.schedule_rank(l.owner_id), e.id
    from public.schedule_employees e
    join public.schedule_locations l on l.id = e.location_id
    where e.user_id = viewer and e.active and l.owner_id <> viewer
      and (p_location is null or l.id = p_location)
      and public.schedule_rank(l.owner_id) >= case when l.is_default then 3 else 4 end
    order by e.created_at, e.id limit 1;
  if found or viewer_rank < 1 then return; end if;

  if p_location is not null then
    if viewer_rank < 4 and exists (
      select from public.schedule_locations l where l.id = p_location and l.owner_id = viewer
    ) then
      return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
        from public.schedule_locations l where l.owner_id = viewer and l.is_default;
    end if;
    return;
  end if;

  if p_initialize then
    insert into public.schedule_locations (owner_id, name, is_default)
    values (viewer, coalesce((select left(trim(v.name),120) from public.venues v where v.owner_id = viewer
      order by v.created_at, v.id limit 1), 'Lokal'), true)
    on conflict (owner_id) where is_default do nothing;
  end if;
  return query select l.id, l.owner_id, l.name, viewer_rank, null::uuid
    from public.schedule_locations l where l.owner_id = viewer and l.is_default;
end;
$$;
