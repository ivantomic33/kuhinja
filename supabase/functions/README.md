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
