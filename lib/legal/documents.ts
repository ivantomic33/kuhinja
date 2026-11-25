/**
 * Draft legal page bodies (Serbian Latin).
 * Marked as nacrt until lawyer review. Placeholders use [popuniti].
 */

import { APP_NAME } from "@/lib/config/app";
import { EU_WITHDRAWAL_REVIEW, getSelectedRefundOption } from "@/lib/legal/refund-options";
import type { LegalDocumentId } from "@/lib/legal/versions";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

export type LegalPageContent = {
  id: Exclude<LegalDocumentId, "marketing">;
  intro: readonly string[];
  sections: readonly LegalSection[];
};

export const termsOfUse: LegalPageContent = {
  id: "terms",
  intro: [
    `Ovi uslovi uređuju korišćenje aplikacije ${APP_NAME} koju pruža [popuniti naziv pružaoca usluge].`,
  ],
  sections: [
    {
      id: "opis-usluge",
      title: "Opis usluge",
      paragraphs: [
        `${APP_NAME} je softverska usluga za profesionalne kuhinje: vođenje sastojaka i nabavnih cena, recepata i food cost proračuna, skaliranje količina, priprema smene (kontrolne liste), trebovanje/zalihe i nedeljni raspored, u okviru dostupnih paketa.`,
        "Pojedine funkcije zavise od paketa (Free, Starter, Pro i drugi koji budu ponuđeni). Opis paketa na sajtu je informativan; važeća prava proizlaze iz aktivne pretplate i tehničkih ograničenja u aplikaciji.",
      ],
    },
    {
      id: "pravo-koriscenja",
      title: "Pravo korišćenja i ograničenja",
      paragraphs: [
        "Stičete neisključivo, neprenosivo pravo da koristite uslugu za unutrašnje poslovanje svog lokala ili kuhinje, u skladu sa ovim uslovima i važećim propisima.",
        "Nije dozvoljeno: zloupotreba usluge; pokušaj neovlašćenog pristupa tuđim podacima; reverse engineering mimo zakonom dozvoljenog; preprodaja usluge bez dogovora; automatizovano masovno skidanje sadržaja; unošenje zlonamernog koda.",
        "Zadržavamo pravo da ograničimo ili suspendujemo nalog pri sumnji na zloupotrebu, neplaćanje ili kršenje uslova, uz razumnu obaveštenost gde je to izvodljivo.",
      ],
    },
    {
      id: "odgovornost-sadrzaja",
      title: "Odgovornost za sadržaj koji unosi korisnik",
      paragraphs: [
        "Vi ste isključivo odgovorni za tačnost i zakonitost podataka koje unosite: nabavne i prodajne cene, sastojke, alergene i napomene o alergenima, recepte, podatke o zaposlenima i rasporedu, zalihe i sličan poslovni sadržaj.",
        `${APP_NAME} ne proverava medicinsku, alergenu ni poresku tačnost unosa i ne snosi odgovornost za odluke donete na osnovu proračuna u aplikaciji (npr. food cost, skaliranje, trebovanje).`,
        "Ako unosite lične podatke zaposlenih ili saradnika, dužni ste da imate odgovarajući pravni osnov i da poštujete propise o zaštiti podataka.",
      ],
    },
    {
      id: "dostupnost",
      title: "Dostupnost usluge",
      paragraphs: [
        "Uslugu pružamo „kakva jeste“ i „kako je dostupna“. Ne garantujemo neprekidan rad, odsustvo grešaka ni određeni nivo dostupnosti, osim ako pisani ugovor ili opis plaćenog paketa izričito ne kaže drugačije.",
        "Mogući su planirani prozori održavanja, smetnje kod podprocesora (npr. hosting, baza, naplata) i offline režim sa ograničenim kešom na uređaju.",
      ],
    },
    {
      id: "trajanje-raskid",
      title: "Trajanje i raskid",
      paragraphs: [
        "Ugovor o korišćenju traje dok imate nalog. Možete ga raskinuti brisanjem naloga u Podešavanjima ili prestankom korišćenja.",
        "Portal naplate dostupan je iz podešavanja za korisnike sa Paddle nalogom za naplatu. Način otkazivanja i datum prestanka pretplate [potvrditi pre objave].",
        "Možemo raskinuti ili ograničiti pristup zbog teškog kršenja uslova, zloupotrebe ili zakonske obaveze.",
      ],
    },
    {
      id: "intelektualna",
      title: "Intelektualna svojina",
      paragraphs: [
        `Softver, dizajn, žig i dokumentacija ${APP_NAME} ostaju u vlasništvu pružaoca ili njegovih licenciara. Vaš poslovni sadržaj (recepti, cene, rasporedi) ostaje vaš; dajete nam licencu da ga obrađujemo isključivo radi pružanja usluge.`,
      ],
    },
    {
      id: "odgovornost",
      title: "Ograničenje odgovornosti",
      paragraphs: [
        "Do mere dozvoljene propisima Republike Srbije, ne odgovaramo za indirektnu, posledičnu ili izmaklu dobit nastalu korišćenjem ili nemogućnošću korišćenja usluge.",
      ],
    },
    {
      id: "merodavno-pravo",
      title: "Merodavno pravo i nadležnost",
      paragraphs: [
        "Na ove uslove i sporove u vezi sa uslugom primenjuje se pravo Republike Srbije, uz poštovanje prinudnih propisa koji se ne mogu ugovorom isključiti.",
        "Nadležni sud [popuniti posle pravnog pregleda].",
      ],
    },
    {
      id: "izmene",
      title: "Izmene uslova",
      paragraphs: [
        "Možemo ažurirati uslove. Nova verzija i datum objavljuju se na ovoj stranici. Bitne izmene možemo najaviti u aplikaciji ili e-poštom. Nastavak korišćenja posle stupanja na snagu znači prihvatanje, osim ako propis zahteva izričit novi pristanak.",
      ],
    },
  ],
};

export const privacyPolicy: LegalPageContent = {
  id: "privacy",
  intro: [
    `Ova politika opisuje kako ${APP_NAME} obrađuje podatke o ličnosti i poslovne podatke u vezi sa uslugom.`,
  ],
  sections: [
    {
      id: "rukovalac",
      title: "Rukovalac podataka",
      paragraphs: [
        `Rukovalac je pružalac usluge ${APP_NAME}: [popuniti puni naziv / PIB / adresu]. Kontakt za zaštitu podataka: [popuniti e-adresu].`,
      ],
    },
    {
      id: "koje-podatke",
      title: "Koje podatke prikupljamo",
      paragraphs: [
        "Podaci naloga: e-adresa, ime i prezime, naziv lokala, lozinka u heširanom obliku kod provajdera autentifikacije (ne čuvamo je u čitljivom obliku u našoj aplikacionoj bazi).",
        "Poslovni sadržaj koji unesete: recepti, sastojci, nabavne cene i istorija cena, zalihe, šabloni i evidencija smene, raspored i eventualni podaci o zaposlenima koje sami unesete (npr. ime u rasporedu).",
        "Podaci o pretplati i naplati obuhvataju identifikatore kupca i pretplate kod Paddle-a, plan, status i datume. Broj kartice se unosi u Paddle Checkout.",
        "Evidencija pravnih dokumenata i opcionog pristanka na marketing sadrži identifikator naloga, dokument, verziju i vreme prihvatanja.",
        "Tehnički podaci: sesijski kolačići neophodni za prijavu, bezbednosni i osnovni logovi servera, podaci o uređaju u meri u kojoj ih pregledač ili PWA prosleđuju.",
        "Offline keš na vašem uređaju: snimci nedavnih recepata, sastojaka i šablona, te red čekanja za određene offline izmene (npr. kontrolne liste), u IndexedDB i kešu servisnog radnika.",
      ],
    },
    {
      id: "svrha-osnov",
      title: "Svrha i pravni osnov po kategoriji",
      paragraphs: [
        "Pružanje naloga i usluge (izvršenje ugovora): registracija, prijava, čuvanje vašeg kuhinjskog sadržaja, sinhronizacija, pretplata.",
        "Naplata i računovodstvo pretplate (izvršenje ugovora / zakonska obaveza gde važi): Paddle i povezani poreski/računovodstveni podaci.",
        "Bezbednost i sprečavanje zloupotrebe (legitimni interes / zakonska obaveza): zaštita naloga, otkrivanje zloupotrebe, logovi.",
        "Unapređenje usluge na osnovu agregiranih ili anonimizovanih uvida — samo ako i kada uvedemo takvu obradu; trenutno ne koristimo marketing analitiku treće strane u aplikaciji.",
        "Marketing e-pošta — samo uz odvojen, neobavezan pristanak. Pristanak možete povući u svakom trenutku.",
        "Evidentiranje prihvatanja pravnih dokumenata služi dokazivanju koja je verzija prihvaćena (predloženi osnov je legitimni interes, [potvrditi pravni osnov]).",
        "Podaci o zaposlenima koje unesete: vi ste u pravilu rukovalac tih podataka; mi smo obrađivač u meri u kojoj ih hostujemo radi usluge. Pravni osnov na vašoj strani mora postojati pre unosa.",
      ],
    },
    {
      id: "podprocesori",
      title: "Podprocesori i primaoci",
      paragraphs: [
        "Supabase — autentifikacija, PostgreSQL baza, eventualni realtime i povezani hosting infrastrukture.",
        "Paddle — naplata pretplata i korisnički portal.",
        "Hosting aplikacije — [popuniti provajdera].",
        "Servis za e-poštu za potvrdu naloga i reset lozinke — [popuniti provajdera].",
        "Ako je dostupna i odaberete je, Google prijava razmenjuje podatke potrebne za autentifikaciju.",
      ],
    },
    {
      id: "prenos",
      title: "Prenos van Srbije ili EU",
      paragraphs: [
        "Lokacije obrade, eventualni prenosi van Srbije ili EU i primenjeni mehanizmi zaštite [popuniti posle potvrde infrastrukture i ugovora].",
      ],
    },
    {
      id: "rokovi",
      title: "Rokovi čuvanja",
      paragraphs: [
        "Podaci naloga i kuhinjski sadržaj čuvaju se dok nalog postoji.",
        "Nakon brisanja naloga u Podešavanjima, podaci se uklanjaju iz aktivne baze u skladu sa procedurom brisanja (kaskadno brisanje povezanih zapisa), osim podataka koje moramo zadržati zbog zakonskih obaveza (npr. knjigovodstveni trag naplate) u minimalnom neophodnom roku — [popuniti rokove posle pravnog pregleda].",
        "Pre brisanja naloga aplikacija otkazuje postojeću Paddle pretplatu. Paddle i dalje može čuvati identifikator kupca i evidenciju naplate. TreuPlate zadržava vezu između identifikatora obrisanog naloga i Paddle kupca radi bezbedne ponovne registracije sa potvrđenom adresom. Rokove i pravni osnov čuvanja treba potvrditi sa pravnim savetnikom.",
        "Čuvanje i brisanje rezervnih kopija i bezbednosnih logova [popuniti rokove].",
        "Evidencija prihvatanja u aplikaciji vezana je za nalog i briše se zajedno s njim. Eventualna obaveza dužeg čuvanja [potvrditi posle pravnog pregleda].",
      ],
    },
    {
      id: "prava",
      title: "Prava korisnika i kako se ostvaruju",
      paragraphs: [
        "U zavisnosti od primenjivog prava, možete imati pravo na: pristup, ispravku, brisanje, ograničenje obrade, prenosivost, prigovor na obradu zasnovanu na legitimnom interesu, te povlačenje pristanka gde je pristanak osnov.",
        "Ispravka imena: Podešavanja naloga.",
        "Brisanje naloga i većine povezanih podataka: Podešavanja → opasna zona (potvrda rečju OBRIŠI). Pre brisanja može biti potrebna nedavna prijava.",
        "Ostali zahtevi: e-pošta [popuniti kontakt]. Odgovaramo u rokovima propisanim zakonom.",
        "Pravo na pritužbu: Poverenik za informacije od javnog značaja i zaštitu podataka o ličnosti Republike Srbije (www.poverenik.rs), bez uticaja na druga pravna sredstva.",
      ],
    },
    {
      id: "kolacici-lokalno",
      title: "Kolačići, IndexedDB i servisni radnik",
      paragraphs: [
        "Neophodni kolačići: sesija prijave (Supabase Auth) i povezani bezbednosni kolačići. Bez njih prijavljeni deo aplikacije ne radi. Za ove kolačiće ne tražimo marketing pristanak.",
        "IndexedDB: offline keš recepata/sastojaka/šablona i red za određene offline upise (npr. smene).",
        "Keš servisnog radnika (PWA): statička sredstva i stranica koja se prikazuje kada mreža nije dostupna. Kuhinjski podaci za rad bez mreže čuvaju se u IndexedDB-u.",
        "Pri odjavi i brisanju naloga aplikacija pokušava da obriše lokalni keš, IndexedDB baze korisnika i Cache Storage na tom uređaju.",
        "Analitika treće strane trenutno nije uključena. Ako je dodamo, prikazaćemo baner za pristanak i nećemo učitavati analitiku dok pristanak nije dat.",
      ],
    },
    {
      id: "offline",
      title: "Offline keš",
      paragraphs: [
        "Offline režim čuva snimke radi čitanja bez mreže. Cene i podaci mogu biti zastareli do sledeće sinhronizacije.",
        "Odjava ili brisanje naloga pokreće brisanje offline keša i reda na tom uređaju. Sačekajte potvrdu sinhronizacije pre odjave da biste sačuvali lokalne izmene.",
      ],
    },
    {
      id: "deca",
      title: "Deca",
      paragraphs: [
        "Usluga je namenjena profesionalnim korisnicima i nije usmerena na decu mlađu od 18 godina.",
      ],
    },
    {
      id: "izmene-politike",
      title: "Izmene politike",
      paragraphs: [
        "Ažuriranja objavljujemo na ovoj stranici sa novim brojem verzije i datumom. Gde je potreban novi pristanak, zatražićemo ga u aplikaciji.",
      ],
    },
  ],
};

export function getRefundPolicy(): LegalPageContent {
  const option = getSelectedRefundOption();
  return {
    id: "refund",
    intro: [option?.summary ?? "Pravila za povraćaj novca [potvrditi izbor varijante]."],
    sections: [...(option?.sections ?? []), EU_WITHDRAWAL_REVIEW],
  };
}

export const legalPages = {
  terms: termsOfUse,
  privacy: privacyPolicy,
  get refund() {
    return getRefundPolicy();
  },
} as const;
