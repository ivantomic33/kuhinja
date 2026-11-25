-- The primary venue query orders the venues visible to the owner by creation time.
create index if not exists idx_venues_owner_id_created_at
  on public.venues (owner_id, created_at);
