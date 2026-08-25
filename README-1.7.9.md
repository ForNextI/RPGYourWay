# RPG Your Way 1.7.9

Recovery release from the failed 1.7.5 release gate.

- Preserves the successful 1.7.5 runtime work that made Play voice input and readback available to signed-in players.
- Removes the stale historical validator assertions that still required voice, speech, and transcription to be owner-QA-only.
- Finishes the planned Play layout/color cleanup using the proven WardensPC desktop rail proportions as a reference.
- Reclaims mobile transcript width without reducing gameplay prose size.
- Uses the normal forest palette for Play text and filled controls; lime is reserved for deliberate thin button highlights rather than ordinary text or surfaces.
- Keeps `Initiative & Dice` on one line when it fits and keeps `& Dice` together if accessibility enlargement forces a wrap.
- Versions 1.7.6 through 1.7.8 were consumed by failed recovery attempts, so the recovered release advances directly to 1.7.9.
- No SQL migration, dependency, billing, AI, campaign-storage, landing-page, Account-page, or AdSense change.
