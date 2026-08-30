import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { MultiplayerCampaignManager } from '@/components/multiplayer/MultiplayerCampaignManager'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Multiplayer',
  description: 'Manage RPG Your Way multiplayer campaigns and virtual tabletop connections.',
}
export const dynamic = 'force-dynamic'

export default async function MultiplayerPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main multiplayer-page-main">
        <div className="shell multiplayer-page-shell">
          <section className="multiplayer-page-intro" aria-labelledby="multiplayer-page-heading">
            <p className="kicker">Multiplayer</p>
            <h1 id="multiplayer-page-heading" className="page-title">Multiplayer</h1>
            <p className="multiplayer-page-notice"><strong>This page is for controlling multiplayer and VTT.</strong> If you&apos;re creating a campaign that uses those, you will do so in Start, as part of the normal campaign creation workflow.</p>
            <p className="page-lede">Use this page after creation to continue campaigns, manage native multiplayer membership and campaign decisions, and, soon, connect virtual tabletop tools.</p>
            <details className="multiplayer-catchup-tip">
              <summary>Hey, did you miss a session or two? Click here for a key trick.</summary>
              <div className="multiplayer-catchup-tip-body">
                <p>If you missed some gameplay, go to the bottom of the Play page, open <strong>Session tools</strong>, and choose <strong>Download transcript</strong>. Find the section that covers the time you missed and copy that section into a new document.</p>
                <p>Then take that new document to <strong>Script</strong> and paste or upload it there. Script can turn the missed gameplay into third-person narrative prose, which can make catching up much more pleasant. If you would rather read the raw transcript, that is what the downloaded transcript is there for too.</p>
              </div>
            </details>
          </section>

          {!user ? (
            <section className="multiplayer-signin-card" aria-labelledby="multiplayer-signin-heading">
              <h2 id="multiplayer-signin-heading">Sign in to manage multiplayer.</h2>
              <p>Multiplayer campaigns and their membership controls belong to your RPG Your Way account.</p>
              <AuthPanel returnTo="/multiplayer" />
            </section>
          ) : (
            <>
              <MultiplayerCampaignManager />
              <section className="multiplayer-vtt-card" aria-labelledby="multiplayer-vtt-heading">
                <p className="kicker">Virtual tabletop</p>
                <h2 id="multiplayer-vtt-heading">VTT connections are coming next.</h2>
                <p>This will be the home for RPG Your Way&apos;s connections to existing virtual tabletop platforms. Campaign creation will still begin in Start; VTT setup and management will live here.</p>
                <div className="multiplayer-vtt-coming-soon" role="status">Coming soon</div>
              </section>
            </>
          )}
        </div>
      </main>
    </PageShell>
  )
}
