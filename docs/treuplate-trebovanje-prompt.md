# TreuPlate — Implement „Trebovanje“ (UPDATE existing app; match approved mockup)

Update the **existing** TreuPlate app. Keep data, auth, recipes, ingredients, shifts, pricing. Add **Trebovanje** exactly as designed in:

- Redesign prototype `index.html` → screen `#s-trebovanje` + modals (`modalSale`, `modalRestock`, `modalOtpis`, `modalInventura`, `modalSaleResult`, `modalNegWarn`)
- Shots: `09-trebovanje-stanje-1440.png`, `10-trebovanje-unesi-prodaju-1440.png`, `11-trebovanje-dopuna-1440.png`, `12-trebovanje-inventura-1440.png`, `13-trebovanje-otpis-1440.png`

Dark tokens: `--bg:#0b0b0c`, `--surface:#18181b`, `--accent:#ff6b35`, Inter, Serbian copy. Prefer mock HTML/CSS over inventing chrome.

---

## IA / navigation

- Sidebar item **Trebovanje** (box icon), between Sastojci and Premium; active orange rail.
- Single main screen titled **Stanje** (not a separate hub). Actions open modals; do not invent extra top-level tabs unless the mock adds them.
- Hash/route `#trebovanje` / equivalent.

---

## Screen: Stanje (`#s-trebovanje`)

### Header
- H1: `Stanje`
- Sub: `Šta imaš u kuhinji danas. Prodaja skida sa stanja automatski.`
- Actions (right), order:
  1. Secondary `Otpis / kalo`
  2. Secondary `Inventura`
  3. Secondary `Unesi prodaju`
  4. Primary accent `Dopuni stanje`

### Chips row (`Zahteva pažnju`)
Dynamic chips:
- `{n} nestalo` (danger) when qty ≤ 0
- `{n} ispod minimuma` (warn) when 0 < qty < min
- `{n} bez stanja` → opens Dopuna, for ingredients with no stock row
- Else `Sve u redu`
- Label may show `Primer` badge while using sample metrics

### KPI row (4 cards, `.kpis.kpi4`)
1. **Stavki na stanju** — count · foot `{x} sa količinom`
2. **Nisko / kritično** — warn+crit · foot `{crit} nestalo · {warn} nisko`
3. **Potrošeno danas** — din value of today’s deductions (`usedToday × unitCost`) · foot `vrednost skinuta danas` · mark Primer until live
4. **Vrednost zalihe** — `sum(max(0,qty)×price)` · foot `po nabavnim cenama` · Primer until live

### Stock card
Toolbar:
- Search `Pretraži stanje...`
- Seg: **Tabela** | **Kartice**
- Faint: `Sortirano: kritično prvo` (sort: Nestalo → Nisko → OK, then name)

**Table columns:** Sastojak (name + `{price} din/{unit}`) · Na stanju (large qty + unit) · Min. · Potrošeno danas · Status badge · Nivo (progress bar vs ~2×min) · acts: `Dopuni` + history icon  

Status: **Nestalo** (danger, qty≤0) · **Nisko** (warning, qty<min) · **OK** (success).

**Cards view:** name, min, badge, big qty, bar, `Dopuni` + `Istorija`.

Empty: `Nema stanja` / `Dodaj prvu dopunu da pratiš zalihe.` CTA `Dopuni stanje`.

Footer: `{shown} od {total} stavki`.

### Card: Šta da nabavim
- Title + count · sub `Ispod minimuma · lista za dobavljača`
- Button `Kopiraj za dobavljača`
- Rows: name · `na stanju … · min …` · suggested need in warning color: **`need = max(0, min×2 − qty)`** (restock toward 2× minimum — match mock)
- Empty: `Nema stavki za nabavku` / `Sve je iznad minimuma.`
- Clipboard text:
  ```
  Nabavka — TreuPlate
  - {name}: {need} {unit} (sada …, min …)
  ```

---

## Modal: Unesi prodaju (`.modal.wide`)

- Title `Unesi prodaju` · sub `Upiši koliko jela si prodao — skidamo sastojke sa stanja.`
- Fields: **Datum** (default today) · **Smena (opciono)** select (`—`, Jutro, Podne, Veče — or real shifts if app has them)
- Layout `.sale-layout` 1.2fr / 0.8fr:
  - **Recepti:** each recipe row with name, ingredient line summary, **stepper** portions
  - **Live skidanje** box: per ingredient `−qty → after`; red when after < 0; empty `Povećaj brojač da vidiš šta se skida.`
  - Inline warn banner when negative: `Negativno stanje: {names}. Možeš smanjiti, dopuniti ili nastaviti.`
- Foot: `Ukupno porcija: N` · `Otkaži` · primary `Skini sa stanja` (disabled if N=0)

### Negative confirm (`modalNegWarn`)
- Title `Stanje bi otišlo u minus`
- Body lists shortfall
- Actions: `Smanji` (close) · `Dopuni` (open restock) · primary `Nastavi ipak` (allow negative / Nestalo)

### Result (`modalSaleResult`)
- Title `Skidanje završeno` · breakdown list
- `Poništi` (ghost) restores snapshot · primary `U redu`
- Also support toast with action for **10s** undo (`toast(..., act)` pattern in mock)

Deduction math: for each recipe ingredient, `amount × portions` (normalize units as existing recipe store does). Update `qty` and `usedToday`. Snapshot stock before commit for undo.

---

## Modal: Dopuni stanje

- Title `Dopuni stanje` · sub `Dodaj nabavku — više stavki u jednom snimanju.`
- Multi-line rows: **Sastojak** select · **Količina** · **Jedinica** (disabled, from ingredient) · **Nabavna cena (opc.)** placeholder `din` · remove row
- `+ Još stavka` dashed add
- Foot: `Stavki: N` · `Otkaži` · `Sačuvaj dopunu`
- On save: qty += · optional price updates unit cost / price history (Pro+) · toast `Stanje dopunjeno (N)`

---

## Modal: Otpis / kalo (max-width ~520)

- Title `Otpis / kalo` · sub `Skida sa stanja kao otpis, ne kao prodaja.`
- Fields: Sastojak · Količina + unit · Razlog:
  - `pokvareno` → Pokvareno
  - `prosuto` → Prosuto / razbijeno
  - `hrana-osoblja` → Hrana za osoblje
  - `ostalo` → Ostalo
- Napomena (opciono) placeholder `npr. luk pokvaren u frižideru`
- Foot: `Beleži se kao otpis` · `Otkaži` · `Potvrdi otpis`

---

## Modal: Inventura — Uskladi stanje (`.modal.wide`)

- Sub: `Uporedi očekivano (sistem) sa stvarnim brojem. Razlika nije dopuna.`
- Columns: Sastojak · Očekivano · Stvarno (input) · Razlika (qty + din value; green for surplus)
- Foot: `Usklađivanje se beleži kao korekcija` · `Otkaži` · `Sačuvaj usklađivanje`
- Persist as **korekcija** moves; set on-hand = counted. Do **not** treat as dopuna.

---

## Dnevnik / Istorija pokreta

Mock shows history icon → toast `Istorija pokreta — uskoro`. **Implement the real log** (do not ship the stub):

- Per-ingredient (and optional global) list: time, type (**Dopuna** + / **Prodaja** − / **Otpis** / **Korekcija**), qty, reason, recipe/sale ref, user (Team)
- Open from row history button and optionally from card `Istorija`

---

## Data (align with mock fields)

```ts
type StockRow = {
  id: string;
  ingredientId / name: string;
  qty: number;
  unit: string;
  min: number;
  price: number;       // nabavna cena / unit
  usedToday: number;
};
type StockMove = {
  at: string;
  type: 'dopuna' | 'prodaja' | 'otpis' | 'korekcija';
  ingredientId: string;
  qtyDelta: number;
  unitCost?: number;
  reason?: string;
  note?: string;
  saleId?: string;
  userId?: string;     // Team audit
  undone?: boolean;
};
```

Append-only moves; undo sale marks undone + restores qty/`usedToday`.

---

## Plan gating (unchanged product rules)

| | Free | Starter+ | Pro+ | Team+ |
|--|------|----------|------|-------|
| Stanje + Unesi prodaju + Šta da nabavim + osnovni dnevnik | ✓ (≤20 sastojaka) | ✓ | ✓ | ✓ |
| Otpis / kalo | ✗ upsell | ✓ | ✓ | ✓ |
| Dopuna + nabavna cena | ✗ upsell | ✓ | ✓ | ✓ |
| Inventura | ✗ | ✗ | ✓ | ✓ |
| userId audit on moves | ✗ | ✗ | ✗ | ✓ |

Wire gated buttons to Premium upsell like other Free limits.

---

## Implementation order

1. Stock model + Stanje UI (chips, KPIs, table/cards, buy list + copy)  
2. Unesi prodaju (live preview, neg warn, submit, result, 10s/Poništi undo)  
3. Dopuni multi-add  
4. Otpis with mock reasons  
5. Inventura  
6. Istorija pokreta (replace uskoro stub)  
7. Plan gates  
8. Pixel-check against shots 09–13  

---

## Acceptance

- [ ] Nav **Trebovanje** → Stanje matches shot 09 (actions, chips, 4 KPIs, table, buy list)
- [ ] Sale modal matches shot 10 (steppers, live skidanje, Skini sa stanja)
- [ ] Neg warn: Smanji / Dopuni / Nastavi ipak
- [ ] Dopuna multi-add + optional price (shot 11)
- [ ] Inventura expected/actual/delta qty+din as korekcija (shot 12)
- [ ] Otpis reasons match mock (shot 13): Pokvareno, Prosuto/razbijeno, Hrana za osoblje, Ostalo
- [ ] Buy need = `min×2 − qty`; Kopiraj za dobavljača works
- [ ] History icon opens real movement log (not permanent uskoro)
- [ ] Gates + existing app data preserved; Serbian copy exact; `#ff6b35` / `#0b0b0c`

## Out of scope

Supplier orders, barcodes, multi-location sync, payment provider.
