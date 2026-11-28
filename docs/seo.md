# TreuPlate SEO

## URL-ovi i indeksiranje

`NEXT_PUBLIC_SITE_URL` je obavezno apsolutno HTTP(S) poreklo bez završne kose crte, putanje, query parametara ili kredencijala. Zod provera zaustavlja build pre kompajliranja ako je vrednost prazna ili nevažeća. Na produkciji postaviti javni HTTPS URL pre builda. Isti origin koriste canonical, Open Graph, Twitter, sitemap, robots i apsolutni URL-ovi strukturiranih podataka.

| Rute | Indeksiranje |
| --- | --- |
| `/`, `/premium`, `/kako-poceti`, `/faq`, `/pravila-koriscenja`, `/privatnost`, `/povracaj-novca` | Sedam javnih, indeksabilnih stranica. Svaka ima sopstveni canonical i ulazi u sitemap. |
| `/dashboard`, `/ingredients`, `/recipes`, `/scaler`, `/shift`, `/settings`, `/trebovanje`, `/raspored`, `/otpad`, `/purchase-orders` | Zajednički `app/(app)/layout.tsx` i HTTP zaglavlje `X-Robots-Tag: noindex, nofollow`. Zaglavlje se primenjuje i na podputanje i preusmerenja na prijavu. |
| `/premium/upravljanje`, `/premium/ponuda` | Zaseban `noindex, nofollow` u metapodacima i HTTP zaglavlju. `/premium` ostaje indeksabilan. |
| `/login` i `/register` | HTML robots `noindex`. |
| `/r/[token]` | Deljeni raspored, dostupan preko tokena. HTML i HTTP `noindex, nofollow`, bez sitemap unosa. |

`robots.txt` dozvoljava preuzimanje stranica pomoću `Allow: /`. Crawler mora moći da dođe do stranice ili preusmerenja da bi pročitao `noindex`. P1 middleware koristi default-deny i traži prijavu za privatne rute. [Google o pravilu noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

P2 obezbeđuje javne pravne stranice, FAQ i njihove datume iz `lib/legal/versions.ts`. Nacrti su trenutno javni i indeksabilni. Datumi početne i cenovnika u `app/sitemap.ts` predstavljaju poslednje izmene tih stranica. Ažurirati ih pri sledećoj izmeni njihovog sadržaja. Sedam URL-ova staje u jedan sitemap.

U repozitorijumu postoji `app/r/[token]/page.tsx`. RPC `schedule_public` vraća snimak rasporeda samo uz odgovarajući token i proveru plana. Tabela objava rasporeda služi drugom toku. Za javne recepte nema rute, oznake za objavu ni potvrđene uredničke kontrole. Predlog za vlasnika je `noindex` dok ne postoji eksplicitna objava i potvrda kvaliteta. Recipe JSON-LD, upit za ID-jeve, RLS politika za objavljene recepte i migracija vezani su za tu buduću odluku.

## Deljenje, strukturirani podaci i paketi

Open Graph i Twitter kartice koriste postojeći znak proizvoda i dve lokalne Inter datoteke. `pnpm fonts:og` priprema oba WOFF podskupa. Node runtime ih čita iz `assets/fonts/` i servira dve PNG slike od 1200 × 630.

Početna koristi postojeći logo i prikazuje `Organization` i `SoftwareApplication`. P6 prikaz i JSON-LD dobijaju isti skup planova iz P3 modula `lib/billing/plans.ts`. Strukturirani podaci koriste dostupne mesečne cene i njihove valute, uključujući Free. `/faq` prikazuje `FAQPage` iz istih pitanja i odgovora kao FAQ pretraga. Pravne stranice koriste `BreadcrumbList`. Zajednička komponenta serijalizuje i escapuje JSON-LD.

Google za obogaćeni prikaz softvera zahteva recenziju ili zbirnu ocenu. Postojeći sadržaj nema proverljivu recenziju ili ocenu za označavanje. Google je ukinuo FAQ obogaćene rezultate u maju 2026. Oznaka `FAQPage` ostaje u skladu sa Schema.org. [SoftwareApplication pravila](https://developers.google.com/search/docs/appearance/structured-data/software-app) · [Google Search izmene](https://developers.google.com/search/updates)

Hero snimak ima `priority`, `sizes`, dimenzije i opisni alt. Preostali snimci imaju dimenzije i opisni alt. Inter u glavnom layout-u koristi `next/font` i `display: "swap"`. Offline replay je dostupan u prijavljenom delu i na `/~offline`. Animacija prelaza je u prijavljenom delu. `ANALYZE=true` pri Webpack buildu uključuje postojeći `@next/bundle-analyzer` i piše izveštaje u `.next/analyze/`.

## Lokalne i udaljene provere

### HTTP i build

- `pnpm lint && pnpm test && pnpm build` pokrenuto je sa `NEXT_PUBLIC_SITE_URL=http://localhost:3107` i `ANALYZE=true`.
- Namerni build bez promenljive i build sa završnom kosom crtom završavaju sa izlaznim kodom 1 i porukom `NEXT_PUBLIC_SITE_URL must be an absolute HTTP(S) origin without a trailing slash, path, query, or credentials.`
- Na lokalnom produkcijskom serveru `curl -I` za svih osam privatnih prefiksa i `/premium/upravljanje` bez prijave vraća `307 Temporary Redirect`, `X-Robots-Tag: noindex, nofollow` i lokaciju `/login?next=…`. Provera sa prijavom čeka testni nalog. Nevažeći token rasporeda vraća `404` i isto robots zaglavlje.
- `GET /login` i `GET /register` daju HTML sa `<meta name="robots" content="noindex"/>`. Svih sedam javnih stranica ima renderovan apsolutni canonical, `og:type=website`, `og:locale=sr_RS` i `twitter:card=summary_large_image`.
- `/opengraph-image` i `/twitter-image` vraćaju `200 image/png`. `/robots.txt` sadrži apsolutni URL sitemap-a, a sitemap sadrži sedam javnih URL-ova.

### Domen i predaja sitemap-a

Vlasnik je potvrdio da je odluka o kanonskom domenu otvorena. Preusmerenje između hostova sledi posle izbora:

- **Apex**, npr. `https://example.com`. `www.example.com` trajno preusmerava na apex. Canonical, sitemap i javna konfiguracija koriste apex.
- **WWW**, npr. `https://www.example.com`. `example.com` trajno preusmerava na www. Canonical, sitemap i javna konfiguracija koriste www.

Po izboru podesiti DNS i TLS za oba hosta, postaviti isti kanonski origin u produkcioni `NEXT_PUBLIC_SITE_URL` i primeniti `permanent: true` uz `has` uslov za alternativni host u `next.config.ts`. Proveriti oba hosta sa `curl -I`. Alternativni host treba da vrati 308 sa kanonskom lokacijom, a kanonski host treba da posluži stranicu bez petlje.

1. U Google Search Console dodati domen i potvrditi vlasništvo DNS TXT zapisom. U **Sitemaps** predati `sitemap.xml` sa kanonskog domena i proveriti status. [Google Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start) · [Google sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
2. U Bing Webmaster Tools dodati isti sajt i potvrditi vlasništvo ili uvesti potvrđeni sajt iz Google Search Console. U **Sitemaps** predati pun URL kanonskog `/sitemap.xml` ako već nije uvezen. Proveriti status obrade. [Bing verifikacija](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b) · [Bing sitemap](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed)
