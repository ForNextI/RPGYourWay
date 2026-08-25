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

const whyCreated = [
  {
    title: 'RPGs are better at full throttle',
    paragraphs: [
      'Every game runs on the same high-capability AI.',
      'Choose how much you want to play, and get the same quality of play every time.',
    ],
  },
  {
    title: 'Buy play and use it when you want',
    paragraphs: [
      'Your purchased usage stays yours until you use it.',
      "Play tonight, next week, or months from now. Your balance is there when you're ready to continue.",
    ],
  },
  {
    title: 'Run at cost',
    paragraphs: [
      'RPG Your Way is designed to cover the cost of providing your play, and nothing more.',
      'Your usage pays for the technology that powers the experience: the AI, speech-to-text, voice responses, and the other services used while you play.',
      "The price is there to keep the game running. That's all you're paying for.",
    ],
  },
  {
    title: 'Campaigns should last',
    paragraphs: [
      'RPG Your Way is built for persistent campaigns that can grow with your characters over the long haul.',
      'Start at the beginning. Build relationships, history, and consequences. Keep the same campaign going all the way to level 20.',
    ],
  },
  {
    title: 'Turn the campaign into a story',
    paragraphs: [
      'Script transforms the campaign you actually played into narrative prose.',
      'Large campaigns can be divided into manageable sections, and before you begin a Script request, you receive a maximum estimated cost.',
      'That estimate is the most you will pay.',
    ],
  },
  {
    title: 'Your characters. Your campaign. Your pace.',
    paragraphs: [
      "Play when you want. Keep going as long as you want. Come back when you're ready.",
    ],
  },
]

const audiences = [
  {
    title: 'Solo players',
    paragraphs: [
      "Or people who can't get a group together right now. Run a party of up to six characters instead of waiting for everyone's schedules to line up.",
    ],
  },
  {
    title: 'Neurodivergent players',
    paragraphs: [
      'Who may prefer familiar, lower-pressure play without strangers or an unfamiliar DM. Play at your own pace and take the time you need.',
    ],
    note: "I'm in both of those groups. They're part of why I created RPG Your Way.",
  },
  {
    title: 'Forever DMs',
    paragraphs: [
      'Usually the one running the game? Sit on the player side of the table for a change, without needing to recruit another DM.',
    ],
  },
  {
    title: 'Blind players and screen-reader users',
    paragraphs: [
      'Use screen-reader support, voice input, and spoken game-master replies, with important visual information communicated in words.',
    ],
  },
  {
    title: 'Players with irregular or limited schedules',
    paragraphs: [
      "Start a session when you have time and stop when you need to, without coordinating a full group's calendar.",
      'Or play at four in the morning.',
    ],
  },
  {
    title: 'Beginners and returning players',
    paragraphs: [
      'Learn or relearn the game gradually and at your own pace, with room to experiment, ask basic questions, and get comfortable with the game.',
    ],
  },
]

function AccordionPlus() {
  return <span className="accordion-plus" aria-hidden="true" />
}

type AccordionItem = {
  title: string
  paragraphs: string[]
  note?: string
}

function NestedAccordionList({ items }: { items: AccordionItem[] }) {
  return (
    <div className="audience-list">
      {items.map((item) => (
        <details className="audience-item" key={item.title}>
          <summary>
            <span>{item.title}</span>
            <AccordionPlus />
          </summary>
          <div className="nested-accordion-copy">
            {item.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {item.note ? <p className="builder-note"><em>{item.note}</em></p> : null}
          </div>
        </details>
      ))}
    </div>
  )
}

function WhyCreatedAccordion() {
  return (
    <details className="landing-accordion unique-accordion">
      <summary className="landing-accordion-summary">
        <span className="landing-accordion-prompt">Why I Created RPG Your Way</span>
        <AccordionPlus />
      </summary>
      <div className="landing-accordion-body unique-body">
        <NestedAccordionList items={whyCreated} />
      </div>
    </details>
  )
}

function AudienceAccordion() {
  return (
    <details className="landing-accordion audience-accordion">
      <summary className="landing-accordion-summary audience-summary">
        <span className="landing-accordion-prompt audience-prompt">The Players I Built RPG Your Way For</span>
        <AccordionPlus />
      </summary>
      <div className="landing-accordion-body audience-body">
        <NestedAccordionList items={audiences} />
      </div>
    </details>
  )
}

export default function HomePage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1}>
        <section className="welcome-banner-section" aria-labelledby="welcome-rpgyw">
          <div className="shell">
            <div className="welcome-banner">
              <p className="welcome-kicker">The doors are open</p>
              <h1 id="welcome-rpgyw">WELCOME TO RPG YOUR WAY</h1>
              <p className="welcome-lede">
                RPG Your Way is being built in public. Accounts are open now, so feel free to look around while we bring the game online.
              </p>
              <p className="welcome-lede welcome-lede-secondary">
                Script is available now. Play and native multiplayer are coming online as soon as possible.
              </p>

              <details className="welcome-details">
                <summary>What is coming, and when?</summary>
                <div className="welcome-details-copy">
                  <p>
                    <strong>Script</strong> is available now and turns campaign transcripts into narrative prose, with large campaigns divided into manageable sections and a maximum estimated cost shown before a request begins.
                  </p>
                  <p>
                    <strong>Play</strong> will bring the RPG Your Way AI Game Master online for persistent campaigns you can return to over the long haul.
                  </p>
                  <p>
                    <strong>Native multiplayer</strong> will follow so friends can share those campaigns together online.
                  </p>
                  <p>
                    Those three pieces are the immediate priority and are being brought online as quickly as we can do it safely. You may see pages, wording, and controls change while that work is happening.
                  </p>
                  <p>
                    After the core RPG Your Way experience is running, we plan to add <strong>Foundry VTT integration</strong> as the first step toward connecting RPG Your Way with existing virtual tabletops.
                  </p>
                  <p>
                    If you already have a campaign at WardensPC, you will be able to export it there and bring it with you when RPG Your Way Play is ready.
                  </p>
                  <p>
                    We will keep this notice updated as each part comes online.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </section>

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
                <div className="campaign-actions">
                  <Link className="fake-button" href="/start">New Player</Link>
                  <Link className="fake-button fake-button-secondary" href="/play">Continue playing</Link>
                </div>
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

            <div className="hero-unique" aria-label="Why I Created RPG Your Way">
              <WhyCreatedAccordion />
            </div>

            <div className="hero-audience" aria-label="The Players I Built RPG Your Way For">
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
