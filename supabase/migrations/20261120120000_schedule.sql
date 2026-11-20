alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free','starter','pro','premium','team','business'));

create table public.schedule_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index schedule_default_location_idx on public.schedule_locations (owner_id) where is_default;
create index schedule_locations_owner_idx on public.schedule_locations (owner_id, created_at);

create table public.schedule_employees (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.schedule_locations (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  role text not null check (length(trim(role)) between 1 and 100),
  hourly_rate_rsd numeric(10,2) check (hourly_rate_rsd >= 0 and hourly_rate_rsd <= 99999999),
  login_email text check (length(login_email) <= 254 and login_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  user_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (location_id, id),
  unique (location_id, login_email),
  unique (location_id, user_id)
);

create index schedule_employees_user_idx on public.schedule_employees (user_id) where active;

create table public.schedule_assignments (
  location_id uuid not null,
  employee_id uuid not null,
  date date not null check (isfinite(date)),
  code text not null check (code in ('J','P','N','D','X','O','B','G')),
  custom_start time,
  custom_end time,
  primary key (location_id, date, employee_id),
  foreign key (location_id, employee_id) references public.schedule_employees (location_id, id) on delete cascade,
  check (case when code = 'X' then
    custom_start is not null and custom_end is not null
    and custom_start < time '24:00' and custom_end < time '24:00'
    and extract(epoch from custom_start) % 1800 = 0 and extract(epoch from custom_end) % 1800 = 0
    else custom_start is null and custom_end is null end)
);

create table public.schedule_publications (
  location_id uuid not null references public.schedule_locations (id) on delete cascade,
  monday date not null check (extract(isodow from monday) = 1),
  assignments jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references public.profiles (id) on delete cascade,
  primary key (location_id, monday)
);

create table public.schedule_requests (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  employee_id uuid not null,
  date date not null check (isfinite(date)),
  type text not null check (type in ('slobodan','zamena','promena')),
  with_employee_id uuid check (with_employee_id <> employee_id),
  to_template_code text check (to_template_code in ('J','P','N','D')),
  source jsonb not null,
  replacement jsonb,
  note text check (length(note) <= 500),
  status text not null default 'novo' check (status in ('novo','odobreno','odbijeno')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  foreign key (location_id, employee_id) references public.schedule_employees (location_id, id) on delete cascade,
  foreign key (location_id, with_employee_id) references public.schedule_employees (location_id, id) on delete cascade,
  check ((type = 'zamena') = (with_employee_id is not null)),
  check ((type = 'promena') = (to_template_code is not null))
);

create index schedule_requests_week_idx on public.schedule_requests (location_id, date, created_at desc);
create unique index schedule_pending_requests_idx on public.schedule_requests (location_id, date, employee_id) where status = 'novo';

create table public.schedule_notifications (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  employee_id uuid not null,
  monday date not null,
  kind text not null check (kind in ('published','odobreno','odbijeno')),
  created_at timestamptz not null default now(),
  foreign key (location_id, employee_id) references public.schedule_employees (location_id, id) on delete cascade
);

create index schedule_notifications_member_idx on public.schedule_notifications (location_id, employee_id, created_at desc);

create table public.schedule_share_links (
  token uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.schedule_locations (id) on delete cascade,
  monday date not null check (extract(isodow from monday) = 1),
  preview jsonb not null,
  created_at timestamptz not null default now(),
  unique (location_id, monday)
);

create table public.schedule_copy_undos (
  token uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.schedule_locations (id) on delete cascade,
  monday date not null,
  previous jsonb not null,
  copied jsonb not null,
  expires_at timestamptz not null default now() + interval '10 minutes',
  unique (location_id, monday)
);

alter table public.schedule_locations enable row level security;
alter table public.schedule_employees enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.schedule_publications enable row level security;
alter table public.schedule_requests enable row level security;
alter table public.schedule_notifications enable row level security;
alter table public.schedule_share_links enable row level security;
alter table public.schedule_copy_undos enable row level security;

revoke all on public.schedule_locations, public.schedule_employees, public.schedule_assignments,
  public.schedule_publications, public.schedule_requests, public.schedule_notifications,
  public.schedule_share_links, public.schedule_copy_undos from public, anon, authenticated;

create function public.schedule_rank(p_owner uuid) returns integer
language sql stable set search_path = '' as $$
  select coalesce((select case
    when p.plan_expires_at < now() then 0
    when p.plan = 'business' then 4
    when p.plan = 'team' then 3
    when p.plan in ('pro', 'premium') then 2
    when p.plan = 'starter' then 1
    else 0 end from public.profiles p where p.id = p_owner), 0);
$$;

create function public.schedule_scope(p_location uuid, p_initialize boolean)
returns table (location_id uuid, account_id uuid, name text, plan_rank integer, member_id uuid)
language plpgsql set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  viewer_rank integer := public.schedule_rank(viewer);
begin
  if viewer is null then return; end if;

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

  return query select l.id, l.owner_id, l.name, public.schedule_rank(l.owner_id), e.id
    from public.schedule_employees e
    join public.schedule_locations l on l.id = e.location_id
    where e.user_id = viewer and e.active and l.owner_id <> viewer
      and (p_location is null or l.id = p_location)
      and public.schedule_rank(l.owner_id) >= case when l.is_default then 3 else 4 end
    order by e.created_at, e.id limit 1;
  if found then return; end if;

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

create function public.schedule_shifts(p_location uuid, p_from date, p_until date, p_employees uuid[])
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(a) - 'location_id' order by a.date, a.employee_id), '[]'::jsonb)
  from public.schedule_assignments a
  where a.location_id = p_location and a.date >= p_from and a.date < p_until
    and (p_employees is null or a.employee_id = any(p_employees));
$$;

create function public.schedule_staff(p_location uuid, p_limit integer default null)
returns setof public.schedule_employees language sql stable set search_path = '' as $$
  select e.* from public.schedule_employees e
  where e.location_id = p_location and e.active order by e.created_at, e.id limit p_limit;
$$;

create function public.schedule_preview(p_location uuid, p_week date)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('venueName',l.name,'monday',p_week,
    'employees',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'full_name',
      case when cardinality(parts.names) > 1 then parts.names[1] || ' ' || left(parts.names[cardinality(parts.names)],1) || '.'
      else parts.names[1] end) order by e.created_at,e.id),'[]'::jsonb)
      from public.schedule_staff(l.id) e
      cross join lateral (select regexp_split_to_array(trim(e.full_name),'\s+') as names) parts),
    'assignments',public.schedule_shifts(l.id,p_week,p_week+7,array(select e.id from public.schedule_staff(l.id) e)))
  from public.schedule_locations l where l.id=p_location;
$$;

create function public.schedule_load(p_location uuid default null, p_week date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  scope record;
  today date := timezone('Europe/Belgrade', now())::date;
  selected_monday date;
  staff_ids uuid[];
  publication jsonb;
  published_assignments jsonb;
begin
  select * into scope from public.schedule_scope(p_location, true);
  if not found then return null; end if;
  selected_monday := date_trunc('week', case when scope.plan_rank = 0 or p_week is null or not isfinite(p_week)
    then today else p_week end)::date;

  if scope.member_id is not null then
    staff_ids := array[scope.member_id];
  else
    staff_ids := array(select e.id from public.schedule_staff(scope.location_id,
      case when scope.plan_rank = 0 then 3 end) e);
  end if;

  select jsonb_build_object('publishedAt', p.published_at, 'publisherName', profile.full_name), p.assignments
    into publication, published_assignments
    from public.schedule_publications p join public.profiles profile on profile.id = p.published_by
    where p.location_id = scope.location_id and p.monday = selected_monday;

  return jsonb_build_object(
    'mode', case when scope.member_id is null then 'owner' else 'employee' end,
    'plan', (array['free','starter','pro','team','business'])[scope.plan_rank + 1],
    'venue', jsonb_build_object('id',scope.location_id,'name',scope.name),
    'today', today, 'monday', selected_monday, 'publication', publication,
    'locations', case when scope.member_id is null and scope.plan_rank = 4 then
      (select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'employeeCount',
        (select count(*) from public.schedule_staff(l.id))) order by l.is_default desc,l.created_at,l.id)
        from public.schedule_locations l where l.owner_id=scope.account_id) else '[]'::jsonb end,
    'employees', (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'full_name',e.full_name,'role',e.role,
      'hourly_rate_rsd',case when scope.member_id is null and scope.plan_rank >= 2 then e.hourly_rate_rsd end,
      'login_email',case when scope.member_id is null and scope.plan_rank >= 3 then e.login_email end)
      order by e.created_at,e.id), '[]'::jsonb) from public.schedule_employees e where e.id=any(staff_ids)),
    'assignments', case when scope.member_id is null then
      public.schedule_shifts(scope.location_id,selected_monday,selected_monday+7,staff_ids) else (
        select coalesce(jsonb_agg(a order by a->>'date'),'[]'::jsonb) from jsonb_array_elements(published_assignments) a
        where (a->>'employee_id')::uuid = scope.member_id
      ) end,
    'publishedAssignments', case when scope.member_id is null and scope.plan_rank >= 3 then
      coalesce(published_assignments,'[]'::jsonb) end,
    'requests', case when scope.plan_rank >= 3 then (select coalesce(jsonb_agg(
      (to_jsonb(r) - 'location_id' - 'replacement' - 'decided_by') || jsonb_build_object(
        'employee_name',e.full_name,'with_employee_name',w.full_name) order by r.created_at desc),'[]'::jsonb)
      from public.schedule_requests r join public.schedule_employees e on e.id=r.employee_id
      left join public.schedule_employees w on w.id=r.with_employee_id
      where r.location_id=scope.location_id and r.date >= selected_monday and r.date < selected_monday+7
        and r.employee_id=any(staff_ids)) else '[]'::jsonb end,
    'coworkers', case when scope.member_id is not null and publication is not null then
      (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'full_name',e.full_name) order by e.full_name),'[]'::jsonb)
        from public.schedule_staff(scope.location_id) e where e.id <> scope.member_id) else '[]'::jsonb end,
    'notifications', case when scope.member_id is not null then
      (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb) from (
        select id,kind,monday,created_at from public.schedule_notifications inbox
        where inbox.location_id=scope.location_id and inbox.employee_id=scope.member_id
        order by inbox.created_at desc,inbox.id limit 10
      ) n)
      else '[]'::jsonb end
  );
end;
$$;

create function public.schedule_put(p_location uuid, p_employee uuid, p_date date, p_data jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  if p_data->>'code' is null then
    delete from public.schedule_assignments a
      where a.location_id=p_location and a.employee_id=p_employee and a.date=p_date;
  else
    insert into public.schedule_assignments (location_id,employee_id,date,code,custom_start,custom_end)
    values (p_location,p_employee,p_date,p_data->>'code',(p_data->>'custom_start')::time,(p_data->>'custom_end')::time)
    on conflict (location_id,date,employee_id) do update set code=excluded.code,
      custom_start=excluded.custom_start, custom_end=excluded.custom_end;
  end if;
end;
$$;

create function public.schedule_command(p_action text, p_location uuid, p_week date, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  scope record;
  today date := timezone('Europe/Belgrade',now())::date;
  selected_monday date := date_trunc('week',p_week)::date;
  employee uuid;
  other_employee uuid;
  linked_email text;
  linked_user uuid;
  day date;
  result_id uuid;
  before_shifts jsonb;
  after_shifts jsonb;
  source_shift jsonb;
  other_shift jsonb;
  published_assignments jsonb;
  shared_preview jsonb;
  pending public.schedule_requests%rowtype;
  undo public.schedule_copy_undos%rowtype;
  decision text;
  notified integer := 0;
begin
  select * into scope from public.schedule_scope(p_location, false);
  if not found or scope.location_id is distinct from p_location or p_week is null or not isfinite(p_week)
    or (scope.plan_rank=0 and selected_monday <> date_trunc('week',today)::date)
    or (scope.member_id is not null and p_action <> 'request')
  then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;

  -- Serialize mutations per location for the Free limit, swaps, and copy/undo.
  perform 1 from public.schedule_locations l where l.id=scope.location_id for update;

  case p_action
  when 'location' then
    if scope.plan_rank < 4 then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    insert into public.schedule_locations (owner_id,name) values (scope.account_id,trim(p_payload->>'name')) returning id into result_id;

  when 'employee' then
    employee := (p_payload->>'id')::uuid;
    linked_email := case when scope.plan_rank >= 3 then nullif(lower(trim(p_payload->>'login_email')),'') end;
    if linked_email is not null then
      select e.user_id into linked_user from public.schedule_employees e
        where e.location_id=p_location and e.id=employee and e.login_email=linked_email;
      if linked_user is null then
        select u.id into linked_user from auth.users u
          where lower(u.email)=linked_email and u.email_confirmed_at is not null;
        if not found then raise exception 'SCHEDULE_LOGIN_MISSING'; end if;
      end if;
    end if;
    if employee is null then
      if scope.plan_rank = 0 and (select count(*) from public.schedule_staff(p_location,3)) = 3
        then raise exception 'SCHEDULE_EMPLOYEE_LIMIT'; end if;
      insert into public.schedule_employees (location_id,full_name,role,hourly_rate_rsd,login_email,user_id)
      values (p_location,trim(p_payload->>'full_name'),trim(p_payload->>'role'),
        case when scope.plan_rank >= 2 then (p_payload->>'hourly_rate_rsd')::numeric end,linked_email,linked_user) returning id into result_id;
    else
      if not exists (select from public.schedule_staff(p_location,case when scope.plan_rank=0 then 3 end) e where e.id=employee)
        then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
      update public.schedule_employees e set full_name=trim(p_payload->>'full_name'), role=trim(p_payload->>'role'),
        hourly_rate_rsd=case when scope.plan_rank >=2 then (p_payload->>'hourly_rate_rsd')::numeric else e.hourly_rate_rsd end,
        login_email=case when scope.plan_rank >=3 then linked_email else e.login_email end,
        user_id=case when scope.plan_rank >=3 then linked_user else e.user_id end
      where e.location_id=p_location and e.id=employee returning e.id into result_id;
    end if;

  when 'assignment' then
    employee := (p_payload->>'employee_id')::uuid;
    day := (p_payload->>'date')::date;
    if day is null or day < selected_monday or day >= selected_monday+7 or not exists (
      select from public.schedule_staff(p_location,case when scope.plan_rank=0 then 3 end) e where e.id=employee
    ) then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    perform public.schedule_put(p_location,employee,day,p_payload);

  when 'publish' then
    insert into public.schedule_publications (location_id,monday,published_by,assignments)
    values (p_location,selected_monday,auth.uid(),public.schedule_shifts(p_location,selected_monday,selected_monday+7,null))
    on conflict on constraint schedule_publications_pkey do update
      set published_at=now(), published_by=excluded.published_by, assignments=excluded.assignments;
    if scope.plan_rank >= 3 then
      insert into public.schedule_notifications (location_id,employee_id,monday,kind)
      select p_location,e.id,selected_monday,'published' from public.schedule_staff(p_location) e
      where e.user_id <> auth.uid();
      get diagnostics notified = row_count;
    end if;
    return jsonb_build_object('notified',notified);

  when 'copy' then
    if scope.plan_rank < 1 then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    before_shifts := public.schedule_shifts(p_location,selected_monday,selected_monday+7,null);
    delete from public.schedule_assignments a where a.location_id=p_location and a.date >= selected_monday and a.date < selected_monday+7;
    insert into public.schedule_assignments (location_id,employee_id,date,code,custom_start,custom_end)
    select p_location,a.employee_id,a.date+7,a.code,a.custom_start,a.custom_end from public.schedule_assignments a
      join public.schedule_employees e on e.location_id=a.location_id and e.id=a.employee_id and e.active
      where a.location_id=p_location and a.date >= selected_monday-7 and a.date < selected_monday;
    after_shifts := public.schedule_shifts(p_location,selected_monday,selected_monday+7,null);
    insert into public.schedule_copy_undos (location_id,monday,previous,copied)
      values (p_location,selected_monday,before_shifts,after_shifts)
      on conflict on constraint schedule_copy_undos_location_id_monday_key do update
      set token=gen_random_uuid(), previous=excluded.previous, copied=excluded.copied, expires_at=excluded.expires_at
      returning token into result_id;
    return jsonb_build_object('token',result_id);

  when 'undo' then
    if scope.plan_rank < 1 then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    select u.* into undo from public.schedule_copy_undos u
      where u.token=(p_payload->>'token')::uuid and u.location_id=p_location and u.monday=selected_monday and u.expires_at>=now();
    if not found or public.schedule_shifts(p_location,selected_monday,selected_monday+7,null) <> undo.copied
      then raise exception 'SCHEDULE_STALE'; end if;
    delete from public.schedule_assignments a where a.location_id=p_location and a.date >= selected_monday and a.date < selected_monday+7;
    insert into public.schedule_assignments (location_id,employee_id,date,code,custom_start,custom_end)
    select p_location,a.employee_id,a.date,a.code,a.custom_start,a.custom_end
    from jsonb_to_recordset(undo.previous) as a(employee_id uuid,date date,code text,custom_start time,custom_end time);
    delete from public.schedule_copy_undos u where u.token=undo.token;

  when 'share' then
    if scope.plan_rank < 1 then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    shared_preview := public.schedule_preview(p_location,selected_monday);
    insert into public.schedule_share_links (location_id,monday,preview) values (p_location,selected_monday,shared_preview)
      on conflict on constraint schedule_share_links_location_id_monday_key do update set preview=excluded.preview
      returning token into result_id;
    return jsonb_build_object('token',result_id,'preview',shared_preview);

  when 'request' then
    day := (p_payload->>'date')::date;
    other_employee := (p_payload->>'with_employee_id')::uuid;
    select p.assignments into published_assignments from public.schedule_publications p
      where p.location_id=p_location and p.monday=selected_monday;
    if scope.member_id is null or day is null or day < greatest(today,selected_monday) or day >= selected_monday+7
      or p_payload->>'type' not in ('slobodan','zamena','promena')
      or published_assignments is null
      then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    select a into source_shift from jsonb_array_elements(published_assignments) a
      where (a->>'employee_id')::uuid=scope.member_id and (a->>'date')::date=day and a->>'code' in ('J','P','N','D','X');
    if not found then raise exception 'SCHEDULE_STALE'; end if;
    if other_employee is not null then
      if not exists (select from public.schedule_staff(p_location) e where e.id=other_employee and e.id<>scope.member_id)
        then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
      select a into other_shift from jsonb_array_elements(published_assignments) a
        where (a->>'employee_id')::uuid=other_employee and (a->>'date')::date=day;
    end if;
    insert into public.schedule_requests (location_id,employee_id,date,type,with_employee_id,to_template_code,note,source,replacement)
    values (p_location,scope.member_id,day,p_payload->>'type',other_employee,p_payload->>'to_template_code',
      nullif(trim(p_payload->>'note'),''),source_shift,other_shift) returning id into result_id;

  when 'decide' then
    decision := p_payload->>'status';
    if scope.plan_rank < 3 or decision is null or decision not in ('odobreno','odbijeno')
      then raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501'; end if;
    select r.* into pending from public.schedule_requests r
      where r.id=(p_payload->>'id')::uuid and r.location_id=p_location and r.status='novo'
        and r.date >= selected_monday and r.date < selected_monday+7;
    if not found then raise exception 'SCHEDULE_STALE'; end if;
    if decision='odobreno' then
      select to_jsonb(a)-'location_id' into source_shift from public.schedule_assignments a
        where a.location_id=p_location and a.date=pending.date and a.employee_id=pending.employee_id;
      if source_shift is distinct from pending.source then raise exception 'SCHEDULE_STALE'; end if;
      case pending.type
      when 'slobodan' then perform public.schedule_put(p_location,pending.employee_id,pending.date,'{"code":"O"}');
      when 'promena' then perform public.schedule_put(p_location,pending.employee_id,pending.date,
        jsonb_build_object('code',pending.to_template_code));
      when 'zamena' then
        select to_jsonb(a)-'location_id' into other_shift from public.schedule_assignments a
          where a.location_id=p_location and a.date=pending.date and a.employee_id=pending.with_employee_id;
        if other_shift is distinct from pending.replacement then raise exception 'SCHEDULE_STALE'; end if;
        perform public.schedule_put(p_location,pending.employee_id,pending.date,coalesce(other_shift,'{"code":"O"}'));
        perform public.schedule_put(p_location,pending.with_employee_id,pending.date,source_shift);
      end case;
      -- Apply the approved cells to the published week without exposing unrelated drafts.
      update public.schedule_publications p set assignments = (
        select coalesce(jsonb_agg(a),'[]'::jsonb) from jsonb_array_elements(p.assignments) a
        where (a->>'date')::date <> pending.date or (a->>'employee_id')::uuid <> all(
          array_remove(array[pending.employee_id,pending.with_employee_id],null)
        )
      ) || public.schedule_shifts(p_location,pending.date,pending.date+1,
        array_remove(array[pending.employee_id,pending.with_employee_id],null))
      where p.location_id=p_location and p.monday=selected_monday;
    end if;
    update public.schedule_requests r set status=decision,decided_at=now(),decided_by=auth.uid() where r.id=pending.id;
    insert into public.schedule_notifications (location_id,employee_id,monday,kind)
    values (p_location,pending.employee_id,selected_monday,decision);

  else raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501';
  end case;
  return jsonb_build_object('id',result_id);
end;
$$;

create function public.schedule_report(p_location uuid,p_month date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  scope record;
  month_start date := date_trunc('month',p_month)::date;
  next_month date := (month_start + interval '1 month')::date;
begin
  select l.id, l.owner_id into scope from public.schedule_locations l
    where l.id=p_location and l.owner_id=auth.uid() and public.schedule_rank(l.owner_id)=4;
  if not found or p_month is null or not isfinite(p_month) then
    raise exception 'SCHEDULE_FORBIDDEN' using errcode='42501';
  end if;
  return jsonb_build_object('employees',(select coalesce(jsonb_agg(
    jsonb_build_object('id',e.id,'full_name',e.full_name,'role',e.role,'hourly_rate_rsd',e.hourly_rate_rsd)
      order by e.created_at,e.id),'[]'::jsonb) from public.schedule_employees e
    where e.location_id=p_location and (e.active or exists (
      select from public.schedule_assignments a where a.location_id=p_location and a.employee_id=e.id
        and a.date >= month_start and a.date < next_month
    ))),'assignments',public.schedule_shifts(p_location,month_start,next_month,null));
end;
$$;

create function public.schedule_public(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select s.preview
  from public.schedule_share_links s join public.schedule_locations l on l.id=s.location_id
  where s.token=p_token and public.schedule_rank(l.owner_id) >= case when l.is_default then 1 else 4 end;
$$;

revoke all on function public.schedule_rank(uuid),public.schedule_scope(uuid,boolean),
  public.schedule_shifts(uuid,date,date,uuid[]),public.schedule_staff(uuid,integer),
  public.schedule_preview(uuid,date),public.schedule_put(uuid,uuid,date,jsonb),public.schedule_load(uuid,date),
  public.schedule_command(text,uuid,date,jsonb),public.schedule_report(uuid,date),public.schedule_public(uuid)
  from public, anon, authenticated;

grant execute on function public.schedule_load(uuid,date),public.schedule_command(text,uuid,date,jsonb),
  public.schedule_report(uuid,date) to authenticated;
grant execute on function public.schedule_public(uuid) to anon, authenticated;
