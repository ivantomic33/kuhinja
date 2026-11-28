/**
 * Offline microbenchmarks for list-scale hot paths.
 * These do NOT replace browser LCP / k6 — they measure pure CPU work that the
 * recipes page and workspace perform once data is in memory.
 *
 * Run: npx vitest run lib/perf/list-scale.bench.test.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getRecipeFoodCost,
  type RecipeCostLine,
} from "@/lib/calc/recipe-food-cost";
import { WORKSPACE_PAGE_SIZE } from "@/components/ui/WorkspacePagination";

const LEVELS = [100, 1_000, 5_000, 10_000, 25_000] as const;
const SEARCH_BUDGET_MS = 300;
const LIST_COST_BUDGET_MS = 2_500; // proxy for server work before first paint

type RecipeRow = {
  id: string;
  name: string;
  portions: number;
  selling_price: number;
  description: string;
  lines: RecipeCostLine[];
};

function makeLines(seed: number, count: number): RecipeCostLine[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `line-${seed}-${i}`,
    name: `Sastojak ${i}`,
    quantity: 10 + ((seed + i) % 200),
    quantityUnit: "g" as const,
    price: 100 + ((seed * 3 + i) % 500),
    priceUnit: "kg" as const,
    lossPercent: (i % 10) * 0.5,
  }));
}

function makeRecipes(n: number): RecipeRow[] {
  const stems = ["Gulaš", "Piletina", "Sarma", "Rižoto", "Palačinke", "Čorba", "Musaka", "Salata"];
  return Array.from({ length: n }, (_, i) => ({
    id: `r-${i}`,
    name: `${stems[i % stems.length]} specijal #${i + 1}`,
    portions: 4 + (i % 12),
    selling_price: 400 + (i % 40) * 20,
    description: i % 5 === 0 ? "Dugačak opis pripreme ".repeat(8) : "Kratak opis",
    lines: makeLines(i, 8 + (i % 18)),
  }));
}

function ms(fn: () => void): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

function filterByName(rows: RecipeRow[], q: string): RecipeRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(needle));
}

function pageSlice<T>(rows: T[], page: number, pageSize = WORKSPACE_PAGE_SIZE): T[] {
  return rows.slice(page * pageSize, (page + 1) * pageSize);
}

function payloadBytes(rows: RecipeRow[]): number {
  // Approximate JSON hydration size for list rows with nested lines (as server embeds items).
  return Buffer.byteLength(
    JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        portions: r.portions,
        selling_price: r.selling_price,
        description: r.description,
        recipe_items: r.lines.map((l) => ({
          id: l.id,
          quantity: l.quantity,
          ingredients: {
            name: l.name,
            unit: l.quantityUnit,
            price: l.price,
            waste_percent: l.lossPercent,
          },
        })),
      })),
    ),
    "utf8",
  );
}

describe("list-scale microbenchmarks", () => {
  const results: Record<string, unknown>[] = [];

  for (const n of LEVELS) {
    it(`measures CPU paths at ${n} recipes`, () => {
      const recipes = makeRecipes(n);

      const costMs = ms(() => {
        for (const row of recipes) {
          getRecipeFoodCost(row.lines, row.selling_price, true);
        }
      });

      const costNoInsightMs = ms(() => {
        for (const row of recipes) {
          getRecipeFoodCost(row.lines, row.selling_price, false);
        }
      });

      // Mirror server list cap of 100 then client filter on that set
      const loadedCap = recipes.slice(0, 100);
      const searchCommonMs = ms(() => {
        filterByName(loadedCap, "piletina");
      });
      const searchRareMs = ms(() => {
        filterByName(loadedCap, "xyznepostoji123");
      });
      // Hypothetical: if the client ever held the full set (bug / future change)
      const searchFullCommonMs = ms(() => {
        filterByName(recipes, "piletina");
      });
      const searchFullRareMs = ms(() => {
        filterByName(recipes, "xyznepostoji123");
      });

      const sortMs = ms(() => {
        [...recipes]
          .sort((a, b) => a.name.localeCompare(b.name, "sr-Latn"))
          .slice(0, WORKSPACE_PAGE_SIZE);
      });

      const pageMs = ms(() => {
        pageSlice(recipes, 0);
      });

      const bytesAll = payloadBytes(recipes);
      const bytesCap100 = payloadBytes(loadedCap);
      // Offline cache keeps at most 20 recent recipes without full item trees in list seeder
      const offlineRecentBytes = Buffer.byteLength(
        JSON.stringify(
          recipes.slice(0, 20).map((r) => ({
            id: r.id,
            venue_id: "v",
            name: r.name,
            description: r.description,
            portions: r.portions,
            selling_price: r.selling_price,
            cachedAt: Date.now(),
          })),
        ),
        "utf8",
      );

      const row = {
        recipes: n,
        costAllWithInsightMs: Number(costMs.toFixed(3)),
        costAllNoInsightMs: Number(costNoInsightMs.toFixed(3)),
        searchCap100CommonMs: Number(searchCommonMs.toFixed(3)),
        searchCap100RareMs: Number(searchRareMs.toFixed(3)),
        searchFullCommonMs: Number(searchFullCommonMs.toFixed(3)),
        searchFullRareMs: Number(searchFullRareMs.toFixed(3)),
        sortFullMs: Number(sortMs.toFixed(3)),
        pageSliceMs: Number(pageMs.toFixed(3)),
        payloadAllBytes: bytesAll,
        payloadCap100Bytes: bytesCap100,
        offlineRecent20Bytes: offlineRecentBytes,
        thresholds: {
          searchMs: SEARCH_BUDGET_MS,
          listCostProxyMs: LIST_COST_BUDGET_MS,
        },
        pass: {
          // Current production path only filters ≤100 rows
          searchOnCap100: searchCommonMs < SEARCH_BUDGET_MS && searchRareMs < SEARCH_BUDGET_MS,
          // Full in-memory cost for all N (if limit removed without other fixes)
          costAllNoInsightUnderLcpProxy: costNoInsightMs < LIST_COST_BUDGET_MS,
          costAllWithInsightUnderLcpProxy: costMs < LIST_COST_BUDGET_MS,
        },
      };
      results.push(row);

      // Hard asserts only on the real current path (cap 100)
      expect(searchCommonMs).toBeLessThan(SEARCH_BUDGET_MS);
      expect(searchRareMs).toBeLessThan(SEARCH_BUDGET_MS);
      expect(pageMs).toBeLessThan(16);
    });
  }

  it("writes raw benchmark JSON for the report", () => {
    const dir = path.join(process.cwd(), "load", "results");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "list-scale-bench.json");
    const payload = {
      at: new Date().toISOString(),
      source: "lib/perf/list-scale.bench.test.ts",
      host: process.platform,
      node: process.version,
      note: "CPU-only; not LCP. App list query still limit(100).",
      results,
    };
    writeFileSync(file, JSON.stringify(payload, null, 2));
    expect(results.length).toBe(LEVELS.length);
  });
});
