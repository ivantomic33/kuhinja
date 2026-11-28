import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8 text-sm leading-relaxed">
      <div className="rounded-md border border-yellow-500 bg-yellow-50 p-4 text-yellow-800">
        Nacrt, pre objave pregledati sa advokatom.
      </div>

      <h1 className="text-2xl font-semibold">Politika privatnosti</h1>

      <section>
        <h2 className="font-medium mb-2">Nosilac podataka</h2>
        <p>[UNESI] (u daljem tekstu „mi“ ili „TreuPlate“).</p>
      </section>

      <section>
        <h2 className="font-medium mb-2">Koje podatke prikupljamo</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Email adresa</li>
          <li>Podaci o receptima</li>
          <li>Podaci o sastojcima i nabavnim cenama</li>
          <li>Podaci o smenama i rasporedu</li>
        </ul>
      </section>

      <section>
        <h2 className="font-medium mb-2">Svrha obrade</h2>
        <p>Pružanje funkcionalnosti aplikacije za profesionalne kuhinje.</p>
      </section>

      <section>
        <h2 className="font-medium mb-2">Pravni osnov</h2>
        <p>Izvršenje ugovora i legitimni interes.</p>
      </section>

      <section>
        <h2 className="font-medium mb-2">Sa kim se deli</h2>
        <p>Supabase (baza), Stripe / Paddle (plaćanje), hosting provajder.</p>
      </section>

      <section>
        <h2 className="font-medium mb-2">Koliko dugo se čuva</h2>
        <p>Podaci se čuvaju dok korisnik koristi nalog ili dok ne zatraži brisanje.</p>
      </section>

      <section>
        <h2 className="font-medium mb-2">Prava korisnika</h2>
        <p>Pristup, ispravka, brisanje, prenosivost podataka. Zahtev se šalje na kontakt email.</p>
      </section>

      <section>
        <h2 className="font-medium mb-2">Kolačići</h2>
        <p>Koristi se samo neophodne kolačiće za održavanje Supabase sesije. Nema analitike ili marketing kolačića.</p>
      </section>

      <section>
        <h2 className="font-medium mb-2">Kontakt</h2>
        <p>[UNESI]</p>
      </section>
    </div>
  );
}
