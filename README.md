# RPG Your Way

**Build 0.1.1 · First brand assets**

RPG Your Way is a fresh Next.js project for the commercial AIGM product. Build 0.1.1 installs the first approved RPG Your Way brand assets while preserving the 0.1.0 commercial skeleton.

## What changed in 0.1.1

- Added the full RPG Your Way compass logo to the landing-page hero.
- Replaced the temporary header `R` mark with the standalone compass rose.
- Added the compass rose as the browser favicon and app icon, including an Apple touch icon.
- Kept the existing mobile-first layout, routes, accessibility behavior, and temporary no-index policy unchanged.

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
