-- =============================================================================
-- Invite lookup / accept helpers (invitee is not yet a workspace member)
-- =============================================================================

create or replace function public.lookup_workspace_invite(p_token_hash text)
returns table (
  id uuid,
  workspace_id uuid,
  email text,
  role text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_token_hash is null or length(p_token_hash) < 32 then
    return;
  end if;

  return query
  select i.id, i.workspace_id, i.email, i.role, i.expires_at, i.accepted_at
  from public.workspace_invites i
  where i.token_hash = p_token_hash
  limit 1;
end;
$$;

revoke all on function public.lookup_workspace_invite(text) from public;
grant execute on function public.lookup_workspace_invite(text) to authenticated;

-- Atomic accept: claim invite + insert membership in one definer transaction.
create or replace function public.accept_workspace_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.workspace_invites%rowtype;
  v_limit integer;
  v_seats integer;
  v_owner uuid;
  v_plan text;
begin
  if v_uid is null then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null or v_email = '' then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  select * into v_invite
  from public.workspace_invites i
  where i.token_hash = p_token_hash
  for update;

  if not found
     or v_invite.accepted_at is not null
     or v_invite.expires_at <= now() then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  if lower(trim(v_invite.email)) is distinct from v_email then
    raise exception 'INVITE_EMAIL_MISMATCH' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = v_invite.workspace_id and wm.user_id = v_uid
  ) then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  select wm.user_id into v_owner
  from public.workspace_members wm
  where wm.workspace_id = v_invite.workspace_id and wm.role = 'owner'
  order by wm.created_at
  limit 1;

  v_plan := coalesce((select plan from public.billing_entitlement_row(v_owner)), 'free');
  v_limit := case v_plan
    when 'pro' then 10
    when 'starter' then 3
    else 1
  end;

  v_seats := public.workspace_member_seat_count(v_invite.workspace_id);
  if v_seats >= v_limit then
    raise exception 'MEMBER_LIMIT' using errcode = 'P0001';
  end if;

  update public.workspace_invites
  set accepted_at = now(), accepted_by = v_uid
  where id = v_invite.id
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, v_uid, v_invite.role);

  return v_invite.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(text) from public;
grant execute on function public.accept_workspace_invite(text) to authenticated;
