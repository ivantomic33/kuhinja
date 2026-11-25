import { afterEach, describe, expect, it } from "vitest";
import { loadTiers, tryLoadTiers } from "@/lib/billing/tiers";

const PRICE_ENV_KEYS = [
  "PADDLE_PRICE_STARTER_MONTHLY_ID",
  "PADDLE_PRICE_STARTER_YEARLY_ID",
  "PADDLE_PRICE_PRO_MONTHLY_ID",
  "PADDLE_PRICE_PRO_YEARLY_ID",
  "PADDLE_PRICE_ADVANCED_MONTHLY_ID",
  "PADDLE_PRICE_ADVANCED_YEARLY_ID",
] as const;

/** Valid-shaped pri_ + 26 [a-z0-9] ids for unit tests only. */
const sampleIds = {
  PADDLE_PRICE_STARTER_MONTHLY_ID: "pri_01stamonth0000000000000001",
  PADDLE_PRICE_STARTER_YEARLY_ID: "pri_01stayear00000000000000001",
  PADDLE_PRICE_PRO_MONTHLY_ID: "pri_01promonth0000000000000001",
  PADDLE_PRICE_PRO_YEARLY_ID: "pri_01proyear00000000000000001",
  PADDLE_PRICE_ADVANCED_MONTHLY_ID: "pri_01advmonth0000000000000001",
  PADDLE_PRICE_ADVANCED_YEARLY_ID: "pri_01advyear00000000000000001",
} as const;

function clearPriceEnv() {
  for (const key of PRICE_ENV_KEYS) {
    delete process.env[key];
  }
}

function setPriceEnv(values: Record<string, string>) {
  for (const key of PRICE_ENV_KEYS) {
    process.env[key] = values[key];
  }
}

afterEach(() => {
  clearPriceEnv();
});

describe("loadTiers", () => {
  it("builds Starter, Pro, and Advanced with month/year price ids", () => {
    setPriceEnv(sampleIds);
    const tiers = loadTiers();

    expect(tiers.map((tier) => tier.name)).toEqual([
      "Starter",
      "Pro",
      "Advanced",
    ]);
    expect(tiers[1]?.featured).toBe(true);
    expect(tiers[0]?.priceId).toEqual({
      month: sampleIds.PADDLE_PRICE_STARTER_MONTHLY_ID,
      year: sampleIds.PADDLE_PRICE_STARTER_YEARLY_ID,
    });
    expect(tiers[2]?.priceId.month).toBe(
      sampleIds.PADDLE_PRICE_ADVANCED_MONTHLY_ID,
    );
  });

  it("fails loudly when a price id env var is missing", () => {
    setPriceEnv(sampleIds);
    delete process.env.PADDLE_PRICE_PRO_YEARLY_ID;

    expect(() => loadTiers()).toThrow(/PADDLE_PRICE_PRO_YEARLY_ID/);
    expect(tryLoadTiers()).toMatchObject({
      error: expect.stringContaining("PADDLE_PRICE_PRO_YEARLY_ID"),
    });
  });

  it("rejects malformed price ids", () => {
    setPriceEnv({
      ...sampleIds,
      PADDLE_PRICE_STARTER_MONTHLY_ID: "not-a-price-id",
    });

    expect(() => loadTiers()).toThrow(/Invalid PADDLE_PRICE_STARTER_MONTHLY_ID/);
  });
});
