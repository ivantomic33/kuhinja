# Server auth inventory

Middleware checks for a session cookie and verifies the user on HTML
navigations. Server Components share the identity verified by `getClaims()`.
Private mutations use `getUser()` and reuse that identity in downstream checks.
Supabase policies apply to the browser and SSR clients.

The error payload uses `{ error: { code, message, status? } }`. A stale ingredient
or recipe update returns `VERSION_CONFLICT` with HTTP status 409.

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
| `app/auth/callback/route.ts` | `GET` | user returned by the Auth code exchange | venue `owner_id` and consent `user_id` = verified user | Zod query fields, safe `next` path and Zod consent metadata |
| `lib/legal/actions.ts` | `recordLegalConsent` | verified Google user from `requireActionUser` | consent `user_id` = verified user under RLS | `registerLegalConsentSchema` |
| `app/api/versioned-update/route.ts` | `PATCH` | yes (`requireActionUser`) | ingredient or recipe RLS | strict Zod envelope and resource-specific patch |

| `app/api/billing/transaction/route.ts` | `POST` | verified user | transaction bound server-side | strict Zod checkout intent |
| `app/api/billing/portal/route.ts` | `POST` | verified user | customer's active account binding | same-origin request |
| `app/api/webhooks/paddle/route.ts` | `POST` | verified Paddle signature | customer binding and checkout authorization in SQL | Zod subscription payload |

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
| `lib/stock/actions.ts` | stock writes use RLS on `stock_*`. The price RPC validates its arguments in PostgreSQL and runs as the caller. |
| `lib/domain/saveRecipeItems.ts` | recipe_items replace |
| `lib/domain/venue.ts` | primary venue read |
| `lib/offline/checklist-sync.ts` | starting a run uses RLS for `user_id`, venue and template. Item writes use a security-invoker RPC with RLS on the parent run. |
| `lib/billing/invoke.ts` | Next.js billing routes verify the signed-in user |

## Edge functions (`supabase/functions`)

| Function | Auth | Notes |
| --- | --- | --- |
| `delete-account` | `getUser` via JWT and a session created within 5 minutes | Service-role RPC deletes the caller and owned data in one transaction |
