import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { createClient } from '@/lib/supabase/server'
import { formatUsageDollars, signedUsageDollars, usageMicrousd } from '@/lib/usage/money'
import { signOut } from './actions'

export const metadata = { title: 'Account' }
export const dynamic = 'force-dynamic'

type AccountPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const statusMessages: Record<string, string> = {
  'signed-out': 'You are signed out.',
}

function activityLabel(source: unknown) {
  if (source === 'shape') return 'Shape'
  if (source === 'play') return 'Play'
  if (source === 'stripe') return 'Play Pack purchase'
  if (source === 'refund') return 'Refund'
  return typeof source === 'string' && source.trim() ? source.trim() : 'Usage adjustment'
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : ''
  const error = typeof params.error === 'string' ? params.error : ''

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  const email = user?.email ?? null

  let wallet: Record<string, unknown> | null = null
  let ledger: Record<string, unknown>[] = []
  let walletUnavailable = false

  if (user) {
    const walletResult = await supabase
      .from('usage_wallets')
      .select('balance_microusd,reserved_microusd,lifetime_credited_microusd,lifetime_debited_microusd,updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (walletResult.error || !walletResult.data) {
      walletUnavailable = true
    } else {
      wallet = walletResult.data as Record<string, unknown>
      const ledgerResult = await supabase
        .from('usage_ledger')
        .select('id,entry_type,amount_microusd,balance_after_microusd,source,source_ref,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8)
      ledger = (ledgerResult.data ?? []) as Record<string, unknown>[]
    }
  }

  const balance = usageMicrousd(wallet?.balance_microusd)
  const reserved = usageMicrousd(wallet?.reserved_microusd)
  const available = Math.max(0, balance - reserved)

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell">
          <p className="kicker">Account</p>
          <h1 className="page-title">Your campaigns. Your account.</h1>
          <p className="page-lede">Your RPG Your Way account keeps your campaigns, Shape work, purchases, and one shared prepaid usage balance together.</p>

          {statusMessages[status] ? <p className="auth-message auth-message-success" role="status">{statusMessages[status]}</p> : null}

          {user ? (
            <>
              <section className="account-signed-in" aria-labelledby="account-connected-heading">
                <div>
                  <p className="account-state-label">Connected account</p>
                  <h2 id="account-connected-heading">You’re signed in.</h2>
                  <p className="account-email">{email ?? 'Authenticated RPG Your Way user'}</p>
                  <p className="account-foundation-note">This account owns your persistent RPG Your Way data and usage history.</p>
                </div>
                <form action={signOut}>
                  <button className="button button-secondary" type="submit">Sign out</button>
                </form>
              </section>

              <section className="usage-balance-card" aria-labelledby="usage-balance-heading">
                <div className="usage-balance-heading-row">
                  <div>
                    <p className="account-state-label">Shared usage balance</p>
                    <h2 id="usage-balance-heading">Play and Shape use the same balance.</h2>
                  </div>
                  {!walletUnavailable ? <p className="usage-balance-amount" aria-label={`${formatUsageDollars(available)} available`}>{formatUsageDollars(available)}</p> : null}
                </div>

                {walletUnavailable ? (
                  <p className="auth-message auth-message-error">The shared usage balance is not available yet. Apply the 1.5.402 balance migration, then reload this page.</p>
                ) : (
                  <>
                    <p className="usage-balance-copy">Play Packs will add prepaid usage here. Play and Shape will deduct successful AI usage from this same pool. No separate Shape wallet or Shape purchase is needed.</p>
                    {reserved > 0 ? <p className="usage-balance-reserved"><strong>{formatUsageDollars(reserved)}</strong> is temporarily reserved for work already in progress. Total balance: {formatUsageDollars(balance)}.</p> : null}
                    <div className="usage-balance-stats" aria-label="Usage balance totals">
                      <div><span>Available now</span><strong>{formatUsageDollars(available)}</strong></div>
                      <div><span>Lifetime added</span><strong>{formatUsageDollars(wallet?.lifetime_credited_microusd)}</strong></div>
                      <div><span>Lifetime used</span><strong>{formatUsageDollars(wallet?.lifetime_debited_microusd)}</strong></div>
                    </div>
                  </>
                )}
              </section>

              {!walletUnavailable ? (
                <section className="usage-activity" aria-labelledby="usage-activity-heading">
                  <div className="usage-activity-heading">
                    <div>
                      <p className="account-state-label">Balance history</p>
                      <h2 id="usage-activity-heading">Recent activity</h2>
                    </div>
                    <p>Purchases, Play, Shape, refunds, and adjustments will appear here.</p>
                  </div>
                  {ledger.length ? (
                    <div className="usage-activity-list">
                      {ledger.map((entry) => {
                        const amount = typeof entry.amount_microusd === 'number' || typeof entry.amount_microusd === 'string' ? entry.amount_microusd : 0
                        const date = typeof entry.created_at === 'string' ? new Date(entry.created_at) : null
                        return (
                          <div className="usage-activity-row" key={String(entry.id)}>
                            <div>
                              <strong>{activityLabel(entry.source)}</strong>
                              <span>{date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                            </div>
                            <div className="usage-activity-amount">
                              <strong>{signedUsageDollars(amount)}</strong>
                              <span>Balance {formatUsageDollars(entry.balance_after_microusd)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : <p className="usage-activity-empty">No balance activity yet. Your first Play Pack purchase will start this ledger.</p>}
                </section>
              ) : null}
            </>
          ) : (
            <AuthPanel returnTo="/account" status={status} error={error} />
          )}

          <p className="note-box">The shared balance foundation is live in this build. Stripe funding and automatic Play/Shape deductions are the next wiring steps.</p>
        </div>
      </main>
    </PageShell>
  )
}
