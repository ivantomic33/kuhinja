# TreuPlate — smernice za dizajn

Ovaj vodič opisuje komponente i ekrane koji se održavaju u aplikaciji. U
interfejsu za kuhinju istaknite trenutnu cenu, najvažniji zadatak i primarnu
akciju. Koristite srpsku latinicu iz `lib/i18n/sr.ts` i naziv iz `lib/config/app.ts`.

## Tokeni

Vrednosti se održavaju u [app/globals.css](app/globals.css).

| Token | Vrednost | Primena |
| --- | --- | --- |
| `--background` | `#0B0B0E` | Platno aplikacije. |
| `--sidebar-bg` | `#111113` | Pozadina bočne navigacije. |
| `--surface`, `--surface-2`, `--surface-3` | `#18181B`, `#1F1F23`, `#27272A` | Kartice, polja i istaknute površine. |
| `--border`, `--border-strong` | `#27272A`, `#3F3F46` | Okviri i razdelnici. |
| `--text`, `--text-2`, `--text-3` | `#FAFAFA`, `#A1A1AA`, `#9898A1` | Primarni, sekundarni i pomoćni tekst. |
| `--accent`, `--accent-hover`, `--accent-pressed` | `#FF6B35`, `#FF7F50`, `#E85A28` | Mirovanje, prelazak pokazivačem i pritisak na primarnu akciju. |
| `--accent-ink` | `var(--background)` (`#0B0B0E`) | Tekst i ikone na punoj akcentnoj pozadini. |
| `--ring` | `#FF6B35` | Vidljiv fokus tastature. |
| `--success`, `--warning`, `--danger` | `#22C55E`, `#F59E0B`, `#EF4444` | Uspeh, upozorenje i destruktivne akcije. |
| `--danger-text` | `#F87171` | Crveni tekst na tamnoj ili zatamnjenoj površini. |
| `--radius-sm` do `--radius-xl` | `8`, `10`, `14`, `20px` | Kontrole, kartice i dijalozi. |
| `--app-max`, `--tap` | `1400px`, `44px` | Maksimalna širina sadržaja i ciljna veličina dodira. |
| `--page-pad` | `24px`, `16px` ispod 720 px | Unutrašnji razmak stranice. Na mobilnom se pri dnu dodaje prostor za navigaciju. |

Inter je osnovni font. Telo teksta je 14 px sa proredom 1,5. Naslovi koriste
20, 24 ili 28 px, težinu 600 i `tracking-tight`. Naslov stranice je 28 px,
odnosno 24 px ispod 720 px. Za prilagođene veličine koristite `text-ui-*`
ili odgovarajuće `--fs-*` tokene iz CSS-a. Manje oznake i podnaslovi u
gustim karticama mogu koristiti veličinu pomoćnog teksta.

Za novčane iznose koristite tabularne cifre. Kolone sa novčanim iznosima
poravnajte desno i prikažite dve decimale. `TableMoney` zadržava istu širinu
oznake jedinice u svakom redu, pa decimalni zarezi ostaju poravnati.

Razmaci koriste korake od 4 px, do 48 px. U Tailwind klasama koristite cele
korake od 1 do 12, a u CSS-u `--space-1` do `--space-12`. Nula je dozvoljena.

### Izuzeci

- Uvodni naslovi i razmaci između velikih celina na javnoj strani koriste
  veće, imenovane veličine. Ilustracija i promotivni naslov pored formulara
  za prijavu takođe koriste prikazne veličine.
- Položaj dijaloga, bezbedna zona ekrana, širina bočne navigacije i razmaci
  za skrolovanje do fiksnih zaglavlja prate dimenzije ekrana i kontrola.
  Javni pregled rasporeda prilagođava unutrašnji razmak širini ekrana.
- Slike za društvene mreže i verzija rasporeda za štampu koriste mere
  prilagođene platnu, odnosno papiru.

## Komponente i stanja

| Komponenta | Varijante i stanja |
| --- | --- |
| `PrimaryButton` | Primary, secondary, ghost i danger. Proverite mirovanje, hover, fokus, pritisak, disabled i loading. |
| `SegmentedControl`, `Tabs`, `Chip` | Izabrano, neizabrano, fokus i nedostupno. Izbor je dostupan tastaturi i asistivnim tehnologijama. |
| `Badge`, `PriceChange` | Neutralno, akcenat i semantička stanja. Promena cene koristi strelicu i predznak uz boju. |
| `KpiCard`, `ProgressBar`, `LimitMeter` | Podaci, trend, zaključana funkcija, približavanje limitu i pun limit. |
| `PageHeader`, `SectionCardHeader` | Naslov, opis, broj stavki ili primarna akcija u skladu sa ekranom. |
| `DataTable` | Gusti redovi, hover, izbor i prazna lista. Široka tabela skroluje u sopstvenom kontejneru. Ispod 768 px sastojci i recepti se prikazuju kao kartice sa cenom na vrhu. |
| `Skeleton`, `EmptyState`, `RouteError` | Skelet pri učitavanju, prazno stanje sa sledećim korakom i poruka sa ponovnim pokušajem. |
| `BottomSheet`, `ConfirmSheet` | Mobilni panel i desktop dijalog. Sadržaj skroluje između zaglavlja i podnožja sa akcijama. |
| `PricingCard` | Obična, istaknuta, aktivna i prigušena ponuda. |
| `Toast` | Potvrda, informacija ili greška. Poruku koja zahteva akciju prikažite i uz kontrolu. |

## Navigacija

- **Desktop od 1200 px.** Grupa Kuhinja sadrži Tablu, Recepte, Sastojke,
  Raspored, Smenu, Trebovanje i Skaliranje. Grupa Račun sadrži Premium i
  Podešavanja. Aktivna stavka ima akcentnu oznaku levo. Meni naloga sa odjavom
  je pri dnu bočne navigacije. Korisnik može da skupi navigaciju na traku sa ikonama.
- **Od 768 do 1199 px.** Bočna navigacija počinje skupljena. Nazivi se prikazuju
  pri prelasku mišem ili fokusu tastature. Proširena navigacija se otvara preko sadržaja.
- **Ispod 768 px.** Donja traka prikazuje Tabla, Recepti, Sastojci, Podešavanja i
  Više. Traka ostavlja prostor za bezbednu zonu uređaja. Dugme Više otvara donji
  panel sa dodatnim odredištima i odjavom. Zaglavlje otvara bočnu navigaciju.
- Skaler serije i Priprema smene počinju izborom recepta ili šablona. Obe
  destinacije, Trebovanje i Raspored imaju direktne veze iz bočne navigacije
  i menija Više.

## Pristupačnost

- Ciljajte najmanje **4,5:1** za normalan tekst i **3:1** za veliki tekst.
  TreuPlate primenjuje minimum 4,5:1 na oznake dugmadi i dok su nedostupna ili
  učitavaju. Za punu akcentnu pozadinu koristite `--accent-ink`.
  [WCAG minimalni kontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Čuvajte vidljiv fokus od 2 px na dugmadima i linkovima. Dijalog treba da
  primi fokus, podrži Escape i vrati fokus na okidač kada se zatvori.
- Obezbedite cilj dodira od 44 px za glavne mobilne akcije. Dodajte vidljivu
  oznaku ili pristupačno ime dugmadima sa samo ikonom.
- Značenje prenesite tekstom, simbolom ili stanjem kontrole. Koristite
  `aria-live` za dinamičke statuse i poštujte `prefers-reduced-motion`.
- Proverite ekran na 375 px i 1280 px. Primarna akcija treba da se vidi pri
  otvaranju, a poslednja stavka mora moći da se skroluje iznad fiksne trake ili
  lepljivog podnožja. Široke tabele skroluju unutar regiona tabele.

## Ekrani i status

Status opisuje mogućnosti u kodu. Ograničenja paketa održavaju se u
[lib/plan/entitlements.ts](lib/plan/entitlements.ts).

| Ekran | Putanja | Status |
| --- | --- | --- |
| Početna | `/` | Javni prikaz funkcija i cenovnika. |
| Prijava i registracija | `/login`, `/register` | Javno. Učitavanje, prazan obrazac, sledeći korak i ponovni pokušaj. |
| Oporavak lozinke | `/forgot-password`, `/reset-password` | Javno. Tok resetovanja putem e-pošte. |
| Kontrolna tabla | `/dashboard` | Za prijavljene. KPI kartice i prečice ka receptima, sastojcima i šablonima. |
| Sastojci | `/ingredients` | Za prijavljene. Pretraga, tabela ili kartice i obrazac za sastojak. |
| Recepti i trošak | `/recipes`, `/recipes/[id]` | Za prijavljene. Napredni uvidi zavise od paketa. |
| Skaler serije | `/scaler`, `/scaler/[id]` | Za prijavljene. Izbor recepta, skaliranje i lista za nabavku. PDF izvoz je nedostupan. |
| Priprema smene | `/shift`, `/shift/[templateId]` | Za prijavljene. Izbor šablona, ček-lista, tajmeri i offline red za ček-listu. |
| Trebovanje | `/trebovanje` | Za prijavljene. Zalihe, dopuna, prodaja, otpis i inventura prema paketu. |
| Raspored | `/raspored` | Raspored vlasnika od Starter paketa. Pristup zaposlenih zavisi od paketa poslodavca. |
| Deljeni raspored | `/r/[token]` | Javni prikaz uz važeću vezu za deljenje. |
| Podešavanja i naplata | `/settings`, `/settings/billing` | Za prijavljene. Nalog, ograničenja, bezbednost i naplata. `/podesavanja` preusmerava na `/settings`. |
| Premium | `/premium` | Poređenje paketa. Team i Business imaju liste čekanja. |
| Offline fallback | `/~offline` | Javni ekran iz PWA precache-a. |

[Snimci ekrana](docs/screenshots/) · [Istorija redizajna](CHANGELOG.md)
