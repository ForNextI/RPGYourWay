# RPG Your Way

**Build 1.3.13 · Landing QA and navigation polish**

Build 1.3.13 puts the opening thesis on a cream card, keeps the full RPG Your Way logo square instead of stretching it to the dashboard height, and tucks the audience accordion beneath the logo on desktop. The campaign Continue action now uses olive fill with a lime outline as the visual language for “what happens next.” The site also moves to a screen-friendly serif stack, restores the jeweled line-and-diamond navigation dividers from the WardensPC design language, and adds an accessible full-screen / restore control to the primary header.

**Build 1.3.12 · Parchment-map UI foundation**

Build 1.3.12 establishes the first RPG Your Way visual system: the approved tan-on-tan overland map as the global background, cream/parchment content surfaces, forest-green framing, moss accents, and lime action highlights. The landing page now keeps the Campaign Dashboard directly beneath the opening thesis, aligns it with the logo column, and moves the audience accordion below the hero. The Play route uses a quieter cream-and-hex field instead of the map so the eventual game interface can develop its own immersive treatment.

**Build 1.3.11 · Compact landing thesis font hotfix**

Build 1.3.11 fixes the landing-page thesis font rule so it actually overrides the generic hero heading style on desktop. “Tabletop gaming is best in person.” is now compact introductory copy rather than a full-size display headline.

**Build 1.3.1 · Compact top-aligned landing thesis**

Build 1.3.1 moves the landing thesis and full RPG Your Way logo to the top of the hero on the same visual line, and reduces the thesis from oversized display copy to compact introductory copy. “Tabletop gaming is best in person.” stays on one line where space permits, followed by “No question.” and “But sometimes...”.

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
