# Audit arhitekture

Inventar je napravljen iz svih migracija u `supabase/migrations/`, middleware-a, Supabase helpera, upisa zaliha i offline modula. Kataloški upiti izvršeni su na privremenoj PostgreSQL instanci (PGlite) sa minimalnom lokalnom `auth` šemom i ulogama Supabase-a. Rezultat opisuje stanje iz repozitorijuma. Veličine tabela na produkciji i konfiguracija udaljene Supabase instance zahtevaju proveru na toj instanci.

## Tabele i rute

Indeksi u tabeli prikazuju korisne prefikse za FK, kombinovane filtere i redosled. Svaka javna tabela ima primarni ključ. Rizik opisuje posledice greške i preostalu izloženost u konkretnom toku.

| Tabela ili ruta | RLS ili kontrola pristupa | Indeksi | Rizik |
| --- | --- | --- | --- |
| `profiles` | Da, forsiran. Pristup sopstvenom profilu po `auth.uid()`. | PK `id` pokriva i FK. Parcijalni `stripe_customer_id`. | Srednji |
| `venues` | Da, forsiran. `owner_id = auth.uid()`. | `(owner_id, created_at)` za prvi lokal, `(owner_id, updated_at)`. | Srednji |
| `ingredients` | Da, forsiran. Vlasništvo lokala. | `venue_id`, `(venue_id, name)`, `(venue_id, updated_at)`. | Srednji |
| `ingredient_price_history` | Da, forsiran. Vlasništvo lokala i Pro+ za čitanje. | `ingredient_id`, `(ingredient_id, recorded_at DESC)`. | Srednji |
| `recipes` | Da, forsiran. Vlasništvo lokala. | `venue_id`, `(venue_id, name)`, `(venue_id, updated_at)`. | Srednji |
| `recipe_items` | Da, forsiran. Vlasništvo recepta i provera istog lokala. | `recipe_id`, `ingredient_id`, jedinstven `(recipe_id, ingredient_id)`. | Visok. Zamena sastojaka recepta ima dva odvojena upisa. |
| `checklist_templates` | Da, forsiran. Vlasništvo lokala. | `venue_id`, `(venue_id, name)`, `(venue_id, updated_at)`. | Nizak |
| `checklist_runs` | Da, forsiran. `user_id = auth.uid()` i vlasništvo lokala i šablona. | `venue_id`, `template_id`, `user_id`, `(user_id, updated_at)`, `(venue_id, updated_at)`, jedinstven `(user_id, template_id)` za aktivne smene. | Srednji |
| `shift_checklist_items` | Da, forsiran. Pristup preko sopstvenog run-a i lokala. | PK `(run_id, item_id)`, `(run_id, updated_at)`, parcijalni `checked_by`. | Srednji |
| `stock_levels` | Da, forsiran. Vlasništvo lokala. | `venue_id`, `ingredient_id`, `(venue_id, ingredient_id)`, `(venue_id, updated_at)`. | Visok. Količine se računaju na klijentu i potom upisuju. |
| `stock_moves` | Da, forsiran. Vlasništvo lokala. | `venue_id`, `ingredient_id`, `user_id`, parcijalni `sale_id`, `(venue_id, created_at)`, `(venue_id, ingredient_id, created_at)`. | Srednji |
| `stripe_webhook_events` | Da, forsiran. Upis servisnom ulogom. | PK `id`. | Srednji |
| `legal_consents` | Da, forsiran. Čitanje i upis sopstvenih saglasnosti. | `user_id`, `(user_id, document, accepted_at DESC)`, jedinstven `(user_id, document, version)`. | Srednji |
| `schedule_locations` | Da, forsiran. Vlasnik ili aktivni član lokacije. | `(owner_id, created_at)`, parcijalni jedinstveni `owner_id` za podrazumevanu lokaciju. | Srednji |
| `schedule_employees` | Da, forsiran. Vlasnik ili sopstveno aktivno članstvo. | `location_id`, parcijalni `user_id`, `(location_id, id)`, `(location_id, user_id)`, `(location_id, login_email)`. | Srednji |
| `schedule_assignments` | Da, forsiran. Vlasnik ili aktivni član lokacije. | PK `(location_id, date, employee_id)`, `(location_id, employee_id)`. | Srednji |
| `schedule_publications` | Da, forsiran. Vlasnik ili aktivni član lokacije. | PK `(location_id, monday)`, `published_by`, `(location_id, published_at)`. | Srednji |
| `schedule_requests` | Da, forsiran. Vlasnik ili učesnik zahteva. | `employee_id`, `(location_id, date, created_at)`, `(location_id, employee_id)`, parcijalni `(location_id, with_employee_id)` i `decided_by`. | Srednji |
| `schedule_notifications` | Da, forsiran. Vlasnik ili primalac. | `employee_id`, `(location_id, employee_id, created_at)`. | Srednji |
| `schedule_share_links` | Da, forsiran. Vlasnik. Javno čitanje preko ograničenog RPC-a sa tokenom. | PK `token`, `location_id`, `(location_id, monday)`. | Srednji |
| `schedule_copy_undos` | Da, forsiran. Vlasnik lokacije. | PK `token`, `location_id`, `(location_id, monday)`. | Nizak |
| `/ingredients`, `/recipes`, `/recipes/[id]`, `/scaler`, `/scaler/[id]`, `/dashboard` | Sesija i RLS lokala. | FK i indeksi za sortiranje iznad. | Srednji |
| `PATCH /api/versioned-update` | Serverski `getUser()`, stroga Zod validacija i RLS. Konflikt vraća HTTP 409. | PK `id` sužava pretragu pre uslova `version`. | Nizak |
| `/shift`, `/shift/[templateId]` | Sesija, RLS šablona, run-a i stavki. | Parcijalni indeks aktivnog run-a i PK stavki. | Srednji |
| `/trebovanje` | Sesija i RLS zaliha. Cena i istorija pojedinačnog sastojka koriste jednu transakciju. | Indeksi `stock_levels` i `stock_moves`. | Srednji |
| `/raspored`, `/settings`, `/settings/billing` | Sesija uz RLS ili RPC provere članstva za raspored. | PK profila i indeksi rasporeda. | Srednji |
| `/r/[token]`, `/auth/callback` | Javne. RPC proverava token rasporeda, a callback razmenjuje kod i proverava korisnika. | PK tokena rasporeda. | Srednji |
| `/`, `/premium`, `/faq`, pravne stranice, stranice za prijavu i oporavak | Javne rute iz eksplicitne liste. | — | Nizak |
| `/~offline` i PWA resursi | Javni resursi. Lokalni keš i red upisa brišu se pri odjavi. | IndexedDB indeks `createdAt` za red upisa. | Srednji |

Supabase browser helper koristi zajednički klijent sa javnim ključem i korisničkom sesijom. Serverski helper koristi kolačiće po zahtevu. Postojeći model pristupa je vlasništvo lokala preko `venues.owner_id` i članstvo preko `schedule_employees` za raspored. U pregledanoj šemi nema zasebne P8 tabele članova workspace-a. Tabela istorije cena nosi naziv `ingredient_price_history`. [Serverski inventar](server-auth-inventory.md) · [Offline ponašanje](offline.md)

## Auth i inicijalna čitanja

- `classifyRoute` deli putanje na public, guest i auth. Bez sesijskog kolačića public i guest prolaze, a sve ostalo ide na prijavu. Prijavljen korisnik sa guest ulaza ide na `/dashboard`. Matcher izuzima sistemske resurse Next.js-a, PWA resurse i generisane slike za deljenje. [Lista ruta](../lib/auth/routes.ts) · [Middleware](../middleware.ts)
- Middleware poziva `getUser()` za HTML navigacije sa sesijskim kolačićem. Server actions i privatni route handleri verifikuju identitet jednom i prosleđuju ga proverama plana i vlasništva. Povratak sa OAuth servera koristi verifikovanog korisnika iz odgovora na razmenu koda.
- Lokalno su provereni `@supabase/ssr` 0.6.1 i `@supabase/supabase-js` 2.119.2. Serverski klijent izlaže `getClaims()`. SDK lokalno proverava potpis i rok asimetričnog JWT-a pomoću WebCrypto i keširanog JWKS-a. Za simetrične tokene, nedostupan ključ ili WebCrypto, SDK prelazi na `getUser(token)`. Hladan JWKS keš može zahtevati mrežni poziv. Server Components dele verifikovan identitet po renderu, a PostgreSQL sprovodi RLS. Mutacije koriste `getUser()`. [Serverski klijent](../lib/supabase/server.ts)
- `/dashboard`, `/ingredients` i `/recipes` učitavaju početne podatke u async Server Components i pune TanStack Query kroz `HydrationBoundary`. Liste čitaju hidrirani keš pri prvom renderu. Kreiranje i brisanje ažuriraju isti keš, a App Router osvežavanje šalje nov serverski snimak. Dashboard i dalje strimuje trendove i troškove recepata kroz postojeće granice učitavanja. [Hidracija](../lib/query/hydrate.tsx)

## Realtime kanali

Brojevi su po otvorenoj stranici u jednoj instanci browser klijenta.

| Stranica | Kanali | Opseg |
| --- | ---: | --- |
| `/trebovanje` | 1 kada postoji lokal | Događaji `INSERT` i `UPDATE` na `stock_levels` sa filterom `venue_id=eq.<id>`. |
| `/dashboard` | 0 | Serverski snimak. |
| `/ingredients` | 0 | Serverski snimak. |
| `/recipes` i `/recipes/[id]` | 0 | Serverski snimak. |
| `/shift` i `/shift/[templateId]` | 0 | IndexedDB replay i Supabase RPC. |
| `/raspored`, `/settings`, `/scaler` i javne stranice | 0 | Serverska čitanja po potrebi. |

Model zaliha koristi `venue_id` kao ekvivalent `workspace_id`. Slušaoci istog lokala dele jedan kanal. Cleanup oslobađa slušaoca, a odlazak poslednjeg zatvara kanal. Periodično ponovno čitanje nadoknađuje propuštene događaje i brisanja. [Registar kanala](../lib/realtime/workspace-channel.ts)

## Opterećenje

Scenario, pragovi i status staging merenja su zabeleženi u [k6 izveštaju](k6-dashboard.md).

## Kataloška provera

Uvodni SQL nije bio priložen. Upiti ispod potvrđuju da sve 21 javne tabele iz migracija imaju `ENABLE` i `FORCE ROW LEVEL SECURITY`. `stripe_webhook_events` ima nula klijentskih politika i koristi servisnu ulogu. Upit za FK vratio je nula redova. Dodatni indeks `idx_venues_owner_id_created_at` pokriva izbor prvog lokala vidljivog vlasniku.

```sql
select c.relname as table_name, c.relrowsecurity as rls, c.relforcerowsecurity as forced,
       (select count(*) from pg_policies p
        where p.schemaname = n.nspname and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by 1;

select tablename, indexname, indexdef
from pg_indexes where schemaname = 'public' order by 1, 2;

select c.conrelid::regclass as table_name, c.conname, pg_get_constraintdef(c.oid) as fk
from pg_constraint c
join pg_namespace n on n.oid = c.connamespace
where n.nspname = 'public' and c.contype = 'f' and not exists (
  select 1 from pg_index i
  where i.indrelid = c.conrelid and i.indisvalid
    and i.indnkeyatts >= cardinality(c.conkey)
    and (select array_agg(k order by k) from unnest(i.indkey) with ordinality a(k, pos)
         where pos <= cardinality(c.conkey))
        = (select array_agg(k order by k) from unnest(c.conkey) a(k))
    and (
      i.indpred is null or exists (
        select 1 from pg_attribute a
        where a.attrelid = c.conrelid and a.attnum = any(c.conkey)
          and pg_get_expr(i.indpred, i.indrelid) = format('(%I IS NOT NULL)', a.attname)
      )
    )
) order by 1, 2;
```

Za veliku postojeću tabelu prvo proveriti veličinu i saobraćaj. Kada je potreban online build indeksa, pokrenuti odgovarajući `CREATE INDEX CONCURRENTLY` kao samostalnu komandu van migracione transakcije sa istim imenom i definicijom. Zatim proveriti `pg_index.indisvalid` pre migracije sa `IF NOT EXISTS`.

## SQL test

`supabase test db` ili `psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql` nad lokalnom bazom sa svim migracijama proverava izolaciju dva korisnika, poništavanje cene pri padu upisa istorije, kontrolu verzija i nezavisne upise checklist stavki. Test koristi transakciju sa `ROLLBACK`.
