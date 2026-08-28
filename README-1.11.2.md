# RPG Your Way 1.11.2

Multiplayer QA and site-wide character addition.

- Adds a session-scoped, user-editable **chat name** so multiplayer players are not stuck with an email-derived label.
- Changes multiplayer character control from one character per human to **multiple characters per human**, while each campaign character can still be controlled by only one player at a time.
- Adds a migration from the 1.11.0/1.11.1 single-character seat claim into the new many-character claim table.
- Widens the desktop/laptop Table Chat rail so normal conversation wraps less aggressively.
- Implements **Add another character** for every existing RPG Your Way campaign, not only multiplayer campaigns. The rebuilt Start character tools add one or more party members without resetting campaign history, gameplay state, settings, or existing characters.
- Preserves the multiplayer invite while the coordinator visits Start to add characters, then synchronizes the expanded campaign roster back into the active multiplayer room on return to Play.
- Keeps the human-player limit and campaign-character limit separate: up to six connected players and up to six campaign characters.
- Advances the application release line from **1.11.1** to **1.11.2**.

## Deployment

Apply the new Supabase migration before or with the application deployment:

`supabase/migrations/20260828073000_multiplayer_names_multi_character.sql`

No new environment variables are required beyond the existing multiplayer configuration.
