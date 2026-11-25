-- =============================================================================
-- P8 F2 optional: public allergen display flags + SECURITY DEFINER reader
-- =============================================================================

alter table public.recipes
  add column if not exists published boolean not null default false;

alter table public.recipes
  add column if not exists show_allergens_public boolean not null default false;

comment on column public.recipes.published is
  'When true, recipe may be shown on a public page (owner opt-in).';
comment on column public.recipes.show_allergens_public is
  'When true with published + Pro allergens feature, public allergen list is allowed.';

-- Public reader: no service role from the app; does not expose the view to anon.
-- Aggregates from base tables inside SECURITY DEFINER (view is security_invoker
-- and would hide rows from anon via RLS).
create or replace function public.published_recipe_allergens(p_recipe_id uuid)
returns table (
  allergen_code text,
  presence text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_published boolean;
  v_show boolean;
begin
  if p_recipe_id is null then
    return;
  end if;

  select r.workspace_id, r.published, r.show_allergens_public
  into v_workspace, v_published, v_show
  from public.recipes r
  where r.id = p_recipe_id;

  if v_workspace is null then
    return;
  end if;

  if not coalesce(v_published, false) then
    return;
  end if;

  if not coalesce(v_show, false) then
    return;
  end if;

  if not public.workspace_has_feature(v_workspace, 'allergens') then
    return;
  end if;

  return query
  select
    ia.allergen_code,
    case
      when bool_or(ia.presence = 'contains') then 'contains'
      else 'trace'
    end as presence
  from public.recipe_items ri
  join public.ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id
  where ri.recipe_id = p_recipe_id
  group by ia.allergen_code
  order by ia.allergen_code;
end;
$$;

revoke all on function public.published_recipe_allergens(uuid) from public;
grant execute on function public.published_recipe_allergens(uuid) to anon, authenticated;
