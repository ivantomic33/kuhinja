# TreuPlate — izveštaj o optimizaciji

## Obuhvat merenja

| Okruženje | Status |
| --- | --- |
| Repo | Lokalni radni direktorijum |
| Stack | Next.js 15.5, React 19, Supabase, Tailwind 4, Serwist |
| Lokalni produkcijski build | Verzija pre izmena na `localhost:3221`, verzija posle na `localhost:3222` |
| Staging i produkcijski URL | Nisu navedeni u briefu |
| Prototip i referentne slike | Fajlovi sa `/workspace/mise-redesign` i `/workspace/mise-*-trenutno.png` nisu dostupni za merenje |

Faza A obuhvatila je pregled koda dostupne aplikacije. Veličina prototipa od oko 186 KB je procena iz briefa. Veličina njegovih stilova, broj DOM čvorova, vremena renderovanja i poređenje sa referentnim slikama ostaju neizmereni. Stvarna aplikacija deli JavaScript po rutama, služi Inter lokalno kroz `next/font` i koristi Lucide SVG ikonice. Tabele su ubrzane ograničavanjem broja montiranih redova.

Faza B koristi mobilni Lighthouse profil i iste fiksne podatke za oba lokalna build-a. Uzorak ima 200 sastojaka i stanja zaliha i 100 recepata. Supabase klijent je u odvojenim kopijama zamenjen testnim klijentom sa 65 ms po upitu i 45 ms po proveri korisnika. Jedina pripremna izmena u baznoj kopiji prosleđuje već izračunat status komponenti trake zbog nedostajućeg obaveznog propa. Vreme i veličine ispod uključuju Next.js i pregledač, uz pomenutu simulaciju baze.

## Lokalna merenja pre i posle

| Metrika | Kontrolna tabla | Stanje | Recepti | Status |
| --- | ---: | ---: | ---: | --- |
| LCP | 717 → 684 ms | 1.096 → 905 ms | 948 → 839 ms | Izmereno, po jedan Lighthouse mobile prolaz |
| TTFB | 465 → 150 ms | 535 → 134 ms | 522 → 126 ms | Izmereno u lokalnom merenju |
| Interaktivnost pri hladnom učitavanju | 2.969 → 2.856 ms | 4.257 → 3.095 ms | 3.165 → 3.008 ms | Lighthouse TTI |
| CLS | 0 → 0,052 | 0 → 0,086 | 0 → 0,030 | Izmereno, posle optimizacije ispod 0,1 |
| TBT | 123 → 124 ms | 1.021 → 140 ms | 160 → 108 ms | Izmereno, laboratorijski signal blokade glavne niti |
| Početni JS prenos | 222,3 → 223,3 KiB | 224,9 → 221,9 KiB | 212,8 → 214,1 KiB | Izmereno u testnom buildu. Zbir mrežnih neophodnih skripti, uključujući zaglavlja |
| JS ulazni fajl rute | 10,7 → 10,9 KiB | 19,0 → 14,4 KiB | 6,8 → 7,3 KiB | Izmeren `page-*.js` prenos |
| INP na uređaju, FPS i vreme tople navigacije | — | — | — | Bez pouzdanog merenja na fizičkom telefonu |
| API p50/p95 za čitanje, prodaju i inventuru | — | — | — | Blokirano bez staging/produkcijskog pristupa |

| Tok prodaje | Pre | Posle | Status |
| --- | ---: | ---: | --- |
| Hladno otvaranje modala sa 100 jela | 530 ms | 554 ms | Medijana 3 mobilna prolaza. Dodatno učitavanje modula ima cenu |
| Potvrda do food-cost rezultata | 1.692 ms | 1.624 ms | Medijana 3 prolaza sa jednim jelom i tri sastojka. Cilj od 1 s još nije dostignut |

Tok prodaje je meren u Chromiumu pri 390 px širine, simuliranom CPU usporenju 4× i mrežnoj latenciji od 90 ms. Posle uspeha test potvrđuje da se stanje promenilo na 4,8 kg i vratilo na 5 kg posle „Poništi“. Brzina povratne informacije tokom upisa nije posebno kvantifikovana.

Najveći prenosi na početku su zajednički chunk-ovi. Na ispitivanom buildu prva tri na Kontrolnoj tabli su približno 54, 47 i 42 KiB. Na „Stanju“ je smanjen ulazni fajl, ali zbir početnog JS-a ostaje iznad cilja od 200 KB. Lighthouse nije korišćen kao zamena za terenski INP niti za p95 baze.

Odvojen produkcijski build sa pravim Supabase klijentom i middleware-om je prošao. Next.js za njega izveštava `First Load JS` od 272 kB za Kontrolnu tablu, 259 kB za Stanje, 263 kB za Recepti i 265 kB za Sastojci. Te vrednosti služe za proveru stvarnog paketa i imaju drugačiji obuhvat od Lighthouse mrežnog prenosa iz testnog build-a.

## Izmene i prioriteti

| Prioritet | Oblast i izmena | Očekivani uticaj / rizik |
| --- | --- | --- |
| P0 | **4 i 7 · Prodaja.** `SaleModal`, `lib/stock/math.ts`. Pregled ima odlaganje od 120 ms i koristi indeks odabranih jela. „Sačuvaj“ računa tačan unos odmah, blokira ponovljeni submit i otvara rezultat po potvrdi skidanja. Stock i undo osvežavaju samo stanje. | Brža promena porcija uz zadržavanje obračuna i pravila plana. Test opterećenja sa 5.000 recepata i 3 odabrana izmerio je 512,37 → 1,81 ms za 1.000 pregleda sa unapred napravljenim indeksom. Taj uzorak je veći od trenutnog limita učitanih podataka. |
| P0 | **4 i 7 · Preostalo usko grlo.** `lib/stock/actions.ts`, `applySale` i `applyInventory`. Izmeriti prave upite pre verzionisane transakcijske funkcije koja u jednom prolazu radi zaključavanje, skidanje, pokrete i potvrdu. | Sada postoje najmanje tri serijska poziva po sastojku za prodaju. Potrebna je provera konkurentnih prodaja, rollback-a, deduplikacije, RLS-a i undo-a na staging-u pre promene. Ovaj prolaz zadržava postojeću sekvencu upisa. |
| P0 | **1 i 5 · Prvo učitavanje.** `dashboard/page.tsx`, `trebovanje/page.tsx`, `app/(app)/layout.tsx`, `lib/supabase/plan-server.ts`. Paralelni nezavisni upiti, jedna verifikacija korisnika u istom renderu, izostavljeni neiskorišćeni brojači. Kontrolna tabla šalje primarni sadržaj i odložene procente, „Stanje“ koristi postojeće skeleton komponente. | Kraći lanac čitanja. Food-cost detalji mogu stići posle ostatka sadržaja. CLS u lokalnom merenju je porastao, ali ostaje ispod 0,1. |
| P1 | **1 i 2 · Velike liste.** `StockWorkspace`, `RecipesWorkspace`, `IngredientsWorkspace`. Preko 50 rezultata prikazuje se 25 redova po strani, sa pretragom nad svim učitanim redovima. Sticky zaglavlja ostaju. Kontrolna tabla već ograničava recepte i sastojke na 8 vidljivih stavki. | „Stanje“ i Sastojci 200 → 25, Recepti 100 → 25 montiranih redova u testu. Uz veće naloge razmotriti serverske stranice tek kada se usaglasi potpuna pretraga i offline skup. |
| P1 | **2 i 5 · Odloženi moduli.** `StockWorkspace`, navigacija, rute Recepti/Sastojci. Stock modali se učitavaju na otvaranje. Navigacija učitava liste na ulasku. Sastojci se učitavaju uz recept preko postojeće relacije. | Manji JS na Stanje ruti i kraće čitanje podataka. Prvo otvaranje nepreuzetog modala ima cenu dodatnog chunk-a. |
| P1 | **1 i 5 · Osvežavanje zaliha.** `lib/stock/read.ts`, `StockWorkspace`. Realtime i provera na 15 s čitaju samo sastojke potrebne za prikaz i količine. Jedan zahtev je u toku u datom trenutku, sa naknadnom proverom ako stigne još promena. Isti snapshot zadržava stanje komponente. | Nema ponovnog učitavanja recepta, šablona i plana pri svakoj promeni količine. Postojeći Realtime uslov ostaje dovoljna publikacija baze. |
| P2 | **3 i 6 · Prikaz na telefonu.** `BottomSheet`, `app/layout.tsx`. Mobilni modal zadržava tamni overlay bez full-screen blur efekta. Inter je samostalno poslužen, a ikonice su SVG. | Manje GPU kompozicije na telefonu. FPS treba proveriti na fizičkom telefonu. Nije opravdano uvoditi sprite ili novu biblioteku ikonica. |
| P2 | **8 · SEO obuhvat.** Javni marketing već ima jedan naslov i osnovne metapodatke. Za prijavljeni deo dodat je `noindex`. | Privatne rute ostaju izvan indeksa. Vizuelna izmena je nepotrebna. |

## Provera i sledeće merenje

Paginacija i pretraga proverene su na desktopu i pri širini od 390 px, uključujući sticky zaglavlje i pun offline skup učitanih sastojaka. Sinhronizacija Stock tabele zadržava identitet redova kad je rezultat isti. Tok za izmenu sastojka je izvan ovog performance zahvata i trenutno i dalje otvara postojeći obrazac za dodavanje. Za proveru udaljene baze i terenskih ciljeva potreban je staging ili produkcijski URL sa testnim nalogom.
