# RPG Your Way 1.6.000

Current foundation:
- Supabase account authentication and persistent account ownership.
- Shape private beta with durable jobs, project continuity, and per-call usage instrumentation.
- ProseMaker v5.2 rolling sections now distinguish normal prose from a successful `no_new_prose` result when a source chunk contains only material the converter is supposed to omit.
- Administrative-only chunks can checkpoint and advance without inventing story prose; they may still revise the bounded previous prose seam when a source correction requires it.
- Empty output is still rejected when the model declares that prose should have been written, so genuinely incomplete responses continue into repair/recovery instead of being silently accepted.
- Shape recovery hardening retains no-change seam preservation, fresh full-section repair, smaller recovery subsections, private-test diagnostics, and downloadable checkpointed prose after an error.
- 1.6.000 rotates writing/repair/recovery operation identities and provider idempotency keys to v2 so saved 1.5.500 jobs receive fresh calls under the new structured schema while prior usage-ledger costs remain preserved.
- Shape usage aggregates are rebuilt from the idempotent per-call ledger so ordinary retries do not double-count already-recorded provider work.
- One persistent prepaid RPG Your Way usage balance shared by Play and Shape.
- Append-only balance ledger plus reservation/capture plumbing for future processing reserves and concurrent-request safety.
- Account dashboard shows available balance and recent balance activity.

No Supabase migration is required for 1.6.000.

Regression target after deploy: resume the existing stranded PW III Shape job. A source section containing no new story-bearing material should now checkpoint as a successful `no_new_prose` section rather than failing as incomplete.

Next commercial step after this reliability regression passes: connect Stripe Play Pack purchases to the shared balance, then wire successful Shape and Play AI usage into balance reservations and deductions.
