# RPG Your Way 1.8.0 — Start onboarding UI foundation

Build 1.8.0 begins the simplified new-player onboarding flow on Start. It is intentionally a UI-review build: the new campaign-creation and character-standardization AI engines are not connected yet. Existing saved/adventure-import functionality remains available below the new flow.

## Included

- automatic age/content pop-up using the existing browser age-band key;
- plain-language game-rules selection with Uncharted Realm fixed as the setting;
- D&D 5.5e default Fighter/Wizard/Cleric/Rogue party and 12-character ready-to-play picker;
- file/drop/paste character-import UI with Imported → Ready to standardize → Standardizing → Ready states;
- “Standardize for RPG Your Way” terminology;
- automatic party-leader display, change/none controls, and buried full leadership-rule explanation;
- optional six-question campaign-tuning UI with per-question help modals and skip path;
- campaign name, Game Master name, Fable/Marin voice choices, and final PLAY control;
- “I need help with all of this” FAQ and the UI shell for 25-question free Start Page Help;
- current returning-player saved/import flow preserved in a collapsed section;
- sitewide Contact footer mail link to brett@rpgyourway.com;
- Account-page Delete my account danger-zone control with explicit DELETE confirmation and server-side Supabase account deletion;
- hot interaction green standardized to #00ff00.

## Deliberately not wired yet

- AI character standardization;
- paid-overage estimation/consent for unusually complex character standardization;
- Start Page Help AI calls and 25-question enforcement;
- final campaign object creation behind PLAY.

Those pieces follow after UI/QA review of this shell.
