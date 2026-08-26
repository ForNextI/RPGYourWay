import Image from 'next/image'
import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { LandingCampaignPanel } from '@/components/LandingCampaignPanel'

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
        <span className="landing-accordion-prompt">Why I created RPG Your Way.</span>
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
        <span className="landing-accordion-prompt audience-prompt">Who benefits from this site?</span>
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
        <section className="landing-notice-section landing-ai-warning" aria-labelledby="ai-warning-heading">
          <div className="shell">
            <div className="landing-notice-card">
              <h1 id="ai-warning-heading">~~ Warning: AI GM ahead ~~</h1>
              <p>RPG Your Way uses AI to run long-term, persistent adventures.</p>
              <p>Everyone gets to play. If that’s a deal breaker, this site is probably not for you.</p>
            </div>
          </div>
        </section>

        <section className="landing-notice-section landing-open-now" aria-labelledby="open-now-heading">
          <div className="shell">
            <div className="landing-notice-card">
              <h2 id="open-now-heading">Open Now</h2>
              <p><strong>Play</strong> is open for players bringing existing games over from WardensPC by export. <strong>Script</strong> is open.</p>
              <p><strong>Still to come:</strong> onboarding for new players and native multiplayer. VTT integration will follow later.</p>
            </div>
          </div>
        </section>

        <section className="landing-thesis-strip" aria-label="RPG Your Way premise">
          <div className="shell">
            <p>Tabletop gaming is best in person. No question. <strong><em>But sometimes...</em></strong></p>
          </div>
        </section>

        <section className="landing-reasons-section" aria-label="Why RPG Your Way exists and who it benefits">
          <div className="shell landing-reasons-grid">
            <div className="hero-unique" aria-label="Why I created RPG Your Way">
              <WhyCreatedAccordion />
            </div>
            <div className="hero-audience" aria-label="Who benefits from this site?">
              <AudienceAccordion />
            </div>
          </div>
        </section>

        <section className="landing-return-section" aria-label="Start or return to a campaign">
          <div className="shell landing-return-grid">
            <div className="landing-player-stack">
              <Link className="landing-new-player button button-secondary" href="/start">Start New Campaign</Link>
              <LandingCampaignPanel />
            </div>

            <div className="brand-logo-card landing-return-logo">
              <Image
                className="brand-logo-image"
                src="/rpgyw-logo-bordered.png"
                alt="RPG Your Way compass logo"
                width={1254}
                height={1254}
                priority
              />
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
