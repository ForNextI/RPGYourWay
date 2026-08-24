# RPG Your Way 1.5.400 — Shape private beta

This build moves Shape from foundation status into a controlled real-API testing workbench.

## What changed

- Ports the mature WardensPC ProseMaker 5.1 continuity, correction, chronology, and rolling-seam prompts into RPG Your Way Shape.
- Keeps the existing 45,000-character single-pass lane and supports one Shape request up to 1,000,000 characters.
- Adds durable campaign projects so exceptionally large campaigns can carry a compact continuity ledger from one chronological part to the next.
- Adds duplicate-transcript protection and the ability to discard a saved unfinished job.
- Makes completed Shape results recoverable after a page refresh by loading the most recent non-cancelled job from the signed-in account.
- Adds per-call provider usage instrumentation: model, phase, operation, request ID when available, input tokens, cached input tokens, output tokens, total tokens, input characters, duration, success/failure, and status code.
- Adds a downloadable JSON test-usage report for Project Feasibility. It contains usage metadata but no transcript or finished prose.
- Cleans up the Shape UI and explains the planned maximum-price-before-processing model. Stripe remains intentionally disconnected.
- Adds runtime Shape sanity tests to `pnpm run validate:release`.

## Supabase migration

After applying this overlay, run the SQL contained in:

`supabase/migrations/20260824194500_shape_beta_instrumentation.sql`

This migration adds `shape_projects`, extends `shape_jobs`, and adds `shape_usage_events` with row-level security.

## Private test configuration

The existing environment variables remain in use:

- `OPENAI_API_KEY`
- `OPENAI_SHAPE_MODEL`
- `RPGYW_SHAPE_BETA_EMAILS`

Only allowlisted signed-in accounts can start AI processing. Other signed-in visitors can inspect the Shape workbench without spending API usage.

## Recommended first live tests

1. 10,000–20,000 characters to verify the single-pass path and usage report.
2. About 40,000 characters to exercise the top of the single-pass lane.
3. 60,000–100,000 characters to force continuity analysis and rolling writing seams.
4. A real 150,000–300,000-character campaign section after the earlier tests pass.

For every test, save the Shape usage JSON and compare the recorded usage with the provider usage/cost records for the same period before building the paid quote formula.
