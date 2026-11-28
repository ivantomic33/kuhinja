# TreuPlate performance capacity report

**Date:** 2026-11-28  
**Scope:** Local analysis + CPU microbenchmarks. No production data.  
**Raw bench output:** `load/results/list-scale-bench.json` (Node v24.21.0, win32)  
**Code audit:** `docs/performance/00-code-findings.md`  
**How to finish live runs:** `docs/performance/RUNBOOK.md`

---

## 1. Summary (three sentences)

With the **current** code, the recipes UI never loads more than **100** recipes (`.limit(100)` on the server), so single-user list LCP/search cannot degrade from 1 000–25 000 rows in the database—the first real failure is **correctness/completeness at >100 recipes**, not frame time. Pure CPU work (food-cost for all rows, name filter, sort) stays under the 2.5 s / 300 ms budgets even at **25 000** in-memory recipes on this host, but a **full nested JSON payload** at 25 000 is **~51.4 MB**, which would break mobile LCP if the limit were removed without pagination. **Concurrent users, Realtime, browser LCP under Slow 4G, and integrity races were not executed in this environment** (Docker/Supabase CLI/k6 blocked); scripts are ready under `load/` and `scripts/perf/`.

---

## 2. Test tables

### 2.A Microbench — in-memory list paths (measured)

Source: `npm run perf:bench` → `load/results/list-scale-bench.json`.

| Level (recipes) | Metric | Measured | Threshold | Pass? | Notes |
| --- | --- | ---: | ---: | --- | --- |
| 100 | food-cost all + insight | **0.744 ms** | 2500 ms proxy | **Yes** | `costAllWithInsightMs` |
| 100 | search on cap-100 (common) | **0.056 ms** | 300 ms | **Yes** | mirrors production filter set |
| 100 | nested list payload | **195 769 B** (~0.19 MB) | — | info | = full set at this level |
| 1 000 | food-cost all + insight | **6.160 ms** | 2500 ms | **Yes** | |
| 1 000 | search full set (common) | **0.193 ms** | 300 ms | **Yes** | if limit removed |
| 1 000 | payload all nested | **2 022 498 B** (~1.9 MB) | — | info | would ship if limit removed |
| 5 000 | food-cost all + insight | **13.731 ms** | 2500 ms | **Yes** | |
| 5 000 | search full (common) | **1.484 ms** | 300 ms | **Yes** | |
| 5 000 | payload all | **10 213 910 B** (~9.7 MB) | — | **risk** | mobile LCP almost certainly fails |
| 10 000 | food-cost all + insight | **16.074 ms** | 2500 ms | **Yes** | |
| 10 000 | sort full name | **13.791 ms** | 16 ms/frame | **borderline** | one long task if on main thread |
| 10 000 | payload all | **20 450 074 B** (~19.5 MB) | — | **fail (payload)** | |
| 25 000 | food-cost all + insight | **52.331 ms** | 2500 ms | **Yes** | |
| 25 000 | food-cost no insight | **11.253 ms** | 2500 ms | **Yes** | |
| 25 000 | search full (common) | **8.131 ms** | 300 ms | **Yes** | |
| 25 000 | sort full name | **25.826 ms** | 16 ms/frame | **No (jank)** | >1 frame; long task |
| 25 000 | page slice 50 | **0.003 ms** | 16 ms | **Yes** | |
| 25 000 | payload all nested | **51 442 981 B** (~49.1 MB) | — | **No** | unusable as SSR/hydration blob |
| 25 000 | offline recent-20 snapshot | **3 576 B** | — | **Yes** | cache stays small by design |
| any | search on **production cap 100** | **≤0.056 ms** | 300 ms | **Yes** | all levels |

**Not measured here (no browser/CDP in this run):** LCP, Slow 4G, CPU 4×, scroll FPS, JS heap after 50 opens, IndexedDB size after real seeder. Harness: `scripts/perf/browser-harness.mjs`.

### 2.B Concurrent users (k6) — not run

| Recipe level | VUs | read p95 | write p95 | error rate | pg_stat_activity | DB CPU/mem | Pass? |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| 1 000 | 10…500 | **not run** | **not run** | **not run** | **not run** | **not run** | — |
| 10 000 | 10…500 | **not run** | **not run** | **not run** | **not run** | **not run** | — |
| 25 000 | 10…500 | **not run** | **not run** | **not run** | **not run** | **not run** | — |

Thresholds (for when you run): read p95 < 500 ms, write p95 < 1 s, errors < 1%.  
Script: `load/recipes-concurrent.js` (`npm run perf:k6:recipes`).

**Blocker:** host rejected `k6`, `supabase`, and `docker` CLI; no local API to hit.

### 2.C Realtime — not run

| N sockets | connect rate | msg p95 latency | drops | Pass? |
| ---: | --- | --- | --- | --- |
| 50 / 100 / 200 / 500 | **not run** | **not run** | **not run** | — |

Script: `load/realtime.js`. Threshold: delivery p95 < 500 ms.

### 2.D Integrity under concurrency — not run (code contract only)

| Case | Expected from code/docs | Live result |
| --- | --- | --- |
| Two writers, same ingredient `version` | At most one `UPDATE … WHERE version=n` returns a row; loser → empty / `VERSION_CONFLICT` (`lib/domain/versioned-update.ts`) | **not run** |
| Checklist same `(run_id, item_id)` | Last successful write wins; no silent drop without error (`docs/offline.md`) | **not run** |

Script: `load/concurrency-integrity.js`.

---

## 3. Bottlenecks (by impact)

| # | Impact | Issue | File:lines |
| ---: | --- | --- | --- |
| 1 | **Critical (correctness)** | Recipe list hard-capped at 100 most recently updated; search cannot see the rest | `app/(app)/recipes/page.tsx` ~L23–29 |
| 2 | **Critical (if limit raised)** | List select embeds **all** `recipe_items` + ingredient price fields → ~0.19 MB/100 rows, **~51 MB/25k** (bench) | `app/(app)/recipes/page.tsx` ~L24–27; bench `payloadAllBytes` |
| 3 | **High** | Food cost (+ optional Pro insight) computed for **every** list row on the server | `app/(app)/recipes/page.tsx` ~L70–88; `lib/calc/recipe-food-cost.ts` |
| 4 | **High** | Search/filter is **client-only** substring on `name`; no `pg_trgm`/FTS | `components/recipes/RecipesWorkspace.tsx` ~L100–104 |
| 5 | **High** | Pagination is client `slice` of already-fetched rows (`WORKSPACE_PAGE_SIZE=50`), not server `range` | `components/ui/WorkspacePagination.tsx` L7–29 |
| 6 | **Medium** | `WORKSPACE_VIRTUALIZE_THRESHOLD=40` is **never used**; `DataTable` mounts all passed rows | `WorkspacePagination.tsx` L10; `components/ui/DataTable.tsx` |
| 7 | **Medium** | Recipe detail loads **all venue ingredients** with no limit | `app/(app)/recipes/[id]/page.tsx` ~L100–105 |
| 8 | **Medium** | Trebovanje loads recipes×items limit 100 + ingredients limit 200 in one shot | `app/(app)/trebovanje/page.tsx` L24–29, L96–100 |
| 9 | **Low–Medium** | Offline cache max **20 keys/user** and **20 recent recipes** — safe size, but detail keys compete with lists | `lib/offline/cache.ts` L18–19, L79, L136–162 |
| 10 | **Low (CPU)** | Full-list `localeCompare` sort becomes a **>16 ms** task by 10k–25k (bench 13.8–25.8 ms) | `DataTable.sortTableRows`; bench `sortFullMs` |

Indexes already present for list-by-recency: `idx_recipes_venue_id_updated_at` (`supabase/migrations/20261204120100_fk_and_composite_indexes.sql`). That helps the current `order + limit 100` path; it does **not** fix missing server search/pagination.

---

## 4. Recommended fixes (impact / effort)

| Priority | Fix | Why | Effort |
| --- | --- | --- | --- |
| P0 | **Server pagination** (`range`/`limit` + `count`, keyset on `(updated_at, id)`) for recipes list API used by the page | Removes silent 100-cap and payload cliff | M |
| P0 | **List select without nested items**; return `id, name, portions, selling_price, updated_at` only | Drops ~MB→KB payloads (bench: 100 nested rows already 196 KB) | S |
| P1 | **Defer food-cost** to open recipe / dialog or a slim SQL/RPC aggregate | List path does O(rows×lines) today | S–M |
| P1 | **Server search** `name ilike` + `pg_trgm` GIN on `recipes(name)` (and optional unaccent) | Client filter cannot see rows outside the fetch window | M |
| P2 | **Wire virtualization** to `WORKSPACE_VIRTUALIZE_THRESHOLD` in `DataTable` | Comment already promises it; 50-row pages still heavy on mobile stacked layout | M |
| P2 | **Detail ingredients**: only recipe lines + typeahead fetch, not full venue catalog | `[id]/page.tsx` unbounded select | M |
| P2 | **Trebovanje**: paginate stock rows; lazy-load recipes for sale | Parallel bulk joins | M |
| P3 | Split IndexedDB keys by workspace (code comment vs legacy key shape) and avoid writing full ingredient arrays on every list visit | Cache churn under 20-key cap | S |
| P3 | Keep k6 + browser harness in CI against **ephemeral** Supabase | Catch regressions on read p95 / LCP | M |

Do **not** merge limit-raising without P0 payload + pagination changes.

Suggested branch name (no merge from this pass): `perf/recipes-server-pagination`.

---

## 5. What was NOT tested (and why)

| Item | Why |
| --- | --- |
| `supabase start` / migrations apply | `supabase` and `docker` CLIs **not allowlisted** in this agent host |
| `pnpm build && pnpm start` production server under load | Could run `npm run build` in theory; without DB/auth the private `/recipes` path is not meaningful |
| Playwright LCP / Slow 4G / CPU 4× / heap / IDB size | Needs running app + Playwright; `npx` blocked; harness written but not executed |
| k6 10–500 VU matrix × 1k/10k/25k recipes | `k6` CLI blocked; no local Supabase URL |
| Realtime 50–500 websockets | same |
| Live version-conflict / checklist races | same; only static review of `versioned-update` + `docs/offline.md` |
| Supabase **hosted plan** connection/Realtime limits | Out of scope (would need staging project + plan docs); local Docker ≠ production pooler |
| Real multi-tenant RLS cost at 25k×N workspaces | Seed script creates one venue owner path; cross-tenant isolation is covered by SQL RLS tests, not load |
| Real user mobile networks / devices | Lab only |

---

## 6. Capacity statement (honest)

| Question | Answer with evidence |
| --- | --- |
| How many recipes until the **current UI** breaks? | **Functionally at 101+** in DB: UI still shows ≤100 (`limit(100)`). Performance of that 100-row path is fine on CPU bench (search ≪ 300 ms, cost ≪ 2.5 s). |
| How many recipes until **CPU calc/search** alone fails budgets? | **>25 000** still passes 300 ms search and 2.5 s cost proxy on this machine (`list-scale-bench.json`). Sort jank starts ~**10 000**. |
| How many recipes until **payload** would fail mobile LCP if uncapped? | **~5 000+** nested list payloads (≈9.7 MB at 5k; ≈49 MB at 25k). |
| How many **concurrent users**? | **Unknown — not measured.** Use `load/recipes-concurrent.js` on local/staging. |
| First point of failure overall | **Silent list truncation at 100**, then **payload size** if that cap is lifted without redesign; concurrency limits TBD. |

---

## 7. Deliverables added this pass

| Path | Role |
| --- | --- |
| `docs/performance/00-code-findings.md` | Pre-test code map |
| `docs/performance/RUNBOOK.md` | Step-by-step local/staging execution |
| `docs/performance/REPORT.md` | This report |
| `scripts/perf/seed.mjs` | Resettable seed 100…25 000 recipes, 200 ingredients, 300 users |
| `scripts/perf/browser-harness.mjs` | Playwright mobile + Slow 4G metrics |
| `load/recipes-concurrent.js` | k6 realistic R/W workload |
| `load/realtime.js` | k6 Realtime fan-out |
| `load/concurrency-integrity.js` | k6 version lock + checklist race |
| `lib/perf/list-scale.bench.test.ts` | Measured microbench |
| `load/results/list-scale-bench.json` | **Raw numbers** cited above |
| `package.json` scripts | `perf:bench`, `perf:seed`, `perf:browser`, `perf:k6:*` |

Existing `load/dashboard.js` remains for staging HTML read smoke tests.

---

## 8. Next action for a complete A–D matrix

On a machine with Docker + Supabase CLI + k6 + Playwright:

```bash
supabase start
# fill .env.local from supabase status
pnpm build && pnpm start
npm run perf:seed -- --reset --recipes 1000 --users 300
npm run perf:bench
npm run perf:browser -- --recipes 1000
K6_VUS=50 K6_RECIPE_LEVEL=1000 npm run perf:k6:recipes
K6_REALTIME_VUS=100 npm run perf:k6:realtime
npm run perf:k6:integrity
```

Replace every **not run** cell in §2 with values copied **only** from `load/results/*`.
