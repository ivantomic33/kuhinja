# Paddle Billing

Na `/premium` su Starter, Pro i Advanced sa mesečnim i godišnjim cenama iz Paddle Price Preview-a. Prijavljeni korisnik pokreće checkout kroz `POST /api/billing/transaction`. Server veže transakciju za verifikovanog korisnika, a browser otvara Paddle.js sa vraćenim ID-jem. Nakon plaćanja `/premium/success` osvežava serverski status na dve sekunde, najviše 15 puta.

Potpisani događaji stižu na `POST /api/webhooks/paddle`. Upis u `billing_events` i sinhronizacija pretplate su transakcijski. Neuspešan upis ostavlja događaj spremnim za ponovnu isporuku. Događaj mora da odgovara Paddle kupcu i, pri prvoj aktivaciji, transakciji koju je odobrio TreuPlate. Stariji događaji ne prepisuju novije stanje. [Paddle potpis](https://developer.paddle.com/webhooks/about/signature-verification/), [custom data](https://developer.paddle.com/build/transactions/custom-data/)

Upravljanje pretplatom otvara Paddle portal preko `POST /api/billing/portal`. Aktivne i probne pretplate daju pristup. Status `past_due` daje pristup do isteka tri dana nakon kraja perioda. Otkazana pretplata zadržava pristup do kraja plaćenog perioda. Pauzirana pretplata je bez plaćenog pristupa.

## Sandbox

1. Koristite sandbox katalog sa mesečnom i godišnjom cenom bez trial polja za svaki prikazani paket. Starter i Pro mogu imati dodatne probne cene od 14 dana. `NEXT_PUBLIC_PADDLE_PRICE_MONTHLY` i `NEXT_PUBLIC_PADDLE_PRICE_YEARLY` su regularne Pro cene. [Šablon okruženja](../.env.example)
2. U staging Supabase bazi primenite migracije iz `supabase/migrations/`. Podesite sandbox API ključ na Next.js serveru, klijentski token sa prefiksom `test_` i `NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox`. API ključ treba da ima pristup cenama, kupcima, transakcijama, pretplatama i kreiranju sesija portala.
3. U Paddle-u podesite podrazumevani link naplate na `https://<domen>/checkout`. Koristite javno dostupan HTTPS staging domen ili tunel. Dodajte domen u Checkout konfiguraciju.
4. U Paddle Notifications dodajte `https://<domen>/api/webhooks/paddle` i postavite tajnu tog odredišta kao serverski `PADDLE_WEBHOOK_SECRET`. Izaberite `subscription.created`, `subscription.updated`, `subscription.activated`, `subscription.trialing`, `subscription.canceled`, `subscription.past_due`, `subscription.paused`, `subscription.resumed` i `transaction.completed`. Kada novo odredište uspešno primi događaje, preusmerite isporuku sa starog odredišta.
5. Kupite pretplatu test karticom. Proverite da potvrda prelazi u aktivnu pretplatu, da Supabase red ima odgovarajući `user_id`, `price_id` i status i da premium funkcije rade na `/dashboard`. Otvorite portal, zakažite otkazivanje i proverite pristup do `current_period_end`. Ponovite događaj kroz Paddle Webhook Simulator i proverite jedan red u `billing_events`. [Paddle sandbox](https://developer.paddle.com/sdks/sandbox/), [Webhook Simulator](https://developer.paddle.com/webhooks/simulator/)

## Postavljanje produkcije

Koristite odvojenu Supabase bazu, produkcioni katalog i token sa prefiksom `live_`. Na Next.js postavite `NEXT_PUBLIC_PADDLE_ENVIRONMENT=production`. Supabase funkcija za brisanje naloga koristi zasebnu serversku promenljivu `PADDLE_ENVIRONMENT=live`. Potpisani preostali pristup posle promene paketa zahteva `PADDLE_ACCESS_SECRET` na Next.js serveru.

Nadogradnja, prelazak na niži paket i otkazivanje dostupni su u TreuPlate podešavanjima. Portal služi za pregled pretplate i ažuriranje podataka naplate. Ostavite direktnu promenu paketa u portalu isključenu kako biste sačuvali pravila TreuPlate-a za obračun i promenu pristupa. [Paddle korisnički portal](https://developer.paddle.com/build/customers/integrate-customer-portal/)

Pre puštanja proverite odobrenje domena, javne pravne stranice i kontakt za podršku. [Paddle koraci za puštanje u rad](https://developer.paddle.com/build/go-live-checklist/)
