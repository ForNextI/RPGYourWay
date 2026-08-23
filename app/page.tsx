import Image from 'next/image'
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

const audiences = [
  {
    title: 'Solo players',
    copy: "Or people who can't get a group together right now. Run a party of up to six characters instead of waiting for everyone's schedules to line up.",
  },
  {
    title: 'Neurodivergent players',
    copy: 'Who may be uncomfortable playing with strangers or putting the game in the hands of an unfamiliar DM. Play in a lower-pressure setting, at your own pace.',
  },
  {
    title: 'Forever DMs',
    copy: 'Who are usually the person running the game. Sit on the player side of the table for a change, without having to try to find somebody competent to DM.',
  },
  {
    title: 'Blind players and screen-reader users',
    copy: 'Use screen-reader support and voice-guided play, including spoken AIGM replies and important visual information communicated in words.',
  },
  {
    title: 'Players with irregular or limited schedules',
    copy: "Start a session when you have time and stop when you need to, without coordinating a full group's calendar. Or play at four in the morning.",
  },
  {
    title: 'Beginners and returning players',
    copy: 'Learn or relearn the game gradually and at your own pace, without worrying about being judged or made fun of.',
  },
]

export default function HomePage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1}>
        <section className="hero">
          <div className="shell hero-grid">
            <div className="hero-copy hero-thesis">
              <h1><span className="hero-thesis-line">Tabletop gaming is best in person.</span><span className="hero-no-question">No question.</span></h1>
              <p className="hero-sometimes">But sometimes...</p>

              <details className="audience-accordion hero-audience">
                <summary className="audience-summary">
                  <span className="audience-prompt">Who RPG Your Way is for</span>
                  <span className="accordion-plus" aria-hidden="true">+</span>
                </summary>

                <div className="audience-body">
                  <div className="audience-list">
                    {audiences.map((audience, index) => (
                      <details className="audience-item" key={audience.title}>
                        <summary>
                          <span>{audience.title}</span>
                          <span className="accordion-plus" aria-hidden="true">+</span>
                        </summary>
                        <p>{audience.copy}</p>
                        {index === 1 ? (
                          <p className="builder-note"><em>I belong to both of those groups. They&apos;re part of why I built this site.</em></p>
                        ) : null}
                      </details>
                    ))}
                  </div>
                </div>
              </details>
            </div>

            <div className="hero-side">
              <div className="brand-logo-card">
                <Image
                  className="brand-logo-image"
                  src="/rpgyw-logo.png"
                  alt="RPG Your Way compass logo"
                  width={1254}
                  height={1254}
                  priority
                />
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
