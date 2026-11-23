/**
 * Free-limit error codes raised by DB triggers / client guards / server actions.
 * Message format (preferred): `LIMIT_REACHED:FREE_LIMIT_<CODE>: ...`
 * Legacy: `FREE_LIMIT_<CODE>: ...`
 */
export const FREE_LIMIT_CODES = [
  "FREE_LIMIT_INGREDIENTS",
  "FREE_LIMIT_RECIPES",
  "FREE_LIMIT_TEMPLATES",
  "FREE_LIMIT_TIMERS",
  "FREE_LIMIT_STOCK_ITEMS",
  "FREE_LIMIT_PRICE_HISTORY",
] as const;

export type FreeLimitCode = (typeof FREE_LIMIT_CODES)[number];

export const LIMIT_REACHED = "LIMIT_REACHED" as const;

const CODE_SET = new Set<string>(FREE_LIMIT_CODES);

function extractFromText(text: string): FreeLimitCode | null {
  const direct = text.match(/\b(FREE_LIMIT_[A-Z_]+)\b/);
  if (direct && CODE_SET.has(direct[1])) {
    return direct[1] as FreeLimitCode;
  }

  // LIMIT_REACHED with resource keyword (no FREE_LIMIT_* token)
  if (/\bLIMIT_REACHED\b/i.test(text)) {
    const lower = text.toLowerCase();
    if (lower.includes("ingredient")) return "FREE_LIMIT_INGREDIENTS";
    if (lower.includes("recipe")) return "FREE_LIMIT_RECIPES";
    if (lower.includes("template")) return "FREE_LIMIT_TEMPLATES";
    if (lower.includes("timer")) return "FREE_LIMIT_TIMERS";
    if (lower.includes("stock")) return "FREE_LIMIT_STOCK_ITEMS";
    if (lower.includes("price") || lower.includes("history")) {
      return "FREE_LIMIT_PRICE_HISTORY";
    }
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
  if (
    lower.includes("price history") ||
    (lower.includes("history") && lower.includes("pro"))
  ) {
    return "FREE_LIMIT_PRICE_HISTORY";
  }

  return null;
}

/** Read free-limit code from any thrown / Supabase / ActionResult-style error. */
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
      resource?: unknown;
      error?: {
        message?: unknown;
        code?: unknown;
        details?: unknown;
        hint?: unknown;
        resource?: unknown;
      };
    };

    const nested = record.error;
    const code = record.code ?? nested?.code;
    if (typeof code === "string" && CODE_SET.has(code)) {
      return code as FreeLimitCode;
    }

    const resource = record.resource ?? nested?.resource;
    if (typeof resource === "string") {
      switch (resource) {
        case "ingredients":
          return "FREE_LIMIT_INGREDIENTS";
        case "recipes":
          return "FREE_LIMIT_RECIPES";
        case "templates":
          return "FREE_LIMIT_TEMPLATES";
        case "timers":
          return "FREE_LIMIT_TIMERS";
        case "stockItems":
          return "FREE_LIMIT_STOCK_ITEMS";
        case "priceHistory":
          return "FREE_LIMIT_PRICE_HISTORY";
        default:
          break;
      }
    }

    const parts = [
      record.message,
      record.code,
      record.details,
      record.hint,
      nested?.message,
      nested?.code,
      nested?.details,
      nested?.hint,
    ]
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
