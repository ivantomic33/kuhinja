# Početna strana TreuPlate-a

Javna ruta `/` renderuje se na serveru u `app/(marketing)/page.tsx`. Jedina
klijentska logika na stranici prati vidljivost mobilnog CTA dugmeta.
FAQ koristi ugrađene `details` / `summary` elemente.

## Struktura

1. **Hero** — poruka o trošku porcije, CTA „Započni besplatno“ → `/login`,
   sekundarni CTA → `/kako-poceti`, primer kartice pileće supe (540+36+24=600,
   600/4=150 din po porciji).
2. **Funkcije** — četiri kartice (trošak porcije, skaliranje, cene/zalihe, smene).
3. **Kako radi** — tri numerisana koraka.
4. **FAQ** — četiri pitanja bez izmišljenih cena ili garancija.
5. **Završni CTA** i podnožje sa `/kako-poceti`, `/premium`, `/login`.

## Dizajn (Kitchen Command)

- Tamno platno i tokeni iz `DESIGN.md` / `app/globals.css`. Narandžasti akcenat
  samo na primarnim CTA i aktivnim stanjima.
- Hero, primer i sadržaj sekcija vidljivi su pri prvom prikazu. Gradijent na
  istaknutim rečima je statičan, a kartice se podižu na hover/focus.
- `prefers-reduced-motion: reduce` gasi pokret kartica.
- Srpska latinica iz `lib/i18n/sr.ts`.

## Cena i JSON-LD

Stranica više ne prikazuje cenovnik u telu. `MarketingJsonLd` i dalje može da
učitá planove za strukturirane podatke. Aktuelne cene su na `/premium`.

Glavni CTA vodi na `/login` (početak naloga). Free plan ne traži karticu.

## Merenje

`data-landing-cta` označava lokacije `hero`, `footer` i `mobile_sticky`.

## Lokalna provera

Otvorite `/` na 375 px, 768 px i 1280 px. Proverite hero, primer (150 din),
mobilni CTA pri skrolu, hover/focus na karticama i da nema horizontalnog skrola.
