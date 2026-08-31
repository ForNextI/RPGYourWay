import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { FoundryConnectionsPanel } from '@/components/foundry/FoundryConnectionsPanel'
import { MultiplayerCampaignManager } from '@/components/multiplayer/MultiplayerCampaignManager'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Campaigns',
  description: 'Open and manage RPG Your Way campaigns, multiplayer controls, and virtual tabletop connections.',
}
export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main multiplayer-page-main">
        <div className="shell multiplayer-page-shell">
          <section className="multiplayer-page-intro" aria-labelledby="campaigns-page-heading">
            <p className="kicker">Campaigns</p>
            <h1 id="campaigns-page-heading" className="page-title">Campaigns</h1>
            <p className="multiplayer-page-notice"><strong>This is the home for all of your saved campaigns.</strong> Solo and multiplayer campaigns live together here. Multiplayer administration and VTT connections are campaign tools, not separate kinds of storage.</p>
            <p className="page-lede">Continue an older adventure, manage a shared campaign, or connect a campaign to a supported virtual tabletop.</p>
            <details className="multiplayer-catchup-tip">
              <summary>Hey, did you miss a session or two? Click here for a cute trick.</summary>
              <div className="multiplayer-catchup-tip-body">
                <p>If you missed some gameplay, go to the bottom of the Play page, open <strong>Session tools</strong>, and choose <strong>Download transcript</strong>. Find the section that covers the time you missed and copy that section into a new document.</p>
                <p>Then take that new document to <strong>Script</strong> and paste or upload it there. Script can turn the missed gameplay into third-person narrative prose, which can make catching up much more pleasant. If you would rather read the raw transcript, that is what the downloaded transcript is there for too.</p>
              </div>
            </details>
          </section>

          {!user ? (
            <section className="multiplayer-signin-card" aria-labelledby="campaigns-signin-heading">
              <h2 id="campaigns-signin-heading">Sign in to see your campaigns.</h2>
              <p>Your cloud campaigns and their management controls belong to your RPG Your Way account.</p>
              <AuthPanel returnTo="/campaigns" />
            </section>
          ) : (
            <>
              <MultiplayerCampaignManager />
              <FoundryConnectionsPanel />
            </>
          )}
        </div>
      </main>
    </PageShell>
  )
}
