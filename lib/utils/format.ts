/**
 * Display formatting helpers (sr-Latn). UI only — never use for calc.
 */

const LOCALE = "sr-Latn-RS";

/** Format a money amount with thousand separators (e.g. 1.990). */
export function formatMoney(
  value: number,
  options?: { fractionDigits?: number }
): string {
  const fractionDigits = options?.fractionDigits ?? 0;
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Format a percent with optional sign (+/−). */
export function formatPercent(
  value: number,
  options?: { fractionDigits?: number; signed?: boolean }
): string {
  const fractionDigits = options?.fractionDigits ?? 1;
  if (!Number.isFinite(value)) return "0%";
  const body = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(value));
  if (!options?.signed) return `${body}%`;
  if (value > 0) return `+${body}%`;
  if (value < 0) return `−${body}%`;
  return `${body}%`;
}

/** Short date for tables (e.g. 12. mar 2026.). */
export function formatShortDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(LOCALE, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
