# Server-side recipe pagination & search — plan

**Branch target:** `perf/server-side-recipes`  
**Date:** 2026-03-28  
**Status:** implementation plan (behavior changes are intentional per task brief)

## 1. Current queries

### Recipes list (`app/(app)/recipes/page.tsx`)

```ts
supabase.from("recipes")
  .select("id, name, venue_id, portions, selling_price, description, recipe_items ( id, quantity, ingredients ( name, unit, price, waste_percent ) )")
  .order("updated_at", { ascending: false })
  .limit(100)

supabase.from("ingredients")
  .select("id, venue_id, name, unit, price, waste_percent, notes")
  .order("name", { ascending: true })
  .limit(100)
```

- Food cost: `getRecipeFoodCost` for every loaded row (≤100) on the server.
- Client (`RecipesWorkspace`): `name.includes(q)` filter, in-memory sort, `WORKSPACE_PAGE_SIZE = 50` slice.
- Footer “X od Y” uses filtered length vs loaded length (never true DB total).

### Trebovanje (`app/(app)/trebovanje/page.tsx`)

```ts
recipes + nested recipe_items/ingredients .order(name).limit(100)
ingredients .limit(200)
```

Sale modal needs nested items for selected recipes; silent cut-off at 100.

### Indexes today

- `idx_recipes_venue_id_updated_at` `(venue_id, updated_at desc)`
- `recipes_workspace_id_name_idx` `(workspace_id, name)`
- **No** `pg_trgm` / FTS on `recipes.name`
- Optimistic lock `version` + trigger — **must stay**

### Offline

- `RECENT_RECIPE_LIMIT = 20`, TTL 7 days, max 20 keys/user
- Seeder writes the server-capped list snapshot
- Cleared on logout via `clearClientUserState` → `clearOfflineCache*`

## 2. Proposed queries

### List page (flat, paged)

```ts
supabase.from("recipes")
  .select("id, name, venue_id, portions, selling_price, description, updated_at", { count: "exact" })
  .eq("venue_id", venueId)
  .ilike("name", `%${escapeIlike(q)}%`)   // only when q non-empty
  .order(sortColumn, { ascending })
  .range(from, to)                        // pageSize default 25 (max 50)
```

- Always filter `venue_id` (RLS still applies via user client).
- **No nested `recipe_items` on the list select.**

### Food cost for current page only (second query)

```ts
supabase.from("recipe_items")
  .select("id, recipe_id, quantity, ingredients ( name, unit, price, waste_percent )")
  .in("recipe_id", pageIds)
  .limit(RECIPE_ITEMS_BATCH_CAP) // safety cap, e.g. 2000
```

Compute `getRecipeFoodCost` only for rows on the page. Detail/open path unchanged (`/recipes/[id]`).

### Trebovanje

```ts
recipes + items .order(name).limit(TREBOVANJE_RECIPES_CAP) // 500
ingredients .limit(TREBOVANJE_INGREDIENTS_CAP)             // 1000
```

Return `truncated: true` when `rows.length === CAP`; UI shows a warning (no silent cut-off).

## 3. Schema changes (new migration)

File: `supabase/migrations/20260328120000_recipes_name_trgm.sql`

```sql
create extension if not exists pg_trgm;

create index if not exists idx_recipes_name_trgm
  on public.recipes using gin (name gin_trgm_ops);

-- Sort helpers already partially covered; ensure venue+name for ILIKE+filter
create index if not exists idx_recipes_venue_id_name
  on public.recipes (venue_id, name);

create index if not exists idx_recipes_venue_id_portions
  on public.recipes (venue_id, portions);

create index if not exists idx_recipes_venue_id_selling_price
  on public.recipes (venue_id, selling_price);
```

No RLS policy changes. No `version` / trigger changes.

## 4. API / server actions / client

| Piece | Change |
| --- | --- |
| `lib/recipes/list-params.ts` | Pure helpers: page size clamp, ILIKE escape, range, pageCount |
| `lib/recipes/list-server.ts` | `fetchRecipeListPage(supabase, params)` + attach costs |
| `lib/recipes/actions.ts` | `listRecipesAction` (user client, Zod input, RLS) |
| `lib/query/keys.ts` | `recipesList(venueId, { q, page, pageSize, sort })` |
| `app/(app)/recipes/page.tsx` | SSR first page only; seed ≤20 recent for offline |
| `RecipesWorkspace.tsx` | Debounced search 300ms; TanStack Query key = params; server page controls; footer uses `totalCount` |
| `WorkspacePagination` | Driven by server `page` / `pageCount` |
| `DataTable` | Optional virtualization when `rows.length > 50` (page size 25 → usually off) |
| `trebovanje/page.tsx` | Caps + truncated flag into `StockWorkspace` / sale UI |
| Offline | Keep 20 recent / 7d TTL; do **not** cache full catalog |

### Sort columns (server)

`name` | `portions` | `selling_price` | `updated_at` (default `updated_at desc`).  
Food-cost % stays display-only (no server sort) — same as today (no `compare` on cost column).

### Category filter

**Not implemented:** `recipes` has no `category` column. Adding one would be a product/schema change outside this perf fix. Documented as out of scope.

## 5. Behavior changes (intentional)

1. Search finds recipes beyond the old 100-row window.
2. “X od Y” uses exact `count` from Postgres.
3. Food-cost insight on the list is only for the current page (open recipe detail still full calc).
4. Free-plan `UsageStrip` uses `totalCount`, not page length.
5. Trebovanje may show a truncation warning at 500 recipes / 1000 ingredients instead of silent 100/200.

No change to optimistic locking, RLS, or offline checklist sync semantics.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| ILIKE `%…%` still sequential on huge tenants without trgm | `pg_trgm` GIN index |
| Double query (list + items) latency | Page ≤50; items capped; parallel where possible |
| Stale search responses | Query key includes `q`; TanStack drops outdated |
| Special chars `%, _, \, '` break ILIKE | `escapeIlikePattern` + unit tests |
| Create/delete cache drift | Invalidate `recipesList` prefix on mutate |
| Integration tests need local Supabase | SQL test + Vitest unit; live seed when Docker available |
| Branch create blocked in agent shell | Implement on working tree; human creates/pushes branch |

## 7. Tests

- Unit: empty list, last page, no results, special chars + diacritics (`čćšžđ`, `%_'"\\`)
- Integration SQL: 1000 recipes × 2 venues, RLS isolation, count, non-overlapping pages
- `pnpm lint`, `pnpm test`, `pnpm build`
- Perf measurement **after** green tests only (`docs/performance/RUNBOOK.md`)

## 8. Rollout order

1. Migration + pure list helpers + unit tests  
2. Server fetch + action  
3. Recipes page + workspace  
4. Trebovanje caps + warning  
5. Virtualization guard  
6. Lint/test/build  
7. Measure (seed → browser harness → k6) → `REPORT.md`
