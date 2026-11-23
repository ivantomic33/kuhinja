# TreuPlate — Add Trebovanje stock-item limits by plan (UPDATE only)

Trebovanje is already in the app **without** plan gating. Wire stock-row limits to the existing plan model. Do **not** rebuild Trebovanje or change unrelated screens.

## Limits (`PlanLimits.maxStockItems`)

| Plan | maxStockItems |
|------|----------------|
| Free | **10** |
| Starter | **40** |
| Pro | `unlimited` |
| Team | `unlimited` |
| Business | `unlimited` |

Add `maxStockItems` next to existing fields (`maxRecipes`, `maxIngredients`, …). Map old/single Premium → Pro if that migration already exists.

Helper e.g. `canAddStockItem(): boolean` → `stockRows.length < limit` (unlimited always true).

## Behavior

1. **Block new stock rows** when at limit: Dopuni that would **create** a first stock row for an ingredient with no stanje, Inventura/seed paths that add rows, empty-state “first dopuna” for a new ingredient, etc. Increasing qty on an **existing** row is always allowed.
2. On block → **upsell modal** (same pattern as recipe/ingredient limits):
   - Free → offer **Starter** / **Pro** (CTA to Premium)
   - Starter → offer **Pro**
   - Copy in Serbian, e.g. `Dostigli ste limit stanja ({n} stavki). Nadogradite plan za više.`
3. **Downgrade:** never delete existing stock rows over the new cap; only block **adds**. Optionally show a non-blocking banner if `count > limit`.
4. **Counter on Stanje** (near header, toolbar, or KPI “Stavki na stanju”):
   - Free: `X / 10`
   - Starter: `X / 40`
   - Pro+: `X` or `X · bez limita` (no fake denominator)

## Acceptance

- [ ] `PlanLimits.maxStockItems` = 10 / 40 / unlimited as above  
- [ ] Cannot add 11th (Free) or 41st (Starter) stock item; upsell shows  
- [ ] Existing over-limit rows kept on downgrade  
- [ ] Stanje shows `X / 10` or `X / 40` (or unlimited label)  
- [ ] Qty top-ups on existing items still work at cap  

## Out of scope

New Trebovanje features, payment, changing recipe/ingredient caps.
