import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { PLAY_PACKS, formatPurchasePrice, formatUsageValue } from '@/lib/billing/play-packs'
import { beginPlayPackCheckout } from '@/app/pricing/actions'
import { createClient } from '@/lib/supabase/server'
import { formatUsageDollars, usageMicrousd } from '@/lib/usage/money'
import { finalizeCheckoutSessionById } from '@/lib/stripe/server'
import { signOut } from './actions'
import { isOwnerQaEmail } from '@/lib/usage/owner-qa'
import { DeleteAccountControl } from '@/components/account/DeleteAccountControl'
import { PurchaseTracking } from '@/components/analytics/PurchaseTracking'

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

function UsageNote() {
  const estimates = [
    ['Starter Play', '$5', 'about 20–30 turns'],
    ['Occasional Play', '$15', 'about 60–90 turns'],
    ['Regular Play', '$30', 'about 120–180 turns'],
    ['Frequent Play', '$45', 'about 180–270 turns'],
    ['Extended Play', '$65', 'about 260–390 turns'],
    ['Marathon Play', '$90', 'about 360–540 turns'],
  ] as const

  return (
    <details className="usage-note-details">
      <summary>What am I getting for my money?</summary>
      <div className="usage-note-copy">
        <p><strong>RPG Your Way sells prepaid usage, not turns.</strong> The ranges below are deliberately broad planning estimates based on real gameplay testing.</p>
        <div className="usage-estimate-table" role="table" aria-label="Estimated gameplay by Play Pack">
          <div className="sr-only" role="row"><span role="columnheader">Play Pack</span><span role="columnheader">Usage value</span><span role="columnheader">Estimated turns</span></div>
          {estimates.map(([name, usage, turns]) => (
            <div className="usage-estimate-row" role="row" key={name}>
              <strong role="cell">{name}</strong>
              <span role="cell">{usage} usage</span>
              <span role="cell">{turns}</span>
            </div>
          ))}
        </div>
        <p>These are estimates, not guaranteed minimums or maximums. A mature, complex campaign with frequent talk-to-text and readback can use balance faster. A simpler campaign or lighter voice use may stretch it farther.</p>
        <p>Gameplay AI, talk-to-text, AI readback, Script, Detailed Help, and custom-character AI processing all draw from the same prepaid balance. You can always see your remaining balance and your aggregate usage totals below.</p>
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
  let purchaseTracking: { transactionId: string; value: number; itemId: string; itemName: string } | null = null

  if (user && checkoutSessionId) {
    try {
      const finalized = await finalizeCheckoutSessionById(checkoutSessionId, user.id)
      paymentNotice = finalized.credited
        ? `${finalized.pack.name} was added to your usage balance.`
        : 'Stripe has not marked that checkout paid yet. Your balance will update automatically when payment clears.'
      if (finalized.credited) {
        purchaseTracking = {
          transactionId: checkoutSessionId,
          value: finalized.pack.priceCents / 100,
          itemId: finalized.pack.id,
          itemName: finalized.pack.name,
        }
      }
    } catch (caught) {
      paymentError = caught instanceof Error ? caught.message : 'RPG Your Way could not verify that Stripe checkout yet.'
    }
  }

  let wallet: Record<string, unknown> | null = null
  let usageSummary: Record<string, unknown> | null = null
  let purchases: Record<string, unknown>[] = []
  let walletUnavailable = false
  let summaryUnavailable = false

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
      const [summaryResult, purchaseResult] = await Promise.all([
        supabase.rpc('rpgyw_usage_summary'),
        supabase.rpc('rpgyw_purchase_history', { p_limit: 50 }),
      ])
      if (summaryResult.error) summaryUnavailable = true
      else usageSummary = (Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data) as Record<string, unknown> | null
      purchases = purchaseResult.error ? [] : (purchaseResult.data ?? []) as Record<string, unknown>[]
    }
  }

  const balance = usageMicrousd(wallet?.balance_microusd)
  const reserved = usageMicrousd(wallet?.reserved_microusd)
  const available = Math.max(0, balance - reserved)
  const lowBalance = !ownerQa && !walletUnavailable && available <= 1_000_000
  const aiUsage = usageMicrousd(usageSummary?.ai_processing_microusd)
  const talkToTextUsage = usageMicrousd(usageSummary?.talk_to_text_microusd)
  const readbackUsage = usageMicrousd(usageSummary?.readback_microusd)
  const totalUsage = usageMicrousd(usageSummary?.total_microusd)

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main account-main">
        <div className="shell account-shell">
          <h1 className="sr-only">Account</h1>
          {purchaseTracking ? (
            <PurchaseTracking
              transactionId={purchaseTracking.transactionId}
              value={purchaseTracking.value}
              email={email}
              itemId={purchaseTracking.itemId}
              itemName={purchaseTracking.itemName}
            />
          ) : null}
          {statusMessages[status] ? <p className="auth-message auth-message-success" role="status">{statusMessages[status]}</p> : null}
          {paymentNotice ? <p className="auth-message auth-message-success" role="status">{paymentNotice}</p> : null}
          {paymentError ? <p className="auth-message auth-message-error" role="alert">{paymentError}</p> : null}

          <details id="sign-in" className={`account-access-details${user ? ' account-access-details--signed-in' : ''}`} open={!user}>
            <summary>
              <span>{user ? `Signed in as ${email ?? 'RPG Your Way user'}` : 'Sign in or create an account'}</span>
              <span className="accordion-plus account-details-caret" aria-hidden="true" />
            </summary>
            <div className="account-access-body">
              {user ? (
                <section className="account-signed-in" aria-labelledby="account-connected-heading">
                  <div>
                    <p className="account-state-label">Connected account</p>
                    <h2 id="account-connected-heading">You&apos;re signed in.</h2>
                    <p className="account-email">{email ?? 'Authenticated RPG Your Way user'}</p>
                    <p className="account-foundation-note">Your account keeps purchases, usage, and cloud campaigns together. Signed-in campaigns can continue on another signed-in device; this browser also keeps a local cache.</p>
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
                    <h2 id="usage-balance-heading">{ownerQa ? 'Provider usage tracked; wallet not deducted' : 'Available across RPG Your Way'}</h2>
                  </div>
                  {!ownerQa && !walletUnavailable ? <p className="usage-balance-amount" aria-label={`${formatUsageDollars(available)} available`}>{formatUsageDollars(available)}</p> : null}
                </div>

                {ownerQa ? (
                  <p className="usage-balance-copy">This account is the RPG Your Way owner QA account. RPG Your Way provider usage is still measured for internal cost tracking, but customer balance deductions are skipped. No Play Pack purchase is required.</p>
                ) : walletUnavailable ? (
                  <p className="auth-message auth-message-error" role="alert">The usage balance is not available yet. Apply the shared-balance database migration, then reload this page.</p>
                ) : (
                  <>
                    <p className="usage-balance-copy">Your balance stays in your account until you use it. Gameplay AI, talk-to-text, AI readback, Script, Detailed Help, and custom-character AI processing all use this same balance.</p>
                    {reserved > 0 ? <p className="usage-balance-reserved"><strong>{formatUsageDollars(reserved)}</strong> is temporarily reserved for work already in progress. Total balance: {formatUsageDollars(balance)}.</p> : null}
                    {lowBalance ? <p className="usage-low-balance" role="status"><strong>Low balance:</strong> {formatUsageDollars(available)} remaining. Add usage before your next larger request.</p> : null}
                  </>
                )}
              </section>

              {!ownerQa ? <section id="add-usage" className="play-pack-section play-pack-section--catalog" aria-labelledby="add-usage-heading">
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
                    <p><strong>Purchase price includes payment processing and a small site operating contribution.*</strong></p>
                    <p><strong>*</strong> Each pack contributes 5% of its usage value toward keeping RPG Your Way online: $0.25, $0.75, $1.50, $2.25, $3.25, and $4.50. Prices also retain the existing Stripe assumption of 2.9% + 30¢.</p>
                    <p>If actual payment-processing costs are lower than the amount included, the difference is credited to your RPG Your Way balance.</p>
                  </div>
                  <UsageNote />
                </div>
              </section> : null}

              {!ownerQa && !walletUnavailable ? (
                <section className="usage-activity" aria-labelledby="usage-summary-heading">
                  <div className="usage-activity-heading">
                    <div>
                      <p className="account-state-label">Usage to date</p>
                      <h2 id="usage-summary-heading">Where your balance has gone</h2>
                    </div>
                    <p>Account totals only. RPG Your Way does not show a turn-by-turn charge list.</p>
                  </div>
                  {summaryUnavailable ? <p className="usage-activity-empty">Usage totals are temporarily unavailable.</p> : (
                    <div className="usage-summary-grid">
                      <div className="usage-summary-item"><span>AI processing</span><strong>{formatUsageDollars(aiUsage)}</strong></div>
                      <div className="usage-summary-item"><span>Talk-to-text</span><strong>{formatUsageDollars(talkToTextUsage)}</strong></div>
                      <div className="usage-summary-item"><span>AI readback</span><strong>{formatUsageDollars(readbackUsage)}</strong></div>
                      <div className="usage-summary-item usage-summary-item--total"><span>Total metered usage</span><strong>{formatUsageDollars(totalUsage)}</strong></div>
                    </div>
                  )}
                </section>
              ) : null}

              {!ownerQa && !walletUnavailable ? (
                <section className="usage-activity usage-activity--purchase-history" aria-labelledby="purchase-history-heading">
                  <div className="usage-activity-heading">
                    <div>
                      <p className="account-state-label">Play Pack purchases</p>
                      <h2 id="purchase-history-heading">Purchase history</h2>
                    </div>
                    <p>Your purchases are kept here without a per-turn receipt.</p>
                  </div>
                  {purchases.length ? (
                    <div className="usage-activity-list">
                      {purchases.map((purchase) => {
                        const date = typeof purchase.created_at === 'string' ? new Date(purchase.created_at) : null
                        const priceCents = Number(purchase.purchase_price_cents || 0)
                        const usageCents = Number(purchase.usage_value_cents || 0)
                        return (
                          <div className="usage-activity-row" key={String(purchase.id)}>
                            <div>
                              <strong>{typeof purchase.pack_name === 'string' ? purchase.pack_name : 'Play Pack'}</strong>
                              <span>{date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                            </div>
                            <div className="usage-activity-amount">
                              <strong>${(Math.max(0, priceCents) / 100).toFixed(2)} paid</strong>
                              <span>${(Math.max(0, usageCents) / 100).toFixed(2)} usage added</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : <p className="usage-activity-empty">No Play Pack purchases yet.</p>}
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
