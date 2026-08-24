# RPG Your Way · Build 1.5.300

Shape foundation + landing accordion copy.

## Included

- Replaces the two landing accordions with Brett's supplied copy and nested section accordions.
- Restores Shape as a working account-owned conversion tool.
- Persists Shape jobs, continuity checkpoints, prose checkpoints, token counts, and results in Supabase.
- Uses the mature WPC Shape thresholds: 45,000-character single pass, ~30,000-character writing sections, ~140,000-character continuity sections, up to 1,000,000 characters per request.
- Adds resume-after-failure/reload behavior.
- Production AI processing fails closed behind `RPGYW_SHAPE_BETA_EMAILS` until Stripe/maximum-cost quoting is installed.
- Adds `OPENAI_API_KEY` / `OPENAI_SHAPE_MODEL` environment placeholders.

## Required before production testing

1. Apply `supabase/migrations/20260824163000_shape_jobs.sql` to the RPG Your Way Supabase project.
2. In Vercel, set `OPENAI_API_KEY`.
3. In Vercel, set `RPGYW_SHAPE_BETA_EMAILS` to the comma-separated email address(es) allowed to test Shape.
4. `OPENAI_SHAPE_MODEL` is optional; the current default is `gpt-5.6-terra`.

Public paid access remains intentionally closed. Stripe and the maximum-cost quote gate come next.
