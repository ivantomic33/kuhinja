# Mise UI redesign — Kitchen Command

## Concept (2–3 sentences)

**Kitchen Command** is a dark, high-contrast workstation UI for professional kitchens: dense enough for tablet shift work, calm enough for daily pricing, and clear enough to sell Pro. Hierarchy is driven by KPI strips, sticky page actions, and price-first tables—not decorative cards. Orange `#FF6B35` is reserved for primary CTAs and active navigation so the eye always knows “what to do next.”

## Design system

### Tokens (`app/globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `bg-app` / `--background` | `#0B0B0E` | App canvas |
| `bg-surface` / `--surface` | `#141418` | Cards, panels |
| `bg-elevated` / `--elevated` | `#22222A` | Menus, hover lift |
| `border` | `#26262E` | 1px edges |
| `text-primary` | `#F5F5F7` | Titles, body |
| `text-muted` | `#9A9AA6` | Labels (≥ AA on dark) |
| `accent` | `#FF6B35` / hover `#FF7F50` | CTA, active nav |
| `accent-ink` | `var(--background)` (`#0B0B0E`) | Text and icons on solid accent fills |
| `text-3` | `#9898A1` | Tertiary text and placeholders on dark surfaces |
| `success` / `danger` | `#22C55E` / `#EF4444` | Price down / up, delete |
| `--glow-pro` | soft orange glow | Pro pricing card |
| `--card-highlight` | top-edge gradient | subtle card lift |
| radius | 8 / 12 / 16 / 20 | controls / inputs / cards / modals |
| spacing | 4–48px scale | layout rhythm |
| layout | max **1400px**, page pad 24px | desktop content |
| body wash | radial accent 4% | fixed ambient glow |

### Typography

- Font: Inter (existing `next/font`)
- Body: 14px / 1.5
- Title: 20–28px semibold tracking-tight
- Tabular nums everywhere money appears
- `BigNumber` sizes: sm / md / lg / hero

### Components (with states)

| Component | States |
| --- | --- |
| `PrimaryButton` | primary / secondary / ghost / danger · default hover focus disabled loading · sm/md/lg |
| `SegmentedControl` | sliding thumb, selected, focus, disabled · sm/md |
| `Badge` | neutral accent success danger warning |
| `ProgressBar` / `LimitMeter` | normal / near-limit / full |
| `KpiCard` | default · trend · **locked** (Premium upsell) |
| `DataTable` | sticky first col, selectable, dense, hover row, empty |
| `SectionCardHeader` | title + count · circular + · open arrow |
| `PriceChange` | up / down / flat (color + arrow + sign) |
| `PricingCard` | default / highlighted (gradient border + glow) |
| `BottomSheet` | mobile sheet + desktop modal, sticky footer, Esc |
| `PageHeader` | title, description, action |
| `Toast` | default / success / danger · auto-dismiss |
| `Chip` | selectable · 44px touch |
| `Tabs`, `Skeleton`, `EmptyState` | loading / empty / error-ready |

### Navigation

- **Desktop (≥ lg):** left sidebar, icon + label, accent active state, profile + sign-out at bottom
- **Mobile / tablet:** bottom bar — Tabla, Recepti, Sastojci, Podešavanja + “Više” (Premium, Odjava)
- Touch targets ≥ 44px; focus ring 2px accent

## Screens delivered

1. **Kontrolna tabla** — time-of-day greeting + first name; 4 KPI cards (locked price-history for Free); section cards with count / + / open; no limit meters on dashboard cards  
2. **Sastojci** (`/ingredients`) — search, table/cards + density, filter chips, selectable table, bulk bar shell  
3. **Novi sastojak** — two-column form, unit segmented control, din prefix, waste slider, **BigNumber** live unit + effective price, sticky footer  
4. **Premium** — Free / Pro / Tim; monthly·yearly + save badge; Pro glow + “Najpopularnije”; comparison table; trust row; FAQ  
5. **Podešavanja** — Account · Plan+limits · Security · Danger zone with type-`OBRIŠI` confirm  

Also: `/recipes` list page, billing overview polish, auth shell spacing, ambient body wash, Toast provider in AppShell.

## Key decisions vs old UI

1. **Sidebar + bottom nav** — top thin links lacked active state and wasted vertical space on tablets; primary kitchen destinations are now always one tap away.  
2. **Content width 1400px** — old `max-w-3xl` felt like a prototype; kitchen managers use wide screens for tables.  
3. **KPI strip on dashboard** — greeting + counts + avg menu price; Free users see locked price-history KPI with unlock CTA.  
4. **Dedicated Ingredients & Recipes routes** — lists outgrew dashboard cards; dashboard keeps previews + deep links via `SectionCardHeader`.  
5. **Price as hero metric** — tables emphasize current price; change column uses arrow + sign (not color alone). History % stays “—” until Premium history API is wired (no fake data).  
6. **Ingredient modal → dialog with sticky footer** — fixed overlap of actions over fields; validation gates Save.  
7. **Effective price with waste** — live preview only; insert still stores unit price as before (no calc/API change).  
8. **Three pricing columns** — Free + Pro checkout real; **Tim = “Uskoro” proposal** (no backend). Pro card uses glow + gradient border.  
9. **Danger zone isolation** — red only there; delete requires typing `OBRIŠI`.  
10. **Sign-out in profile menu** — removed from primary chrome so nav stays task-focused.  
11. **Limit meters** — stay on Ingredients / Settings / plan gates; removed from dashboard section cards to reduce noise.

## Constraints respected

- No backend / auth / billing / food-cost logic changes  
- Serbian (Latin) copy via `lib/i18n/sr.ts`  
- Dark theme + orange accent retained  
- `prefers-reduced-motion` honored globally and in sheets / BigNumber / SegmentedControl  
- Chrome / Safari / Firefox friendly (no exotic CSS)
