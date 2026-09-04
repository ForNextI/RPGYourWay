import Image from 'next/image'
import Link from 'next/link'
import { Megaphone } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { LandingCampaignPanel } from '@/components/LandingCampaignPanel'
import { PersistentPlayModal } from '@/components/PersistentPlayModal'
import { AdSenseSlot } from '@/components/ads/AdSenseSlot'

const differences = [
  {
    title: 'I think campaigns should last.',
    persistentPlay: true,
    copy: 'I wanted to be able to take a character from level 1 to level 20 without the beginning of the campaign disappearing behind me. If, 2,000 turns and 15 levels later, I need the name of the conductor on the first train my party ever rode, I want the AIGM to be able to go back and find it.',
  },
  {
    title: 'I think everything you spend should go into your play.',
    copy: 'There is no monthly subscription and no cut-rate AI tier. Everyone gets the same high-level AIGM. The money you buy for usage goes exclusively toward the AI you actually use. The only additional costs are payment processing and the minor expense of keeping RPG Your Way running. What you buy stays yours until you use it.',
  },
  {
    title: 'I wanted a Game Master with secrets.',
    copy: 'So I built one that will make plans you don’t know about, keep information from you that only the GM should know, and set things in motion behind the scenes. You may chase those threads, ignore them, or stumble into them much later, but they’re there to give the campaign a spine.',
  },
  {
    title: 'Then I realized we could turn the campaign into a story.',
    copy: 'Because RPG Your Way preserves the raw chat data from your game, Script can turn the adventure you actually played into readable fiction. You can keep the story of a favorite campaign, read it later, or use it to catch up on a multiplayer session you missed instead of digging through hundreds of turns of chat.',
  },
]

const features = [
  {
    eyebrow: 'Your campaign',
    title: 'Play when you have time',
    copy: 'Play a long-running campaign without waiting for everybody to be free at the same time.',
  },
  {
    eyebrow: 'Your party',
    title: 'Bring the characters you want',
    copy: 'Play one character or run a party of up to six. Bring the characters you want and make the campaign yours.',
  },
  {
    eyebrow: 'Your pace',
    title: 'Type, speak, read, or listen',
    copy: 'Type or talk to your Game Master. Read the reply or have it read aloud. Play whichever way is easiest for you.',
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
    persistentPlay: true,
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
  persistentPlay?: boolean
}

function NestedAccordionList({ items, initiallyOpen = false }: { items: AccordionItem[]; initiallyOpen?: boolean }) {
  return (
    <div className="audience-list">
      {items.map((item) => (
        <details className="audience-item" key={item.title} open={initiallyOpen}>
          <summary>
            <span>{item.title}</span>
            <AccordionPlus />
          </summary>
          <div className="nested-accordion-copy">
            {item.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {item.note ? <p className="builder-note"><em>{item.note}</em></p> : null}
            {item.persistentPlay ? <PersistentPlayModal /> : null}
          </div>
        </details>
      ))}
    </div>
  )
}

function WhyCreatedAccordion() {
  return (
    <details className="landing-accordion unique-accordion" open>
      <summary className="landing-accordion-summary">
        <span className="landing-accordion-prompt">Why I created RPG Your Way.</span>
        <AccordionPlus />
      </summary>
      <div className="landing-accordion-body unique-body">
        <NestedAccordionList items={whyCreated} initiallyOpen />
      </div>
    </details>
  )
}

function AudienceAccordion() {
  return (
    <details className="landing-accordion audience-accordion" open>
      <summary className="landing-accordion-summary audience-summary">
        <span className="landing-accordion-prompt audience-prompt">Who benefits from this site?</span>
        <AccordionPlus />
      </summary>
      <div className="landing-accordion-body audience-body">
        <NestedAccordionList items={audiences} initiallyOpen />
      </div>
    </details>
  )
}

function DifferenceSection() {
  return (
    <section className="landing-difference-section" aria-labelledby="landing-difference-heading">
      <div className="shell landing-difference-plaque">
        <div className="landing-difference-nameplate">
          <h2 id="landing-difference-heading">Why would you spend your money at RPG Your Way?</h2>
        </div>

        <div className="landing-difference-intro">
          <p>
            <strong>This site isn’t trying to make a profit. I’m a gamer offering a service to other gamers.</strong>{' '}
            I built the kind of AI RPG experience I wanted to play myself, and I’m making that same experience
            available to other players without turning it into another subscription machine.
          </p>
        </div>

        <div className="landing-difference-accordions">
          {differences.map((difference, index) => (
            <details className="landing-difference-item" key={difference.title}>
              <summary>
                <span><strong>{index + 1}.</strong> {difference.title}</span>
                <AccordionPlus />
              </summary>
              <div className="landing-difference-copy">
                <p>{difference.copy}</p>
                {difference.persistentPlay ? (
                  <PersistentPlayModal
                    triggerLabel="Find Out More"
                    triggerClassName="landing-difference-more-button"
                  />
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <PageShell headerVariant="landing">
      <main id="main-content" tabIndex={-1}>
        <h1 className="sr-only">RPG Your Way: Your AI GM</h1>
        <AdSenseSlot placement="landing" />

        <DifferenceSection />

        <section className="landing-news-section" aria-labelledby="landing-news-heading">
          <div className="shell landing-news-panel">
            <div className="landing-news-header">
              <p className="landing-news-eyebrow">
                <Megaphone aria-hidden="true" />
                <span>News</span>
              </p>
              <p className="landing-news-deck">The latest happenings here at RPG Your Way</p>
            </div>
            <h2 id="landing-news-heading" className="sr-only">RPG Your Way news</h2>
            <div className="landing-news-headlines">
              <p className="landing-news-line">
                <strong>Reduction in prices, yay!</strong>
                <span className="landing-news-separator" aria-hidden="true">•</span>
                <span>Multiplayer is live, with built-in table chat.</span>
              </p>
              <p className="landing-news-line">
                <span className="landing-news-separator" aria-hidden="true">•</span>
                <strong>In the works: VTT Light</strong>
                <span>our native, no-third-party tactical sketch VTT.</span>
              </p>

              <p className="landing-news-line">
               <span className="landing-news-separator" aria-hidden="true">•</span>
               <strong>In the works: VTT Heavy</strong>
               <span>fully immersive VTT play through Foundry.</span>
              </p>
            </div>
          </div>
        </section>

        <section className="landing-return-section landing-return-section--hero" aria-label="Start or return to a campaign">
          <div className="shell landing-return-grid">
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

            <div className="landing-player-stack">
              <Link className="landing-new-player button button-secondary" href="/start">Start A New Campaign</Link>
              <LandingCampaignPanel />
            </div>
          </div>
        </section>

        <section className="landing-reasons-section" aria-labelledby="landing-reasons-heading">
          <h2 id="landing-reasons-heading" className="sr-only">Why RPG Your Way exists and who it benefits</h2>
          <div className="shell landing-reasons-grid">
            <div className="landing-reason-card landing-reason-created" aria-label="Why I created RPG Your Way">
              <WhyCreatedAccordion />
            </div>
            <div className="landing-reason-card landing-reason-audience" aria-label="Who benefits from this site?">
              <AudienceAccordion />
            </div>
          </div>
        </section>

        <section className="feature-section" aria-labelledby="landing-features-heading">
          <h2 id="landing-features-heading" className="sr-only">RPG Your Way features</h2>
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
