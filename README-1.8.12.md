# RPG Your Way 1.8.12

Play Pack pricing, whole-turn voice billing, and calmer customer usage reporting.

- Reprices Play Packs around the actual prepaid usage value, a 5% site-operating contribution, and the existing 2.9% + 30¢ Stripe assumption.
- Keeps the same usage values: $5, $15, $30, $45, $65, and $90.
- Adds conservative customer planning estimates for approximate gameplay turns while making clear that RPG Your Way sells usage, not fixed turns.
- Bills a normal Play exchange as one combined provider total: talk-to-text + gameplay AI + AI readback, accumulated in micro-US-dollars and rounded to the nearest cent once at final turn settlement.
- Preserves free onboarding/Start voice behavior instead of sending those audio calls into paid Play billing.
- Records TTS cost from server-measured WAV duration using a launch estimator, while preserving internal data needed for provider reconciliation.
- Keeps owner QA provider-cost tracking while customer billing remains zero.
- Removes customer-facing turn-by-turn usage charges. Account now shows remaining balance, aggregate AI-processing / talk-to-text / AI-readback totals, and Play Pack purchase history.
- Adds a low-balance notice at $1.00 remaining.
- Adds private turn/component billing tables and customer-safe aggregate RPCs in the 1.8.12 Supabase migration.
