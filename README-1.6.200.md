# RPG Your Way 1.6.200

This minor release turns the account/balance foundation into a usable commercial loop for Script.

Highlights:
- Account is now the normal place to sign in, see balance, and buy usage.
- Play Pack retail prices are $6.00 / $16.90 / $33.40 / $49.90 / $72.00 / $99.50 and add $5 / $15 / $30 / $45 / $65 / $90 of nominal usable balance.
- Stripe's actual settled processing fee is read when available; any included processing amount left over is credited to the customer's usage balance.
- Script is no longer private-allowlist gated. It shows a maximum estimated deduction before processing, reserves that amount, meters successful GPT-5.6 Terra usage, and captures the lesser of actual provider cost or the approved maximum.
- Failed provider calls record zero usage. Discarding a partial job settles successful work and releases unused reservation.
- Account includes the usage-variability note and explicit pricing disclosure.
- Global navigation now includes Account, the header is shorter, the landing dashboard's Continue playing control links to /play, and the footer includes Buy Brett a Coffee with a lime Ko-fi cup.

Before deploying code, apply:
`supabase/migrations/20260825060000_script_commercial_billing.sql`
