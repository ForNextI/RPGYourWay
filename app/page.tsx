import Link from 'next/link'
import { PageShell } from '@/components/PageShell'

const features = [
  {
    eyebrow: 'Your campaign',
    title: 'Play when you have time',
    copy: 'Run an ongoing tabletop campaign without waiting for a whole group to be free at the same moment.',
  },
  {
    eyebrow: 'Your party',
    title: 'Bring the characters you want',
    copy: 'Play one character or manage a full party. The commercial build will inherit the campaign tools already proven in WardensPC.',
  },
  {
    eyebrow: 'Your pace',
    title: 'Type, speak, read, or listen',
    copy: 'The interface is being built mobile-first, with text as the primary path and voice features available when they help.',
  },
]

export default function HomePage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1}>
        <section className="hero">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <p className="kicker">Paid beta in development</p>
              <h1>Tabletop roleplaying.<br /><span>Your way.</span></h1>
              <p className="hero-lede">
                An AI Game Master for people who want a campaign they can return to on their own schedule.
                Simple to start, built to keep going.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/play">See the play area</Link>
                <Link className="button button-secondary" href="/pricing">How access will work</Link>
              </div>
              <p className="microcopy">Pricing is not final yet. The payment and usage system will be built before prices are locked.</p>
            </div>

            <div className="preview-card" aria-label="Preview of the future player dashboard">
              <div className="preview-topline">
                <span className="status-dot" aria-hidden="true" />
                <span>Campaign dashboard</span>
                <span className="preview-badge">Preview</span>
              </div>
              <div className="campaign-card">
                <p className="campaign-label">Continue campaign</p>
                <h2>Your adventure</h2>
                <p>Last played recently</p>
                <div className="fake-button">Continue playing</div>
              </div>
              <div className="preview-row">
                <div><strong>Usage</strong><span>Prepaid access</span></div>
                <div><strong>Voice</strong><span>Available</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="what-it-is">
          <div className="shell">
            <div className="section-heading">
              <p className="kicker">The product</p>
              <h2 id="what-it-is">Less site. More game.</h2>
              <p>RPG Your Way is being separated from WardensPC so the commercial experience can be focused, faster, and much easier to use on a phone.</p>
            </div>
            <div className="feature-grid">
              {features.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <p className="feature-eyebrow">{feature.eyebrow}</p>
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-tight" aria-labelledby="beta-heading">
          <div className="shell callout">
            <div>
              <p className="kicker">Building now</p>
              <h2 id="beta-heading">The foundation comes first.</h2>
              <p>Accounts, prepaid usage, campaign storage, payments, and the AIGM will be connected here next. No decorative maze required.</p>
            </div>
            <Link className="text-link" href="/pricing">View the access model →</Link>
          </div>
        </section>
      </main>
    </PageShell>
  )
}
