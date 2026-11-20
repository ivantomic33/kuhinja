# Server auth inventory

Middleware only checks that a session cookie exists. Every server action, route
handler, and server-side Supabase call must authorize itself with
`supabase.auth.getUser()` (not `getSession()`).

Error shape: `{ error: { code, message } }` with codes
`UNAUTHORIZED` | `FORBIDDEN` | `VALIDATION_ERROR` | `NOT_FOUND` | `INTERNAL_ERROR`.

## Server actions (`"use server"`)

| File | Function | Auth check | Ownership check | Input validated |
| --- | --- | --- | --- | --- |
| `lib/auth/actions.ts` | `loginAction` | n/a (public) | n/a | yes (strict Zod) |
| `lib/auth/actions.ts` | `registerAction` | n/a (public) | n/a | yes (strict Zod) |
| `lib/auth/actions.ts` | `forgotPasswordAction` | n/a (public) | n/a | yes (strict Zod) |
| `lib/auth/actions.ts` | `resetPasswordAction` | yes (`getUser`) | self only | yes (strict Zod) |
| `lib/auth/actions.ts` | `signOutAction` | yes (`getUser`) | self only | n/a |
| `lib/auth/actions.ts` | `getGoogleOAuthUrl` | n/a (public) | n/a | yes (strict Zod path) |
| `lib/auth/profile-actions.ts` | `updateProfileAction` | yes | self (`user.id`) | yes (strict Zod) |
| `lib/schedule/actions.ts` | `updateSchedule` | yes | schedule location membership | yes (strict Zod) |
| `lib/schedule/actions.ts` | `loadScheduleReport` | yes | schedule location membership | yes (strict Zod) |

## Route handlers

| File | Function | Auth check | Ownership check | Input validated |
| --- | --- | --- | --- | --- |
| `app/auth/callback/route.ts` | `GET` | yes (`exchangeCode` + `getUser`) | venue `owner_id` = verified user | safe `next` path |

## Server-side Supabase helpers / loaders

| File | Function | Auth check | Ownership check | Input validated |
| --- | --- | --- | --- | --- |
| `lib/schedule/server.ts` | `loadSchedule` | yes | RPC `auth.uid()` scope | UUID/date parse |
| `lib/schedule/server.ts` | `loadPublicSchedule` | n/a (token capability) | share token | UUID token |
| `lib/schedule/server.ts` | `loadMonthlyReport` | yes | RPC owner + plan | UUID/date parse |
| `lib/supabase/plan-server.ts` | `getPlanDetails` | yes (`getServerUser`) | `profiles.id = user.id` | n/a |
| `lib/supabase/recipe-count.ts` | `getRecipeCount` | yes (`getServerUser`) | RLS + auth gate | n/a |
| `app/(app)/layout.tsx` | layout | yes → redirect | n/a | n/a |
| App pages under `app/(app)/**` | various | layout + `getServerUser` / RLS | venue owner via RLS | page params |

## Client-side mutations (not server actions)

These use the browser Supabase client and rely on Postgres RLS. They are **not**
`"use server"` entry points. Prefer moving privileged writes to server actions
over time; never trust client-supplied `user_id` / `owner_id`.

| File | Notes |
| --- | --- |
| `lib/stock/actions.ts` | stock writes; RLS on `stock_*` |
| `lib/domain/saveRecipeItems.ts` | recipe_items replace |
| `lib/domain/venue.ts` | primary venue read |
| `lib/offline/checklist-sync.ts` | checklist run upsert (includes `user_id` in payload — RLS must enforce) |
| `lib/billing/invoke.ts` | edge function invoke with user JWT |

## Edge functions (`supabase/functions`)

| Function | Auth | Notes |
| --- | --- | --- |
| `create-checkout-session` | `getUser` via JWT | 401 if missing |
| `create-portal-session` | `getUser` via JWT | 401 if missing |
| `delete-account` | `getUser` via JWT | deletes only caller |
| `stripe-webhook` | Stripe signature | no user session |
