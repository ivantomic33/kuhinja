# Paddle naplata

Početak kupovine je na `/premium`. Stranica prikazuje Starter, Pro i Advanced sa mesečnim/godišnjim prekidačem. Cene dolaze iz `Paddle.PricePreview()` (samo `formattedTotals`, bez lokalnog računanja). Zemlja posetioca se čita server-side iz `x-vercel-ip-country` (ili CF) i prosleđuje klijentu; ako header nedostaje, Paddle sam detektuje IP.

**Subscribe** pokreće ovlašćeni checkout: Edge `create-checkout-session` veže Paddle kupca, kreira transakciju i vraća `/checkout?_ptxn=…`. Stranica otvara one-page overlay preko `Paddle.Checkout.open` (`displayMode: "overlay"`, `variant: "one-page"`). Uspeh vodi na `/welcome`. Prava pristupa aktivira potpisani webhook, ne sam redirect.

Editabilni tier copy i env ključevi za cene su u [`lib/billing/tiers.ts`](../lib/billing/tiers.ts). Obavezne su regularne cene (6× `pri_…`). Probne cene su opcione. Default payment link i dalje podesite na `https://<vaš-domen>/checkout` (ne localhost) radi Paddle payment linkova — vidi Checkout settings.

RSD se koristi za poslovne iznose u aplikaciji. Za pretplate u Paddle-u izaberite podržanu valutu poput EUR. [Paddle valute](https://developer.paddle.com/concepts/sell/supported-currencies/)

## Paddle MCP (AI agent)

Workspace MCP config is in [`.vscode/mcp.json`](../.vscode/mcp.json):

| Server | URL | Auth |
| --- | --- | --- |
| `paddle-sandbox` | `https://sandbox-mcp.paddle.com/mcp` | Sandbox API key (`pdl_sdbx_…`), prompted on first use |
| `paddle-live` | `https://mcp.paddle.com/mcp` | OAuth in the browser (or a live API key if you change the config) |

Reload the window after saving, then enable the servers in **MCP: Open User Configuration** / workspace MCP tools. Prefer sandbox while building the catalog. Name the environment in prompts (`Using paddle-sandbox…`). Review every `execute` before it runs.

TreuPlate expects three paid plans (Starter, Pro, Advanced), each with monthly + yearly prices. Matching 14-day trial price variants are optional. After the agent creates prices, copy the `pri_…` IDs into `.env.local` / Edge secrets as in [`.env.example`](../.env.example).

## Sandbox

1. U zasebnom sandbox nalogu napravite Starter, Pro i Advanced, svaki sa mesečnom i godišnjom cenom (bez trial polja na regularnoj ceni). Opciono, za Starter/Pro dodajte i posebnu cenu sa istim iznosom, valutom i periodom obnove, uz besplatni probni period od 14 dana koji zahteva karticu. Aplikacija bira probnu cenu samo za prvu pretplatu kada su trial ID-jevi podešeni; inače koristi regularnu cenu. Ako nudite popuste, napravite ih i ograničite na odgovarajuće cene u Paddle katalogu.
2. U `.env.local` postavite vrednosti po obrascu iz [`.env.example`](../.env.example). Postavite `PADDLE_ENVIRONMENT` i `NEXT_PUBLIC_PADDLE_ENVIRONMENT` na `sandbox`. Koristite Paddle sandbox API ključ i `test_` klijentski token. Postavite isti nasumičan `PADDLE_ACCESS_SECRET` na Next.js serveru i Edge funkcijama da verifikuju podatke o preostalom plaćenom pristupu. API ključ treba da ima pristup cenama, kupcima, transakcijama, pretplatama i kreiranju sesije korisničkog portala prema pozivima aplikacije.
3. Primeni migracije u lokalnom ili staging Supabase okruženju. Postavi Edge tajne iz obrasca. `SITE_URL` mora da odgovara poreklu checkout URL-a, a Paddle default payment link mora da vodi na `/checkout` na tom poreklu. Za provere preko Paddle-a koristi javno dostupan staging URL ili HTTPS tunel dostupan Paddle-u.
4. Objavi `create-checkout-session`, `create-portal-session` i `delete-account` u testnom okruženju. Objavi `paddle-webhook` uz `--no-verify-jwt`, jer Paddle potpisuje zahtev sopstvenim potpisom. U sandbox Paddle-u koristi postojeće odgovarajuće odredište ili kreiraj novo prema adresi webhooka i unesi njegov `endpoint_secret_key` kao `PADDLE_WEBHOOK_SECRET`. Uključi događaje `subscription.created`, `subscription.updated`, `subscription.activated`, `subscription.trialing`, `subscription.past_due`, `subscription.canceled`, `subscription.paused` i `subscription.resumed`.
5. Proveri Paddle test karticom oba paketa i ciklusa, probni period i ponovnu kupovinu, neuspelu naplatu i oporavak, portal, nadogradnju, prelazak na jeftiniji paket i godišnje na mesečno, otkazivanje i njegovo poništavanje. Proveri da sledeća naplata pri prelasku na jeftiniji paket ostaje na kraju postojeće obnove i da prava pristupa ostaju dostupna do tog datuma. Proveri ponovljene i zakasnele webhook događaje.

## Pretplate

Promena paketa ide kroz TreuPlate. U Paddle portalu i Paddle Retain ponudama ostavite promene paketa isključene da korisnicima ostane isti datum promene pristupa. Nadogradnja aktivne pretplate koristi Paddle proration. Promena paketa tokom besplatnog probnog perioda čuva datum prve naplate. Kod prelaska na niži paket TreuPlate potpisuje vreme do kog korisniku pripada prethodni plaćeni nivo, a Paddle zadržava postojeći datum naplate. SQL proverava pristup na osnovu tog vremena. Otkazivanje na kraju perioda i poništavanje idu kroz Paddle. Isplate i podaci o načinu plaćanja ostaju u Paddle-u.

Prva pretplata se vezuje za checkout transakciju koju je odobrio TreuPlate server. Događaji se evidentiraju jednom po ID-u, a stariji događaji ne prepisuju novije stanje. Nepoznata cena ne dodeljuje plaćena prava. Istorijski testni redovi prethodnog provajdera ostaju u bazi i ne određuju prava pristupa.

## Live posle sandbox provere

Zaseban live katalog, klijent i webhook tajna dolaze iz live naloga. Koristi odvojene Supabase baze za sandbox i live da ID-jevi Paddle kupaca i pretplata ostanu u odgovarajućem okruženju. Koristi `PADDLE_ENVIRONMENT=live` i `NEXT_PUBLIC_PADDLE_ENVIRONMENT=live`, uz live API ključ i `live_` klijentski token. Sačuvaj postojeće odredište za obaveštenja i njegovu tajnu. Koristi odobren HTTPS domen i setuj default payment link na `/checkout`. Paddle Retain dobija ID Paddle kupca prijavljenog korisnika.

Postavi javni webhook iza svog ulaznog proksija. Proksi prepisuje `X-TreuPlate-Source-IP` stvarnom adresom klijenta iz svog pouzdanog mrežnog sloja i dodaje `X-TreuPlate-Ingress-Token` sa vrednošću `PADDLE_INGRESS_TOKEN`. Proksi prosleđuje neizmenjeno telo i `Paddle-Signature`. Live Edge funkcija proverava token, osvežava listu adresa sa Paddle `/ips` i proverava potpis. Konfiguriši Paddle odredište prema javnom URL-u proksija. [Paddle smernice za webhookove](https://developer.paddle.com/webhooks/about/respond-to-webhooks/)

Proveri javne pravne stranice, kontakt, katalog i odobrenje domena pre verifikacije naloga. [Paddle koraci za puštanje u rad](https://developer.paddle.com/build/go-live-checklist/)
