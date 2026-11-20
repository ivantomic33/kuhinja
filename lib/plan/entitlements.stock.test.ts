import { expect, it } from "vitest";
import {
  canAddStockItem,
  FREE_MAX_STOCK_ITEMS,
  getEntitlements,
  isUnlimited,
  STARTER_MAX_STOCK_ITEMS,
} from "./entitlements";

it("caps free stock items at 10 and starter at 40", () => {
  expect(getEntitlements("free").maxStockItems).toBe(FREE_MAX_STOCK_ITEMS);
  expect(getEntitlements("starter").maxStockItems).toBe(STARTER_MAX_STOCK_ITEMS);
  expect(isUnlimited(getEntitlements("pro").maxStockItems)).toBe(true);
});

it("blocks new stock rows at the plan cap but allows existing top-ups", () => {
  expect(canAddStockItem("free", 9)).toBe(true);
  expect(canAddStockItem("free", 10)).toBe(false);
  expect(canAddStockItem("starter", 40)).toBe(false);
  expect(canAddStockItem("pro", 999)).toBe(true);
});
