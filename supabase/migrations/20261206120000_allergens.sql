-- =============================================================================
-- P8 F2: EU 1169/2011 allergen matrix for ingredients + recipe aggregation
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Feature gate: workspace owner plan (Pro / Advanced)
-- Uses billing_entitlement_row (same source as get_entitlements), not the
-- auth-bound RPC, so RLS and SECURITY DEFINER paths can evaluate it.
-- ---------------------------------------------------------------------------
create or replace function public.workspace_has_feature(
  p_workspace_id uuid,
  p_feature text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan text;
  v_pro_plus boolean;
begin
  if p_workspace_id is null or p_feature is null or length(trim(p_feature)) = 0 then
    return false;
  end if;

  select wm.user_id into v_owner
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.role = 'owner'
  order by wm.created_at asc, wm.user_id
  limit 1;

  if v_owner is null then
    return false;
  end if;

  v_plan := coalesce((select plan from public.billing_entitlement_row(v_owner)), 'free');
  v_pro_plus := v_plan in ('pro', 'advanced');

  return case p_feature
    when 'allergens' then v_pro_plus
    when 'manageSubscription' then v_plan <> 'free'
    when 'schedule' then v_plan <> 'free'
    when 'priceHistory' then v_pro_plus
    when 'foodCostVariance' then v_pro_plus
    when 'basicReports' then v_pro_plus
    when 'prepListPdf' then v_plan <> 'free'
    when 'stockWriteOff' then v_plan <> 'free'
    when 'stockRestock' then v_plan <> 'free'
    when 'stockInventory' then v_pro_plus
    when 'teamMembers' then v_plan <> 'free'
    else false
  end;
end;
$$;

revoke all on function public.workspace_has_feature(uuid, text) from public;
grant execute on function public.workspace_has_feature(uuid, text) to authenticated;
-- anon may call only through published_recipe_allergens (separate migration)

-- Keep get_entitlements feature map in sync (allergens = Pro+)
create or replace function public.get_entitlements(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  entitlement record;
  effective text;
  pro_plus boolean;
  member_limit integer;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select * into entitlement from public.billing_entitlement_row(p_user_id);
  effective := coalesce(entitlement.plan, 'free');
  pro_plus := effective in ('pro', 'advanced');
  member_limit := case effective
    when 'advanced' then 10
    when 'pro' then 10
    when 'starter' then 3
    else 1
  end;

  return jsonb_build_object(
    'plan', effective,
    'status', (entitlement.subscription).status,
    'trial_ends_at', (entitlement.subscription).trial_end,
    'grace', coalesce(entitlement.grace, false),
    'features', jsonb_build_object(
      'manageSubscription', effective <> 'free',
      'schedule', effective <> 'free',
      'priceHistory', pro_plus,
      'foodCostVariance', pro_plus,
      'basicReports', pro_plus,
      'prepListPdf', effective <> 'free',
      'stockWriteOff', effective <> 'free',
      'stockRestock', effective <> 'free',
      'stockInventory', pro_plus,
      'teamMembers', effective <> 'free',
      'allergens', pro_plus
    ),
    'limits', jsonb_build_object(
      'recipes', case when effective = 'free' then 5 end,
      'ingredients', case when effective = 'free' then 20 end,
      'templates', case effective when 'free' then 1 when 'starter' then 3 end,
      'timers', case when not pro_plus then 2 end,
      'stockItems', case effective when 'free' then 10 when 'starter' then 40 end,
      'locations', case when effective = 'advanced' then null else 1 end,
      'members', member_limit
    )
  );
end;
$$;

revoke all on function public.get_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.get_entitlements(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ingredient_allergens
-- ---------------------------------------------------------------------------
create table if not exists public.ingredient_allergens (
  ingredient_id uuid not null
    references public.ingredients (id) on delete cascade,
  allergen_code text not null,
  presence text not null default 'contains',
  primary key (ingredient_id, allergen_code),
  constraint ingredient_allergens_code_check check (
    allergen_code in (
      'gluten',
      'rakovi',
      'jaja',
      'riba',
      'kikiriki',
      'soja',
      'mleko',
      'orasasti_plodovi',
      'celer',
      'senf',
      'susam',
      'sumpor_dioksid',
      'lupina',
      'mekusci'
    )
  ),
  constraint ingredient_allergens_presence_check check (
    presence in ('contains', 'trace')
  )
);

create index if not exists idx_ingredient_allergens_code
  on public.ingredient_allergens (allergen_code, ingredient_id);

alter table public.ingredient_allergens enable row level security;

revoke all on table public.ingredient_allergens from anon, authenticated;
grant select, insert, update, delete on table public.ingredient_allergens to authenticated;

drop policy if exists ingredient_allergens_select_member on public.ingredient_allergens;
drop policy if exists ingredient_allergens_insert_chef on public.ingredient_allergens;
drop policy if exists ingredient_allergens_update_chef on public.ingredient_allergens;
drop policy if exists ingredient_allergens_delete_chef on public.ingredient_allergens;

-- Select: cook+ membership AND workspace owner has allergens feature
create policy ingredient_allergens_select_member
  on public.ingredient_allergens
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_member(i.workspace_id, 'cook')
        and public.workspace_has_feature(i.workspace_id, 'allergens')
    )
  );

create policy ingredient_allergens_insert_chef
  on public.ingredient_allergens
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_member(i.workspace_id, 'chef')
        and public.workspace_has_feature(i.workspace_id, 'allergens')
    )
  );

create policy ingredient_allergens_update_chef
  on public.ingredient_allergens
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_member(i.workspace_id, 'chef')
        and public.workspace_has_feature(i.workspace_id, 'allergens')
    )
  )
  with check (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_member(i.workspace_id, 'chef')
        and public.workspace_has_feature(i.workspace_id, 'allergens')
    )
  );

create policy ingredient_allergens_delete_chef
  on public.ingredient_allergens
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_id
        and public.is_member(i.workspace_id, 'chef')
        and public.workspace_has_feature(i.workspace_id, 'allergens')
    )
  );

-- ---------------------------------------------------------------------------
-- recipe_allergens view (security_invoker — requires PostgreSQL 15+)
-- Aggregates via recipe_items (this schema name; not recipe_ingredients).
-- ---------------------------------------------------------------------------
drop view if exists public.recipe_allergens;

create view public.recipe_allergens
with (security_invoker = true)
as
select
  r.workspace_id,
  ri.recipe_id,
  ia.allergen_code,
  case
    when bool_or(ia.presence = 'contains') then 'contains'
    else 'trace'
  end as presence
from public.recipes r
join public.recipe_items ri on ri.recipe_id = r.id
join public.ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id
group by r.workspace_id, ri.recipe_id, ia.allergen_code;

revoke all on table public.recipe_allergens from anon, public;
grant select on table public.recipe_allergens to authenticated;

-- ---------------------------------------------------------------------------
-- set_ingredient_allergens RPC — replace set in one transaction
-- ---------------------------------------------------------------------------
create or replace function public.set_ingredient_allergens(
  p_ingredient_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace uuid;
  v_item jsonb;
  v_code text;
  v_presence text;
  v_best jsonb := '{}'::jsonb;
begin
  if p_ingredient_id is null then
    raise exception 'INGREDIENT_REQUIRED' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) > 14 then
    raise exception 'TOO_MANY_ITEMS' using errcode = '22023';
  end if;

  select i.workspace_id into v_workspace
  from public.ingredients i
  where i.id = p_ingredient_id;

  if v_workspace is null then
    raise exception 'INGREDIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_member(v_workspace, 'chef') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if not public.workspace_has_feature(v_workspace, 'allergens') then
    raise exception 'UPGRADE_REQUIRED' using errcode = 'P0001';
  end if;

  -- Dedupe: contains wins over trace for the same code
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'INVALID_ITEM' using errcode = '22023';
    end if;

    v_code := v_item ->> 'code';
    v_presence := coalesce(v_item ->> 'presence', 'contains');

    if v_code is null or v_code not in (
      'gluten', 'rakovi', 'jaja', 'riba', 'kikiriki', 'soja', 'mleko',
      'orasasti_plodovi', 'celer', 'senf', 'susam', 'sumpor_dioksid',
      'lupina', 'mekusci'
    ) then
      raise exception 'INVALID_ALLERGEN_CODE' using errcode = '22023';
    end if;

    if v_presence not in ('contains', 'trace') then
      raise exception 'INVALID_PRESENCE' using errcode = '22023';
    end if;

    if v_best ? v_code then
      if (v_best ->> v_code) = 'trace' and v_presence = 'contains' then
        v_best := jsonb_set(v_best, array[v_code], to_jsonb(v_presence));
      end if;
    else
      v_best := v_best || jsonb_build_object(v_code, v_presence);
    end if;
  end loop;

  delete from public.ingredient_allergens
  where ingredient_id = p_ingredient_id;

  insert into public.ingredient_allergens (ingredient_id, allergen_code, presence)
  select
    p_ingredient_id,
    key,
    value #>> '{}'
  from jsonb_each(v_best);
end;
$$;

revoke all on function public.set_ingredient_allergens(uuid, jsonb) from public;
grant execute on function public.set_ingredient_allergens(uuid, jsonb) to authenticated;
