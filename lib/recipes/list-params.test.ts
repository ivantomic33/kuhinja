import { describe, expect, it } from "vitest";
import {
  RECIPE_LIST_MAX_PAGE_SIZE,
  RECIPE_LIST_PAGE_SIZE,
  clampPageIndex,
  clampRecipePageSize,
  escapeIlikePattern,
  normalizeRecipeListParams,
  normalizeRecipeSearchQuery,
  pageCountFromTotal,
  rangeForPage,
  recipeListKeyParts,
  recipeNameIlikePattern,
  resolveListPage,
} from "@/lib/recipes/list-params";

describe("escapeIlikePattern", () => {
  it("escapes percent, underscore, and backslash", () => {
    expect(escapeIlikePattern("100%_done\\x")).toBe("100\\%\\_done\\\\x");
  });

  it("leaves diacritics and quotes untouched", () => {
    expect(escapeIlikePattern("čćšžđ '\"")).toBe("čćšžđ '\"");
  });
});

describe("normalizeRecipeSearchQuery", () => {
  it("trims and bounds length", () => {
    expect(normalizeRecipeSearchQuery("  grah  ")).toBe("grah");
    expect(normalizeRecipeSearchQuery("a".repeat(200)).length).toBe(100);
    expect(normalizeRecipeSearchQuery(null)).toBe("");
    expect(normalizeRecipeSearchQuery(undefined)).toBe("");
  });
});

describe("recipeNameIlikePattern", () => {
  it("returns null for empty search", () => {
    expect(recipeNameIlikePattern("")).toBeNull();
    expect(recipeNameIlikePattern("   ")).toBeNull();
  });

  it("wraps escaped term in wildcards", () => {
    expect(recipeNameIlikePattern("a%b")).toBe("%a\\%b%");
    expect(recipeNameIlikePattern("šnicle")).toBe("%šnicle%");
  });
});

describe("pagination math", () => {
  it("uses default and max page size", () => {
    expect(clampRecipePageSize(undefined)).toBe(RECIPE_LIST_PAGE_SIZE);
    expect(clampRecipePageSize(0)).toBe(RECIPE_LIST_PAGE_SIZE);
    expect(clampRecipePageSize(999)).toBe(RECIPE_LIST_MAX_PAGE_SIZE);
    expect(clampRecipePageSize(40)).toBe(40);
  });

  it("handles empty list and last page", () => {
    expect(pageCountFromTotal(0, 25)).toBe(1);
    expect(pageCountFromTotal(25, 25)).toBe(1);
    expect(pageCountFromTotal(26, 25)).toBe(2);
    expect(pageCountFromTotal(1000, 25)).toBe(40);

    expect(clampPageIndex(0, 1)).toBe(0);
    expect(clampPageIndex(99, 4)).toBe(3);
    expect(clampPageIndex(-1, 4)).toBe(0);

    expect(rangeForPage(0, 25)).toEqual({ from: 0, to: 24 });
    expect(rangeForPage(3, 25)).toEqual({ from: 75, to: 99 });
  });

  it("resolveListPage clamps past the last page", () => {
    const empty = resolveListPage(5, 0, 25);
    expect(empty).toMatchObject({ page: 0, pageCount: 1, outOfRange: true });

    const last = resolveListPage(39, 1000, 25);
    expect(last).toMatchObject({ page: 39, pageCount: 40, outOfRange: false });

    const past = resolveListPage(40, 1000, 25);
    expect(past).toMatchObject({ page: 39, pageCount: 40, outOfRange: true });
  });

  it("normalizeRecipeListParams applies defaults", () => {
    const n = normalizeRecipeListParams({ venueId: "v1" });
    expect(n).toEqual({
      venueId: "v1",
      query: "",
      page: 0,
      pageSize: RECIPE_LIST_PAGE_SIZE,
      sort: { column: "updated_at", direction: "descending" },
    });
  });

  it("recipeListKeyParts is stable for TanStack keys", () => {
    expect(recipeListKeyParts({ query: "  Grah ", page: 2 })).toEqual({
      q: "Grah",
      page: 2,
      pageSize: RECIPE_LIST_PAGE_SIZE,
      sort: "updated_at",
      dir: "descending",
    });
  });
});

describe("search edge cases (unit)", () => {
  it("encodes special SQL LIKE characters without throwing", () => {
    for (const raw of ["%", "_", "'", '"', "\\", "%%", "%_'", "čćšžđ"]) {
      const pattern = recipeNameIlikePattern(raw);
      expect(pattern).toBeTruthy();
      expect(pattern!.startsWith("%")).toBe(true);
      expect(pattern!.endsWith("%")).toBe(true);
    }
  });

  it("empty and whitespace-only queries mean no filter", () => {
    expect(recipeNameIlikePattern("")).toBeNull();
    expect(recipeNameIlikePattern("\t  \n")).toBeNull();
  });
});
