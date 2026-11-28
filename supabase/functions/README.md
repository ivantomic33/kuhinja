# Supabase Edge Functions

Checkout, customer portal i potpisani Paddle događaji koriste Next.js rute opisane u [vodiču za naplatu](../../docs/billing.md).

## Account deletion

Apply the database migrations before deploying the Edge Function.

```bash
supabase functions deploy delete-account
supabase secrets set --env-file <billing-env-file>
```

Set `PADDLE_API_KEY` and `PADDLE_ENVIRONMENT` in the Edge environment. Use `sandbox` for testing and `live` for production. Supabase provides its URL, anon key, and service role key.

The function verifies the caller with Supabase Auth, checks for a session created within five minutes, cancels the caller's Paddle subscriptions, and invokes the deletion transaction. Refreshing a session token does not reset its age.

Run the local integration test with Supabase and `psql` available.

```bash
supabase functions serve delete-account
node --env-file=.env.local --test supabase/tests/delete-account.mjs
```
