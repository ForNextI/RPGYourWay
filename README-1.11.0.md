# RPG Your Way 1.11.0

Native multiplayer Phase 1: private-test lobby, realtime transport, and table chat.

- Adds server-authoritative multiplayer sessions with long random invite codes, a coordinator identity, expiration, and a six-player seat limit.
- Keeps **Start Multiplayer** private to the RPG Your Way owner QA account during this incomplete Phase 1; ordinary authenticated accounts can still join when the coordinator sends them a valid invite link.
- Adds authenticated join, explicit player leave, character-seat claim/release, coordinator close, and reconnectable session lookup APIs.
- Adds server-issued, short-lived Ably TokenRequests scoped to only the current multiplayer room. The Ably server key remains server-side.
- Adds room Presence for connected-player state and human-to-human **Table Chat** using Ably Pub/Sub. Chat messages do not enter the AIGM gameplay route and do not consume AI usage balance.
- Extends the existing Play UI rather than replacing it: desktop multiplayer shows Play plus Chat, with Dice or Characters temporarily replacing Chat; mobile keeps Play as home and opens Chat, Dice, or Characters as secondary full-screen panels with **Back to Play**.
- Keeps chat scroll state and unread counts when another secondary panel is open.
- Preserves multiplayer invite codes through sign-in/account creation and lets invited players join the Phase 1 lobby even when that browser does not carry the coordinator's campaign copy.
- Adds Supabase tables for multiplayer sessions, room characters, and active seats. Row-level security is enabled with no browser policies; multiplayer mutations go through authenticated RPG Your Way server routes.
- Adds deterministic tests for Ably room capability scope and TokenRequest HMAC signing.
- Preserves the Phase 1 boundary: shared AIGM action serialization, public game-state synchronization, sponsorship, multi-payer reservations, and split billing are **not included yet**.

Deployment requirements:

1. Apply `supabase/migrations/20260828043000_native_multiplayer_phase1.sql` to the production Supabase project.
2. Add the server-only `ABLY_API_KEY` environment variable for the existing Ably app used by RPG Your Way multiplayer.
3. Deploy the application normally.

The browser never receives the Ably root/server API key. It receives short-lived signed TokenRequests whose capabilities are limited to its current multiplayer room.
