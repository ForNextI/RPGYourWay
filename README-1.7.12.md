# RPG Your Way 1.7.12

Play space-reclamation and account-entry cleanup, retried after the failed 1.7.10 and 1.7.11 installers.

- Uses the 80%-readability / 67%-density QA comparison as the design target: gameplay prose stays readable while surrounding chrome, gaps, headers, and rails become substantially tighter.
- Campaign star, adventure name, voice settings, and fullscreen control share the first header row; Game Master / scene / turn metadata gets the full-width row below.
- Composer starts at two lines on desktop and mobile.
- Mobile hides the two help questions under the collapsed Session Tools control; desktop keeps the existing three-button row. Expanded mobile Session Tools use the full available width.
- Character rail header, helper spacing, cards, and list gaps are tightened. Visible reorder arrows are removed from ordinary pointer/touch use. Desktop drag reorders; mobile long-press then drag reorders; keyboard-accessible move controls remain and float only when focused.
- Center conversation receives more horizontal and vertical room; mobile gutters, transcript spacing, utility-panel padding, and bottom navigation are tightened without shrinking normal conversation prose.
- The daily sign-in/create-account prompt now uses a full-width “Not now. I just want to look around.” button.
- Create account asks for email once and password twice. The server refuses account creation when the two passwords do not match.
- Versioning is permanently Site.Update.Patch; all feature work, fixes, and hotfixes advance the single third-field sequence. The failed 1.7.10 installer consumed that number, so this complete retry is 1.7.11.
- No SQL migration and no package dependency change.
