# Ručna provera Supabase Storage pristupa

Repozitorijum ne definiše Storage bucket-e ni politike za `storage.objects`.
U Supabase Dashboard-u prvo izaberite projekat koji je odobren za proveru.

1. Otvorite **Storage → Buckets**. Zabeležite ime i namenu svakog bucket-a.
2. Proverite oznaku **Public** na svakom bucket-u. Javni bucket omogućava preuzimanje fajla svima koji imaju njegovu javnu adresu. Korisnički i timski fajlovi treba da budu u privatnim bucket-ima.
3. Otvorite **Storage → Policies** i pregledajte pravila za `storage.objects`. Proverite ulogu, `bucket_id`, uslove čitanja i brisanja (`USING`) i uslove upisa i izmene (`WITH CHECK`). Svako pravilo treba da ograniči pristup na vlasnika fajla ili na odgovarajuću ulogu u njegovom radnom prostoru.
4. U lokalnom ili testnom projektu proverite dva naloga. Svaki nalog treba da može da pristupi svojim fajlovima, dok pristup privatnim fajlovima drugog naloga mora da bude odbijen. Proverite i pristup bez prijave.

Zabeležite stanje i odstupanja. Svaka izmena produkcionih podešavanja zahteva zasebno odobrenje.
