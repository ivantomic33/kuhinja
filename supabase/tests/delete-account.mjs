import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const apiUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const dbUrl = new URL(process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
for (const url of [apiUrl, dbUrl]) {
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Use a local Supabase stack");
}

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(apiUrl.href, serviceKey, options);

function sql(statement) {
  return execFileSync("psql", [dbUrl.href, "-qXAt", "-v", "ON_ERROR_STOP=1", "-c", statement], {
    encoding: "utf8",
  }).trim();
}

test("account deletion requires a fresh session and removes login and owned data", async () => {
  sql("select 1");
  const credentials = { email: `delete-${randomUUID()}@example.test`, password: randomUUID() };
  const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
  assert.ifError(created.error);
  const { id } = created.data.user;
  const client = createClient(apiUrl.href, anonKey, options);

  async function deleteAccount(session, confirmation) {
    const response = await fetch(new URL("/functions/v1/delete-account", apiUrl), {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmation }),
    });
    return [response.status, await response.json()];
  }

  try {
    const venue = sql(`select id from public.venues where owner_id = '${id}'`);
    const ingredient = sql(`insert into public.ingredients (venue_id, name, unit, price)
      values ('${venue}', 'Brašno', 'g', 100) returning id`);
    const recipe = sql(`insert into public.recipes (venue_id, name, portions)
      values ('${venue}', 'Hleb', 1) returning id`);
    sql(`insert into public.recipe_items (recipe_id, ingredient_id, quantity)
      values ('${recipe}', '${ingredient}', 1)`);
    sql(`insert into public.stock_levels (venue_id, ingredient_id) values ('${venue}', '${ingredient}');
      insert into public.stock_moves (venue_id, ingredient_id, type, qty_delta, user_id)
      values ('${venue}', '${ingredient}', 'dopuna', 1, '${id}');`);
    const template = sql(`insert into public.checklist_templates (venue_id, name)
      values ('${venue}', 'Otvaranje') returning id`);
    sql(`insert into public.checklist_runs (venue_id, template_id, user_id)
      values ('${venue}', '${template}', '${id}');`);
    const location = sql(`insert into public.schedule_locations (owner_id, name)
      values ('${id}', 'Raspored') returning id`);
    const employee = sql(`insert into public.schedule_employees (location_id, full_name, role)
      values ('${location}', 'Test Kuvar', 'Kuvar') returning id`);
    sql(`insert into public.schedule_assignments (location_id, employee_id, date, code)
      values ('${location}', '${employee}', '2026-11-23', 'J');
      insert into public.schedule_share_links (location_id, monday, preview)
      values ('${location}', '2026-11-23', '{}');`);

    const stale = await client.auth.signInWithPassword(credentials);
    assert.ifError(stale.error);
    const staleId = JSON.parse(Buffer.from(stale.data.session.access_token.split(".")[1], "base64url")).session_id;
    sql(`update auth.sessions set created_at = now() - interval '6 minutes' where id = '${staleId}'`);
    const refreshed = await client.auth.refreshSession();
    assert.ifError(refreshed.error);

    const fresh = await client.auth.signInWithPassword(credentials);
    assert.ifError(fresh.error);
    const freshId = JSON.parse(Buffer.from(fresh.data.session.access_token.split(".")[1], "base64url")).session_id;
    const direct = await client.rpc("delete_account", { p_user_id: id, p_session_id: freshId });
    assert.equal(direct.error?.code, "42501", "authenticated clients must not call the privileged RPC");
    assert.deepEqual(await deleteAccount(refreshed.data.session, "OBRIŠI"), [403, { error: "RECENT_SIGN_IN_REQUIRED" }]);
    assert.deepEqual(await deleteAccount(fresh.data.session, " OBRIŠI"), [400, { error: "INVALID_CONFIRMATION" }]);
    assert.equal(sql(`select count(*) from public.recipe_items where recipe_id = '${recipe}'`), "1");
    assert.deepEqual(await deleteAccount(fresh.data.session, "OBRIŠI"), [200, { success: true }]);

    const login = await client.auth.signInWithPassword(credentials);
    assert.equal(login.error?.code, "invalid_credentials");
    assert.equal(login.data.session, null);
    assert.equal(sql(`select
      (select count(*) from auth.users where id = '${id}') +
      (select count(*) from auth.identities where user_id = '${id}') +
      (select count(*) from auth.sessions where user_id = '${id}') +
      (select count(*) from auth.refresh_tokens where user_id = '${id}') +
      (select count(*) from public.profiles where id = '${id}') +
      (select count(*) from public.venues where owner_id = '${id}') +
      (select count(*) from public.ingredients where venue_id = '${venue}') +
      (select count(*) from public.ingredient_price_history where ingredient_id = '${ingredient}') +
      (select count(*) from public.recipes where venue_id = '${venue}') +
      (select count(*) from public.recipe_items where recipe_id = '${recipe}') +
      (select count(*) from public.stock_levels where venue_id = '${venue}') +
      (select count(*) from public.stock_moves where venue_id = '${venue}' or user_id = '${id}') +
      (select count(*) from public.checklist_templates where venue_id = '${venue}') +
      (select count(*) from public.checklist_runs where venue_id = '${venue}' or user_id = '${id}') +
      (select count(*) from public.schedule_locations where owner_id = '${id}') +
      (select count(*) from public.schedule_employees where location_id = '${location}') +
      (select count(*) from public.schedule_assignments where location_id = '${location}') +
      (select count(*) from public.schedule_share_links where location_id = '${location}')`), "0");
  } finally {
    sql(`delete from public.recipe_items where recipe_id in
      (select r.id from public.recipes r join public.venues v on v.id = r.venue_id where v.owner_id = '${id}');
      delete from auth.users where id = '${id}';`);
  }
});
