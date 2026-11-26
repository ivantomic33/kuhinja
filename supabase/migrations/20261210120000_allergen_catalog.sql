-- Normalize the 14 regulated allergens and reference the catalogue from
-- ingredient_allergens so the stored code set cannot drift from the UI.

create table if not exists public.allergens (
  code text primary key,
  label text not null,
  regulation_order smallint not null unique
    constraint allergens_regulation_order_check
    check (regulation_order between 1 and 14)
);

alter table public.allergens enable row level security;
revoke all on table public.allergens from public, anon, authenticated;
grant select on table public.allergens to authenticated;

drop policy if exists allergens_select_authenticated on public.allergens;
create policy allergens_select_authenticated
  on public.allergens
  for select
  to authenticated
  using (true);

insert into public.allergens (code, label, regulation_order)
values
  ('gluten', 'Žitarice koje sadrže gluten', 1),
  ('rakovi', 'Rakovi', 2),
  ('jaja', 'Jaja', 3),
  ('riba', 'Riba', 4),
  ('kikiriki', 'Kikiriki', 5),
  ('soja', 'Soja', 6),
  ('mleko', 'Mleko', 7),
  ('orasasti_plodovi', 'Orašasti plodovi', 8),
  ('celer', 'Celer', 9),
  ('senf', 'Senf', 10),
  ('susam', 'Susam', 11),
  ('sumpor_dioksid', 'Sumpor-dioksid i sulfiti', 12),
  ('lupina', 'Lupina', 13),
  ('mekusci', 'Mekušci', 14)
on conflict (code) do update
set label = excluded.label,
    regulation_order = excluded.regulation_order;

alter table public.ingredient_allergens
  drop constraint if exists ingredient_allergens_code_check;

alter table public.ingredient_allergens
  drop constraint if exists ingredient_allergens_allergen_code_fkey;

alter table public.ingredient_allergens
  add constraint ingredient_allergens_allergen_code_fkey
  foreign key (allergen_code) references public.allergens (code)
  on update cascade on delete restrict;
