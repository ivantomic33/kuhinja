/**
 * Legal document versions — bump when text changes after lawyer review.
 * Registration stores these version strings with each consent row.
 */

export const LEGAL_DOCUMENTS = [
  "terms",
  "privacy",
  "refund",
  "marketing",
] as const;

export type LegalDocumentId = (typeof LEGAL_DOCUMENTS)[number];

export type LegalVersionMeta = {
  /** Semver-like document revision shown on the page and stored on consent. */
  version: string;
  /** ISO date (YYYY-MM-DD) of the last editorial change. */
  lastUpdated: string;
  /** Path without origin. */
  path: string;
  title: string;
  status: "nacrt" | "odobreno";
};

export const LEGAL_LAST_UPDATED = "2026-11-24";

/**
 * Single source of truth for public legal pages and consent recording.
 * Keep in sync with page content under app/(legal) and app/faq.
 */
export const LEGAL_VERSIONS = {
  terms: {
    version: "0.2.0-draft",
    lastUpdated: LEGAL_LAST_UPDATED,
    status: "nacrt",
    path: "/pravila-koriscenja",
    title: "Uslovi korišćenja",
  },
  privacy: {
    version: "0.2.0-draft",
    lastUpdated: LEGAL_LAST_UPDATED,
    status: "nacrt",
    path: "/privatnost",
    title: "Politika privatnosti",
  },
  refund: {
    version: "0.2.0-draft",
    lastUpdated: LEGAL_LAST_UPDATED,
    status: "nacrt",
    path: "/povracaj-novca",
    title: "Politika povraćaja",
  },
  marketing: {
    version: "0.2.0-draft",
    lastUpdated: LEGAL_LAST_UPDATED,
    status: "nacrt",
    path: "/privatnost",
    title: "Marketing komunikacija",
  },
} as const satisfies Record<LegalDocumentId, LegalVersionMeta>;

export const FAQ_VERSION = {
  title: "Česta pitanja",
  version: "0.2.0-draft",
  lastUpdated: LEGAL_LAST_UPDATED,
  status: "nacrt",
  path: "/faq",
} as const satisfies LegalVersionMeta;

export const PUBLIC_LEGAL_PAGES = [LEGAL_VERSIONS.terms, LEGAL_VERSIONS.privacy, LEGAL_VERSIONS.refund, FAQ_VERSION];

/** Documents that must be accepted at registration. */
export const REQUIRED_CONSENT_DOCUMENTS = ["terms", "privacy"] as const;

export type RequiredConsentDocument =
  (typeof REQUIRED_CONSENT_DOCUMENTS)[number];
