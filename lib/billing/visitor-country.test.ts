import { beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

describe("getVisitorCountry", () => {
  beforeEach(() => {
    headersMock.mockReset();
    vi.resetModules();
  });

  it("reads x-vercel-ip-country when present", async () => {
    headersMock.mockResolvedValue({
      get: (name: string) =>
        name === "x-vercel-ip-country" ? "rs" : null,
    });
    const { getVisitorCountry } = await import("./visitor-country");
    await expect(getVisitorCountry()).resolves.toBe("RS");
  });

  it("returns undefined for missing or unknown codes (never OTHERS)", async () => {
    headersMock.mockResolvedValue({
      get: () => null,
    });
    const { getVisitorCountry } = await import("./visitor-country");
    await expect(getVisitorCountry()).resolves.toBeUndefined();

    headersMock.mockResolvedValue({
      get: (name: string) =>
        name === "x-vercel-ip-country" ? "XX" : null,
    });
    await expect(getVisitorCountry()).resolves.toBeUndefined();
  });
});
