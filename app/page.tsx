import Image from 'next/image'
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
    copy: 'Use screen-reader support and voice-guided play, including spoken game-master replies and important visual information communicated in words.',
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

function AccordionPlus() {
  return <span className="accordion-plus" aria-hidden="true" />
}

function UniqueAccordion() {
  return (
    <details className="landing-accordion unique-accordion">
      <summary className="landing-accordion-summary">
        <span className="landing-accordion-prompt">What makes RPG Your Way unique?</span>
        <AccordionPlus />
      </summary>
      <div className="landing-accordion-body unique-body">
        <p>We&apos;ll fill this comparison out as the rest of RPG Your Way moves in.</p>
      </div>
    </details>
  )
}

function AudienceAccordion() {
  return (
    <details className="landing-accordion audience-accordion">
      <summary className="landing-accordion-summary audience-summary">
        <span className="landing-accordion-prompt audience-prompt">Who RPG Your Way is for</span>
        <AccordionPlus />
      </summary>

      <div className="landing-accordion-body audience-body">
        <div className="audience-list">
          {audiences.map((audience, index) => (
            <details className="audience-item" key={audience.title}>
              <summary>
                <span>{audience.title}</span>
                <AccordionPlus />
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
  )
}

export default function HomePage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1}>
        <section className="hero">
          <div className="shell hero-grid">
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

            <div className="hero-brand-stack">
              <div className="brand-logo-card">
                <Image
                  className="brand-logo-image"
                  src="/rpgyw-logo-bordered.png"
                  alt="RPG Your Way compass logo"
                  width={1254}
                  height={1254}
                  priority
                />
              </div>

              <div className="hero-thesis">
                <h1>
                  <span className="hero-thesis-line">Tabletop gaming is best in person.</span>
                  <span className="hero-no-question">No question.</span>
                </h1>
                <p className="hero-sometimes">But sometimes...</p>
              </div>
            </div>

            <div className="hero-unique" aria-label="What makes RPG Your Way unique">
              <UniqueAccordion />
            </div>

            <div className="hero-audience" aria-label="Who RPG Your Way is for">
              <AudienceAccordion />
            </div>
          </div>
        </section>

        <section className="feature-section" aria-label="RPG Your Way features">
          <div className="shell feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <p className="feature-eyebrow">{feature.eyebrow}</p>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </PageShell>
  )
}
