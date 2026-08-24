import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { createClient } from '@/lib/supabase/server'
import { signOut } from './actions'

export const metadata = { title: 'Account' }
export const dynamic = 'force-dynamic'

type AccountPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const statusMessages: Record<string, string> = {
  'signed-out': 'You are signed out.',
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : ''
  const error = typeof params.error === 'string' ? params.error : ''

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const email = typeof claims?.email === 'string' ? claims.email : null

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell">
          <p className="kicker">Account</p>
          <h1 className="page-title">Your campaigns. Your account.</h1>
          <p className="page-lede">Sign in here any time to reach your account directly. This page will also become the home for campaign ownership, Shape jobs, balances, purchases, and other account settings as those systems come online.</p>

          {statusMessages[status] ? <p className="auth-message auth-message-success" role="status">{statusMessages[status]}</p> : null}

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
            <AuthPanel returnTo="/account" status={status} error={error} />
          )}

          <p className="note-box">The account layer is now live, but this is still an early account dashboard. Paid access, campaign storage, and Shape job history are not connected yet.</p>
        </div>
      </main>
    </PageShell>
  )
}
