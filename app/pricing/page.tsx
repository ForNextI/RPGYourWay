import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { PLAY_PACKS, formatPurchasePrice } from '@/lib/billing/play-packs'
import { formatUsageDollars } from '@/lib/usage/money'
import { createClient } from '@/lib/supabase/server'
import { beginPlayPackCheckout } from './actions'

export const metadata = { title: 'Pricing' }
export const dynamic = 'force-dynamic'

type PricingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const params = await searchParams
  const status = typeof params.status === 'string' ? params.status : ''
  const error = typeof params.error === 'string' ? params.error : ''
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell">
          <p className="kicker">Access</p>
          <h1 className="page-title">One balance. Play or Script.</h1>
          <p className="page-lede">Buy a Play Pack once, then use the resulting prepaid balance for AI-powered Play, Script, or a mixture of both. There is no subscription and no automatic refill.</p>

          {status === 'checkout-cancelled' ? <p className="auth-message auth-message-success" role="status">Checkout was cancelled. Nothing was charged.</p> : null}
          {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}

          <section className="play-pack-section" aria-labelledby="play-packs-heading">
            <div className="play-pack-heading">
              <div>
                <p className="account-state-label">Prepaid usage</p>
                <h2 id="play-packs-heading">Choose a Play Pack</h2>
              </div>
              <p>Every pack uses the same AI and the same features. Larger packs simply contain more usage.</p>
            </div>

            <div className="play-pack-grid">
              {PLAY_PACKS.map((pack) => (
                <article className="play-pack-card" key={pack.id}>
                  <div>
                    <h3>{pack.name}</h3>
                    <p className="play-pack-price">{formatPurchasePrice(pack.priceCents)}</p>
                    <p>{pack.shortDescription}</p>
                  </div>
                  <div className="play-pack-allowance">
                    <span>Metered AI usage included</span>
                    <strong>{formatUsageDollars(pack.allowanceMicrousd)}</strong>
                  </div>
                  {user ? (
                    <form action={beginPlayPackCheckout}>
                      <input type="hidden" name="pack" value={pack.id} />
                      <button className="button button-primary" type="submit">Buy {pack.name}</button>
                    </form>
                  ) : (
                    <Link className="button button-primary" href="/account">Sign in to buy</Link>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="pricing-card" aria-labelledby="pricing-model-heading">
            <h2 id="pricing-model-heading">How the shared balance works</h2>
            <div className="pricing-points">
              <p><strong>Prepaid.</strong><span>Purchase usage before you use paid AI features.</span></p>
              <p><strong>Shared.</strong><span>Play and Script draw from the same RPG Your Way usage balance.</span></p>
              <p><strong>Bounded.</strong><span>When your available balance is gone, new paid AI work stops until you choose to add more.</span></p>
              <p><strong>Transparent.</strong><span>Your remaining balance and recent purchases stay visible on your account.</span></p>
            </div>
          </section>

          <p className="note-box">Stripe Checkout now funds the shared balance. Script is still in private testing in this build, so purchasing a Play Pack does not yet unlock paid Script processing. Automatic Script deductions are the next wiring step.</p>
        </div>
      </main>
    </PageShell>
  )
}
