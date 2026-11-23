-- Allow account deletion to check ingredient references after all cascades finish.
alter table public.recipe_items
  drop constraint recipe_items_ingredient_id_fkey,
  add constraint recipe_items_ingredient_id_fkey
    foreign key (ingredient_id) references public.ingredients (id)
    on delete no action deferrable initially immediate;

create function public.delete_account(p_user_id uuid, p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  signed_in_at timestamptz;
  expires_at timestamptz;
  checked_at timestamptz;
begin
  -- Serialize deletes started from different sessions of the same account.
  perform 1 from auth.users where id = p_user_id for update;
  if not found then
    return false;
  end if;

  select created_at, not_after into signed_in_at, expires_at
    from auth.sessions
    where id = p_session_id and user_id = p_user_id
    for update;

  checked_at := clock_timestamp();
  if signed_in_at is null
    or signed_in_at > checked_at
    or signed_in_at < checked_at - interval '5 minutes'
    or expires_at <= checked_at then
    return false;
  end if;

  -- Sessions, profiles, venues, and owned workspace data cascade from this row.
  set constraints public.recipe_items_ingredient_id_fkey deferred;
  delete from auth.users where id = p_user_id;
  set constraints public.recipe_items_ingredient_id_fkey immediate;
  return true;
end;
$$;

revoke all on function public.delete_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid, uuid) to service_role;
