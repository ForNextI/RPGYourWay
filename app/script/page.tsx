import { PageShell } from '@/components/PageShell'
import { ShapeSignInGate } from '@/components/ShapeSignInGate'
import { ShapeWorkspace } from '@/components/ShapeWorkspace'
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
        <div className="shell shape-shell">
          <section className="shape-intro">
            <p className="kicker">Script</p>
            <h1 className="page-title">Turn the campaign you played into the story you can read.</h1>
            <p className="page-lede">Give Script a raw tabletop transcript. It works out what actually happened, removes the dice arithmetic and table chatter, keeps the chronology straight, and writes the adventure as third-person narrative prose.</p>
            <p className="shape-limit-note"><strong>Up to 1,000,000 characters per Script request.</strong> Larger campaigns can be divided at natural story breaks and carried forward as an ongoing campaign project.</p>

            <div className="shape-steps" aria-label="How Script works">
              <div><strong>1</strong><span>Add the transcript</span><small>Paste it, upload a text file, or use a WardensPC campaign export.</small></div>
              <div><strong>2</strong><span>See the maximum</span><small>Script shows the most this request can deduct before you approve it.</small></div>
              <div><strong>3</strong><span>Script and download</span><small>Only successful metered AI processing is charged, and long jobs checkpoint to your account.</small></div>
            </div>

            <details className="shape-pricing-details">
              <summary>How Script uses your RPG Your Way balance</summary>
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
