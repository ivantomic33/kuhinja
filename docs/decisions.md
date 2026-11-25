# Product and technical decisions

## P8 F2 — Allergen matrix (EU 1169/2011 Annex II)

### 1. Presence model (`contains` / `trace`)

**Decision:** Add `presence text not null default 'contains'` with check
`('contains','trace')` on `ingredient_allergens`. Primary key remains
`(ingredient_id, allergen_code)`.

**Rationale:** The base matrix only marked presence/absence. Restaurants need
“may contain / traces” separately from “contains”. If the same code is sent
twice, **contains wins over trace** (application + RPC dedupe).

### 2. Whose plan unlocks allergens

**Decision (interim product default):** Feature `allergens` is evaluated from the
**workspace owner’s** active plan via `public.workspace_has_feature(workspace_id,
'allergens')`. Owner is the earliest `workspace_members` row with `role =
'owner'`. Plan comes from `billing_entitlement_row` (same source as
`get_entitlements`). Pro and Advanced unlock the feature; Free and Starter do
not.

**Rationale:** Billing is per user (P3), allergens are workspace data. Locking
by owner plan keeps one kitchen on one entitlement and blocks Free REST reads
even when a Pro guest is invited later. Product owner may override later.

### 3. PDF library and font

**Decision:** **`pdf-lib`** for server-side PDF generation.

**Rationale:**

- Runs in a Next.js route handler (Node) without a browser.
- Embeds custom fonts (TTF/OTF).
- Smaller operational surface than `@react-pdf/renderer` for a single table
  export; no React tree on the server for this path.
- Loaded only inside the export route / generator module (dynamic `import`) so
  it stays out of the main client bundle (P4).

**Font:** `assets/fonts/NotoSans-Regular.ttf` (full Noto Sans Regular). Chosen
over the existing Inter WOFF files because `pdf-lib` embeds TTF/OTF, not WOFF,
and Noto Sans includes latin-ext glyphs (č, ć, š, ž, đ). Fetch script:
`scripts/fetch-allergen-font.mjs`.

### Related deviations

- Junction table in this codebase is `recipe_items` (not `recipe_ingredients`).
- Legal copy lives in `lib/legal/documents.ts` + `lib/legal/versions.ts`
  (P2 equivalent of `content/legal/*`).
- Free users see a **data-free placeholder** (not CSS blur) so allergen rows
  never enter the DOM.
- Public allergen page is `/recept/[id]` because `/r/[token]` is already the
  schedule share route.

## P8 F5 — Waste log Excel export

**Decision:** **`exceljs`** (MIT) for XLSX export of waste reports.

**Rationale:**

- Clear MIT license (avoids SheetJS community license ambiguity for commercial use).
- First-class workbook/worksheet API, number cells stay numbers, currency formats.
- Server-only dynamic import in the waste export path (same pattern as pdf-lib).
- Bundle size is acceptable because it never ships to the client.

See `docs/waste.md` for CSV/PDF/rounding and offline cost decisions.
