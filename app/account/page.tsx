import { PageShell } from '@/components/PageShell'
import { createClient } from '@/lib/supabase/server'
import { signIn, signOut, signUp } from './actions'

export const metadata = { title: 'Account' }
export const dynamic = 'force-dynamic'

type AccountPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const statusMessages: Record<string, string> = {
  'signed-in': 'Signed in. Your RPG Your Way account is connected.',
  'signed-out': 'You are signed out.',
  created: 'Account created and signed in.',
  'check-email': 'Account created. Check your email and confirm the address before signing in.',
  confirmed: 'Email confirmed. Your account is ready.',
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : ''
  const error = typeof params.error === 'string' ? params.error : ''

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const email = typeof claims?.email === 'string' ? claims.email : null

  const statusText = statusMessages[status]
  const errorText = error === 'confirmation'
    ? 'That confirmation link could not be verified. Please try signing in or request a new confirmation email later.'
    : error

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell">
          <p className="kicker">Account</p>
          <h1 className="page-title">Your campaigns. Your account.</h1>
          <p className="page-lede">RPG Your Way now has its first real account layer. Email and password authentication is handled by Supabase, with cookie-backed sessions that work on the server and in the browser.</p>

          {statusText ? <p className="auth-message auth-message-success" role="status">{statusText}</p> : null}
          {errorText ? <p className="auth-message auth-message-error" role="alert">{errorText}</p> : null}

          {claims ? (
            <section className="account-signed-in" aria-labelledby="account-connected-heading">
              <div>
                <p className="account-state-label">Connected account</p>
                <h2 id="account-connected-heading">You’re signed in.</h2>
                <p className="account-email">{email ?? 'Authenticated RPG Your Way user'}</p>
                <p className="account-foundation-note">Campaign ownership, Shape jobs, balances, and purchase history will attach to this account as those systems move in.</p>
              </div>
              <form action={signOut}>
                <button className="button button-secondary" type="submit">Sign out</button>
              </form>
            </section>
          ) : (
            <div className="auth-grid">
              <section className="auth-card" aria-labelledby="sign-in-heading">
                <p className="account-state-label">Already have an account?</p>
                <h2 id="sign-in-heading">Sign in</h2>
                <form action={signIn} className="auth-form">
                  <label>
                    <span>Email</span>
                    <input name="email" type="email" autoComplete="email" required />
                  </label>
                  <label>
                    <span>Password</span>
                    <input name="password" type="password" autoComplete="current-password" required />
                  </label>
                  <button className="button button-primary auth-submit" type="submit">Sign in</button>
                </form>
              </section>

              <section className="auth-card" aria-labelledby="sign-up-heading">
                <p className="account-state-label">New to RPG Your Way?</p>
                <h2 id="sign-up-heading">Create an account</h2>
                <form action={signUp} className="auth-form">
                  <label>
                    <span>Email</span>
                    <input name="email" type="email" autoComplete="email" required />
                  </label>
                  <label>
                    <span>Password</span>
                    <input name="password" type="password" autoComplete="new-password" minLength={8} required />
                  </label>
                  <p className="auth-hint">Use at least 8 characters. We’ll ask you to confirm your email address.</p>
                  <button className="button button-secondary auth-submit" type="submit">Create account</button>
                </form>
              </section>
            </div>
          )}

          <p className="note-box">This is the account foundation, not the finished account dashboard. No campaign data, billing data, or Shape jobs are being stored here yet.</p>
        </div>
      </main>
    </PageShell>
  )
}
