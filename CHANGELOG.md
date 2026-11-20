# Changelog

Beleške iz prvobitnog redizajna. Važeće smernice su u [DESIGN.md](DESIGN.md).

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
