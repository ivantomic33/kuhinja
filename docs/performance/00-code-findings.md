# Pre-test code findings (TreuPlate)

Read-only audit before any load run. Paths are relative to the repo root.

## 1. Recipe list load path

| Piece | Location | Behavior |
| --- | --- | --- |
| Server page | `app/(app)/recipes/page.tsx` L23–29 | `from("recipes").select(... recipe_items + ingredients ...).order("updated_at", { ascending: false }).limit(100)` |
| Ingredients on list | same file L30–34 | `.limit(100)` only |
| Client workspace | `components/recipes/RecipesWorkspace.tsx` | Hydrated TanStack Query list; no further server fetch for paging |
| Client page size | `components/ui/WorkspacePagination.tsx` L7 | `WORKSPACE_PAGE_SIZE = 50` — **client slice only** |
| Virtualization | `WorkspacePagination.tsx` L10 | `WORKSPACE_VIRTUALIZE_THRESHOLD = 40` is **exported but unused**; `DataTable` mounts all `rows` passed in |

**Implication:** The UI never sees more than the 100 most recently updated recipes. Search/filter cannot find older recipes. “25 000 recipes” cannot be exercised through the current list API without code changes.

## 2. Search and filtering

| Piece | Location | Behavior |
| --- | --- | --- |
| Search input | `RecipesWorkspace.tsx` L239–250 | Controlled via `startTransition` + local `query` state |
| Filter | L100–104 | `recipes.filter((row) => row.name.toLowerCase().includes(q))` — **in-browser, name only** |
| Sort | `DataTable.sortTableRows` | Full in-memory copy + sort of filtered set |
| DB text search | migrations | **No** `pg_trgm` / FTS index on `recipes.name` |

## 3. Portion / food-cost calculation

| Piece | Location | Behavior |
| --- | --- | --- |
| Pure calc | `lib/calc/recipe-food-cost.ts` | `getRecipeFoodCost(lines, sellingPrice, includeInsight)` |
| List page | `app/(app)/recipes/page.tsx` L70–88 | Runs `getRecipeFoodCost` **for every loaded recipe** (up to 100), including Pro insight payload when plan allows |
| Detail page | `app/(app)/recipes/[id]/page.tsx` | Loads **all venue ingredients** (no `.limit`) + recipe items; calculator computes for the open recipe |
| Dialog | `RecipeFoodCostDialog` | Uses precomputed `foodCost` from the list row |

**Implication:** Cost is not deferred to “open only” on the list path. Nested `recipe_items` + ingredient join inflates the list payload.

## 4. Offline cache (`lib/offline/cache.ts`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `OFFLINE_CACHE_DB_NAME` | `treuplate-cache` | idb-keyval store |
| `OFFLINE_CACHE_TTL_MS` | 7 days | Timed payloads expire |
| `OFFLINE_CACHE_MAX_KEYS_PER_USER` | 20 | Soft cap on distinct keys per user |
| `RECENT_RECIPE_LIMIT` | 20 | Merged recent-recipe list size |

Keys are scoped `${userId}:…` (comment also mentions workspace; list keys still use legacy suffixes). Detail keys `recipe:{id}` and `template:{id}` compete with list keys under the 20-key cap. Seeder on list/trebovanje pages writes the **server-capped** snapshots (≤100 recipes / ≤200 ingredients on trebovanje).

## 5. Trebovanje (stock) queries

`app/(app)/trebovanje/page.tsx`:

- Recipes: nested items + ingredients, `.limit(100)` (L24–29)
- Ingredients: `.limit(200)` (L96–100)
- Venue + nested `stock_levels` for first venue only
- Offline seeder deferred in `Suspense`

## 6. SQL schema / indexes / RLS (migrations)

- Core tables + RLS: `supabase/migrations/20250322000000_initial_schema.sql` (`recipes`, `recipe_items`, `ingredients`, venue ownership policies)
- List composites: `idx_recipes_venue_id_updated_at`, `idx_ingredients_venue_id_updated_at` in `20261204120100_fk_and_composite_indexes.sql`
- Optimistic lock: `version` + `bump_row_version` trigger on ingredients/recipes — `20261204120300_optimistic_locking_version.sql`
- Checklist item key `(run_id, item_id)` last-write-wins — documented in `docs/offline.md`
- Workspaces / multi-tenant RLS later migrations (`20261205120*`)
- **No** name search index; **no** range/cursor pagination helpers in app queries

## 7. Concurrency semantics (for test D)

- Ingredient/recipe price edits: `lib/domain/versioned-update.ts` — `UPDATE … WHERE version = n`; empty row → `VERSION_CONFLICT` (not silent last-write-wins)
- Checklist: last successfully applied write per `(run_id, item_id)` wins (`docs/offline.md`)
- Restock + price history: RPC path (network required)

## 8. Existing load script

`load/dashboard.js` — k6 ramping VUs against staging HTML reads (`/dashboard`, `/ingredients`, `/recipes`) after Supabase password grant. Does **not** cover recipe pagination APIs, writes, Realtime, or integrity.

## 9. Environment blockers noted at audit time

This agent host allowlists only certain `npm` scripts. Direct `supabase`, `docker`, `k6`, and `pnpm` CLI invocations were rejected. Full A/B/C/D against a live local stack must be run outside this sandbox (scripts are provided under `scripts/perf/` and `load/`).
