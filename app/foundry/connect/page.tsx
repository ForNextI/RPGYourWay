import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { FoundryPairingApproval } from '@/components/foundry/FoundryPairingApproval'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Connect Foundry VTT',
  description: 'Approve a Foundry VTT world connection to an RPG Your Way campaign.',
}
export const dynamic = 'force-dynamic'

export default async function FoundryConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const params = await searchParams
  const code = typeof params.code === 'string' ? params.code : ''
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const returnTo = code ? `/foundry/connect?code=${encodeURIComponent(code)}` : '/foundry/connect'

  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main multiplayer-page-main">
        <div className="shell multiplayer-page-shell">
          <section className="multiplayer-page-intro" aria-labelledby="foundry-page-heading">
            <p className="kicker">Virtual tabletop</p>
            <h1 id="foundry-page-heading" className="page-title">Connect Foundry VTT</h1>
            <p className="page-lede">This one-time approval links the running Foundry world to one RPG Your Way cloud campaign.</p>
          </section>

          {!user ? (
            <section className="multiplayer-signin-card" aria-labelledby="foundry-signin-heading">
              <h2 id="foundry-signin-heading">Sign in to approve the connection.</h2>
              <p>After signing in, you will choose which campaign this Foundry world should use.</p>
              <AuthPanel returnTo={returnTo} />
            </section>
          ) : (
            <FoundryPairingApproval initialCode={code} />
          )}
        </div>
      </main>
    </PageShell>
  )
}
