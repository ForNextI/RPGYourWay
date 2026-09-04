import { PageShell } from '@/components/PageShell'
import { ShapeSignInGate } from '@/components/ShapeSignInGate'
import { ShapeWorkspace } from '@/components/ShapeWorkspace'
import { AdSenseSlot } from '@/components/ads/AdSenseSlot'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Script',
  description: 'Turn the tabletop campaign you played into narrative prose.',
}

export default async function ScriptPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main shape-main">
        <AdSenseSlot placement="script" />
        <div className="shell shape-shell">
          <section className="shape-intro">
            <p className="kicker">Script</p>
            <h1 className="page-title shape-script-title">Turn the campaign you played into a story you can read.</h1>
            <p className="page-lede">Give Script a digital record of a campaign you played. It turns your play into readable third-person prose, keeping the story while removing dice math, table chatter, and other gameplay clutter.</p>
            <p className="shape-limit-note"><strong>Up to 1,000,000 characters per Script request.</strong> Larger campaigns can be split at natural story breaks and continued as one project.</p>

            <details className="shape-pricing-details">
              <summary>How Script uses your RPG Your Way balance <span className="accordion-plus" aria-hidden="true" /></summary>
              <div className="shape-pricing-copy">
                <p>Script uses the <strong>same prepaid RPG Your Way usage balance as Play</strong>.</p>
                <p>Before processing begins, Script shows a <strong>maximum estimated balance deduction</strong>. The finished request can cost less, but it will never deduct more than that maximum.</p>
                <p>Transcript size, continuity work, writing sections, description level, and the actual AI processing required can affect the deduction. Failed provider calls are not charged. If a completed request unexpectedly costs more than its estimate, RPG Your Way absorbs the difference rather than exceeding the approved maximum.</p>
              </div>
            </details>
          </section>

          {!user ? <ShapeSignInGate /> : <ShapeWorkspace />}
        </div>
      </main>
    </PageShell>
  )
}
