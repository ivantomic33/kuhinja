# TreuPlate — Trebovanje „Stanje“: visual polish to match the disigne mockup (UI ONLY)

Trebovanje already works. **Do not change logic, data, routes, or plan gating.** Only restyle the **Stanje** screen (and shared components it uses) so it matches the approved mockup pixel-close.

Reference (source of truth): redesign prototype `index.html` → `#s-trebovanje` + its CSS block `/* Trebovanje / Stanje */`, and screenshot `shots/09-trebovanje-stanje-1440.png`. Copy class structure and values from there instead of improvising.

## 0. Design tokens (put in global CSS / theme if not already there)

```css
:root{
  --bg:#0B0B0C; --surface:#18181B; --surface-2:#1F1F23; --surface-3:#27272A;
  --border:#27272A; --border-strong:#3F3F46;
  --text:#FAFAFA; --text-2:#A1A1AA; --text-3:#71717A;
  --accent:#FF6B35; --accent-hover:#FF8255; --accent-pressed:#E85A28; --accent-ink:#1A0A03;
  --accent-soft:rgba(255,107,53,.12); --accent-line:rgba(255,107,53,.35);
  --success:#22C55E; --success-soft:rgba(34,197,94,.12);
  --warning:#F59E0B; --warning-soft:rgba(245,158,11,.12);
  --danger:#EF4444;  --danger-soft:rgba(239,68,68,.12);
  --fs-xs:12px; --fs-sm:13px; --fs-base:14px; --fs-md:15px; --fs-2xl:24px; --fs-kpi:28px;
  --r-md:10px; --r-lg:14px; --tap:44px;
  --shadow:0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px rgba(0,0,0,.25);
  --focus:0 0 0 3px rgba(255,107,53,.28);
}
```
Font: **Inter** 400/500/600/700 loaded (Google Fonts), `font-variant-numeric: tabular-nums` on all numbers.

## 1. What is wrong now → what it must be

| Area | Now (Ivan's screenshot) | Must be (mockup) |
|---|---|---|
| Header buttons | Tiny pill buttons (~28px, fully rounded), no icons | `.btn` height **44px**, radius **10px**, padding 0 18px, 600 weight, 14px, **icon + label**: `Otpis / kalo` (minus), `Inventura` (scale), `Unesi prodaju` (utensils) as **secondary** (`--surface-2` bg, 1px `--border-strong`), `Dopuni stanje` (plus) as **primary** (`--accent` bg, `--accent-ink` text, hover `--accent-hover`). Gap 10px. |
| Page head | OK-ish | H1 24px/600, letter-spacing -.015em; sub 14px `--text-2`; header `align-items:flex-end`, margin-bottom 20px |
| “Zahteva pažnju” row | Small grey text + small badge | Label as **uppercase** 12px, 600, letter-spacing .08em, `--text-2`. Chips: height **36px**, pill, `--surface` bg, 1px `--border`, 13px text, **8px colored dot** (warning for `bez stanja`/`ispod minimuma`, danger for `nestalo`, success for `Sve u redu`). Gap 10px, margin-bottom 20px. |
| KPI cards | Only first card has an icon; values look plain | 4 equal cards (`grid repeat(4,1fr)`, gap 16px, mb 24px), padding 20px, min-height 132px, radius 14px, `--shadow`. Top row: label 13px `--text-2` + **36×36 icon tile** radius 10px on **every** card: box, alert, trend, card. Cards 3–4 (`Potrošeno danas`, `Vrednost zalihe`) are `.highlight` → icon tile `--accent-soft` bg + `--accent` icon. Value **28px / 600**, `din` as small 14px `--text-2`. In “Nisko / kritično” foot, `N nestalo` bold in `--danger`. |
| Stock card toolbar | Fine but loose | padding 16px 20px, border-bottom. Search `.input`: 44px, radius 10px, bg `--bg`, border `--border-strong`, search icon, focus = accent border + `--focus` ring, max-width 480px. Seg toggle: 4px padding, radius 10px, bg `--bg`, active button `--surface-3`. “Sortirano: kritično prvo” 13px `--text-3`. |
| Table header | Mixed case, grey | `th`: **UPPERCASE**, 12px, 600, letter-spacing .06em, `--text-3`, padding 14px 20px |
| Table rows | Plain name, “— kg”, dash in Nivo | Each row: **40×40 thumb** (radius 10px, `--surface-3`, ingredient icon) + name 600 + sub `945,00 din/kg` 13px `--text-3`. Zebra `rgba(255,255,255,.018)`, hover `#1F1F23`, padding 14px 20px. |
| Na stanju | `— kg` thin | `.stock-qty` **20px / 700**, unit 13px `--text-2`. For items without stock show `—` in `--text-3` **without** the unit. |
| Min. / Potrošeno | — | Same `—` muted when empty; otherwise `3 kg` etc. |
| Status | “Bez stanja” plain badge | Badge height 24px pill, 12px/600: **Nestalo** danger-soft/danger, **Nisko** warning-soft/warning, **OK** success-soft/success, **Bez stanja** neutral (`--surface-2`, border `--border-strong`, `--text-2`). |
| Nivo | `—` | Always show the **bar**: 8px track `--surface-3`, radius 99px, min-width 100px; fill success/warning/danger by status; empty track (0%) for Bez stanja. |
| Row actions | Small pill button | `Dopuni` = `.btn.btn-secondary.btn-sm` (36px, radius 10px, 13px); history = `.icon-btn` 44×44 radius 10px, transparent, hover `--surface-2`. |
| Card footer | OK | `3 od 3 stavki` 13px `--text-3`, padding 14px 20px, border-top. |
| Šta da nabavim | “· 0” text count | Count as `.count` pill (24px, `--surface-3`, 12px/600) next to the title (15px/600). Sub 13px `--text-2`. `Kopiraj za dobavljača` = secondary btn-sm with copy icon, **disabled** style when list is empty. Empty state: 64px icon tile radius 16px `--surface-2`, title 15px/600, text 13px `--text-2`, padding 32px 24px. Rows (when filled): 56px min-height, need value right-aligned 600 in `--warning`. |
| Cards in general | Light borders, small radius | `.card`: `--surface` bg, 1px `--border`, radius **14px**, `--shadow`. Space between stock card and buy card 24px. |

## 2. Layout & responsiveness
- Content: max-width 1440px + padding `36px 40px 64px` (≤1279px: `28px 28px 56px`; ≤900px: `20px 16px 48px`).
- KPIs: 4 columns; ≤900px → 2 columns.
- Columns Min., Potrošeno danas, Nivo hide below ~900px (`.hide-sm`).
- Header actions wrap to the right under the title on narrow screens.

## 3. Rules
- Reuse the app's existing button/badge/card components if they exist — **update them to these specs** so other screens benefit; don't fork duplicates.
- Icons: same icon set as the rest of TreuPlate (lucide-style line icons, 20px; 16px in small buttons).
- Serbian copy unchanged.
- No new features, no changes to stock math, limits, or modals' logic.

## 4. Acceptance
- [ ] Side-by-side with `shots/09-trebovanje-stanje-1440.png` at 1440px the Stanje screen looks the same (button sizes/icons, chips, KPI icons + highlight, table thumbs, big qty, bars, buy card).
- [ ] Header buttons are 44px with icons; primary is orange.
- [ ] All 4 KPI cards have icon tiles; last two use accent tiles.
- [ ] Table header uppercase; rows have thumbs, zebra and hover.
- [ ] Items without stock show muted `—`, neutral `Bez stanja` badge and an empty bar — no `— kg`.
- [ ] Buy card uses count pill and proper empty state; copy button disabled when empty.
- [ ] Nothing in logic/data changed.
