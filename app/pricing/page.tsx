import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Pricing' }

export default function PricingPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell">
          <p className="kicker">Access</p>
          <h1 className="page-title">One balance. Play or Shape.</h1>
          <p className="page-lede">RPG Your Way uses bounded prepaid usage. Buy a Play Pack, then use the resulting balance for AI-powered Play, Shape, or a mixture of both.</p>
          <section className="pricing-card" aria-labelledby="pricing-model-heading">
            <h2 id="pricing-model-heading">The model we are building around</h2>
            <div className="pricing-points">
              <p><strong>Prepaid.</strong><span>Purchase usage before you use paid AI features.</span></p>
              <p><strong>Shared.</strong><span>Play and Shape draw from the same RPG Your Way usage balance.</span></p>
              <p><strong>Bounded.</strong><span>When your available balance is gone, new paid AI work stops until you choose to add more.</span></p>
              <p><strong>Transparent.</strong><span>Your remaining balance and recent usage stay visible on your account.</span></p>
            </div>
          </section>
          <p className="note-box">Stripe checkout is not connected in this build. The shared balance and ledger are being put in place first, so purchases and AI deductions have one durable home when payments come online.</p>
        </div>
      </main>
    </PageShell>
  )
}
