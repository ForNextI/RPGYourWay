# RPG Your Way

**Build 0.1.2 · Audience accordions**

RPG Your Way is a fresh Next.js project for the commercial AIGM product. Build 0.1.2 adds a compact, mobile-friendly explanation of who the site is for without turning the landing page into a wall of text.

## What changed in 0.1.2

- Added an outer landing-page accordion built around “Tabletop gaming is best in person. No question.”
- Added nested accordions for solo players, neurodivergent players, forever DMs, blind and screen-reader users, players with irregular schedules, and beginners or returning players.
- Preserved the personal note explaining that solo and neurodivergent play are part of why the site was built.
- Used native `<details>` and `<summary>` controls for a lightweight, keyboard-friendly, no-JavaScript interaction that works well on phones.
- Kept the 0.1.1 logo and favicon work unchanged.

## Previous build

Build 0.1.1 installed the approved RPG Your Way logo, compass mark, favicon, app icon, and Apple touch icon.

## Foundation inherited from 0.1.0

- Next.js 16.2.6 / React 19 / TypeScript
- Responsive landing page
- `/play`, `/pricing`, `/account`, `/support`, `/legal/privacy`, and `/legal/terms`
- Accessibility skip link and visible focus treatment
- Reduced-motion handling
- Temporary `robots.txt` policy that blocks indexing while the commercial site is under construction
- Release validator

## Still intentionally not wired

- No WardensPC gameplay code yet
- No authentication provider yet
- No payment provider yet
- No OpenAI API key or gameplay route yet
- No final pricing
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

## Next infrastructure layer

The intended next build is account and billing infrastructure, followed by migration of the AIGM and campaign data model. The exact providers should be wired deliberately rather than faked in this starter.
