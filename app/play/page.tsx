import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { RpgywPlayEntry } from '@/components/aigm/rpgyw-play-entry'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Play' }
export const dynamic = 'force-dynamic'

export default async function PlayPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    return (
      <PageShell variant="play">
        <main id="main-content" tabIndex={-1} className="inner-main">
          <div className="shell narrow-shell play-signin-shell">
            <p className="kicker">Play</p>
            <h1 className="page-title">Sign in to play.</h1>
            <p className="page-lede">Existing WardensPC adventures can be imported after you sign in. Campaign files stay in your browser; your RPG Your Way account supplies the shared usage balance.</p>
            <AuthPanel returnTo="/play" />
          </div>
        </main>
      </PageShell>
    )
  }

  return <RpgywPlayEntry />
}
