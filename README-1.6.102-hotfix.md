# RPG Your Way 1.6.102 hotfix

Cumulative build hotfix for the 1.6.100 Stripe funding release.

## Included

- Carries forward the 1.6.101 `ShapeWritingDisposition` TypeScript fix in `app/api/shape/transform/route.ts`.
- Fixes the production TypeScript import in `lib/stripe/checkout.ts` by removing the `.ts` extension from `../billing/play-packs`.
- Updates the visible/custom RPG Your Way build number to `1.6.102`.
- Adds a release-validator guard so production TypeScript cannot silently reintroduce a `.ts`-extension import in Stripe checkout.

## No database change

No Supabase migration is required.

## Apply

```bash
unzip -o RPGYourWay-1.6.102-stripe-funding-hotfix.zip
rm RPGYourWay-1.6.102-stripe-funding-hotfix.zip
pnpm run validate:release
pnpm run build
git diff --check
git status --short
```
