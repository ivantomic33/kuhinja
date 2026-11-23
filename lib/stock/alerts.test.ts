import { describe, expect, it } from "vitest";
import { classifyStockAlert } from "./alerts";
import { belgradeToday } from "./math";

const stock = {
  qty: 2,
  min: 3,
  usedToday: 1,
  usedOn: belgradeToday(),
  hasLevel: true,
};

describe("classifyStockAlert", () => {
  it("distinguishes missing stock from zero and negative stock", () => {
    expect(
      classifyStockAlert({ ...stock, hasLevel: false, qty: 0 }, "free")
    ).toMatchObject({ status: "bez", gone: false, soon: false });
    expect(classifyStockAlert({ ...stock, qty: 0 }, "free")).toMatchObject({
      status: "crit",
      gone: true,
      soon: false,
    });
    expect(classifyStockAlert({ ...stock, qty: -1 }, "pro")).toMatchObject({
      status: "crit",
      gone: true,
      soon: false,
    });
  });

  it("hides below-minimum and projected alerts on Free", () => {
    expect(classifyStockAlert({ ...stock, usedToday: 4 }, "free")).toMatchObject({
      status: "ok",
      gone: false,
      soon: false,
    });
  });

  it("uses inclusive one- and two-shift boundaries on Starter and higher", () => {
    expect(
      classifyStockAlert({ ...stock, min: 1, usedToday: 2 }, "starter")
    ).toMatchObject({ status: "crit", soon: true, remainingShifts: 1 });
    expect(classifyStockAlert({ ...stock, min: 1 }, "team")).toMatchObject({
      status: "warn",
      soon: true,
      remainingShifts: 2,
    });
    expect(classifyStockAlert({ ...stock, min: 1, qty: 2.01 }, "business"))
      .toMatchObject({ status: "ok", soon: false });
  });

  it("uses the strict minimum and ignores consumption from previous days", () => {
    expect(
      classifyStockAlert({ ...stock, usedToday: 0 }, "starter")
    ).toMatchObject({ status: "warn", soon: false, remainingShifts: Infinity });
    expect(
      classifyStockAlert({ ...stock, min: 2, usedOn: "2000-01-01" }, "pro")
    ).toMatchObject({ status: "ok", soon: false, remainingShifts: Infinity });
  });
});
