import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { FoundryPlayerLinkApproval } from '@/components/foundry/FoundryPlayerLinkApproval'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Link Foundry Player',
  description: 'Link a Foundry VTT player user to an RPG Your Way account.',
}
export const dynamic = 'force-dynamic'

export default async function FoundryPlayerLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const params = await searchParams
  const code = typeof params.code === 'string' ? params.code : ''
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const returnTo = code
    ? `/foundry/link-player?code=${encodeURIComponent(code)}`
    : '/foundry/link-player'

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main multiplayer-page-main">
        <div className="shell multiplayer-page-shell">
          <section className="multiplayer-page-intro" aria-labelledby="foundry-player-page-heading">
            <p className="kicker">Virtual tabletop</p>
            <h1 id="foundry-player-page-heading" className="page-title">Link Foundry Player</h1>
            <p className="page-lede">This one-time approval identifies which RPG Your Way account belongs to this Foundry player user.</p>
          </section>

          {!user ? (
            <section className="multiplayer-signin-card" aria-labelledby="foundry-player-signin-heading">
              <h2 id="foundry-player-signin-heading">Sign in to approve the player link.</h2>
              <p>After signing in, RPG Your Way will verify that your account belongs to the campaign already connected to this Foundry world.</p>
              <AuthPanel returnTo={returnTo} />
            </section>
          ) : (
            <FoundryPlayerLinkApproval initialCode={code} />
          )}
        </div>
      </main>
    </PageShell>
  )
}
