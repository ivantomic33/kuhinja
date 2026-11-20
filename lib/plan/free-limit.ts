/**
 * Free-limit error codes raised by DB triggers / client guards.
 * Message format: `FREE_LIMIT_<CODE>: ...`
 */
export const FREE_LIMIT_CODES = [
  "FREE_LIMIT_INGREDIENTS",
  "FREE_LIMIT_RECIPES",
  "FREE_LIMIT_TEMPLATES",
  "FREE_LIMIT_TIMERS",
  "FREE_LIMIT_STOCK_ITEMS",
] as const;

export type FreeLimitCode = (typeof FREE_LIMIT_CODES)[number];

const CODE_SET = new Set<string>(FREE_LIMIT_CODES);

function extractFromText(text: string): FreeLimitCode | null {
  const direct = text.match(/\b(FREE_LIMIT_[A-Z_]+)\b/);
  if (direct && CODE_SET.has(direct[1])) {
    return direct[1] as FreeLimitCode;
  }

  // Legacy English messages from older triggers
  const lower = text.toLowerCase();
  if (lower.includes("maximum 20 ingredients") || lower.includes("ingredients per venue")) {
    return "FREE_LIMIT_INGREDIENTS";
  }
  if (
    lower.includes("maximum 1 recipe") ||
    lower.includes("maximum 5 recipes") ||
    lower.includes("recipes per venue")
  ) {
    return "FREE_LIMIT_RECIPES";
  }
  if (lower.includes("template") && lower.includes("limit")) {
    return "FREE_LIMIT_TEMPLATES";
  }
  if (lower.includes("timer") && lower.includes("limit")) {
    return "FREE_LIMIT_TIMERS";
  }
  if (
    lower.includes("stock") &&
    (lower.includes("limit") || lower.includes("maximum"))
  ) {
    return "FREE_LIMIT_STOCK_ITEMS";
  }

  return null;
}

/** Read free-limit code from any thrown / Supabase-style error. */
export function getFreeLimitCode(error: unknown): FreeLimitCode | null {
  if (!error) return null;

  if (typeof error === "string") {
    return extractFromText(error);
  }

  if (typeof error === "object") {
    const record = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const parts = [record.message, record.code, record.details, record.hint]
      .filter((part): part is string => typeof part === "string")
      .join(" ");

    if (parts) {
      return extractFromText(parts);
    }
  }

  return null;
}

export function isFreeLimitError(error: unknown): boolean {
  return getFreeLimitCode(error) !== null;
}
