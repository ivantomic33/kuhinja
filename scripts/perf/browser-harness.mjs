#!/usr/bin/env node
/**
 * Playwright browser metrics for /recipes (LOCAL production-mode app).
 *
 * Prerequisites:
 *   - App: pnpm build && pnpm start (or npm run build && npm run start)
 *   - Seeded local DB + test user
 *   - npx playwright install chromium
 *
 * Usage:
 *   node scripts/perf/browser-harness.mjs --base http://127.0.0.1:3000 --recipes 1000
 *
 * Env:
 *   PERF_TEST_EMAIL, PERF_TEST_PASSWORD
 *   PERF_BASE_URL
 */
import { chromium, devices } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const base = (arg("base", process.env.PERF_BASE_URL || "http://127.0.0.1:3000")).replace(/\/$/, "");
const recipeLevel = arg("recipes", "unknown");
const email = process.env.PERF_TEST_EMAIL;
const password = process.env.PERF_TEST_PASSWORD;
const outDir = path.join("load", "results");

if (!email || !password) {
  console.error("Set PERF_TEST_EMAIL and PERF_TEST_PASSWORD");
  process.exit(1);
}

const THRESHOLDS = {
  lcpMs: 2500,
  searchMs: 300,
};

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);
  await Promise.all([
    page.waitForURL(/dashboard|recipes|trebovanje|\//, { timeout: 30_000 }).catch(() => null),
    page.locator('button[type="submit"]').first().click(),
  ]);
}

async function measureRecipes(page) {
  const longTasks = [];
  await page.exposeBinding("__treuLongTask", (_source, entry) => {
    longTasks.push(entry);
  }).catch(() => {});

  await page.addInitScript(() => {
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__treuLongTask?.({ duration: e.duration, startTime: e.startTime, name: e.name });
        }
      });
      po.observe({ type: "longtask", buffered: true });
    } catch {
      // Long Tasks API may be unavailable.
    }
  });

  const started = Date.now();
  await page.goto(`${base}/recipes`, { waitUntil: "networkidle", timeout: 120_000 });
  const navMs = Date.now() - started;

  const paint = await page.evaluate(() => {
    const lcp = performance.getEntriesByType("largest-contentful-paint").at(-1);
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      lcpMs: lcp?.startTime ?? null,
      fcpMs: fcp?.startTime ?? null,
      heap: performance.memory ? performance.memory.usedJSHeapSize : null,
    };
  });

  async function searchOnce(query) {
    const input = page.getByLabel(/pretraži recepte/i).or(page.locator('input[type="search"]')).first();
    await input.fill("");
    const t0 = Date.now();
    await input.fill(query);
    // Wait a frame + React transition
    await page.waitForTimeout(50);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const dt = Date.now() - t0;
    const countText = await page.locator("text=/\\d+ od \\d+ recepata/").first().textContent().catch(() => null);
    return { query, ms: dt, countText };
  }

  const searches = [];
  for (const q of ["piletina", "xyznepostoji123", "gulaš"]) {
    searches.push(await searchOnce(q));
  }

  // Open up to 50 recipe dialogs / rows if present
  let opened = 0;
  const openButtons = page.getByRole("button", { name: /^Otvori$/i });
  const n = Math.min(50, await openButtons.count());
  for (let i = 0; i < n; i++) {
    await openButtons.nth(i).click().catch(() => null);
    await page.keyboard.press("Escape").catch(() => null);
    opened += 1;
  }

  const heapAfter = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);

  const idbBytes = await page.evaluate(async () => {
    if (!indexedDB.databases) return null;
    const dbs = await indexedDB.databases();
    return dbs.map((d) => d.name);
  });

  return {
    navMs,
    paint,
    searches,
    opened,
    heapAfter,
    idbDatabaseNames: idbBytes,
    longTasksSample: longTasks.slice(0, 20),
    longTaskCount: longTasks.length,
    longTasksOver50ms: longTasks.filter((t) => t.duration > 50).length,
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    // Slow 4G-ish
  });
  // CPU 4x is not directly available in all Playwright builds; use CDP when possible.
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  }).catch(() => null);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 }).catch(() => null);

  await login(page);
  const metrics = await measureRecipes(page);

  const report = {
    at: new Date().toISOString(),
    base,
    recipeLevel,
    thresholds: THRESHOLDS,
    metrics,
    pass: {
      lcp: metrics.paint.lcpMs != null ? metrics.paint.lcpMs < THRESHOLDS.lcpMs : null,
      search: metrics.searches.every((s) => s.ms < THRESHOLDS.searchMs),
    },
  };

  const file = path.join(outDir, `browser-recipes-${recipeLevel}.json`);
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
