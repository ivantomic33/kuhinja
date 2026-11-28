#!/usr/bin/env node
/**
 * LOCAL / STAGING ONLY — never point at production.
 *
 * Seeds realistic kitchen data for TreuPlate scale tests.
 *
 * Usage:
 *   node scripts/perf/seed.mjs --recipes 1000 --users 300 --reset
 *
 * Required env (local Supabase defaults work after `supabase start`):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PERF_SEED_PASSWORD   (shared test password, min 8 chars)
 *
 * Optional:
 *   PERF_SEED_OWNER_EMAIL   (default perf-owner@treuplate.local)
 *   PERF_INGREDIENT_COUNT   (default 200)
 *   PERF_BATCH_SIZE         (default 200)
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const RECIPE_LEVELS = new Set([100, 1000, 5000, 10000, 25000]);
const recipeCount = Number(arg("recipes", "1000"));
const userCount = Number(arg("users", "300"));
const ingredientCount = Number(process.env.PERF_INGREDIENT_COUNT ?? arg("ingredients", "200"));
const batchSize = Number(process.env.PERF_BATCH_SIZE ?? "200");
const doReset = hasFlag("reset");

if (!RECIPE_LEVELS.has(recipeCount) && !hasFlag("allow-any-count")) {
  console.error(`--recipes must be one of ${[...RECIPE_LEVELS].join(", ")} (or pass --allow-any-count)`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.PERF_SEED_PASSWORD;
const ownerEmail = process.env.PERF_SEED_OWNER_EMAIL ?? "perf-owner@treuplate.local";

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (local/staging only).");
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error("Set PERF_SEED_PASSWORD (shared test password, >= 8 chars).");
  process.exit(1);
}
if (/supabase\.co/i.test(url) && !hasFlag("i-know-this-is-staging")) {
  console.error("Refusing remote supabase.co URL without --i-know-this-is-staging.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const UNITS = ["g", "kg", "ml", "l", "kom", "pak"];
const CATEGORIES = ["supe", "predjelo", "glavno", "prilog", "salata", "desert", "pecivo", "napitak"];

const INGREDIENT_NAMES = [
  "Brašno T-400", "Brašno T-500", "Šećer kristal", "So kuhinjska", "Ulje suncokretovo",
  "Maslinovo ulje", "Puter", "Mleko 2.8%", "Pavlaka 20%", "Jaja A klasa",
  "Pileći batak", "Pileći file", "Juneće meso", "Svinjski vrat", "Mleveno meso mešano",
  "Pasulj tetovac", "Krompir crveni", "Krompir beli", "Šargarepa", "Crni luk",
  "Beli luk", "Paradajz", "Paprika babura", "Kupus", "Karfiol",
  "Brokoli", "Tikvice", "Plavi patlidžan", "Pečurke šampinjoni", "Spanać",
  "Pirinač basmati", "Testenina penne", "Testenina spaghetti", "Kuskus", "Griz",
  "Parmezan", "Kačkavalj", "Feta", "Mozzarella", "Kajmak",
  "Šunka", "Panceta", "Kobasica domaća", "Slanina", "Pršut",
  "Tunjevina konzerva", "Sardina", "Oslić file", "Škampi", "Lignje",
  "Limun", "Narandža", "Jabuka", "Banana", "Jagoda",
  "Čokolada 70%", "Kakao prah", "Vanilin šećer", "Prašak za pecivo", "Soda bikarbona",
  "Biber crni", "Aleva paprika", "Origano", "Bosiljak", "Ruzmarin",
  "Lovorov list", "Cimet", "Muškatni oraščić", "Đumbir mleveni", "Kumin",
  "Kečap", "Majonez", "Senf", "Soja sos", "Sirće jabučno",
  "Med livadski", "Džem kajsija", "Orasi", "Bademi", "Lešnici",
  "Susam", "Suncokretovo seme", "Kukuruzni skrob", "Prezla", "Kvasac suvi",
  "Pavlaka za kuvanje", "Pavlaka kisela", "Jogurt", "Sirni namaz", "Skuta",
  "Zelena salata", "Rukola", "Krastavac", "Rotkvica", "Celer",
  "Peršun", "Mirođija", "Vlasac", "Krompir pire mešavina", "Grašak smrznuti",
  "Boranija", "Kukuruz šećerac", "Pasulj konzerva", "Paradajz pelat", "Pavlaka biljna",
];

const RECIPE_STEMS = [
  "Gulaš", "Paprikaš", "Musaka", "Sarma", "Pasulj", "Čorba", "Supa", "Rižoto",
  "Piletina", "Bečka šnicla", "Karađorđeva", "Pljeskavica", "Ćevapi", "Punjene paprike",
  "Pečeni krompir", "Pire krompir", "Grilovano povrće", "Šopska salata", "Cezar salata",
  "Tiramisu", "Palačinke", "Kolač od čokolade", "Pita sa jabukama", "Gibanica",
  "Riblja čorba", "Lignje na žaru", "Špagete bolonjeze", "Pene arrabbiata", "Lazanje",
  "Omlet", "Kajgana", "Sendvič klub", "Burger kućni", "Tortilja wrap",
];

function pick(arr, i) {
  return arr[i % arr.length];
}

function recipeName(i) {
  const stem = pick(RECIPE_STEMS, i);
  const cat = pick(CATEGORIES, i);
  return `${stem} ${cat} #${i + 1}`;
}

function recipeDescription(i) {
  const short = `Klasičan recept iz kategorije ${pick(CATEGORIES, i)}.`;
  if (i % 5 === 0) {
    return `${short} Priprema: dinstati povrće, dodati meso, kuvati na tihoj vatri 45–60 min. Poslužiti sa prilogom po želji. Napomena za skaliranje: količine su za ${4 + (i % 12)} porcija.`;
  }
  if (i % 3 === 0) {
    return `${short} Vreme pripreme oko ${20 + (i % 40)} min.`;
  }
  return short;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function ensureUser(email, meta = {}) {
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = listed?.users?.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: meta.full_name ?? email, ...meta },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function resetVenueData(venueId) {
  // Order respects FKs; service role bypasses RLS.
  const tables = [
    "recipe_items",
    "recipes",
    "ingredient_price_history",
    "stock_moves",
    "stock_levels",
    "ingredients",
  ];
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq(
      table === "recipe_items" ? "recipe_id" : table === "ingredient_price_history" || table === "stock_moves" || table === "stock_levels" ? "venue_id" : "venue_id",
      venueId,
    ).neq("id", "00000000-0000-0000-0000-000000000000");
    // recipe_items has no venue_id — delete via recipes cascade if configured; else wipe by selecting recipe ids.
    if (error && table !== "recipe_items") {
      // Fallback: delete all rows owned through venue for tables that support it.
      const { error: e2 } = await admin.from(table).delete().eq("venue_id", venueId);
      if (e2) console.warn(`reset ${table}:`, e2.message);
    }
  }

  const { data: recipes } = await admin.from("recipes").select("id").eq("venue_id", venueId);
  const ids = (recipes ?? []).map((r) => r.id);
  for (const part of chunk(ids, 200)) {
    if (part.length === 0) continue;
    await admin.from("recipe_items").delete().in("recipe_id", part);
    await admin.from("recipes").delete().in("id", part);
  }
  await admin.from("ingredient_price_history").delete().in(
    "ingredient_id",
    (await admin.from("ingredients").select("id").eq("venue_id", venueId)).data?.map((r) => r.id) ?? [],
  );
  await admin.from("stock_levels").delete().eq("venue_id", venueId);
  await admin.from("ingredients").delete().eq("venue_id", venueId);
}

async function main() {
  console.log(JSON.stringify({
    phase: "start",
    url,
    recipeCount,
    userCount,
    ingredientCount,
    doReset,
  }));

  const ownerId = await ensureUser(ownerEmail, { full_name: "Perf Owner" });

  // profiles.plan → pro so free limits do not block seed volume
  await admin.from("profiles").upsert({
    id: ownerId,
    full_name: "Perf Owner",
    plan: "pro",
  });

  let { data: venues } = await admin.from("venues").select("id, name").eq("owner_id", ownerId).limit(1);
  let venueId = venues?.[0]?.id;
  if (!venueId) {
    const { data: created, error } = await admin.from("venues").insert({
      owner_id: ownerId,
      name: "Perf Kuhinja",
    }).select("id").single();
    if (error) throw error;
    venueId = created.id;
  }

  if (doReset) {
    console.log(JSON.stringify({ phase: "reset", venueId }));
    await resetVenueData(venueId);
  }

  // --- ingredients ---
  const ingredientRows = Array.from({ length: ingredientCount }, (_, i) => ({
    id: randomUUID(),
    venue_id: venueId,
    name: `${pick(INGREDIENT_NAMES, i)}${i >= INGREDIENT_NAMES.length ? ` ${i}` : ""}`,
    unit: pick(UNITS, i),
    price: Number((50 + (i % 900) + (i % 7) * 0.25).toFixed(4)),
    waste_percent: Number(((i % 15) * 0.5).toFixed(2)),
    notes: i % 4 === 0 ? "Sezonska nabavka" : null,
  }));

  for (const part of chunk(ingredientRows, batchSize)) {
    const { error } = await admin.from("ingredients").upsert(part, { onConflict: "venue_id,name" });
    if (error) throw new Error(`ingredients: ${error.message}`);
  }

  const { data: storedIngredients, error: ingErr } = await admin
    .from("ingredients")
    .select("id, price")
    .eq("venue_id", venueId);
  if (ingErr) throw ingErr;
  const ingredientIds = storedIngredients.map((r) => r.id);

  // price history (2–4 points each for first 200)
  const history = [];
  for (const row of storedIngredients.slice(0, Math.min(200, storedIngredients.length))) {
    const n = 2 + (row.id.charCodeAt(0) % 3);
    for (let h = 0; h < n; h++) {
      history.push({
        ingredient_id: row.id,
        price: Number((Number(row.price) * (0.85 + h * 0.07)).toFixed(4)),
        recorded_at: new Date(Date.now() - h * 86400000 * 7).toISOString(),
      });
    }
  }
  for (const part of chunk(history, batchSize)) {
    const { error } = await admin.from("ingredient_price_history").insert(part);
    if (error) console.warn("price history:", error.message);
  }

  // --- recipes + items ---
  let createdRecipes = 0;
  for (let offset = 0; offset < recipeCount; offset += batchSize) {
    const n = Math.min(batchSize, recipeCount - offset);
    const recipes = Array.from({ length: n }, (_, j) => {
      const i = offset + j;
      return {
        id: randomUUID(),
        venue_id: venueId,
        name: recipeName(i),
        description: recipeDescription(i),
        portions: 4 + (i % 12),
        selling_price: Number((400 + (i % 50) * 20).toFixed(2)),
      };
    });
    const { error: rErr } = await admin.from("recipes").insert(recipes);
    if (rErr) throw new Error(`recipes @${offset}: ${rErr.message}`);

    const items = [];
    for (const [j, recipe] of recipes.entries()) {
      const i = offset + j;
      const lineCount = 8 + (i % 18); // 8..25
      for (let k = 0; k < lineCount; k++) {
        const ingredientId = ingredientIds[(i * 3 + k * 5) % ingredientIds.length];
        items.push({
          recipe_id: recipe.id,
          ingredient_id: ingredientId,
          quantity: Number((10 + ((i + k) % 500) + k * 2.5).toFixed(3)),
        });
      }
    }
    for (const part of chunk(items, batchSize)) {
      const { error } = await admin.from("recipe_items").insert(part);
      if (error) throw new Error(`recipe_items @${offset}: ${error.message}`);
    }
    createdRecipes += n;
    console.log(JSON.stringify({ phase: "recipes", createdRecipes, target: recipeCount }));
  }

  // --- test users (shared password) ---
  const userEmails = [];
  for (let i = 0; i < userCount; i++) {
    const email = `perf-user-${String(i + 1).padStart(4, "0")}@treuplate.local`;
    await ensureUser(email, { full_name: `Perf User ${i + 1}` });
    userEmails.push(email);
    if ((i + 1) % 50 === 0) {
      console.log(JSON.stringify({ phase: "users", created: i + 1, target: userCount }));
    }
  }

  const summary = {
    phase: "done",
    venueId,
    ownerEmail,
    ownerId,
    recipes: createdRecipes,
    ingredients: ingredientIds.length,
    users: userEmails.length,
    sharedPasswordEnv: "PERF_SEED_PASSWORD",
    note: "App list queries still .limit(100) — seed volume is for DB/API/k6, not full UI list.",
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
