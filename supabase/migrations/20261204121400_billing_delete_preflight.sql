-- Authorize the external Stripe side effect while holding the account billing lock.
create function public.authorize_billing_account_deletion(
  p_user_id uuid, p_session_id uuid, p_token uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.billing_locks set authorized_session_id = p_session_id
    where key = 'customer:' || p_user_id::text and token = p_token and expires_at > clock_timestamp()
    and exists (
      select 1 from auth.sessions
      where id = p_session_id and user_id = p_user_id
        and created_at between clock_timestamp() - interval '5 minutes' and clock_timestamp()
        and (not_after is null or not_after > clock_timestamp())
    );
  return found;
end
$$;

-- A successfully authorized deletion can complete after the original five-minute
-- sign-in window, while the verified session and the exclusive operation remain valid.
create function public.delete_billing_account(
  p_user_id uuid, p_session_id uuid, p_token uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform from public.billing_locks
    where key = 'customer:' || p_user_id::text and token = p_token
      and authorized_session_id = p_session_id and expires_at > clock_timestamp() for update;
  if not found then return false; end if;

  perform from auth.users where id = p_user_id for update;
  if not found then return false; end if;
  perform from auth.sessions where id = p_session_id and user_id = p_user_id
    and (not_after is null or not_after > clock_timestamp()) for update;
  if not found then return false; end if;

  set constraints public.recipe_items_ingredient_id_fkey deferred;
  delete from auth.users where id = p_user_id;
  set constraints public.recipe_items_ingredient_id_fkey immediate;
  return true;
end
$$;

revoke all on function public.authorize_billing_account_deletion(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_billing_account(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.authorize_billing_account_deletion(uuid, uuid, uuid) to service_role;
grant execute on function public.delete_billing_account(uuid, uuid, uuid) to service_role;
