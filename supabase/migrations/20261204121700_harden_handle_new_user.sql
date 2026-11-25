-- =============================================================================
-- Harden signup trigger: profile + default venue must always succeed under
-- FORCE ROW LEVEL SECURITY. Runs as definer (postgres) with a fixed search_path.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_venue_name text;
begin
  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_venue_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'venue_name', '')), '');

  insert into public.profiles (id, full_name)
  values (new.id, coalesce(v_full_name, ''))
  on conflict (id) do update
    set full_name = excluded.full_name,
        updated_at = now()
    where public.profiles.full_name is distinct from excluded.full_name;

  insert into public.venues (owner_id, name)
  select new.id, coalesce(v_venue_name, 'Moj lokal')
  where not exists (
    select 1
    from public.venues v
    where v.owner_id = new.id
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to postgres, service_role;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
