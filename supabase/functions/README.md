# Supabase Edge Functions

## Billing (Stripe)

| Function | Auth | Role |
| --- | --- | --- |
| `create-checkout-session` | User JWT | Create Checkout (14-day trial) |
| `create-portal-session` | User JWT | Open Customer Portal |
| `stripe-webhook` | Stripe signature | Update `profiles.plan` (service role) |

### Deploy

```bash
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

Webhook must use `--no-verify-jwt` so Stripe can POST without a Supabase JWT.
Signature verification still runs inside the function.

### Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_MONTHLY_ID=price_...
supabase secrets set STRIPE_PRICE_YEARLY_ID=price_...
supabase secrets set SITE_URL=https://your-domain.example
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform.

### Stripe webhook events

Point the Stripe endpoint to:

`https://<project-ref>.supabase.co/functions/v1/stripe-webhook`

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Account deletion

Apply the database migrations before deploying the Edge Function.

```bash
supabase db push
supabase functions deploy delete-account
```

The function verifies the caller with Supabase Auth and uses the service role
to invoke the deletion transaction. Token refresh does not reset the five-minute
sign-in window.

To run the integration test, start local Supabase, run
`supabase functions serve delete-account`, and use a test environment file with
the local Supabase URL, anon key, and service role key. The test requires `psql`
and defaults to the local database on port 54322.

```bash
node --env-file=.env.local --test supabase/tests/delete-account.mjs
```
