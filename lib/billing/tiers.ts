import type { PaidPlan } from "@/supabase/functions/_shared/billing-prices";
import { STARTER_MAX_STOCK_ITEMS } from "@/lib/plan/entitlements";

/**
 * Editable paid tiers for the pricing page + Paddle Checkout.
 * Price IDs come from env (never hard-coded).
 */

export type TierName = "Starter" | "Pro" | "Advanced";

export type TierInterval = "month" | "year";

export interface Tier {
  /** Billing plan key used by authorized checkout + webhooks. */
  key: PaidPlan;
  name: TierName;
  description: string;
  features: string[];
  /** Highlight as recommended on the pricing grid. */
  featured?: boolean;
  priceId: { month: string; year: string };
}

/** Marketing copy — edit features here. Price IDs are filled by `loadTiers()`. */
export const TIER_DEFINITIONS: ReadonlyArray<
  Omit<Tier, "priceId"> & {
    key: PaidPlan;
    priceEnv: { month: string; year: string };
  }
> = [
  {
    key: "starter",
    name: "Starter",
    description: "Za svakodnevno vođenje jedne kuhinje.",
    features: [
      "Neograničeni recepti i sastojci",
      `Trebovanje do ${STARTER_MAX_STOCK_ITEMS} stavki, otpis i dopuna`,
      "Raspored smena",
      "Food cost posle prodaje",
      "1 lokacija",
    ],
    priceEnv: {
      month: "PADDLE_PRICE_STARTER_MONTHLY_ID",
      year: "PADDLE_PRICE_STARTER_YEARLY_ID",
    },
  },
  {
    key: "pro",
    name: "Pro",
    description: "Za detaljnije praćenje troškova i zaliha.",
    featured: true,
    features: [
      "Sve iz Starter paketa",
      "Istorija cena sastojaka",
      "Trebovanje bez limita · inventura",
      "Pregled odstupanja troškova",
      "Više tajmera odjednom",
    ],
    priceEnv: {
      month: "PADDLE_PRICE_PRO_MONTHLY_ID",
      year: "PADDLE_PRICE_PRO_YEARLY_ID",
    },
  },
  {
    key: "advanced",
    name: "Advanced",
    description: "Paket za više lokacija.",
    features: [
      "Sve iz Pro paketa",
      "Više lokacija",
    ],
    priceEnv: {
      month: "PADDLE_PRICE_ADVANCED_MONTHLY_ID",
      year: "PADDLE_PRICE_ADVANCED_YEARLY_ID",
    },
  },
] as const;

const PRICE_ID_RE = /^pri_[a-z\d]{26}$/;

function readPriceId(envKey: string): string {
  const value = process.env[envKey]?.trim() ?? "";
  if (!value) {
    throw new Error(
      `Missing ${envKey}. Set the Paddle price id in your environment (see .env.example).`,
    );
  }
  if (!PRICE_ID_RE.test(value)) {
    throw new Error(
      `Invalid ${envKey}: expected a Paddle price id like pri_… (26 chars).`,
    );
  }
  return value;
}

/**
 * Server-only: resolve tier price IDs from env.
 * Throws if any required price id is missing or malformed — never silent defaults.
 */
export function loadTiers(): Tier[] {
  return TIER_DEFINITIONS.map((def) => ({
    key: def.key,
    name: def.name,
    description: def.description,
    features: [...def.features],
    featured: def.featured,
    priceId: {
      month: readPriceId(def.priceEnv.month),
      year: readPriceId(def.priceEnv.year),
    },
  }));
}

/** Soft load for pages that should still render when billing is not configured. */
export function tryLoadTiers(): { tiers: Tier[] } | { error: string } {
  try {
    return { tiers: loadTiers() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Billing tiers unavailable",
    };
  }
}

export function allTierPriceIds(tiers: Tier[]): string[] {
  return tiers.flatMap((tier) => [tier.priceId.month, tier.priceId.year]);
}
