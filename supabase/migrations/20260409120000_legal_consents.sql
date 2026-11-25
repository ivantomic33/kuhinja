-- =============================================================================
-- legal_consents: record accepted legal document versions per user
-- RLS: users may SELECT own rows; INSERT own rows (server action / authenticated)
-- No UPDATE/DELETE for clients — audit trail stays append-only from the app side
-- =============================================================================

create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document text not null
    constraint legal_consents_document_check
      check (document in ('terms', 'privacy', 'refund', 'marketing')),
  version text not null
    constraint legal_consents_version_not_blank check (char_length(trim(version)) > 0),
  accepted_at timestamptz not null default now(),
  constraint legal_consents_user_document_version_key unique (user_id, document, version)
);

create index if not exists legal_consents_user_id_idx
  on public.legal_consents (user_id);

create index if not exists legal_consents_user_document_accepted_idx
  on public.legal_consents (user_id, document, accepted_at desc);

alter table public.legal_consents enable row level security;
alter table public.legal_consents force row level security;

revoke all on table public.legal_consents from anon, authenticated;
grant select on table public.legal_consents to authenticated;
grant insert on table public.legal_consents to authenticated;

create policy "Users can select own legal consents"
  on public.legal_consents
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own legal consents"
  on public.legal_consents
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Signup may complete without a lasting session (email confirm). Store consent
-- versions on auth user metadata; this trigger writes audit rows as definer.
create or replace function public.record_signup_legal_consents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms text;
  v_privacy text;
  v_marketing text;
begin
  v_terms := nullif(trim(coalesce(new.raw_user_meta_data ->> 'legal_terms_version', '')), '');
  v_privacy := nullif(trim(coalesce(new.raw_user_meta_data ->> 'legal_privacy_version', '')), '');
  v_marketing := nullif(trim(coalesce(new.raw_user_meta_data ->> 'legal_marketing_version', '')), '');

  if v_terms is not null then
    insert into public.legal_consents (user_id, document, version)
    values (new.id, 'terms', v_terms)
    on conflict (user_id, document, version) do nothing;
  end if;

  if v_privacy is not null then
    insert into public.legal_consents (user_id, document, version)
    values (new.id, 'privacy', v_privacy)
    on conflict (user_id, document, version) do nothing;
  end if;

  if v_marketing is not null then
    insert into public.legal_consents (user_id, document, version)
    values (new.id, 'marketing', v_marketing)
    on conflict (user_id, document, version) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_legal_consents on auth.users;

create trigger on_auth_user_legal_consents
  after insert on auth.users
  for each row
  execute function public.record_signup_legal_consents();
