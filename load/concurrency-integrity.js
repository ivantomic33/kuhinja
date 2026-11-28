/**
 * k6 — concurrent integrity for ingredient version lock + checklist items.
 * LOCAL / STAGING only.
 *
 * Verifies:
 *  1) Two VUs patching the same ingredient with the same version → at most one
 *     silent overwrite; loser should see 0 rows or conflict (app uses version).
 *  2) Checklist items keyed by (run_id, item_id) — last successful write wins;
 *     no lost transport errors swallowed without status.
 *
 * Env:
 *   K6_SUPABASE_URL, K6_SUPABASE_ANON_KEY
 *   K6_USER_A_EMAIL, K6_USER_A_PASSWORD
 *   K6_USER_B_EMAIL, K6_USER_B_PASSWORD  (can match A for single-account lock test)
 *   K6_INGREDIENT_ID
 *   K6_CHECKLIST_RUN_ID   optional
 *   K6_CHECKLIST_ITEM_ID  optional
 */
import { check, fail, sleep } from "k6";
import http from "k6/http";
import { Counter } from "k6/metrics";

const versionWins = new Counter("integrity_version_write_rows");
const versionEmpty = new Counter("integrity_version_empty_update");
const checklistOk = new Counter("integrity_checklist_ok");
const checklistFail = new Counter("integrity_checklist_fail");

export const options = {
  scenarios: {
    dual_price: {
      executor: "per-vu-iterations",
      vus: 2,
      iterations: 20,
      maxDuration: "3m",
      exec: "priceRace",
    },
    checklist: {
      executor: "per-vu-iterations",
      vus: 2,
      iterations: 20,
      maxDuration: "3m",
      exec: "checklistRace",
      startTime: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
  },
};

function baseCfg() {
  const base = (__ENV.K6_SUPABASE_URL || "").replace(/\/$/, "");
  const key = __ENV.K6_SUPABASE_ANON_KEY;
  if (!base || !key) fail("missing supabase env");
  return { base, key };
}

function login(email, password, key, base) {
  const res = http.post(
    `${base}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    { headers: { apikey: key, "Content-Type": "application/json" } },
  );
  if (res.status !== 200) fail(`login ${email}: ${res.status}`);
  return res.json().access_token;
}

export function setup() {
  const { base, key } = baseCfg();
  const emailA = __ENV.K6_USER_A_EMAIL || __ENV.K6_TEST_EMAIL;
  const passA = __ENV.K6_USER_A_PASSWORD || __ENV.K6_TEST_PASSWORD;
  const emailB = __ENV.K6_USER_B_EMAIL || emailA;
  const passB = __ENV.K6_USER_B_PASSWORD || passA;
  if (!emailA || !passA) fail("need user credentials");
  if (!__ENV.K6_INGREDIENT_ID) fail("K6_INGREDIENT_ID required");

  return {
    base,
    key,
    tokenA: login(emailA, passA, key, base),
    tokenB: login(emailB, passB, key, base),
    ingredientId: __ENV.K6_INGREDIENT_ID,
    runId: __ENV.K6_CHECKLIST_RUN_ID || "",
    itemId: __ENV.K6_CHECKLIST_ITEM_ID || "",
  };
}

function headers(token, key) {
  return {
    apikey: key,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export function priceRace(data) {
  const token = __VU % 2 === 0 ? data.tokenA : data.tokenB;
  const h = headers(token, data.key);
  const get = http.get(
    `${data.base}/rest/v1/ingredients?id=eq.${data.ingredientId}&select=id,price,version`,
    { headers: h },
  );
  if (get.status !== 200) {
    fail(`read ingredient ${get.status}`);
  }
  const row = get.json()[0];
  if (!row) fail("ingredient missing");

  const patch = http.patch(
    `${data.base}/rest/v1/ingredients?id=eq.${data.ingredientId}&version=eq.${row.version}`,
    JSON.stringify({ price: Number((Number(row.price) + 0.01).toFixed(4)) }),
    { headers: h },
  );

  check(patch, { "price patch transport ok": (r) => r.status === 200 || r.status === 204 });
  let rows = [];
  try {
    rows = patch.json();
  } catch {
    rows = [];
  }
  if (Array.isArray(rows) && rows.length > 0) versionWins.add(1);
  else versionEmpty.add(1);

  sleep(0.05);
}

export function checklistRace(data) {
  if (!data.runId || !data.itemId) {
    sleep(0.1);
    return;
  }
  const token = __VU % 2 === 0 ? data.tokenA : data.tokenB;
  const h = headers(token, data.key);
  const checked = __VU % 2 === 0;
  // PostgREST upsert on composite PK — adjust table/columns to match schema
  const res = http.post(
    `${data.base}/rest/v1/shift_checklist_items?on_conflict=run_id,item_id`,
    JSON.stringify({
      run_id: data.runId,
      item_id: data.itemId,
      checked,
      updated_at: new Date().toISOString(),
    }),
    {
      headers: {
        ...h,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    },
  );
  if (res.status >= 200 && res.status < 300) checklistOk.add(1);
  else checklistFail.add(1);
  sleep(0.05);
}

export function handleSummary(data) {
  return {
    "load/results/concurrency-integrity.json": JSON.stringify(data, null, 2),
    stdout: [
      `version write rows (won lock): ${data.metrics.integrity_version_write_rows?.values?.count ?? 0}`,
      `version empty updates (lost lock / no row): ${data.metrics.integrity_version_empty_update?.values?.count ?? 0}`,
      `checklist ok: ${data.metrics.integrity_checklist_ok?.values?.count ?? 0}`,
      `checklist fail: ${data.metrics.integrity_checklist_fail?.values?.count ?? 0}`,
      "Expect: under contention, empty updates > 0 if both VUs share the same read version.",
      "Expect: final ingredient.version = initial + number of winning writes (no silent multi-apply of same version).",
      "",
    ].join("\n"),
  };
}
