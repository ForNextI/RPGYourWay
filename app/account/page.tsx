import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { PLAY_PACKS, formatPurchasePrice, formatUsageValue } from '@/lib/billing/play-packs'
import { beginPlayPackCheckout } from '@/app/pricing/actions'
import { createClient } from '@/lib/supabase/server'
import { formatUsageDollars, signedUsageDollars, usageMicrousd } from '@/lib/usage/money'
import { finalizeCheckoutSessionById } from '@/lib/stripe/server'
import { signOut } from './actions'
import { isOwnerQaEmail } from '@/lib/usage/owner-qa'
import { DeleteAccountControl } from '@/components/account/DeleteAccountControl'

export const metadata = { title: 'Account' }
export const dynamic = 'force-dynamic'

type AccountPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const statusMessages: Record<string, string> = {
  'signed-out': 'You are signed out.',
  'checkout-cancelled': 'Checkout was cancelled. Nothing was charged.',
  'account-deleted': 'Your RPG Your Way account was deleted.',
}

function activityLabel(source: unknown) {
  if (source === 'shape') return 'Script'
  if (source === 'play') return 'Play'
  if (source === 'stripe') return 'Play Pack purchase'
  if (source === 'stripe-surplus') return 'Payment processing credit'
  if (source === 'refund') return 'Refund'
  return typeof source === 'string' && source.trim() ? source.trim() : 'Usage adjustment'
}

function UsageNote() {
  return (
    <details className="usage-note-details">
      <summary>A Note on Usage</summary>
      <div className="usage-note-copy">
        <p>Usage can vary quite a bit from one session to another.</p>
        <p>What you&apos;re paying for is the amount of AI processing your game requires. In simple terms, the more thinking the game has to do, the more usage it takes.</p>
        <p>If your party spends an afternoon wandering through a field, visiting a tavern, talking with friends, playing dice, and listening to the bard sing, that may use relatively little.</p>
        <p>A complicated party with multiple characters, subclasses, multiclassing, spells, abilities, and a large combat encounter requires considerably more.</p>
        <p>That means two sessions of similar length may use different amounts of your balance.</p>
        <p>There aren&apos;t extra charges hidden inside the heavier session. It simply required more processing to run.</p>
        <p>We want you to know that before you play, especially if you enjoy mechanically complex characters, large parties, or combat-heavy games.</p>
        <p>However you like to play, enjoy.</p>
      </div>
    </details>
  )
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : ''
  const error = typeof params.error === 'string' ? params.error : ''
  const checkoutSessionId = typeof params.session_id === 'string' ? params.session_id : ''

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  const email = user?.email ?? null
  const ownerQa = isOwnerQaEmail(email)
  let paymentNotice = ''
  let paymentError = ''

  if (user && checkoutSessionId) {
    try {
      const finalized = await finalizeCheckoutSessionById(checkoutSessionId, user.id)
      paymentNotice = finalized.credited
        ? `${finalized.pack.name} was added to your usage balance.`
        : 'Stripe has not marked that checkout paid yet. Your balance will update automatically when payment clears.'
    } catch (caught) {
      paymentError = caught instanceof Error ? caught.message : 'RPG Your Way could not verify that Stripe checkout yet.'
    }
  }

  let wallet: Record<string, unknown> | null = null
  let ledger: Record<string, unknown>[] = []
  let walletUnavailable = false

  if (user) {
    await supabase.rpc('rpgyw_release_expired_usage')
    const walletResult = await supabase
      .from('usage_wallets')
      .select('balance_microusd,reserved_microusd,updated_at')
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
        .limit(10)
      ledger = (ledgerResult.data ?? []) as Record<string, unknown>[]
    }
  }

  const balance = usageMicrousd(wallet?.balance_microusd)
  const reserved = usageMicrousd(wallet?.reserved_microusd)
  const available = Math.max(0, balance - reserved)
  const lowBalance = !ownerQa && !walletUnavailable && available > 0 && available <= 1_000_000

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main account-main">
        <div className="shell account-shell">
          <section className="account-intro" aria-labelledby="account-page-title">
            <p className="kicker">Account</p>
            <h1 id="account-page-title" className="page-title">Your account.</h1>
            <p className="page-lede">Sign in, see your RPG Your Way balance, and add usage for Play or Script.</p>

            {statusMessages[status] ? <p className="auth-message auth-message-success" role="status">{statusMessages[status]}</p> : null}
            {paymentNotice ? <p className="auth-message auth-message-success" role="status">{paymentNotice}</p> : null}
            {paymentError ? <p className="auth-message auth-message-error" role="alert">{paymentError}</p> : null}
          </section>

          <details id="sign-in" className="account-access-details" open={!user}>
            <summary>
              <span>{user ? `Signed in as ${email ?? 'RPG Your Way user'}` : 'Sign in or create an account'}</span>
              <span className="account-details-caret" aria-hidden="true">+</span>
            </summary>
            <div className="account-access-body">
              {user ? (
                <section className="account-signed-in" aria-labelledby="account-connected-heading">
                  <div>
                    <p className="account-state-label">Connected account</p>
                    <h2 id="account-connected-heading">You&apos;re signed in.</h2>
                    <p className="account-email">{email ?? 'Authenticated RPG Your Way user'}</p>
                    <p className="account-foundation-note">Your account keeps purchases and usage together. Play campaigns stay in this browser unless you export them.</p>
                  </div>
                  <form action={signOut}>
                    <button className="button button-secondary" type="submit">Sign out</button>
                  </form>
                </section>
              ) : <AuthPanel returnTo="/account" status={status} error={error} />}
            </div>
          </details>

          {user ? (
            <>
              <section id="usage-balance" className="usage-balance-card" aria-labelledby="usage-balance-heading">
                <div className="usage-balance-heading-row">
                  <div>
                    <p className="account-state-label">{ownerQa ? 'Owner QA account' : 'Usage balance'}</p>
                    <h2 id="usage-balance-heading">{ownerQa ? 'Provider usage tracked; wallet not deducted' : 'Available for Play and Script'}</h2>
                  </div>
                  {!ownerQa && !walletUnavailable ? <p className="usage-balance-amount" aria-label={`${formatUsageDollars(available)} available`}>{formatUsageDollars(available)}</p> : null}
                </div>

                {ownerQa ? (
                  <p className="usage-balance-copy">This account is the RPG Your Way owner QA account. Play and Script provider usage is still measured for internal cost tracking, but customer balance deductions are skipped. No Play Pack purchase is required.</p>
                ) : walletUnavailable ? (
                  <p className="auth-message auth-message-error">The usage balance is not available yet. Apply the shared-balance database migration, then reload this page.</p>
                ) : (
                  <>
                    <p className="usage-balance-copy">Your balance stays in your account until you use it. Successful AI processing deducts its actual metered cost.</p>
                    {reserved > 0 ? <p className="usage-balance-reserved"><strong>{formatUsageDollars(reserved)}</strong> is temporarily reserved for work already in progress. Total balance: {formatUsageDollars(balance)}.</p> : null}
                    {lowBalance ? <p className="usage-low-balance" role="status"><strong>Low balance:</strong> {formatUsageDollars(available)} remaining. Add usage before your next larger request.</p> : null}
                  </>
                )}
              </section>

              {!ownerQa ? <section id="add-usage" className="play-pack-section" aria-labelledby="add-usage-heading">
                <div className="play-pack-heading">
                  <div>
                    <p className="account-state-label">Add usage</p>
                    <h2 id="add-usage-heading">Choose a Play Pack</h2>
                  </div>
                  <p>Every pack uses the same AI and features. Larger packs simply put more usable balance in your account.</p>
                </div>

                <div className="play-pack-grid">
                  {PLAY_PACKS.map((pack) => (
                    <article className="play-pack-card" key={pack.id}>
                      <div>
                        <h3>{pack.name}</h3>
                        <p className="play-pack-price">{formatPurchasePrice(pack.priceCents)}</p>
                        <p>{pack.shortDescription}</p>
                        <p className="play-pack-allowance"><span>Usage added</span><strong>{formatUsageValue(pack.usageCents)}</strong></p>
                      </div>
                      <form action={beginPlayPackCheckout}>
                        <input type="hidden" name="pack" value={pack.id} />
                        <button className="button button-primary" type="submit">Buy {pack.name}</button>
                      </form>
                    </article>
                  ))}
                </div>

                <div className="usage-disclosure-row">
                  <div className="usage-disclosure-copy">
                    <p><strong>Purchase price includes payment processing and site operating costs.*</strong></p>
                    <p><strong>*</strong> Prices assume Stripe&apos;s standard U.S. domestic-card processing rate of 2.9% + 30¢. Site operating amounts are $0.50, $1.05, $2.10, $3.15, $4.55, and $6.30 by pack.</p>
                    <p>If actual payment-processing costs are lower than the amount included, the difference is credited to your RPG Your Way balance.</p>
                  </div>
                  <UsageNote />
                </div>
              </section> : null}

              {!walletUnavailable ? (
                <section className="usage-activity" aria-labelledby="usage-activity-heading">
                  <div className="usage-activity-heading">
                    <div>
                      <p className="account-state-label">Balance history</p>
                      <h2 id="usage-activity-heading">Recent activity</h2>
                    </div>
                    <p>Purchases and successful Play or Script usage appear here.</p>
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
                  ) : <p className="usage-activity-empty">No balance activity yet. Your first Play Pack purchase will start this history.</p>}
                </section>
              ) : null}
              <DeleteAccountControl />
            </>
          ) : null}
        </div>
      </main>
    </PageShell>
  )
}
