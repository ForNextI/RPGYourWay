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
            <h1 className="page-title">Turn the campaign into the story.</h1>
            <p className="page-lede">Shape reads the campaign you actually played, works out what happened across the full submission, and turns it into third-person narrative prose without the dice arithmetic, rules chatter, corrections, and other transcript debris.</p>
            <div className="shape-intro-notes">
              <p><strong>Long campaigns are welcome.</strong> A single Shape request can accept up to 1,000,000 characters and uses continuity analysis plus overlapping writing sections when the transcript is too large for one pass.</p>
              <p><strong>Your progress is durable.</strong> Once a job starts, its transcript, continuity ledger, writing checkpoints, and finished prose live with your account in Supabase rather than only in this browser tab.</p>
            </div>
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
