# SECURITY DEFINER funkcije

Popis je izveden iz svih migracija i proveren prema katalogu lokalnog PostgreSQL
okruženja sa simuliranim Supabase ulogama. Prava ispod prikazuju `EXECUTE` za
`anon`, `authenticated` i `service_role`. Vlasnik funkcije ima sopstvena prava.
Produkcioni grantovi nisu proveravani.

Sve aktivne funkcije imaju eksplicitno podešen `search_path`. Postojeće funkcije
koje koriste prazan `search_path` i kvalifikovana imena zadržale su tu postavku.

| Funkcija i parametri | Provera pozivaoca ili pristupa | EXECUTE |
| --- | --- | --- |
| `public.accept_workspace_invite(p_token_hash text)` | Sesija, token, email i ograničenje broja mesta. Članstvo se kreira prihvatanjem. | `authenticated`, `service_role` |
| `public.adjust_stock(p_ingredient_id uuid, p_delta numeric, p_reason text, p_note text, p_purchase_order_id uuid, p_allow_negative boolean)` | Chef u radnom prostoru sastojka. Povezanu narudžbenicu proverava i triger. | `authenticated`, `service_role` |
| `public.allocate_purchase_order_number(p_workspace_id uuid)` | Chef u traženom radnom prostoru. | `authenticated`, `service_role` |
| `public.apply_ingredient_price_internal(p_ingredient_id uuid, p_new_price numeric, p_note text)` | Chef u radnom prostoru sastojka za korisnički poziv kroz prijem. Interno izvršavanje. | `service_role` |
| `public.apply_paddle_subscription(p_event_id text, p_occurred_at timestamp with time zone, p_transaction_id text, p_subscription jsonb, p_event_type text)` | Identitet kupca, odobrenje naplate i usklađivanje pretplate. Poziv servisa. | `service_role` |
| `public.assert_same_workspace()` | Triger proverava isti radni prostor roditelja i deteta. | `service_role` |
| `public.authorize_billing_account_deletion(p_user_id uuid, p_session_id uuid, p_token uuid)` | Zaključavanje naloga i sveža Auth sesija ciljnog korisnika. Poziv servisa. | `service_role` |
| `public.check_food_cost_alert(p_recipe_id uuid)` | Chef u radnom prostoru recepta za korisnički poziv. | `authenticated`, `service_role` |
| `public.check_low_stock_alert(p_ingredient_id uuid)` | Chef u radnom prostoru sastojka za korisnički poziv kroz podešavanje zaliha. Interno izvršavanje. | `service_role` |
| `public.claim_billing_lock(p_key text, p_token uuid)` | Zaključavanje naplate. Poziv servisa. | `service_role` |
| `public.create_workspace(p_name text)` | Zahteva auth.uid() i upisuje samo članstvo kreiranog radnog prostora. | `authenticated`, `service_role` |
| `public.delete_account(p_user_id uuid, p_session_id uuid)` | Nalog i sveža Auth sesija ciljnog korisnika. Poziv servisa. | `service_role` |
| `public.delete_billing_account(p_user_id uuid, p_session_id uuid, p_token uuid)` | Odobreno zaključavanje i Auth sesija ciljnog korisnika. Poziv servisa. | `service_role` |
| `public.effective_owner_plan(p_owner_id uuid)` | Za korisnika vraća plan samo ako auth.uid() odgovara traženom vlasniku. | `anon`, `authenticated`, `service_role` |
| `public.enforce_free_limit()` | Triger proverava ograničenje plana. | `service_role` |
| `public.enforce_price_history_plan()` | Triger funkcija iz ranijih migracija. Triger je uklonjen. | `service_role` |
| `public.enforce_stock_item_limit()` | Triger proverava ograničenje zaliha prema planu. | `service_role` |
| `public.enforce_workspace_invite_limit()` | Triger proverava ulogu menadžera i broj slobodnih mesta. | `service_role` |
| `public.get_entitlements(p_user_id uuid)` | Zahteva da traženi korisnik odgovara auth.uid(). | `authenticated`, `service_role` |
| `public.handle_new_user()` | Auth triger izvodi identitet iz novog reda auth.users. | `service_role` |
| `public.is_member(p_workspace_id uuid, p_min_role text)` | Proverava auth.uid() i minimalnu ulogu u radnom prostoru. | `authenticated`, `service_role` |
| `public.is_venue_owner(p_venue_id uuid)` | Proverava auth.uid() kao vlasnika i njegovo članstvo u radnom prostoru. | `authenticated`, `service_role` |
| `public.list_workspace_members(p_workspace_id uuid)` | Cook ili viša uloga u traženom radnom prostoru. | `authenticated`, `service_role` |
| `public.log_ingredient_price_change()` | Triger evidentira cenu prema planu radnog prostora. | `service_role` |
| `public.lookup_workspace_invite(p_token_hash text)` | Zahteva auth.uid() i token. Poziv je namenjen i pozvanim korisnicima pre članstva. | `authenticated`, `service_role` |
| `public.mark_alert_read(p_alert_id uuid)` | Cook ili viša uloga u radnom prostoru upozorenja. | `authenticated`, `service_role` |
| `public.mark_purchase_order_sent(p_order_id uuid, p_sent_to text)` | Chef u radnom prostoru narudžbenice. | `authenticated`, `service_role` |
| `public.published_recipe_allergens(p_recipe_id uuid)` | Javni pristup samo za izričito objavljene alergene uz odgovarajući plan. | `anon`, `authenticated`, `service_role` |
| `public.receive_purchase_order(p_order_id uuid, p_lines jsonb)` | Chef u radnom prostoru narudžbenice. Sastojci moraju biti iz istog radnog prostora. | `authenticated`, `service_role` |
| `public.refresh_recipe_cost_snapshot(p_recipe_id uuid)` | Cook ili viša uloga u radnom prostoru recepta za korisnički poziv. | `authenticated`, `service_role` |
| `public.release_billing_lock(p_key text, p_token uuid)` | Token zaključavanja naplate. Poziv servisa. | `service_role` |
| `public.revert_purchase_order_sent(p_order_id uuid)` | Chef u radnom prostoru narudžbenice. | `authenticated`, `service_role` |
| `public.schedule_command(p_action text, p_location uuid, p_week date, p_payload jsonb)` | Vlasništvo ili aktivno zaposlenje proverava schedule_scope. Zaposleni može da pošalje zahtev. | `authenticated`, `service_role` |
| `public.schedule_load(p_location uuid, p_week date)` | Vlasništvo ili aktivno zaposlenje proverava schedule_scope. | `authenticated`, `service_role` |
| `public.schedule_location_access(p_location_id uuid, p_owner_only boolean)` | Proverava auth.uid() za vlasnika ili aktivnog zaposlenog. | `authenticated`, `service_role` |
| `public.schedule_public(p_token uuid)` | Važeći, neopozvani token i odgovarajući plan. | `anon`, `authenticated`, `service_role` |
| `public.schedule_rank(p_owner uuid)` | Interna provera plana vlasnika rasporeda. | `service_role` |
| `public.schedule_report(p_location uuid, p_month date)` | Proverava auth.uid() kao vlasnika lokacije i plan. | `authenticated`, `service_role` |
| `public.schedule_share(p_location uuid, p_week date, p_revoke boolean)` | Zahteva vlasnički pristup preko schedule_scope i odgovarajući plan. | `authenticated`, `service_role` |
| `public.set_schedule_location_workspace_from_owner()` | Triger popunjava radni prostor preko vlasnika lokacije. | `service_role` |
| `public.set_venue_workspace_from_owner()` | Triger popunjava radni prostor preko vlasnika lokala. | `service_role` |
| `public.set_workspace_id_from_ingredient()` | Triger izvodi radni prostor iz sastojka. | `service_role` |
| `public.set_workspace_id_from_recipe()` | Triger izvodi radni prostor iz recepta. | `service_role` |
| `public.set_workspace_id_from_run()` | Triger izvodi radni prostor iz izvršavanja kontrolne liste. | `service_role` |
| `public.set_workspace_id_from_schedule_location()` | Triger izvodi radni prostor iz lokacije rasporeda. | `service_role` |
| `public.set_workspace_id_from_venue()` | Triger izvodi radni prostor iz lokala. | `service_role` |
| `public.waste_entries_before_insert()` | Triger proverava radni prostor sastojka ili recepta i snimak cene. | `service_role` |
| `public.waste_entries_reject_mutation()` | Triger odbija izmenu evidencije. | `service_role` |
| `public.workspace_has_feature(p_workspace_id uuid, p_feature text)` | Cook ili viša uloga. Interni pomoćnik proverava plan za prethodno autorizovane tokove. | `authenticated`, `service_role` |
| `public.workspace_member_limit(p_workspace_id uuid)` | Cook ili viša uloga. Vraća broj mesta prema planu vlasnika. | `authenticated`, `service_role` |
| `public.workspace_member_seat_count(p_workspace_id uuid)` | Cook ili viša uloga. Interni pomoćnik služi prihvatanju poziva pre članstva. | `authenticated`, `service_role` |
| `public.workspace_members_guard_last_owner()` | Triger čuva poslednjeg vlasnika. | `service_role` |
| `tenant_private.workspace_has_feature(p_workspace_id uuid, p_feature text)` | Interno. Pozivalac obavlja proveru autorizacije. | Samo vlasnik |
| `tenant_private.workspace_member_limit(p_workspace_id uuid)` | Interno. Pozivalac obavlja proveru autorizacije. | Samo vlasnik |
| `tenant_private.workspace_member_seat_count(p_workspace_id uuid)` | Interno. Pozivalac obavlja proveru autorizacije. | Samo vlasnik |

Funkcije prisutne samo u istoriji migracija:

- `public.record_signup_legal_consents()` uklonjena je u `20261204121000_record_legal_consents_with_user_session.sql`.
- `public.begin_stripe_event(p_id text, p_type text, p_payload jsonb)` i `public.finish_stripe_event(p_id text, p_lock_key text, p_token uuid, p_user_id uuid, p_customer_id text, p_subscription jsonb)` uklonjene su u `20261212120000_billing.sql`.
