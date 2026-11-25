# P2 pravni dokumenti

Javne rute `/pravila-koriscenja`, `/privatnost`, `/povracaj-novca` i `/faq` su na postojećoj listi javnih ruta u `lib/auth/routes.ts`. Verzija, datum i status stranica su u `lib/legal/versions.ts`. Poslednja izmena nacrta je 24. novembra 2026. godine.

## Registracija i čuvanje prihvatanja

Obavezno je prihvatanje uslova korišćenja i politike privatnosti. Marketing je zasebna opcija koja je podrazumevano isključena. Aplikacija beleži prihvatanje marketinga kada je izabrano. Slanje marketinških poruka nije deo P2.

Pri registraciji e-poštom server uzima verzije iz konfiguracije i beleži vreme prihvatanja. Za projekat iz lokalne konfiguracije, Auth podešavanja vraćaju `mailer_autoconfirm: false`. Zato se verzije i vreme prosleđuju u `signUp` metapodacima. Callback upisuje redove nakon razmene koda za sesiju. Ako potvrda nije uključena, upis se dešava u registraciji pre zatvaranja neposredne sesije. Ako upis ne uspe, naredna prijava lozinkom ga ponavlja s istim verzijama i vremenom. Jedinstveni ključ čuva prvi upis za korisnika, dokument i verziju. Sa uspešnim upisom aplikacija uklanja privremene metapodatke.

Privatni deo aplikacije traži prihvatanje od Google korisnika koji nemaju oba obavezna reda. Pristanak se unosi nakon potvrđivanja identiteta i pre ulaska u aplikaciju. Ovo važi i za ranije Google naloge bez evidencije. Google je isključen u proverenom Auth projektu.

Migracije `20260409120000_legal_consents.sql` i `20261204121000_record_legal_consents_with_user_session.sql` zajedno uspostavljaju tabelu sa RLS politikama i uklanjaju zatečeni trigger koji je samostalno upisivao redove pri kreiranju Auth naloga. Upis koristi korisničku sesiju. Korisnik može čitati i dodavati svoje redove. Brisanje Auth naloga kaskadno uklanja njegove redove. Datumi i verzije iz prethodno evidentiranih redova se čuvaju dok nalog postoji.

## Brisanje naloga i naplata

Aplikacija nakon provere sveže sesije zatvara otvoreni Checkout i otkazuje postojeće Paddle pretplate pre brisanja Auth naloga. Profil i redovi pretplate brišu se kaskadno. Paddle zadržava svoj identifikator kupca i evidenciju naplate. Pravnik treba da potvrdi rok, pravni osnov i postupak minimizacije ili brisanja tih podataka u Paddle-u, uključujući povezane metapodatke.

## Odluke pre odobrenja nacrta

- **Uslovi i privatnost.** Popuniti naziv pružaoca, identitet rukovaoca (puni naziv, PIB, adresa), kontakt i nadležni sud. Potvrditi pravni osnov evidencije i obaveze čuvanja posle brisanja naloga.
- **Infrastruktura.** Potvrditi hosting, servis e-pošte, lokacije obrade i mehanizme prenosa. Popuniti rokove čuvanja evidencije naplate, rezervnih kopija i bezbednosnih logova.
- **Povraćaj.** Vlasnik postavlja `SELECTED_REFUND_OPTION` u `lib/legal/refund-options.ts` na `A` za varijantu bez povraćaja za započeti period uz 14-dnevni probni period ili `B` za proporcionalni povraćaj u prvih 14 dana. Proveriti odredbe o odustanku od digitalne usluge za potrošače u EU prema [Direktivi 2011/83/EU](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32011L0083) i primenljivom nacionalnom pravu.
- **FAQ i naplata.** Potvrditi zahtev za karticu u aktivnom Paddle Checkout-u, kao i omogućeno otkazivanje i vreme prestanka pretplate u Paddle portalu. Dopuniti kontakt za podršku.

Za ostvarivanje prava i pritužbe pogledati [uputstvo Poverenika](https://poverenik.rs/zastita-podataka/kako-da-ostvarite-svoja-prava/?script=lat).
