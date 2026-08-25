# RPG Your Way 1.6.100

Stripe funding + public Script rename + three small RPG Your Way cleanup items.

## What this build does

### Stripe Play Pack funding

- Adds hosted Stripe Checkout for all six Play Packs.
- Uses the existing shared RPG Your Way prepaid wallet and `rpgyw_credit_usage` service-role RPC.
- Credits the account only after Stripe reports the Checkout Session as paid.
- Validates the Play Pack id, USD currency, purchase amount, and RPG Your Way account reference before crediting.
- Uses `stripe:checkout:<checkout-session-id>` as the ledger idempotency key, so duplicate webhook deliveries cannot double-credit the balance.
- Finalizes a paid checkout on the Account return page as well as through the webhook. The same idempotency key makes both paths safe, and the Account page does not have to wait for webhook timing before showing the new balance.
- Supports both `checkout.session.completed` and `checkout.session.async_payment_succeeded` webhook events.
- Excludes `/api/stripe/webhook` from the Supabase session-refresh proxy so Stripe can call it directly.

Current Play Packs and metered AI allowances:

| Play Pack | Purchase | Usage added |
| --- | ---: | ---: |
| Starter Play | $5 | $4.25 |
| Occasional Play | $15 | $13.50 |
| Regular Play | $30 | $27.00 |
| Frequent Play | $45 | $40.50 |
| Extended Play | $65 | $58.50 |
| Marathon Play | $90 | $81.00 |

Every pack uses the same AI and features. Starter Play has proportionally less metered allowance because fixed payment-processing costs matter more on a $5 purchase.

### Shape is now Script in public

- Primary navigation now says **Script** and opens `/script`.
- The old `/shape` route permanently redirects to `/script`.
- Customer-facing workbench copy, buttons, errors, account copy, landing copy, pricing copy, and usage-report labels now say **Script**.
- Internal plumbing deliberately remains `shape_jobs`, `/api/shape/...`, `ShapeWorkspace`, Shape config/types, and the existing Supabase schema.

### Other two small RPG Your Way tasks

- **Read** in the primary navigation now opens `TheReadingOfTheWardens.com` in a new browser tab.
- Account creation now asks for **Confirm your email address** and refuses submission if the two email entries do not match.

## No new Supabase migration

1.6.100 uses the shared-wallet migration already applied for 1.5.402. Do not run a new SQL migration for this build.

The existing `rpgyw_credit_usage(...)` RPC is intentionally service-role only. The new Stripe path calls it from the server with `SUPABASE_SERVICE_ROLE_KEY`.

## Required Vercel environment variables

The existing public Supabase/OpenAI variables remain unchanged. Add these server-side variables:

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

`STRIPE_SECRET_KEY` should be the Stripe test secret key while we validate the purchase flow. `SUPABASE_SERVICE_ROLE_KEY` comes from the same Supabase project RPG Your Way already uses. Never expose either value as `NEXT_PUBLIC_*`.

## Stripe webhook

After this build is deployed, create a Stripe webhook endpoint for:

```text
https://www.rpgyourway.com/api/stripe/webhook
```

Subscribe it to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
```

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` in Vercel, then redeploy so the secret is available to the route.

## First test

Use Stripe test mode first.

1. Sign in to RPG Your Way.
2. Open **Pricing**.
3. Buy **Starter Play** through Stripe Checkout.
4. Complete the test payment.
5. Stripe returns to **Account**.
6. Confirm the shared balance increased by **$4.25** and Recent activity shows **Play Pack purchase**.
7. Reload Account and confirm the balance does not increase a second time.
8. In Stripe, resend the successful checkout webhook and confirm the balance still does not increase a second time.

That last pair is the duplicate-credit regression test.

## Still intentionally not done in 1.6.100

- Script does not yet deduct from the shared balance. It remains private/no-charge while we wire reservation and actual-usage capture.
- Play does not yet deduct from the shared balance.
- Stripe refunds/chargebacks are not yet automated into the RPG Your Way ledger. Do not treat the current credit path as the final refund policy.
- The onboarding and Play-page structural migration has not started yet.

## Validation

Run from the repository root:

```bash
pnpm run validate:release
pnpm run build
git diff --check
git status --short
```

The release validator now includes Stripe Play Pack amount checks and Stripe webhook-signature verification in addition to the existing Shape/Script and usage-money regression tests.
