import { TRIAL_DAYS_PRO } from "@/lib/plan/entitlements";

export type RefundOptionId = "A" | "B";

type RefundOption = {
  summary: string;
  sections: ReadonlyArray<{
    id: string;
    title: string;
    paragraphs: readonly string[];
  }>;
};

export const REFUND_OPTIONS = {
  A: {
    summary: `Probni period traje ${TRIAL_DAYS_PRO} dana gde je ponuđen. Za započeti plaćeni period nema povraćaja osim kada ga nalaže važeći propis.`,
    sections: [
      {
        id: "probni-period",
        title: "Probni period i plaćeni period",
        paragraphs: [
          "Tokom probnog perioda nema naplate pretplate. Uslovi prve naplate prikazuju se u Paddle Checkout-u.",
          "Za započeti mesečni ili godišnji plaćeni period ne nudimo povraćaj, osim ako važeći propis nalaže drugačije.",
        ],
      },
    ],
  },
  B: {
    summary: "U roku od 14 dana od naplate možete zatražiti proporcionalni povraćaj za neiskorišćeni deo plaćenog perioda.",
    sections: [
      {
        id: "proporcionalni-povracaj",
        title: "Proporcionalni povraćaj u prvih 14 dana",
        paragraphs: [
          "Ako otkažete pretplatu u roku od 14 dana od naplate, možete zatražiti povraćaj za preostali neiskorišćeni deo obračunskog perioda.",
          "Zahtev pošaljite na kontakt adresu iz politike privatnosti. Po isteku 14 dana povraćaj se odobrava kada to nalaže važeći propis.",
        ],
      },
    ],
  },
} as const satisfies Record<RefundOptionId, RefundOption>;

export const EU_WITHDRAWAL_REVIEW = {
  id: "eu-odustanak",
  title: "Pravo potrošača u EU na odustanak",
  paragraphs: [
    "Pravo na odustanak od digitalne usluge, rok i način podnošenja zahteva, kao i posledice ranog početka pružanja usluge [potvrditi sa advokatom prema Direktivi 2011/83/EU i primenljivom nacionalnom pravu].",
  ],
};

// The owner selects A or B. Leave unset while the decision is pending.
export const SELECTED_REFUND_OPTION: RefundOptionId | null = null;

export function getSelectedRefundOption(): RefundOption | null {
  return SELECTED_REFUND_OPTION ? REFUND_OPTIONS[SELECTED_REFUND_OPTION] : null;
}
