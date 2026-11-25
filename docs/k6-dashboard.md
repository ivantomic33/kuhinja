# k6 test čitanja na staging-u

## Rezultat

Na dan 24. novembra 2026. `k6 inspect load/dashboard.js` prošao je na k6 1.8.2 i potvrdio rampu i pragove. Merenje na staging-u čeka potvrđen HTTPS URL, staging Supabase projekat i testni nalog. P95 i stopa grešaka još nisu izmereni.

## Scenario

U prvih pet minuta broj aktivnih virtuelnih korisnika raste od 0 do 200. U narednih pet minuta raste od 200 do 500. Svaki korisnik redom čita `/dashboard`, `/ingredients` i `/recipes`, pa pravi pauzu od jedne sekunde. Setup jednom prijavljuje testni nalog u staging Supabase Auth-u. Virtuelni korisnici dele tu sesiju dok pristupni token važi. Preusmerenja se računaju kao neuspeh. Pragovi su p95 ispod 500 ms za označena čitanja i `http_req_failed` ispod 1% za sve zahteve. [Scenario](../load/dashboard.js) · [Grafana k6 pragovi](https://grafana.com/docs/k6/latest/using-k6/thresholds/)

## Staging pokretanje

1. Na staging deployment-u aplikacije postaviti `TREUPLATE_DEPLOYMENT=staging` i povezati ga sa izdvojenim Supabase projektom sa primenjenim migracijama i reprezentativnim testnim podacima.
2. Lokalno postaviti `K6_STAGING_ORIGIN` na HTTPS adresu aplikacije, `K6_STAGING_PROJECT_REF` na ID staging Supabase projekta i `K6_STAGING_ANON_KEY` na njegov javni publishable ili anon ključ. Testni kredencijali se čitaju iz `K6_STAGING_EMAIL` i `K6_STAGING_PASSWORD`.
3. Setup proverava oznaku deployment-a i poklapanje Supabase projekta na `/login` pre prijave. Zatim proverava da staging prihvata testnu sesiju i da ona važi tokom cele rampe.
4. Pokrenuti lokalnim k6 i sačuvati izveštaj u `docs/`.

   ```powershell
   k6 run --summary-mode=full load/dashboard.js | Tee-Object -FilePath docs/k6-dashboard-results.txt
   ```

   Uz izveštaj zabeležiti datum, verziju staging deploy-a i veličinu testnog skupa. [Grafana k6 izlaz rezultata](https://grafana.com/docs/k6/latest/get-started/results-output/)
