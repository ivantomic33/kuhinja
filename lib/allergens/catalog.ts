/**
 * EU Regulation (EU) No 1169/2011 — Annex II allergen catalogue.
 * Single source of truth for UI, Zod enums, and SQL check constraints.
 *
 * Codes are stable ASCII identifiers. Labels are Serbian (Latin) display names.
 * `uredba` is the Annex II item number (1–14).
 */

export const ALLERGEN_CODES = [
  "gluten",
  "rakovi",
  "jaja",
  "riba",
  "kikiriki",
  "soja",
  "mleko",
  "orasasti_plodovi",
  "celer",
  "senf",
  "susam",
  "sumpor_dioksid",
  "lupina",
  "mekusci",
] as const;

export type AllergenCode = (typeof ALLERGEN_CODES)[number];

export type AllergenPresence = "contains" | "trace";

export type AllergenCatalogEntry = {
  code: AllergenCode;
  label: string;
  /** Annex II ordinal (1–14). */
  uredba: number;
};

export const ALLERGEN_CATALOG: readonly AllergenCatalogEntry[] = [
  { code: "gluten", label: "Žitarice koje sadrže gluten", uredba: 1 },
  { code: "rakovi", label: "Rakovi", uredba: 2 },
  { code: "jaja", label: "Jaja", uredba: 3 },
  { code: "riba", label: "Riba", uredba: 4 },
  { code: "kikiriki", label: "Kikiriki", uredba: 5 },
  { code: "soja", label: "Soja", uredba: 6 },
  { code: "mleko", label: "Mleko", uredba: 7 },
  { code: "orasasti_plodovi", label: "Orašasti plodovi", uredba: 8 },
  { code: "celer", label: "Celer", uredba: 9 },
  { code: "senf", label: "Senf", uredba: 10 },
  { code: "susam", label: "Susam", uredba: 11 },
  { code: "sumpor_dioksid", label: "Sumpor-dioksid i sulfiti", uredba: 12 },
  { code: "lupina", label: "Lupina", uredba: 13 },
  { code: "mekusci", label: "Mekušci", uredba: 14 },
] as const;

export const ALLERGEN_PRESENCE = ["contains", "trace"] as const;

export function allergenLabel(code: AllergenCode): string {
  const entry = ALLERGEN_CATALOG.find((row) => row.code === code);
  return entry?.label ?? code;
}

export function isAllergenCode(value: string): value is AllergenCode {
  return (ALLERGEN_CODES as readonly string[]).includes(value);
}
