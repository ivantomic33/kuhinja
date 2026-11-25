# Supabase Edge Functions

## Billing (Paddle)

| Function | Auth | Role |
| --- | --- | --- |
| `create-checkout-session` | User JWT | Start Starter or Pro Checkout with a 14-day first trial |
| `create-portal-session` | User JWT | Open Customer Portal |
| `paddle-webhook` | Paddle signature | Record Paddle events and sync subscriptions (service role) |

### Deploy

```bash
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy paddle-webhook --no-verify-jwt
```

Webhook must use `--no-verify-jwt` so Paddle can POST without a Supabase JWT.
Signature verification still runs inside the function.

### Secrets

```bash
supabase secrets set --env-file <billing-env-file>
```

Copy the Paddle server and Edge variables from [`.env.example`](../../.env.example) to the billing secrets file. See the [billing guide](../../docs/billing.md) for catalog, checkout URL, and webhook setup.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform. See the [billing runbook](../../docs/billing.md) for Next.js server configuration, reconciliation, and local checks.

### Paddle webhook events

For sandbox, point the Paddle endpoint to:

`https://<project-ref>.supabase.co/functions/v1/paddle-webhook`

Use the subscription lifecycle events listed in the [billing guide](../../docs/billing.md). For live, point Paddle at the public proxy described there.

## Account deletion

Apply the database migrations before deploying the Edge Function.

```bash
supabase functions deploy delete-account
```

The function verifies the caller with Supabase Auth and uses the service role
to verify the fresh session, cancel existing Paddle subscriptions, and invoke the deletion transaction. Token refresh does not reset the five-minute
sign-in window.

To run the integration test, start local Supabase, run
`supabase functions serve delete-account`, and use a test environment file with
the local Supabase URL, anon key, and service role key. The test requires `psql`
and defaults to the local database on port 54322.

```bash
node --env-file=.env.local --test supabase/tests/delete-account.mjs
```
