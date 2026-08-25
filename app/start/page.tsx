import Link from 'next/link'
import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'New Player' }

export default function StartPage() {
  return (
    <PageShell variant="play">
      <main id="main-content" tabIndex={-1} className="inner-main start-main">
        <div className="shell narrow-shell">
          <p className="kicker">New Player</p>
          <h1 className="page-title">Start your adventure.</h1>
          <p className="page-lede">This is the permanent front door to RPG Your Way onboarding. Guided character and campaign setup will be built into this page next.</p>

          <section className="start-placeholder" aria-labelledby="start-onboarding-heading">
            <span className="placeholder-number" aria-hidden="true">01</span>
            <div>
              <h2 id="start-onboarding-heading">Onboarding</h2>
              <p>Character setup, campaign choices, imports, and launch controls will appear here as the Play migration comes online.</p>
            </div>
          </section>

          <p className="microcopy">Already have a campaign waiting? <Link href="/play">Go to Play.</Link></p>
        </div>
      </main>
    </PageShell>
  )
}
