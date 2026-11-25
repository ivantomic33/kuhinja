# Food cost alerts (P8 F3)

## Definitions

**Trošak porcije (portion cost)**  
`sum(line costs) / recipe.portions`

Each line cost matches `lib/calc/foodcost.ts`:

- Normalize quantity into the price unit (g↔kg, ml↔l; `kom`/`pak` only with the same family).
- `effectivePrice = price / (1 - waste_percent / 100)`
- `lineCost = normalizedQuantity × effectivePrice`

Recipe rows store quantity in the ingredient’s unit (same as the app loaders), so stored recipes usually need no conversion. SQL helpers still mirror TypeScript conversion for parity tests.

**Food cost %**  
`portion_cost / selling_price_net × 100`

- If `selling_price_net` is null or ≤ 0, food cost % is **not** computed and **no alert** is created.
- Target default: `recipes.target_food_cost_pct = 30`.

### VAT decision

`target_food_cost_pct` is evaluated against **net selling price (without VAT)**.  
Column: `recipes.selling_price_net`.  
Existing `selling_price` remains for UI/legacy; migration backfills `selling_price_net` from `selling_price` where `selling_price > 0`. Owner can later store gross separately if needed.

## Snapshot storage: table vs materialized view

**Choice: ordinary table `recipe_cost_snapshot`.**

Reasons:

1. RLS is straightforward (`is_member(workspace_id, 'cook')`).
2. No `REFRESH MATERIALIZED VIEW` locking or concurrent-refresh requirements.
3. Upsert on `recipe_id` after restock is simple and transactional with price history.

## Alert rules

Kind: `food_cost_over_target`. Subject: `recipe_id`.

### One active alert

Partial unique index: `(kind, subject_id) WHERE read_at IS NULL`.

### Threshold crossing (not “still over”)

Before updating the snapshot, read the previous `food_cost_pct`.

Create an alert only when:

1. New `food_cost_pct > target_food_cost_pct`, and
2. Previous value was **null or ≤ target** (crossed from at/under to over), and
3. No unread alert already exists for that recipe.

If the user marked an alert read while cost stayed over target, a later restock that keeps cost over target **does not** open a new alert until cost falls to ≤ target and rises again.

### When cost falls under target

Active alerts are **not** auto-deleted or auto-marked read. The cook/chef marks them read in the UI.

## Plan gate

Feature key: `foodCostAlarm` / `food_cost_alarm`.

| Plan    | Food cost alarm |
| ------- | --------------- |
| Free    | No              |
| Starter | Yes             |
| Pro+    | Yes             |

Restock still refreshes snapshots when possible; alert insert runs only when the workspace has the feature.

## Unit conversion

Implemented in SQL as `normalize_quantity_to_price_unit`, matching `lib/calc/foodcost.ts`.  
Incompatible families → line skipped as unpriced → whole recipe snapshot refresh aborted (no partial zeroing).

## Email digest

Edge Function: `digest-food-cost`.

- Groups unread alerts since the last successful digest per workspace.
- Recipients: workspace **owner** and **manager** only (not chef/cook).
- Idempotency table: `digest_runs (workspace_id, run_date)` unique.
- **Email provider:** this repo has no production mail sender (invite flow only checks `RESEND_API_KEY` / `SMTP_URL` / `EMAIL_PROVIDER_URL`). If none is set, the function **logs and does not insert `digest_runs`**.
- Auth: shared secret header `x-food-cost-digest-secret` (Vault / function secret). Missing/invalid → 401.

### pg_cron (manual ops — do not commit secrets)

Cron runs in **UTC**. 07:00 Europe/Belgrade is:

- **06:00 UTC** during CET (winter, UTC+1)
- **05:00 UTC** during CEST (summer, UTC+2)

Do **not** put the service role key in a migration. Configure from the Supabase Dashboard:

1. Enable extensions `pg_cron` and `pg_net` if available on the project.
2. Store function URL and digest secret in **Vault** (or Dashboard secrets).
3. Schedule something equivalent to:

```sql
-- Example only — bind secrets from Vault, never hardcode service_role.
select cron.schedule(
  'digest-food-cost-daily',
  '0 6 * * *', -- adjust for DST policy
  $$ select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'food_cost_digest_url'),
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-food-cost-digest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'food_cost_digest_secret')
       ),
       body := '{}'::jsonb
     ); $$
);
```

If Vault / `pg_net` is unavailable on the plan, run the Edge Function from an external scheduler with the same secret header.

## Manual owner steps

1. Enter **net** selling prices (`selling_price_net`) on recipes.
2. Optionally set `target_food_cost_pct` per recipe (default 30).
3. Confirm Starter or Pro billing for the workspace owner.
4. Set Edge secrets: `FOOD_COST_DIGEST_SECRET` (and mail provider when ready).
5. Enable pg_cron + Vault (or external cron) as above.
6. Decide product follow-up: auto-dismiss alerts when cost returns under target (currently **manual** only).
