import { PageShell } from '@/components/PageShell'
import { ShapeSignInGate } from '@/components/ShapeSignInGate'
import { ShapeWorkspace } from '@/components/ShapeWorkspace'
import { shapeAccessConfigured, shapeEmailAllowed } from '@/lib/shape/access'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Shape',
  description: 'Turn the tabletop campaign you played into narrative prose.',
}

export default async function ShapePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main shape-main">
        <div className="shell shape-shell">
          <section className="shape-intro">
            <p className="kicker">Shape</p>
            <h1 className="page-title">Turn the campaign you played into the story you can read.</h1>
            <p className="page-lede">Give Shape a raw tabletop transcript. It works out what actually happened, removes the dice arithmetic and table chatter, keeps the chronology straight, and writes the adventure as third-person narrative prose.</p>
            <p className="shape-limit-note"><strong>Up to 1,000,000 characters per Shape request.</strong> Larger campaigns can be divided at natural story breaks and carried forward as an ongoing campaign project.</p>

            <div className="shape-steps" aria-label="How Shape works">
              <div><strong>1</strong><span>Add the transcript</span><small>Paste it, upload a text file, or use a WardensPC campaign export.</small></div>
              <div><strong>2</strong><span>Choose the prose</span><small>Pick the amount of description and, for a long campaign, keep continuity across parts.</small></div>
              <div><strong>3</strong><span>Shape and download</span><small>Long jobs checkpoint to your account so a refresh or temporary failure does not start them over.</small></div>
            </div>

            <details className="shape-pricing-details">
              <summary>How Shape uses your RPG Your Way balance</summary>
              <div className="shape-pricing-copy">
                <p><strong>Private testing is running now, and no payment is collected during these tests.</strong> We are recording real input, cached-input, and output token usage so the final deduction formula is based on actual Shape jobs rather than guesses.</p>
                <p>Shape will use the <strong>same prepaid RPG Your Way usage balance as Play</strong>. There is no separate Shape wallet and no separate Shape Pack to buy.</p>
                <p>Before a paid Shape request begins, Shape will show a <strong>maximum estimated balance deduction</strong>. The finished request can cost less, but it will never deduct more than that maximum.</p>
                <p>Transcript size, continuity work, writing sections, description level, and the actual AI processing required can affect the deduction. A failed processing step will not become a customer charge. Stripe funding is the next payment step; the shared balance is being built first.</p>
              </div>
            </details>
          </section>

          {!user ? <ShapeSignInGate /> : (
            <ShapeWorkspace
              accessAllowed={shapeEmailAllowed(user.email)}
              accessConfigured={shapeAccessConfigured()}
            />
          )}
        </div>
      </main>
    </PageShell>
  )
}
