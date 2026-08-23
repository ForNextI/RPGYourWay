# RPG Your Way

**Build 1.3.0 · Landing thesis, Play / Shape / Read navigation**

Build 1.3.0 moves the site thesis to the first content position on the landing page and restores the three-part Play / Shape / Read navigation used by the broader project family.

## What changed in 1.3.0

- The landing page now opens with **“Tabletop gaming is best in person. No question.”** followed by **“But sometimes...”**
- The audience explanation now sits directly beneath that thesis behind a compact **“Who RPG Your Way is for”** accordion.
- The existing plus-sign accordion controls remain in place as a visual echo of the compass-rose brand mark.
- Primary navigation is now **Play / Shape / Read**.
- Added a `/shape` placeholder for the returning transcript-to-prose tool. Shape is explicitly separate from the Play balance and will be quoted per conversion.
- Added a deliberately minimal `/read` page pointing novel readers to **TheReadingOfTheWardens.com**.
- Preserved the approved RPG Your Way logo, compass favicon, nested audience accordions, and mobile-first styling.

## Current product rules

- **Play:** prepaid usage balance.
- **Shape:** separately quoted one-time price per conversion; never silently deducted from Play balance.
- **Read:** the novel lives on the separate free reading site.

## Still intentionally not wired

- No WardensPC gameplay code yet
- No authentication provider yet
- No payment provider yet
- No OpenAI API key or gameplay route yet
- No final Play pricing
- Shape quotation and conversion processing are not yet implemented
- No final legal copy
- No analytics or advertising code

## Local setup

```bash
pnpm install
pnpm run validate:release
pnpm run dev
```

Production check:

```bash
pnpm run validate:release
pnpm run build
git diff --check
```
