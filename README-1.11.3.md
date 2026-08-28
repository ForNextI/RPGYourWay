# RPG Your Way 1.11.3

Multiplayer QA hardening and Play polish.

- Keeps the multiplayer side rail within the Play viewport when **Table setup** is open and gives the setup contents their own internal scroll area.
- Replaces the native disclosure marker on **Table setup** with RPG Your Way's standard rotating plus/X accordion furniture.
- Changes the Session tools **Back to Play** behavior during multiplayer so it actually exits realtime multiplayer first: coordinators close the current room; other participants leave their seat; Play then opens without the multiplayer invite parameter.
- Requests the browser Screen Wake Lock while Play is visible, with visibility-based reacquisition and graceful fallback on unsupported or denied devices.
- Makes the main Play Send button forest green with white icon/text as soon as a gameplay message is sendable; hover/focus changes the icon/text to house lime.
- Makes multiplayer human-player capacity follow the current campaign character count, capped at six. A four-character campaign therefore displays **1/4**, **3/4**, etc. and cannot accept a fifth human participant.
- Repairs the **Add another character** header so its Back to Play control no longer expands across the board or crushes the heading/copy.
- Advances the application release line from **1.11.2** to **1.11.3**.
