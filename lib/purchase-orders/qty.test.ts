import { describe, expect, it } from "vitest";
import {
  ceilToPack,
  computeOrderQty,
  groupBySupplier,
  mergeOrderCandidates,
} from "./qty";
import {
  adjustStockSchema,
  createPurchaseOrderDraftSchema,
  emailSchema,
  receivePurchaseOrderSchema,
  stockReasonSchema,
} from "./schemas";
import { formatPurchaseOrderText, normalizePhoneForWa, waMeLink } from "./text";

describe("purchase order qty", () => {
  it("par 10, stock 3, pack 5 → orders 10", () => {
    expect(
      computeOrderQty({ parLevel: 10, currentStock: 3, packSize: 5 }),
    ).toBe(10);
  });

  it("par 10, stock 3, no pack → 7", () => {
    expect(
      computeOrderQty({ parLevel: 10, currentStock: 3, packSize: null }),
    ).toBe(7);
  });

  it("ceilToPack rounds up to pack multiples", () => {
    expect(ceilToPack(7, 5)).toBe(10);
    expect(ceilToPack(5, 5)).toBe(5);
    expect(ceilToPack(0.1, null)).toBe(0.1);
  });

  it("groups by supplier including null bucket", () => {
    const groups = groupBySupplier([
      { supplierId: "a", id: 1 },
      { supplierId: null, id: 2 },
      { supplierId: "a", id: 3 },
    ]);
    expect(groups.get("a")?.map((x) => x.id)).toEqual([1, 3]);
    expect(groups.get(null)?.map((x) => x.id)).toEqual([2]);
  });

  it("merges alert + trebovanje by ingredient_id with max need", () => {
    const lines = mergeOrderCandidates([
      {
        ingredientId: "11111111-1111-4111-8111-111111111111",
        name: "Meso",
        unit: "kg",
        supplierId: "s1",
        parLevel: 10,
        currentStock: 3,
        packSize: null,
      },
      {
        ingredientId: "11111111-1111-4111-8111-111111111111",
        name: "Meso",
        unit: "kg",
        supplierId: "s1",
        trebovanjeNeed: 8,
        packSize: null,
      },
    ]);
    expect(lines).toHaveLength(1);
    // max(par gap 7, trebovanje 8) = 8
    expect(lines[0].qty).toBe(8);
  });
});

describe("purchase order zod", () => {
  it("rejects negative quantity and unknown reason", () => {
    expect(
      adjustStockSchema.safeParse({
        ingredientId: "11111111-1111-4111-8111-111111111111",
        delta: -1,
        reason: "not-a-reason",
      }).success,
    ).toBe(false);
    expect(stockReasonSchema.safeParse("prijem").success).toBe(true);
  });

  it("rejects bad email and >200 receive lines", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("  Chef@Example.COM ").success).toBe(true);
    expect(emailSchema.parse("  Chef@Example.COM ")).toBe("chef@example.com");

    const lines = Array.from({ length: 201 }, () => ({
      itemId: "11111111-1111-4111-8111-111111111111",
      qtyReceived: 1,
      unitPrice: null,
    }));
    expect(
      receivePurchaseOrderSchema.safeParse({
        orderId: "11111111-1111-4111-8111-111111111111",
        lines,
      }).success,
    ).toBe(false);
  });

  it("requires at least one draft source", () => {
    expect(
      createPurchaseOrderDraftSchema.safeParse({
        workspaceId: "11111111-1111-4111-8111-111111111111",
        sourceAlerts: false,
        sourceTrebovanje: false,
      }).success,
    ).toBe(false);
  });
});

describe("purchase order text", () => {
  it("includes all lines and order number, no foreign workspace data", () => {
    const text = formatPurchaseOrderText({
      workspaceName: "Kuhinja A",
      orderNumber: 42,
      status: "nacrt",
      supplierName: "Metro",
      createdAt: new Date("2026-01-15T10:00:00Z"),
      lines: [
        { name: "Ulje", qty: 2, unit: "l" },
        { name: "So", qty: 1.5, unit: "kg" },
      ],
    });
    expect(text).toContain("Narudžbenica br. 42");
    expect(text).toContain("Kuhinja A");
    expect(text).toContain("Ulje");
    expect(text).toContain("So");
    expect(text).not.toContain("Kuhinja B");
  });

  it("normalizes phone for wa.me", () => {
    expect(normalizePhoneForWa("+381 64 123-4567")).toBe("381641234567");
    expect(waMeLink("+381 64 123-4567")).toBe("https://wa.me/381641234567");
    expect(normalizePhoneForWa("12")).toBeNull();
  });
});
