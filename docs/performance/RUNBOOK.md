# Performance test runbook (local / staging only)

Never use production URLs, production service keys, or real customer data.

## 0. One-time tools

- Node 22, pnpm 9.15.0
- Docker + Supabase CLI
- k6 (`k6 version`)
- Playwright Chromium: `npx playwright install chromium`

## 1. Local stack

```bash
supabase start
# copy API URL + anon + service_role into .env.local
pnpm build && pnpm start
```

## 2. Seed levels

```bash
export PERF_SEED_PASSWORD='…shared-test-password…'
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY=…local-service-role…

npm run perf:seed -- --reset --recipes 100 --users 300
npm run perf:seed -- --reset --recipes 1000 --users 300
npm run perf:seed -- --reset --recipes 5000 --users 300
npm run perf:seed -- --reset --recipes 10000 --users 300
npm run perf:seed -- --reset --recipes 25000 --users 300
```

Between levels always pass `--reset`.

## 3. Microbench (no DB)

```bash
npm run perf:bench
# → load/results/list-scale-bench.json
```

## 4. Browser (A)

```bash
export PERF_TEST_EMAIL=perf-owner@treuplate.local
export PERF_TEST_PASSWORD=$PERF_SEED_PASSWORD
export PERF_BASE_URL=http://127.0.0.1:3000
npm run perf:browser -- --recipes 1000
```

## 5. k6 concurrent users (B)

```bash
export K6_SUPABASE_URL=http://127.0.0.1:54321
export K6_SUPABASE_ANON_KEY=…
export K6_TEST_EMAIL=perf-owner@treuplate.local
export K6_TEST_PASSWORD=$PERF_SEED_PASSWORD
export K6_VENUE_ID=…
export K6_WRITE_INGREDIENT_ID=…
export K6_RECIPE_LEVEL=1000

for vus in 10 50 100 250 500; do
  K6_VUS=$vus npm run perf:k6:recipes
done
```

During the run, in another shell:

```sql
select count(*) from pg_stat_activity where datname = 'postgres';
```

## 6. Realtime (C)

```bash
K6_REALTIME_VUS=50 npm run perf:k6:realtime
K6_REALTIME_VUS=100 npm run perf:k6:realtime
K6_REALTIME_VUS=200 npm run perf:k6:realtime
K6_REALTIME_VUS=500 npm run perf:k6:realtime
```

## 7. Integrity (D)

```bash
export K6_INGREDIENT_ID=…
export K6_CHECKLIST_RUN_ID=…   # optional
export K6_CHECKLIST_ITEM_ID=…  # optional
npm run perf:k6:integrity
```

Then SQL-check final `ingredients.version` and checklist row.

## 8. Artifacts

All machine-readable outputs go under `load/results/`. Paste numbers into `docs/performance/REPORT.md` only from those files.
