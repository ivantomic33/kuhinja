alter policy "Owners can insert own checklist runs"
on public.checklist_runs
with check (
  auth.uid() = user_id
  and public.is_venue_owner(venue_id)
  and exists (
    select 1 from public.checklist_templates t
    where t.id = template_id and t.venue_id = checklist_runs.venue_id
  )
);

alter policy "Owners can update own checklist runs"
on public.checklist_runs
with check (
  auth.uid() = user_id
  and public.is_venue_owner(venue_id)
  and exists (
    select 1 from public.checklist_templates t
    where t.id = template_id and t.venue_id = checklist_runs.venue_id
  )
);
