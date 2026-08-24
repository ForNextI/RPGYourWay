# RPG Your Way

**Project version 1.5.0.1 · Supabase account foundation**  
**Package-manager version 1.5.1**

RPG Your Way now has the first real Supabase authentication layer. This build adds cookie-backed Supabase SSR clients, a Next.js 16 `proxy.ts` session refresh path, email/password sign-up and sign-in, email-confirmation handling, sign-out, and a live `/account` page that changes according to the authenticated session.

The four-part RPG Your Way version remains the human-facing project version. `package.json` uses the strict three-part `1.5.1` form only because package tooling expects SemVer.

## Supabase dashboard steps required before testing signup confirmation

1. **Authentication → URL Configuration**
   - Set **Site URL** to the production RPG Your Way URL.
   - Add `http://localhost:3000/**` if you want to test locally.
   - Add your Vercel preview wildcard later if preview-email flows are needed.
2. **Authentication → Email Templates → Confirm signup**
   - Use a confirmation link that sends the token hash to RPG Your Way's SSR endpoint:

   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

3. Leave **Confirm Email** enabled for the beta unless we deliberately decide otherwise.

The Vercel/Supabase integration already supplies the production Supabase environment variables. For local development, pull the Vercel development environment into `.env.local` before testing authenticated routes.

## Deliberately not in this build

- campaign database tables
- Shape job tables
- prepaid balances or Stripe
- profile/preferences table
- password-reset flow
- social login
- multiplayer permissions

Those attach to the authenticated user after this base session flow is proven.
