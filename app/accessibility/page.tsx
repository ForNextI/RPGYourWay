import { PageShell } from '@/components/PageShell'
import { AdSenseSlot } from '@/components/ads/AdSenseSlot'

export const metadata = {
  title: 'Accessibility',
  description: 'Accessibility information for RPG Your Way, including keyboard, screen-reader, voice, and reduced-motion support.',
}

export default function AccessibilityPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <AdSenseSlot placement="accessibility" />
        <div className="shell narrow-shell prose-page accessibility-page">
          <p className="kicker">Accessibility</p>
          <h1 className="page-title">RPG Your Way should be playable your way.</h1>
          <p className="page-lede">RPG Your Way is being built toward <abbr title="Web Content Accessibility Guidelines">WCAG</abbr> 2.2 Level AA and is designed to work with keyboard navigation, screen readers, voice input, spoken Game Master replies, browser zoom, and reduced-motion preferences.</p>

          <section aria-labelledby="accessibility-features-heading">
            <h2 id="accessibility-features-heading">What is built in</h2>
            <ul>
              <li>A skip link and semantic page landmarks for keyboard and screen-reader navigation.</li>
              <li>Visible keyboard focus, keyboard-operable controls, and non-drag alternatives for character reordering.</li>
              <li>Named form controls, live status and error announcements, and focus-managed modal dialogs.</li>
              <li>Reduced-motion support that follows the device setting, with an override available in Play.</li>
              <li>Voice-guided Play for blind players, screen-reader users, and anyone who prefers step-by-step spoken interaction.</li>
              <li>Talk-to-text for player input and AI-generated spoken readback for Game Master responses.</li>
            </ul>
          </section>

          <section aria-labelledby="accessibility-testing-heading">
            <h2 id="accessibility-testing-heading">Testing and conformance</h2>
            <p>Accessibility is an ongoing engineering requirement, not a badge we award ourselves. Automated source checks are part of the release process, and the site is also intended to be checked with keyboard-only use, browser zoom and reflow, reduced motion, high-contrast modes, and common screen-reader/browser combinations.</p>
            <p>Because assistive technologies, browsers, third-party payment pages, and AI-generated game content can behave differently, this page does not claim independent certification or perfect compatibility with every setup.</p>
          </section>

          <section aria-labelledby="accessibility-help-heading">
            <h2 id="accessibility-help-heading">If something gets in your way</h2>
            <p>Please tell us what page or control caused the problem, what assistive technology or browser you were using if you know it, and what you were trying to do. You do not need to diagnose the technical cause.</p>
            <p><a href="mailto:brett@rpgyourway.com">Email accessibility feedback to brett@rpgyourway.com</a>.</p>
          </section>
        </div>
      </main>
    </PageShell>
  )
}
