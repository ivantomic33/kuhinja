# Početna strana TreuPlate-a

Javna ruta `/` renderuje se na serveru u `app/(marketing)/page.tsx`. Cenovnik i mobilni CTA imaju klijentske komponente. FAQ koristi ugrađene `details` elemente i isti sadržaj kao `/faq`. Landing zadržava postojeći URL `/#pricing` i koristi `/#cenovnik` za nove veze.

## Dizajn

- Tamno platno i površine iz `DESIGN.md`, sekundarni tekst iz postojećih tokena i narandžasta primarna dugmad sa tamnim tekstom.
- Inter iz korenskog `next/font` učitavanja za `latin` i `latin-ext`. Naslovi imaju težinu 600. Veći, prilagodljivi uvodni naslov i razmak između sekcija koriste izuzetak za javne stranice.
- Kartice i kontrole koriste postojeće radijuse i korake razmaka. Mobilni linkovi i kontrole imaju najmanje 44 × 44 px. Fokus je vidljiv, mobilna traka uzima bezbednu zonu, a animacija FAQ strelice prati podešavanje smanjenog pokreta.
- Srpska latinica, obraćanje u drugom licu množine i funkcije pod nazivima iz aplikacije. Raspored sekcija, izgled okvira snimka i trenutak prikaza mobilne trake određeni su za landing. Pravila za dijaloge i navigaciju unutar aplikacije ovde nisu primenljiva.

## Cena i početak probnog perioda

`getPricingPlans()` u `lib/billing/plans.ts` sastavlja prikaz iz Free paketa, cenovnih ID-jeva iz konfiguracije i funkcija koje koristi `/premium` iz `lib/billing/tiers.ts`. `getBillingCatalog()` čita redovne cene iz Paddle-a i proverava varijante za besplatni probni period. Ako cena ili odgovarajuća konfiguracija nije dostupna, tabela prikazuje stanje nedostupnosti. Godišnji iznos je vrednost cele godine. Ušteda se računa samo kada su obe cene u istoj valuti i godišnja cena je povoljnija.

Glavni CTA bira Pro mesečno. Plaćeni paketi koriste `/checkout?plan_key=…&interval=…` i čuvaju izbor kroz prijavu, registraciju i Google saglasnost. Tek nakon pristanka na nastavak, serverska akcija validira zahtev i poziva `create-checkout-session`. Edge funkcija proverava dostupnost probnog perioda i izdaje Paddle URL. Free vodi na registraciju. Advanced nema podržanu varijantu probne cene i upis sa landinga je nedostupan.

Paddle provera varijante probne cene očekuje `requires_payment_method`. Poruka „Bez kreditne kartice“ se zato ne prikazuje uz probni period. Kartica FAQ-a o Free paketu govori samo o Free paketu. Oznaka „Najpopularnije“ nema potvrđen izvor.

## Snimci i offline

Snimci u `public/landing/` nastali su u lokalnom Chrome-u iz komponenti `FoodCostCalculator`, `IngredientsWorkspace` i `ShiftChecklist` sa izolovanim test podacima. Kalkulator za pileću supu prikazuje 200,00 dinara po porciji. Snimci su sačuvani u AVIF i WebP formatima, a landing koristi `next/image` sa dimenzijama, alt tekstovima i prioritetom za hero.

[Offline dokumentacija](offline.md) i [FAQ](../content/faq.ts) potvrđuju čitanje prethodno sačuvanih recepata, sastojaka i šablona. Promene kontrolnih lista čekaju lokalno do povratka mreže. Izmena nabavne cene traži mrežu. Pravilo o razlikama između Starter i Pro paketa pri offline upisu nije potvrđeno.

## Merenje i sadržaj koji čeka potvrdu

`landing_cta_click` beleži lokaciju `hero`, `pricing`, `footer` ili `mobile_sticky`. `landing_pricing_toggle` beleži interval `monthly` ili `yearly`. Omotač u `lib/analytics/track.ts` je no-op pošto nema povezanog provajdera. A/B test je preskočen jer u projektu nema mehanizma za feature flagove.

- [nakon odobrenja] Logotipi kuhinja.
- [nakon odobrenja] Svedočenja uz datum pisanog odobrenja `approvedAt` u `content/landing-social-proof.ts`.
- [popuniti] Broj kuhinja, kada postoji proverljiv izvor.

Ove oznake ostaju u dokumentaciji. Za landing i njegove strukturirane podatke biraju se četiri FAQ unosa bez oznaka koje čekaju potvrdu. Izvorni FAQ i pravne stranice zadržavaju status nacrta iz P2.

## Lokalna provera

`pnpm lint && pnpm test && pnpm build` je prošao. Vitest je izvršio 271 test u 51 fajlu. Playwright je na 390 × 844 potvrdio vidljiv hero CTA i dodirne mete od najmanje 44 × 44 px. Mobilna traka se prikazuje pri skrolovanju i sklanja pre završnog CTA i podnožja. Prekidač prikazuje različite Paddle cene za oba intervala i izostavlja procenat kad je godišnja cena skuplja.

Lighthouse 13.6.0 je na mobilnom profilu za lokalni produkcioni build izmerio performance 94, accessibility 100, LCP 3,09 s i CLS 0.

Lokalni Paddle katalog vraća redovne cene. Promenljive `PADDLE_PRICE_{STARTER,PRO}_{MONTHLY,YEARLY}_TRIAL_ID` nemaju vrednosti u lokalnom okruženju. Zbog toga plaćene kartice prikazuju nedostupan upis. Playwright je potvrdio da prijava zadržava Pro mesečni izbor iz hero CTA, a Vitest je proverio serverski poziv Edge funkcije. Stvarna probna transakcija zavisi od konfiguracije tih varijanti u Paddle katalogu i Edge tajnama.
