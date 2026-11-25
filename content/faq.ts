/**
 * Shared FAQ source for landing (subset) and /faq (full list).
 * Answers must match real product behavior.
 */

import { APP_NAME } from "@/lib/config/app";
import { TRIAL_DAYS_PRO, FREE_MAX_RECIPES, FREE_MAX_INGREDIENTS } from "@/lib/plan/entitlements";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { getSelectedRefundOption } from "@/lib/legal/refund-options";

export const FAQ_CATEGORIES = [
  "Opšte",
  "Paketi i cene",
  "Naplata i otkazivanje",
  "Offline i PWA",
  "Podaci i privatnost",
  "Tehnička pitanja",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  /** When true, item is highlighted on the marketing landing FAQ. */
  featured?: boolean;
  required?: boolean;
};

const refund = getSelectedRefundOption();

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "no-card-free",
    category: "Paketi i cene",
    question: "Da li mogu bez kartice?",
    answer: `Da. Free plan ne traži karticu. Možete voditi do ${FREE_MAX_RECIPES} recepata i ${FREE_MAX_INGREDIENTS} sastojaka, kalkulator troška porcije i osnovne funkcije bez plaćanja.`,
    featured: true,
  },
  {
    id: "trial-card",
    category: "Paketi i cene",
    question: "Postoji li probni period i da li je potrebna kartica?",
    answer: `Free plan ne traži karticu. Plaćeni Paddle Checkout je podešen sa probnim periodom od ${TRIAL_DAYS_PRO} dana. Da li je za probni period potrebno uneti karticu [potvrditi za aktivni Paddle Checkout].`,
    featured: true,
  },
  {
    id: "who-for",
    category: "Opšte",
    question: `Za koga je ${APP_NAME}?`,
    answer:
      "Za restorane, profesionalne kuhinje i male lokale kojima trebaju food cost, skaliranje recepata, smene, trebovanje i raspored na jednom mestu.",
    featured: true,
  },
  {
    id: "offline",
    category: "Offline i PWA",
    question: "Da li aplikacija radi bez interneta?",
    answer:
      "Delimično. Keširani recepti, sastojci i šabloni ostaju čitljivi offline. Pojedine izmene (npr. kontrolne liste smene) mogu ući u red i poslati se kad se mreža vrati. Live naplata, novi podaci sa servera i neke akcije zahtevaju vezu. Aplikaciju možete instalirati kao PWA.",
    featured: true,
  },
  {
    id: "cancel",
    category: "Naplata i otkazivanje",
    question: "Kako se otkazuje pretplata?",
    answer:
      "U Podešavanjima izaberite „Upravljaj naplatom“. Ako imate Paddle nalog za naplatu, stranica prikazuje dugme za Paddle portal. Dostupnost otkazivanja i datum prestanka pretplate [potvrditi pre objave].",
    featured: true,
  },
  {
    id: "after-expiry",
    category: "Naplata i otkazivanje",
    question: "Šta se dešava sa podacima posle isteka pretplate?",
    answer:
      "Istek pretplate ne pokreće brisanje recepata, sastojaka ili smena. Po isteku važe ograničenja Free paketa, uključujući limite pri dodavanju novog sadržaja. Brisanje naloga je posebna radnja u Podešavanjima.",
  },
  {
    id: "delete-account",
    category: "Podaci i privatnost",
    question: "Kako se briše nalog?",
    answer:
      "Podešavanja → opasna zona → Obriši nalog. Potrebno je da otkucate potvrdnu reč OBRIŠI. Brisanje je trajno i uklanja nalog, profile i povezane kuhinjske podatke prema serverskoj proceduri. Pre brisanja može biti potrebna prijava u poslednjih nekoliko minuta. Pri odjavi/brisanju briše se i lokalni offline keš na uređaju.",
  },
  {
    id: "refund-policy",
    category: "Naplata i otkazivanje",
    question: "Da li postoji povraćaj novca?",
    answer: `${refund?.summary ?? "Pravila povraćaja [potvrditi izbor varijante]."} Dokument je dostupan na ${LEGAL_VERSIONS.refund.path}.`,
  },
  {
    id: "food-cost-speed",
    category: "Tehnička pitanja",
    question: "Koliko brzo se računa food cost?",
    answer:
      "Uživo u pregledaču, čim unesete ili izmenite sastojak i količine u receptu. Proračun ne čeka poseban server round-trip za osnovni food cost prikaz.",
    featured: true,
  },
  {
    id: "packages",
    category: "Paketi i cene",
    question: "Koja je razlika između Free, Starter i Pro?",
    answer:
      "Free: ograničen broj recepata i sastojaka, osnovni kalkulator i jedan šablon smene. Starter: više kapaciteta, raspored i trebovanje sa limitom stavki. Pro: istorija nabavnih cena, naprednije zalihe/trebovanje, više šablona i tajmera i ostale Pro stavke sa stranice Premium. Team/Business mogu biti na listi čekanja.",
  },
  {
    id: "data-ownership",
    category: "Podaci i privatnost",
    question: "Ko vidi moje cene i recepte?",
    answer:
      "Vaš kuhinjski sadržaj vezan je za vaš nalog i lokal (RLS u bazi). Javni linkovi postoje samo tamo gde ih sami uključite (npr. deljeni raspored). Zaposleni sa kojima delite uređaj mogu videti keš dok ste prijavljeni — odjavite se na deljenim tabletima.",
  },
  {
    id: "privacy-rights",
    category: "Podaci i privatnost",
    question: "Gde su uslovi i politika privatnosti?",
    answer: `Uslovi: ${LEGAL_VERSIONS.terms.path}. Privatnost: ${LEGAL_VERSIONS.privacy.path}. Povraćaj: ${LEGAL_VERSIONS.refund.path}. Dokumenti su javni i označeni kao nacrt dok ih advokat ne pregleda.`,
  },
  {
    id: "pwa-install",
    category: "Offline i PWA",
    question: "Mogu li da instaliram aplikaciju na telefon ili tablet?",
    answer: `Da. ${APP_NAME} je PWA: u podržanom pregledaču možete je dodati na početni ekran. Servisni radnik kešira sredstva za brži start i offline čitanje keširanog sadržaja.`,
  },
  {
    id: "sign-out-cache",
    category: "Offline i PWA",
    question: "Šta se briše pri odjavi?",
    answer:
      "Odjava čisti lokalni keš korisnika: React Query keš, IndexedDB (offline podaci i red), Cache Storage servisnog radnika i lokalnu auth sesiju na uređaju, da sledeći korisnik na deljenom uređaju ne vidi tuđe podatke.",
  },
  {
    id: "sign-out-pending",
    category: "Offline i PWA",
    question: "Šta se dešava ako se odjavim pre sinhronizacije?",
    answer: "Odjava briše lokalni red i listu neuspelih upisa na uređaju. Nesinhronizovane izmene time mogu biti izgubljene. Vratite vezu i sačekajte da se izmene pošalju pre odjave.",
  },
  {
    id: "allergens",
    category: "Opšte",
    question: "Da li TreuPlate garantuje tačnost alergena?",
    answer:
      "Ne. Alergeni, cene i podaci o zaposlenima koje unesete vaša su odgovornost. Aplikacija ne zamenjuje stručnu ili zakonsku proveru.",
  },
  {
    id: "support",
    category: "Tehnička pitanja",
    question: "Kako da prijavim grešku?",
    answer:
      "Pišite na kontakt e-adresu iz politike privatnosti ([popuniti]) sa opisom koraka, pregledačem i da li ste online ili offline. Za probleme sa naplatom koristite i portal naplate.",
  },
] as const;

/** Landing / compact FAQ: featured items only, stable order. */
export function getFeaturedFaqItems(): FaqItem[] {
  return FAQ_ITEMS.filter((item) => item.featured);
}

export function getLandingFaqItems(): FaqItem[] {
  const publishable = FAQ_ITEMS.filter(({ answer }) => !/\[(?:popuniti|potvrditi|nakon odobrenja)/i.test(answer));
  const required = publishable.filter((item) => item.required);
  return [...required, ...publishable.filter((item) => !item.required)].slice(0, 4);
}

export function getFaqByCategory(category: FaqCategory | "all"): FaqItem[] {
  if (category === "all") return [...FAQ_ITEMS];
  return FAQ_ITEMS.filter((item) => item.category === category);
}

export function searchFaqItems(
  query: string,
  category: FaqCategory | "all" = "all",
  items: readonly FaqItem[] = FAQ_ITEMS,
): FaqItem[] {
  const term = normalizeSearch(query.trim());
  return items.filter((item) =>
    (category === "all" || item.category === category) &&
    normalizeSearch(`${item.question} ${item.answer} ${item.category}`).includes(term),
  );
}

function normalizeSearch(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ|dj/g, "d");
}
