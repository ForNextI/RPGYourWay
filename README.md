# RPG Your Way

**Build 0.1.0 · Commercial skeleton**

RPG Your Way is a fresh Next.js project for the commercial AIGM product. It deliberately does **not** clone WardensPC wholesale. This first build establishes the public shell, route structure, mobile-first styling, and placeholders for the systems that will be wired next.

## What is in 0.1.0

- Next.js 16.2.6 / React 19 / TypeScript
- WPC-derived dark slate, cyan, and amber palette without WPC branding
- Responsive landing page
- `/play`, `/pricing`, `/account`, `/support`, `/legal/privacy`, and `/legal/terms`
- Accessibility skip link and visible focus treatment
- Reduced-motion handling
- Temporary `robots.txt` policy that blocks indexing while the commercial site is under construction
- Release validator

## What is intentionally not in 0.1.0

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
