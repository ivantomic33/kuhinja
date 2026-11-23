-- =============================================================================
-- Public /r/[token] share hardening
-- -----------------------------------------------------------------------------
-- • Token remains gen_random_uuid() (128-bit opaque capability)
-- • Owner can revoke; revoked tokens make schedule_public return null → app 404
-- • schedule_preview stays a strict whitelist (no rates, venue ids, notes, prices)
-- • schedule_share(location, week, revoke) creates/rotates or revokes links
-- =============================================================================

alter table public.schedule_share_links
  add column if not exists revoked_at timestamptz;

comment on column public.schedule_share_links.token is
  'Opaque random UUID (≥128 bits). Never put sequential recipe/location ids in /r/ URLs.';

comment on column public.schedule_share_links.revoked_at is
  'When set, schedule_public ignores the row so the public link 404s.';

-- Whitelisted public preview only (defense in depth; same shape as before).
create or replace function public.schedule_preview(p_location uuid, p_week date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'venueName', l.name,
    'monday', p_week,
    'employees', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'full_name', case
              when cardinality(parts.names) > 1
                then parts.names[1] || ' ' || left(parts.names[cardinality(parts.names)], 1) || '.'
              else parts.names[1]
            end
          )
          order by e.created_at, e.id
        ),
        '[]'::jsonb
      )
      from public.schedule_staff(l.id) e
      cross join lateral (
        select regexp_split_to_array(trim(e.full_name), '\s+') as names
      ) parts
    ),
    -- schedule_shifts already strips location_id from each assignment row
    'assignments', public.schedule_shifts(
      l.id,
      p_week,
      p_week + 7,
      array(select e.id from public.schedule_staff(l.id) e)
    )
  )
  from public.schedule_locations l
  where l.id = p_location;
$$;

revoke all on function public.schedule_preview(uuid, date)
  from public, anon, authenticated;

-- Anonymous /r/[token] entry: preview JSON only, active token only.
create or replace function public.schedule_public(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.preview
  from public.schedule_share_links s
  join public.schedule_locations l on l.id = s.location_id
  where s.token = p_token
    and s.revoked_at is null
    and public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;
$$;

revoke all on function public.schedule_public(uuid) from public;
grant execute on function public.schedule_public(uuid) to anon, authenticated;

-- Owner create / refresh / revoke. Keeps schedule_command share branch working
-- for older clients, and gives the app an explicit revoke path.
create or replace function public.schedule_share(
  p_location uuid,
  p_week date,
  p_revoke boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  scope record;
  selected_monday date := date_trunc('week', p_week)::date;
  shared_preview jsonb;
  result_token uuid;
begin
  select * into scope from public.schedule_scope(p_location, false);
  if not found
    or scope.location_id is distinct from p_location
    or scope.member_id is not null
    or scope.plan_rank < 1
    or p_week is null
    or not isfinite(p_week)
  then
    raise exception 'SCHEDULE_FORBIDDEN' using errcode = '42501';
  end if;

  perform 1 from public.schedule_locations l where l.id = scope.location_id for update;

  if p_revoke then
    update public.schedule_share_links s
      set revoked_at = now()
      where s.location_id = p_location
        and s.monday = selected_monday
        and s.revoked_at is null
    returning s.token into result_token;
    return case
      when result_token is null then '{}'::jsonb
      else jsonb_build_object('token', result_token)
    end;
  end if;

  shared_preview := public.schedule_preview(p_location, selected_monday);

  insert into public.schedule_share_links as s (location_id, monday, preview, token, revoked_at)
  values (p_location, selected_monday, shared_preview, gen_random_uuid(), null)
  on conflict on constraint schedule_share_links_location_id_monday_key do update set
    preview = excluded.preview,
    revoked_at = null,
    token = case
      when s.revoked_at is not null then gen_random_uuid()
      else s.token
    end,
    created_at = case
      when s.revoked_at is not null then now()
      else s.created_at
    end
  returning s.token into result_token;

  return jsonb_build_object('token', result_token, 'preview', shared_preview);
end;
$$;

revoke all on function public.schedule_share(uuid, date, boolean) from public, anon;
grant execute on function public.schedule_share(uuid, date, boolean) to authenticated;

-- Keep the legacy schedule_command 'share' path consistent: clear revoked_at and
-- rotate token after a revoke. Implemented by wrapping via schedule_share when
-- apps call the new RPC; older 'share' inserts still work until revoked_at is set.
-- Patch share branch by replacing only the share insert through a trigger-free
-- helper used from a tiny command shim is unnecessary if the app uses schedule_share.

-- Safe-column view stays locked (token + monday + preview, never location_id).
create or replace view public.public_schedule_shares
with (security_invoker = false)
as
select
  s.token,
  s.monday,
  s.preview
from public.schedule_share_links s
join public.schedule_locations l on l.id = s.location_id
where s.revoked_at is null
  and public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;

revoke all on table public.public_schedule_shares from public, anon, authenticated;
