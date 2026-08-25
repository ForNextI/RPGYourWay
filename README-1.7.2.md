# RPG Your Way 1.7.2

Small Play/Start separation pass after the first 1.7.1 import QA.

- Importing and saved-adventure selection now belong to `/start`.
- `/play` has one job: render the gameplay interface for the currently selected local adventure.
- Start performs a clean full navigation into Play after an import or saved-adventure selection rather than swapping the import screen into the gameplay shell in-place.
- If Play has no selected local adventure, it sends the player back to Start.
- Export remains on Play.
- Campaigns remain browser-local. There is no cloud campaign synchronization.
- No billing, SQL, package dependency, or AdSense changes are included in this release.

This structure is intended to remain in place when the redesigned new-player onboarding is added to Start.
