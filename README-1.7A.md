# RPG Your Way 1.7A QA build

This is the first QA slice of the 1.7.000 Play migration. It is intentionally **import-only** for campaigns. Start/onboarding is still being redesigned separately.

## What is in this alpha

- `/play` now exposes the proven WardensPC gameplay shell after RPG Your Way sign-in.
- Existing WardensPC/RPG Your Way full-game JSON exports can be imported directly into Play.
- Campaign persistence remains local to the browser. Export/import is still how a player backs up or moves a campaign between devices.
- There is no cloud campaign storage or synchronization in this build.
- Typed gameplay requests use the shared prepaid RPG Your Way balance and charge only successful, actual measured Terra usage, rounded to customer-facing cents.
- The customer receives a low-balance warning at $1.00 and an Add Usage path when a request cannot be reserved.
- `brett@rpgyourway.com` is the only owner-QA billing exemption. Provider usage is still measured internally, but that account's customer wallet is not debited.
- The same owner-QA exemption applies to Script.
- Voice/TTS/transcription are enabled only for the owner-QA account in this alpha. Public Play is typed while prepaid voice billing is finished.
- A server-only `provider_usage_events` ledger records real provider cost separately from customer wallet deductions.

## Database migration

Apply this migration once before testing 1.7 Play:

`supabase/migrations/20260825120000_play_provider_usage.sql`

It creates the internal provider-cost ledger. It does not store campaign text or campaign files.

## Dependency/lockfile step

1.7 adds `lucide-react` plus Tailwind/PostCSS for the imported Play interface. The overlay deliberately does **not** replace `pnpm-lock.yaml` because the live repository already contains the Vercel Analytics lockfile change.

After applying the overlay, run:

```bash
pnpm install
pnpm install --frozen-lockfile
pnpm run validate:release
pnpm run build
git diff --check
git status --short
```

The first command updates the lockfile to match the new 1.7 dependencies. The second reproduces Vercel's frozen-lockfile requirement before you push.

## First QA target

Use an exported existing adventure. The highest-value test is The Sharn Chronicles:

1. Sign in with the owner-QA account.
2. Open `/play` and import the full Sharn JSON export.
3. Confirm the campaign opens with its characters, transcript/state, current turn, and Game Master intact.
4. Reload the page and confirm the campaign remains in this browser.
5. Send one ordinary typed turn and confirm a coherent response is saved.
6. Confirm the owner-QA wallet did not decrease.
7. Export the imported campaign again and confirm the resulting JSON is readable.
8. Repeat one small test on the ordinary paid account to verify a real customer wallet deduction.

Do not announce public Play from this alpha alone. It is the QA bridge to the finished 1.7.000 import-only release.
