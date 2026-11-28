/**
 * k6 — concurrent kitchen workload (LOCAL / STAGING only).
 *
 * Auth via Supabase password grant, then:
 *  - list recipes (PostgREST range limit 20)
 *  - search by name (ilike)
 *  - open one recipe + items
 *  - trebovanje-ish stock_levels read
 *  - write: versioned ingredient price bump OR checklist item upsert when configured
 *
 * Env:
 *   K6_SUPABASE_URL          e.g. http://127.0.0.1:54321
 *   K6_SUPABASE_ANON_KEY
 *   K6_TEST_EMAIL
 *   K6_TEST_PASSWORD
 *   K6_RECIPE_LEVEL          label only (1000|10000|25000)
 *   K6_VUS                   peak VUs for this run (default 10)
 *   K6_VENUE_ID              optional filter
 *   K6_WRITE_INGREDIENT_ID   optional UUID for price write path
 *
 * Example:
 *   k6 run -e K6_VUS=50 -e K6_RECIPE_LEVEL=1000 load/recipes-concurrent.js
 */
import { check, fail, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const readTrend = new Trend("treuplate_read_ms", true);
const writeTrend = new Trend("treuplate_write_ms", true);
const errorRate = new Rate("treuplate_errors");

const peakVus = Number(__ENV.K6_VUS || 10);

export const options = {
  scenarios: {
    kitchen: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: peakVus },
        { duration: "5m", target: peakVus },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    treuplate_read_ms: ["p(95)<500"],
    treuplate_write_ms: ["p(95)<1000"],
    treuplate_errors: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
  },
};

function cfg() {
  const base = (__ENV.K6_SUPABASE_URL || "").replace(/\/$/, "");
  const key = __ENV.K6_SUPABASE_ANON_KEY;
  const email = __ENV.K6_TEST_EMAIL;
  const password = __ENV.K6_TEST_PASSWORD;
  if (!base || !key || !email || !password) {
    fail("Set K6_SUPABASE_URL, K6_SUPABASE_ANON_KEY, K6_TEST_EMAIL, K6_TEST_PASSWORD");
  }
  if (/supabase\.co/i.test(base) && __ENV.K6_ALLOW_REMOTE !== "1") {
    fail("Refusing supabase.co without K6_ALLOW_REMOTE=1 (staging only).");
  }
  return { base, key, email, password, venueId: __ENV.K6_VENUE_ID || "" };
}

function authHeaders(token, key) {
  return {
    apikey: key,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export function setup() {
  const { base, key, email, password, venueId } = cfg();
  const login = http.post(
    `${base}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: { apikey: key, "Content-Type": "application/json" },
      tags: { operation: "auth" },
    },
  );
  if (login.status !== 200) fail(`auth failed: ${login.status} ${login.body}`);
  const body = login.json();
  return {
    base,
    key,
    token: body.access_token,
    venueId,
    writeIngredientId: __ENV.K6_WRITE_INGREDIENT_ID || "",
    recipeLevel: __ENV.K6_RECIPE_LEVEL || "unknown",
  };
}

function trackRead(res) {
  readTrend.add(res.timings.duration);
  const ok = res.status >= 200 && res.status < 300;
  errorRate.add(!ok);
  return ok;
}

function trackWrite(res) {
  writeTrend.add(res.timings.duration);
  const ok = res.status >= 200 && res.status < 300;
  errorRate.add(!ok);
  return ok;
}

export default function (data) {
  const h = authHeaders(data.token, data.key);
  const rest = `${data.base}/rest/v1`;
  const venueFilter = data.venueId ? `&venue_id=eq.${data.venueId}` : "";

  // A. recipe list page (limit 20) — mirrors intended server pagination
  const list = http.get(
    `${rest}/recipes?select=id,name,updated_at,portions,selling_price&order=updated_at.desc&limit=20${venueFilter}`,
    { headers: h, tags: { operation: "read", name: "recipes_list" } },
  );
  check(list, { "list 2xx": (r) => trackRead(r) });

  // B. search (common / rare / empty-ish)
  const queries = ["piletina", "xyznepostoji123", "gulaš"];
  const q = queries[Math.floor(Math.random() * queries.length)];
  const search = http.get(
    `${rest}/recipes?select=id,name&name=ilike.*${encodeURIComponent(q)}*&limit=20${venueFilter}`,
    { headers: h, tags: { operation: "read", name: "recipes_search" } },
  );
  check(search, { "search 2xx": (r) => trackRead(r) });

  // C. open recipe
  let recipeId = null;
  try {
    const rows = list.json();
    if (Array.isArray(rows) && rows[0]) recipeId = rows[0].id;
  } catch {
    recipeId = null;
  }
  if (recipeId) {
    const detail = http.get(
      `${rest}/recipes?id=eq.${recipeId}&select=id,name,portions,selling_price,description,recipe_items(id,quantity,ingredient_id)`,
      { headers: h, tags: { operation: "read", name: "recipe_detail" } },
    );
    check(detail, { "detail 2xx": (r) => trackRead(r) });
  }

  // D. trebovanje-ish
  const stock = http.get(
    `${rest}/stock_levels?select=id,ingredient_id,qty,min_qty&limit=50${venueFilter}`,
    { headers: h, tags: { operation: "read", name: "stock_levels" } },
  );
  check(stock, { "stock 2xx": (r) => trackRead(r) });

  // E. write path — bump price with version lock when ingredient id provided
  if (data.writeIngredientId && Math.random() < 0.3) {
    const current = http.get(
      `${rest}/ingredients?id=eq.${data.writeIngredientId}&select=id,price,version`,
      { headers: h, tags: { operation: "read", name: "ingredient_before_write" } },
    );
    trackRead(current);
    let version = 1;
    let price = 100;
    try {
      const row = current.json()[0];
      if (row) {
        version = row.version;
        price = Number(row.price) || 100;
      }
    } catch {
      // keep defaults
    }
    const nextPrice = Number((price + (Math.random() * 0.5 - 0.25)).toFixed(4));
    const write = http.patch(
      `${rest}/ingredients?id=eq.${data.writeIngredientId}&version=eq.${version}`,
      JSON.stringify({ price: nextPrice }),
      { headers: { ...h, Prefer: "return=minimal" }, tags: { operation: "write", name: "ingredient_price" } },
    );
    // 200/204 success; 0 rows is still 200 with Prefer minimal — treat 2xx as transport OK
    check(write, { "write 2xx": (r) => trackWrite(r) });
  }

  sleep(1);
}

export function handleSummary(data) {
  const path = `load/results/recipes-concurrent-${__ENV.K6_RECIPE_LEVEL || "x"}-vu${peakVus}.json`;
  return {
    [path]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, peakVus),
  };
}

function textSummary(data, vus) {
  const reads = data.metrics.treuplate_read_ms;
  const writes = data.metrics.treuplate_write_ms;
  const errs = data.metrics.treuplate_errors;
  return [
    `recipeLevel=${__ENV.K6_RECIPE_LEVEL || "?"} vus=${vus}`,
    `read p95=${reads?.values?.["p(95)"] ?? "n/a"} ms (threshold 500)`,
    `write p95=${writes?.values?.["p(95)"] ?? "n/a"} ms (threshold 1000)`,
    `error rate=${errs?.values?.rate ?? "n/a"} (threshold 0.01)`,
    "",
  ].join("\n");
}
