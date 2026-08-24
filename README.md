# RPG Your Way

**Build 1.5.100 · Account modal and footer foundation**

RPG Your Way now uses the fixed-width project version `Site.Major.Minor(hotfix)`, so `1.5.100` means Site 1, Major 5, Minor 1, Hotfix 00. This form is also valid SemVer, so the displayed build and `package.json` version can now match.

This build turns the Supabase account foundation into a site-wide account experience:

- unsigned visitors receive a soft sign-in/new-account modal once per local calendar day
- dismissing the modal suppresses that automatic prompt until the next day
- sign-in and account creation reuse one shared authentication panel
- `/account` remains the permanent account-management fallback
- successful modal sign-in returns the visitor to the page they were on
- the footer now carries dodo ink ownership, the build number, and the required SRD 5.2.1 / CC BY 4.0 attribution

## Supabase dashboard steps required before testing signup confirmation

1. **Authentication → URL Configuration**
   - Set **Site URL** to the production RPG Your Way URL.
   - Add `http://localhost:3000/**` if you want to test locally.
   - Add your Vercel preview wildcard later if preview-email flows are needed.
2. **Authentication → Email Templates → Confirm signup**
   - Use this confirmation link so the token hash reaches RPG Your Way's SSR endpoint:

   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

3. Leave **Confirm Email** enabled for the beta unless we deliberately decide otherwise.

The Vercel/Supabase integration already supplies the production Supabase environment variables. For local development, pull the Vercel development environment into `.env.local` before testing authenticated routes.

## Still deliberately not in this build

- campaign database tables
- Shape job tables
- prepaid balances or Stripe
- profile/preferences table
- password-reset flow
- social login
- multiplayer permissions

Those systems attach to the authenticated user after the base account flow is proven.
