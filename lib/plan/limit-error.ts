/**
 * Typed plan-limit errors returned by server actions / DB triggers.
 *
 * Canonical code: LIMIT_REACHED
 * Message format: `LIMIT_REACHED:<FREE_LIMIT_*>: human detail`
 * Legacy DB messages still use FREE_LIMIT_* alone — see free-limit.ts.
 */

import { FREE_LIMIT_CODES, type FreeLimitCode } from "@/lib/plan/free-limit";
import { sr } from "@/lib/i18n/sr";

export const LIMIT_REACHED = "LIMIT_REACHED" as const;

export type LimitResource =
  | "ingredients"
  | "recipes"
  | "templates"
  | "timers"
  | "stockItems"
  | "priceHistory";

export type LimitReachedPayload = {
  code: typeof LIMIT_REACHED;
  resource: LimitResource;
  freeLimitCode: FreeLimitCode | null;
  message: string;
};

const RESOURCE_TO_FREE_CODE: Record<LimitResource, FreeLimitCode | null> = {
  ingredients: "FREE_LIMIT_INGREDIENTS",
  recipes: "FREE_LIMIT_RECIPES",
  templates: "FREE_LIMIT_TEMPLATES",
  timers: "FREE_LIMIT_TIMERS",
  stockItems: "FREE_LIMIT_STOCK_ITEMS",
  priceHistory: "FREE_LIMIT_PRICE_HISTORY",
};

const FREE_CODE_TO_RESOURCE: Record<FreeLimitCode, LimitResource> = {
  FREE_LIMIT_INGREDIENTS: "ingredients",
  FREE_LIMIT_RECIPES: "recipes",
  FREE_LIMIT_TEMPLATES: "templates",
  FREE_LIMIT_TIMERS: "timers",
  FREE_LIMIT_STOCK_ITEMS: "stockItems",
  FREE_LIMIT_PRICE_HISTORY: "priceHistory",
};

/** Serbian upsell copy for a limit resource (UI sheet). */
export function limitReachedMessage(resource: LimitResource): string {
  switch (resource) {
    case "ingredients":
      return sr.premium.limits.ingredients;
    case "recipes":
      return sr.premium.limits.recipes;
    case "templates":
      return sr.premium.limits.templates;
    case "timers":
      return sr.premium.limits.timers;
    case "stockItems":
      return sr.premium.limits.stockItems;
    case "priceHistory":
      return sr.premium.limits.priceHistory;
    default:
      return sr.premium.limits.generic;
  }
}

/** Build a machine-readable LIMIT_REACHED message for APIs / Postgres. */
export function formatLimitReachedMessage(
  resource: LimitResource,
  detail?: string
): string {
  const freeCode = RESOURCE_TO_FREE_CODE[resource];
  const suffix = detail?.trim() || limitReachedMessage(resource);
  if (freeCode) {
    return `${LIMIT_REACHED}:${freeCode}: ${suffix}`;
  }
  return `${LIMIT_REACHED}: ${suffix}`;
}

export function limitReachedPayload(
  resource: LimitResource,
  detail?: string
): LimitReachedPayload {
  return {
    code: LIMIT_REACHED,
    resource,
    freeLimitCode: RESOURCE_TO_FREE_CODE[resource],
    message: formatLimitReachedMessage(resource, detail),
  };
}

export function resourceFromFreeLimitCode(
  code: FreeLimitCode
): LimitResource {
  return FREE_CODE_TO_RESOURCE[code];
}

export function freeLimitCodeFromResource(
  resource: LimitResource
): FreeLimitCode | null {
  return RESOURCE_TO_FREE_CODE[resource];
}

/** True when an ActionError / thrown value is LIMIT_REACHED. */
export function isLimitReachedError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") {
    return error.includes(LIMIT_REACHED) || FREE_LIMIT_CODES.some((c) => error.includes(c));
  }
  if (typeof error === "object") {
    const record = error as {
      code?: unknown;
      message?: unknown;
      error?: { code?: unknown; message?: unknown };
    };
    const code = record.code ?? record.error?.code;
    const message = record.message ?? record.error?.message;
    if (code === LIMIT_REACHED) return true;
    if (typeof code === "string" && FREE_LIMIT_CODES.includes(code as FreeLimitCode)) {
      return true;
    }
    if (typeof message === "string") {
      return (
        message.includes(LIMIT_REACHED) ||
        FREE_LIMIT_CODES.some((c) => message.includes(c))
      );
    }
  }
  return false;
}
