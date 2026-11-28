-- =============================================================================
-- rls_uid_cache: Replace bare auth.uid() with (select auth.uid()) in all RLS
-- policies. The subquery form is evaluated once per statement instead of once
-- per row, cutting auth overhead on large scans.
-- Idempotent — drops before recreating.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

drop policy if exists "Users can select own profile" on public.profiles;
drop policy if exists "Users can update own full_name" on public.profiles;

create policy "Users can select own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own full_name"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------

drop policy if exists "Owners can select own venues" on public.venues;
drop policy if exists "Owners can insert own venues" on public.venues;
drop policy if exists "Owners can update own venues" on public.venues;
drop policy if exists "Owners can delete own venues" on public.venues;

create policy "Owners can select own venues"
  on public.venues for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can insert own venues"
  on public.venues for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update own venues"
  on public.venues for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete own venues"
  on public.venues for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- checklist_runs
-- ---------------------------------------------------------------------------

drop policy if exists "Owners can select own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can insert own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can update own checklist runs" on public.checklist_runs;
drop policy if exists "Owners can delete own checklist runs" on public.checklist_runs;

create policy "Owners can select own checklist runs"
  on public.checklist_runs for select to authenticated
  using (
    (select auth.uid()) = user_id
    and public.is_venue_owner(venue_id)
  );

create policy "Owners can insert own checklist runs"
  on public.checklist_runs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_venue_owner(venue_id)
  );

create policy "Owners can update own checklist runs"
  on public.checklist_runs for update to authenticated
  using (
    (select auth.uid()) = user_id
    and public.is_venue_owner(venue_id)
  )
  with check (
    (select auth.uid()) = user_id
    and public.is_venue_owner(venue_id)
  );

create policy "Owners can delete own checklist runs"
  on public.checklist_runs for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and public.is_venue_owner(venue_id)
  );

-- ---------------------------------------------------------------------------
-- legal_consents
-- ---------------------------------------------------------------------------

drop policy if exists "Users can select own legal consents" on public.legal_consents;
drop policy if exists "Users can insert own legal consents" on public.legal_consents;

create policy "Users can select own legal consents"
  on public.legal_consents for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own legal consents"
  on public.legal_consents for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- schedule_locations
-- ---------------------------------------------------------------------------

drop policy if exists "Schedule location owners manage" on public.schedule_locations;
drop policy if exists "Schedule location members select" on public.schedule_locations;

create policy "Schedule location owners manage"
  on public.schedule_locations for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Schedule location members select"
  on public.schedule_locations for select to authenticated
  using (
    exists (
      select 1 from public.schedule_employees e
      where e.location_id = id
        and e.user_id = (select auth.uid())
        and e.active
    )
  );

-- ---------------------------------------------------------------------------
-- schedule_employees
-- ---------------------------------------------------------------------------

drop policy if exists "Schedule employees owner all" on public.schedule_employees;
drop policy if exists "Schedule employees self select" on public.schedule_employees;

create policy "Schedule employees owner all"
  on public.schedule_employees for all to authenticated
  using (
    exists (
      select 1 from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy "Schedule employees self select"
  on public.schedule_employees for select to authenticated
  using (user_id = (select auth.uid()) and active);

-- ---------------------------------------------------------------------------
-- schedule_assignments
-- ---------------------------------------------------------------------------

drop policy if exists "Schedule assignments owner all" on public.schedule_assignments;
drop policy if exists "Schedule assignments member select" on public.schedule_assignments;

create policy "Schedule assignments owner all"
  on public.schedule_assignments for all to authenticated
  using (
    exists (
      select 1 from public.schedule_employees e
      join public.schedule_locations l on l.id = e.location_id
      where e.id = employee_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.schedule_employees e
      join public.schedule_locations l on l.id = e.location_id
      where e.id = employee_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy "Schedule assignments member select"
  on public.schedule_assignments for select to authenticated
  using (
    exists (
      select 1 from public.schedule_employees e
      where e.id = employee_id
        and e.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- schedule_publications
-- ---------------------------------------------------------------------------

drop policy if exists "Schedule publications owner all" on public.schedule_publications;
drop policy if exists "Schedule publications member select" on public.schedule_publications;

create policy "Schedule publications owner all"
  on public.schedule_publications for all to authenticated
  using (
    exists (
      select 1 from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy "Schedule publications member select"
  on public.schedule_publications for select to authenticated
  using (
    exists (
      select 1 from public.schedule_employees e
      where e.location_id = location_id
        and e.user_id = (select auth.uid())
        and e.active
    )
  );

-- ---------------------------------------------------------------------------
-- schedule_requests
-- ---------------------------------------------------------------------------

drop policy if exists "Schedule requests owner all" on public.schedule_requests;
drop policy if exists "Schedule requests member select insert" on public.schedule_requests;

create policy "Schedule requests owner all"
  on public.schedule_requests for all to authenticated
  using (
    exists (
      select 1 from public.schedule_employees e
      join public.schedule_locations l on l.id = e.location_id
      where e.id = employee_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.schedule_employees e
      join public.schedule_locations l on l.id = e.location_id
      where e.id = employee_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy "Schedule requests member select insert"
  on public.schedule_requests for select to authenticated
  using (
    exists (
      select 1 from public.schedule_employees e
      where e.id = employee_id
        and e.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- schedule_notifications
-- ---------------------------------------------------------------------------

drop policy if exists "Schedule notifications owner all" on public.schedule_notifications;
drop policy if exists "Schedule notifications member select delete" on public.schedule_notifications;

create policy "Schedule notifications owner all"
  on public.schedule_notifications for all to authenticated
  using (
    exists (
      select 1 from public.schedule_employees e
      join public.schedule_locations l on l.id = e.location_id
      where e.id = employee_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.schedule_employees e
      join public.schedule_locations l on l.id = e.location_id
      where e.id = employee_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy "Schedule notifications member select delete"
  on public.schedule_notifications for select to authenticated
  using (
    exists (
      select 1 from public.schedule_employees e
      where e.id = employee_id
        and e.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- schedule_share_links
-- ---------------------------------------------------------------------------

drop policy if exists "Schedule share links owner all" on public.schedule_share_links;

create policy "Schedule share links owner all"
  on public.schedule_share_links for all to authenticated
  using (
    exists (
      select 1 from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- schedule_copy_undos
-- ---------------------------------------------------------------------------

drop policy if exists "Schedule copy undos owner all" on public.schedule_copy_undos;

create policy "Schedule copy undos owner all"
  on public.schedule_copy_undos for all to authenticated
  using (
    exists (
      select 1 from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.schedule_locations l
      where l.id = location_id
        and l.owner_id = (select auth.uid())
    )
  );
