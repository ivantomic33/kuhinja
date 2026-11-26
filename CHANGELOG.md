# Changelog

## Nepublikovano

- Alergeni: normalizovan katalog 14 alergena sa RLS-om, urednik sastojaka, automatska unija alergena u receptu i štampiva tabela jelovnika na `/allergens/print`.
- Izvoz: CSV/XLSX za sastojke i recepte, PDF kartica recepta sa troškom porcije i ugrađenim Noto Sans fontom.

- Faza 1 (bezbednost): CSP je obavezujući, sa nonce-om po zahtevu. Rute su podeljene na public, guest i auth. Open redirect je blokiran. Sesijski kolačić ostaje čitljiv browser klijentu jer `@supabase/ssr` čita sesiju iz `document.cookie`; u produkciji važe `Secure` i `SameSite=Lax`.

- P8 F4: upozorenja o niskim zalihama (`low_stock`), dobavljači, `stock_movements`, narudžbenice po dobavljaču (iz upozorenja / trebovanja), PDF/tekst slanje, atomičan prijem robe (`receive_purchase_order`) koji ažurira zalihe i cene. Plan flagovi `stockAlerts` (Starter+) i `purchaseOrders` (Pro+). E-pošta ostaje isključena dok nema mail providera (Edge Function 501).

- P7 dodaje kanonske URL-ove, metapodatke za društvene mreže, strukturirane podatke i sitemap za šest javnih stranica. Privatne rute i deljeni rasporedi imaju `noindex`. Produkcijski build zahteva validan `NEXT_PUBLIC_SITE_URL`.

- P6 redizajnira javnu početnu stranu. Dodat je prikaz obračuna iz aplikacije, mesečni i godišnji cenovnik iz Paddle kataloga, mobilni poziv na probni period i nastavak izabranog paketa kroz prijavu ili registraciju.

- P3 uvodi Starter i Pro pretplate, sedmodnevni grace period, idempotentnu Paddle sinhronizaciju i serverske provere prava. Korisnik može promeniti paket, zakazati otkazivanje ili poništiti otkazivanje.
- Brisanje naloga zaustavlja Paddle pretplate pre brisanja Auth naloga. Otpis i inventura proveravaju paket i zajedno upisuju količinu i evidenciju pokreta.

- P2 dovršava javne nacrte uslova korišćenja, privatnosti, povraćaja i FAQ-a, dodaje linkove u podnožja i sitemap i beleži prihvatanje dokumenata tokom registracije.
- Dodat je inventar RLS politika, indeksa i ruta, uz SQL regresioni test izolacije podataka.
- Dopuna sa cenom ažurira sastojak i upisuje jedan istorijski red u istoj transakciji. Starter može da sačuva cenu, a istorija je dostupna od Pro paketa.
- Izmene sastojka i podataka recepta koriste verziju reda. Zastarela izmena dobija HTTP 409 i dugme za osvežavanje.
- Kontrolne liste se sinhronizuju po stavci. Postojeće čekirane stavke se prenose iz JSON-a, a završetak smene čuva njen status.
- Dopunjeni su prevodi koje koriste postojeće FAQ i pravne stranice.
- Replay nastavlja red nakon neuspeha. Peti neuspeh premešta zapis u `dead_letter` i osvežava upozorenje u zaglavlju.
- Sužena je lista javnih ruta. RLS čitanja koriste verifikovane JWT tvrdnje, a privatne mutacije ponovo koriste identitet iz jedne provere.
- Kontrolna tabla, sastojci i recepti hidriraju TanStack Query sa servera. Prikazi zaliha dele jedan Realtime kanal po lokalu.
- Dodat je k6 scenario za staging i dijagram toka zahteva u README-u.

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
