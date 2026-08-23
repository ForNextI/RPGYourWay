import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Pricing' }

export default function PricingPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell">
          <p className="kicker">Access</p>
          <h1 className="page-title">Pay for what you use.</h1>
          <p className="page-lede">The exact prices are still being measured. The intended model is bounded prepaid usage, not an unlimited subscription that quietly turns into an API bonfire.</p>
          <section className="pricing-card" aria-labelledby="pricing-model-heading">
            <h2 id="pricing-model-heading">The model we are building around</h2>
            <div className="pricing-points">
              <p><strong>Prepaid.</strong><span>Buy a defined amount of gameplay before using it.</span></p>
              <p><strong>Bounded.</strong><span>When the purchased usage is gone, new paid generation stops until more is purchased.</span></p>
              <p><strong>Transparent.</strong><span>Your remaining balance should be visible without hunting through an account maze.</span></p>
            </div>
          </section>
          <p className="note-box">No dollar amounts are published in this build. We can wire the payment system first and set the actual products after the cost study is finished.</p>
        </div>
      </main>
    </PageShell>
  )
}
